/**
 * Guards the import layer: the scraping, and the duplicate check the picker
 * runs over its results. Run with `npm run check:import`.
 */
import { decodeEntities, parseUgSearch } from "../src/lib/import";
import { textToChordPro, ugContentToChordPro } from "../src/lib/convert";
import { findDuplicate, LibraryEntry } from "../src/lib/duplicates";
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

// Ultimate Guitar writes outros as "|[ch]Am[/ch] [ch]D[/ch] |[ch]G[/ch]", so the
// bar ends up glued to the chord with no space between them.
eq("bar glued to the chord", textToChordPro("|Am D |G C |"), "[Am] [D] [G] [C]");
eq("trailing bars", textToChordPro("Am| C| G|"), "[Am] [C] [G]");
eq("repeat dots around a chord", textToChordPro("|:Am D :|"), "[Am] [D]");
eq(
  "glued bars in an Ultimate Guitar outro",
  ugContentToChordPro("|[ch]Am[/ch] [ch]D[/ch] |[ch]G[/ch] [ch]C[/ch] |[ch]Am[/ch] [ch]D[/ch] |[ch]G[/ch]   |"),
  "[Am] [D] [G] [C] [Am] [D] [G]",
);
// A glued bar shifts the chord one column right; dropping it must not drag the
// chord off the syllable it sat above.
eq(
  "glued bars above lyrics keep their column",
  textToChordPro("|Am  D  |G\nHello there now"),
  "H[Am]ello[D] the[G]re now",
);

console.log("Ultimate Guitar search…");
// The search page carries its results in the same entity-encoded data
// attribute the tab pages use, so accents arrive escaped here too.
function searchPage(rows: object[]): string {
  const json = JSON.stringify({ store: { page: { data: { results: rows } } } });
  return `<div class="js-store" data-content="${json.replace(/"/g, "&quot;")}"></div>`;
}
const tab = (id: number) => `https://tabs.ultimate-guitar.com/tab/jacques-brel/song-chords-${id}`;
const hits = parseUgSearch(
  searchPage([
    // No type: an advert for the paid apps, sitting above the real results.
    { marketing_type: "official", song_name: "Amsterdam", artist_name: "Jacques Brel" },
    { type: "Chords", song_name: "La Chanson Des Vieux Amants", artist_name: "Jacques Brel", version: 1, rating: 4.7, votes: 580, tonality_name: "Abm", tab_url: tab(1) },
    { type: "Bass Tabs", song_name: "Amsterdam", artist_name: "Jacques Brel", tab_url: tab(2) },
    { type: "Pro", song_name: "Amsterdam", artist_name: "Jacques Brel", tab_url: tab(3) },
    { type: "Ukulele Chords", song_name: "&Agrave; Jeun", artist_name: "Jacques Brel", version: 2, tab_url: tab(4) },
    // The same tab again: it matched on both the title and the artist.
    { type: "Chords", song_name: "La Chanson Des Vieux Amants", artist_name: "Jacques Brel", tab_url: tab(1) },
  ]),
);
eq("only chord sheets survive", hits.map((h) => h.type).join(", "), "Chords, Ukulele Chords");
eq("entities are decoded in results", hits[1].title, "À Jeun");
eq("duplicate tabs are dropped", String(hits.length), "2");
eq(
  "the fields the picker shows",
  `${hits[0].title} / ${hits[0].artist} / v${hits[0].version} / ${hits[0].key} / ${hits[0].rating} / ${hits[0].votes}`,
  "La Chanson Des Vieux Amants / Jacques Brel / v1 / Abm / 4.7 / 580",
);

console.log("Duplicate detection…");
const wonderwall = "https://tabs.ultimate-guitar.com/tab/oasis/wonderwall-chords-27596";
const library: LibraryEntry[] = [
  { id: "oasis-wonderwall", title: "Wonderwall", artist: "Oasis", sourceUrl: wonderwall },
  { id: "jeff-buckley-hallelujah", title: "Hallelujah", artist: "Jeff Buckley" },
  { id: "emile-bilodeau-ete-80", title: "Été '80", artist: "Émile Bilodeau" },
];
function duplicateOf(title: string, artist = "", sourceUrl?: string) {
  const match = findDuplicate(library, { title, artist, sourceUrl });
  return match ? `${match.kind} ${match.song.id}` : "none";
}
eq("the very same tab", duplicateOf("Wonderwall", "Oasis", wonderwall), "same-sheet oasis-wonderwall");
eq("a trailing slash is the same tab", duplicateOf("Wonderwall", "Oasis", `${wonderwall}/`), "same-sheet oasis-wonderwall");
// Ultimate Guitar lists every version separately, so this is the common case:
// a different tab of a song already in the library.
eq(
  "another version of the same song",
  duplicateOf("Wonderwall", "Oasis", "https://tabs.ultimate-guitar.com/tab/oasis/wonderwall-chords-1177425"),
  "same-song oasis-wonderwall",
);
eq("a version label doesn't hide it", duplicateOf("Wonderwall (Acoustic)", "Oasis"), "same-song oasis-wonderwall");
eq("case is ignored", duplicateOf("HALLELUJAH", "jeff buckley"), "same-song jeff-buckley-hallelujah");
eq("accents are ignored", duplicateOf("Ete '80", "Emile Bilodeau"), "same-song emile-bilodeau-ete-80");
// Pasted sheets often arrive as a title and nothing else.
eq("no artist to compare", duplicateOf("Hallelujah"), "same-song jeff-buckley-hallelujah");
eq("same title, different artist", duplicateOf("Hallelujah", "Leonard Cohen"), "none");
eq("a song we don't have", duplicateOf("Champagne Supernova", "Oasis"), "none");
eq("nothing to match on", duplicateOf("", "Oasis"), "none");

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
