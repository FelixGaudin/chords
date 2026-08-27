/**
 * Guards the scraping layer. Run with `npm run check:import`.
 */
import { decodeEntities } from "../src/lib/import";
import { textToChordPro, ugContentToChordPro } from "../src/lib/convert";
import { parseSheet } from "../src/lib/sheet";

let failures = 0;
function eq(label: string, actual: string, expected: string) {
  if (actual === expected) return;
  failures++;
  console.error(`  FAIL ${label}\n       got      ${JSON.stringify(actual)}\n       expected ${JSON.stringify(expected)}`);
}

console.log("HTML entities…");
// Accented names are the ones that matter: chord sites are full of them and a
// missed entity leaks raw "&Ccedil;" into a song title.
eq("uppercase C-cedilla", decodeEntities("&Ccedil;a va"), "Ça va");
eq("uppercase E-acute", decodeEntities("&Eacute;mile Bilodeau"), "Émile Bilodeau");
eq("lowercase accents", decodeEntities("&ccedil;a c&#39;est d&eacute;j&agrave; &ecirc;tre l&agrave;"), "ça c'est déjà être là");
eq("case is significant", decodeEntities("&Eacute; vs &eacute;"), "É vs é");
eq("more Latin-1", decodeEntities("&agrave;&acirc;&euml;&iuml;&ocirc;&ugrave;&ntilde;&Uuml;&szlig;&oslash;"), "àâëïôùñÜßø");
eq("ligatures", decodeEntities("s&oelig;ur &AElig;on"), "sœur Æon");
eq("typography", decodeEntities("don&rsquo;t &ldquo;stop&rdquo; &hellip; &mdash; &ndash; &bull;"), "don’t “stop” … — – •");
eq("currency and marks", decodeEntities("&euro;5 &copy; &trade; &deg; &laquo;x&raquo;"), "€5 © ™ ° «x»");
eq("ampersand and markup", decodeEntities("Simon &amp; Garfunkel &lt;b&gt;"), "Simon & Garfunkel <b>");
eq("numeric decimal and hex", decodeEntities("&#201;t&#233; &#x27;80"), "Été '80");
eq("astral codepoint", decodeEntities("&#x1F3B8;"), "🎸");
// Scraped pages often carry Windows-1252 bytes as numeric refs; browsers remap
// these, and without it an apostrophe becomes an invisible control character.
eq("cp1252 apostrophe", decodeEntities("don&#146;t"), "don’t");
eq("cp1252 dash", decodeEntities("a&#151;b"), "a—b");
eq("unknown entity is left alone", decodeEntities("&notareal; &"), "&notareal; &");

console.log("Chord sheet conversion…");
eq(
  "accents survive an Ultimate Guitar import",
  ugContentToChordPro("[tab][ch]Am[/ch]\r\nÇa va déjà[/tab]"),
  "[Am]Ça va déjà",
);
eq("chords above lyrics", textToChordPro("C       G\nHello there"), "[C]Hello th[G]ere");

console.log("Chord grids…");
// Bar lines are layout, not music: they shouldn't survive into the sheet.
eq("bars stripped", textToChordPro("| Am | C | D | F |"), "[Am] [C] [D] [F]");
eq("repeat barlines", textToChordPro("|: Am | C :|"), "[Am] [C]");
eq("grid with repeat count", textToChordPro("| Em   | Em   | Am   | C    |  x2"), "[Em] [Em] [Am] [C] x2");
// Dropping the bars must not shift the chords: Am sits at column 2 and C at
// column 11, so they still land on the same letters they sat above.
eq(
  "bars above lyrics vanish without moving the chords",
  textToChordPro("| Am     | C\nHello there now"),
  "He[Am]llo there[C] now",
);
eq(
  "bars in an Ultimate Guitar grid",
  ugContentToChordPro("| [ch]Am[/ch] | [ch]C[/ch] | x2"),
  "[Am] [C] x2",
);
// An aside is prose and keeps its spacing, unlike a bare grid.
eq(
  "aside still preserved",
  ugContentToChordPro("[ch]C[/ch]   [ch]G[/ch]  (let it ring)"),
  "[C]   [G]  (let it ring)",
);

console.log("Repeat markers…");
function repeatOf(source: string) {
  const line = parseSheet(source).sections[0]?.lines[0];
  if (!line || line.kind !== "lyrics") return "not a lyric line";
  const text = line.chunks.map((c) => c.text).join("").trim();
  return `repeat=${line.repeat ?? "none"} chords=${line.chunks.map((c) => c.chord).filter(Boolean).join(",")} leftoverText=${JSON.stringify(text)}`;
}
eq("x2 becomes a repeat count", repeatOf("[Em] [Am] x2"), 'repeat=2 chords=Em,Am leftoverText=""');
eq("2x spelling", repeatOf("[Em] [Am] 2x"), 'repeat=2 chords=Em,Am leftoverText=""');
eq("parenthesised", repeatOf("[C] [G] (x4)"), 'repeat=4 chords=C,G leftoverText=""');
eq("uppercase X", repeatOf("[C] [G] X3"), 'repeat=3 chords=C,G leftoverText=""');
eq("no marker", repeatOf("[C] [G]"), 'repeat=none chords=C,G leftoverText=""');
eq("lyrics are never a repeat", repeatOf("[C]I have x2 apples"), 'repeat=none chords=C leftoverText="I have x2 apples"');

if (failures) {
  console.error(`\n${failures} failures.`);
  process.exit(1);
}
console.log("\nImport layer OK.");
