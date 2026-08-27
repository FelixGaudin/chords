/**
 * Guards the scraping layer. Run with `npm run check:import`.
 */
import { decodeEntities } from "../src/lib/import";
import { textToChordPro, ugContentToChordPro } from "../src/lib/convert";

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

if (failures) {
  console.error(`\n${failures} failures.`);
  process.exit(1);
}
console.log("\nImport layer OK.");
