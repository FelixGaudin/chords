/** Fetches a song page and reduces it to title, artist and a ChordPro body. */
import { textToChordPro, ugContentToChordPro } from "./convert";
import { looksLikeChordLine } from "./music";

export interface ImportResult {
  title: string;
  artist: string;
  source: string;
  key?: string;
  capo?: number;
  sourceUrl: string;
  /** Which strategy produced the result, shown to the user. */
  via: string;
}

export class ImportError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
  }
}

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchPage(url: string, allowNotFound = false): Promise<{ body: string; contentType: string }> {
  let res: Response;
  try {
    res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow", signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    throw new ImportError(
      `Could not reach ${new URL(url).hostname}`,
      err instanceof Error ? err.message : undefined,
    );
  }
  if (!res.ok && !(allowNotFound && res.status === 404)) {
    throw new ImportError(
      `${new URL(url).hostname} replied ${res.status}`,
      res.status === 403 || res.status === 429
        ? "The site is blocking automated requests. Open the page in your browser and paste the text instead."
        : undefined,
    );
  }
  return { body: await res.text(), contentType: res.headers.get("content-type") ?? "" };
}

/**
 * Latin-1 entity names, in code-point order from 160 (nbsp) to 255 (yuml).
 * Listing them positionally keeps the table honest — chord sites are full of
 * accents, and a name we don't know leaks through as raw "&Ccedil;" text.
 */
const LATIN1_NAMES =
  "nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 " +
  "acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde " +
  "Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute " +
  "Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde " +
  "auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute " +
  "ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml";

const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  amp: "&",
  apos: "'",
  lt: "<",
  gt: ">",
  OElig: "\u0152",
  oelig: "\u0153",
  Scaron: "\u0160",
  scaron: "\u0161",
  Yuml: "\u0178",
  fnof: "\u0192",
  circ: "\u02c6",
  tilde: "\u02dc",
  ensp: "\u2002",
  emsp: "\u2003",
  thinsp: "\u2009",
  ndash: "\u2013",
  mdash: "\u2014",
  lsquo: "\u2018",
  rsquo: "\u2019",
  sbquo: "\u201a",
  ldquo: "\u201c",
  rdquo: "\u201d",
  bdquo: "\u201e",
  dagger: "\u2020",
  Dagger: "\u2021",
  bull: "\u2022",
  hellip: "\u2026",
  permil: "\u2030",
  prime: "\u2032",
  Prime: "\u2033",
  lsaquo: "\u2039",
  rsaquo: "\u203a",
  oline: "\u203e",
  frasl: "\u2044",
  euro: "\u20ac",
  trade: "\u2122",
};
LATIN1_NAMES.split(" ").forEach((name, i) => {
  NAMED_ENTITIES[name] = String.fromCharCode(160 + i);
});

/**
 * Pages served as Windows-1252 leak these as numeric references. Unicode calls
 * 128-159 control characters, so without the remap a curly apostrophe imports
 * as an invisible character. Browsers do the same substitution.
 */
const CP1252: Record<number, number> = {
  128: 0x20ac, 130: 0x201a, 131: 0x0192, 132: 0x201e, 133: 0x2026, 134: 0x2020, 135: 0x2021,
  136: 0x02c6, 137: 0x2030, 138: 0x0160, 139: 0x2039, 140: 0x0152, 142: 0x017d, 145: 0x2018,
  146: 0x2019, 147: 0x201c, 148: 0x201d, 149: 0x2022, 150: 0x2013, 151: 0x2014, 152: 0x02dc,
  153: 0x2122, 154: 0x0161, 155: 0x203a, 156: 0x0153, 158: 0x017e, 159: 0x0178,
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (full, name: string) => {
    if (name[0] === "#") {
      const hex = name[1] === "x" || name[1] === "X";
      const code = parseInt(hex ? name.slice(2) : name.slice(1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return full;
      return String.fromCodePoint(CP1252[code] ?? code);
    }
    // Entity names are case-sensitive — &Eacute; and &eacute; are different
    // letters — so an exact match has to win before any leniency.
    return NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()] ?? full;
  });
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  );
}

function pageTitle(html: string): string {
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (h1) return stripTags(h1[1]).trim();
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return t ? decodeEntities(t[1]).trim() : "";
}

/** "Song Name Chords by Artist | Site" -> { title, artist } */
function splitTitle(raw: string): { title: string; artist: string } {
  let s = raw.split("|")[0].split(" - Ultimate")[0].trim();
  s = s.replace(/\s*\(?(chords|tabs?|lyrics|guitar chords|ukulele chords)\)?\s*$/i, "");
  const by = /^(.*?)\s+(?:chords|tab|lyrics)?\s*by\s+(.+)$/i.exec(s);
  if (by) return { title: by[1].replace(/\s*(chords|tab|lyrics)\s*$/i, "").trim(), artist: by[2].trim() };
  const dash = /^(.*?)\s+[-–—]\s+(.*)$/.exec(s);
  if (dash) return { title: dash[2].trim(), artist: dash[1].trim() };
  return { title: s, artist: "" };
}

/** Ultimate Guitar ships its page state as JSON in a data attribute. */
function ugStore<T>(html: string): T {
  const m = /<div[^>]+class="js-store"[^>]+data-content="([^"]*)"/i.exec(html);
  if (!m) throw new ImportError("Ultimate Guitar page had no data we could read", "The page layout may have changed.");
  try {
    return JSON.parse(decodeEntities(m[1])) as T;
  } catch {
    throw new ImportError("Could not read Ultimate Guitar's page data");
  }
}

interface UgStore {
  store?: {
    page?: {
      data?: {
        tab?: { song_name?: string; artist_name?: string; tonality_name?: string; capo?: number };
        tab_view?: {
          wiki_tab?: { content?: string };
          meta?: { capo?: number; tonality?: string };
        };
      };
    };
  };
}

function importUltimateGuitar(html: string, url: string): ImportResult {
  const page = ugStore<UgStore>(html).store?.page?.data;
  const content = page?.tab_view?.wiki_tab?.content;
  if (!content) {
    throw new ImportError(
      "That Ultimate Guitar page has no chord sheet",
      "Official/Pro tabs are interactive and can't be imported. Look for a plain 'Chords' version.",
    );
  }

  const source = ugContentToChordPro(content);
  if (!/\[[^\]]+\]/.test(source)) {
    throw new ImportError("That page looks like a tab, not a chord sheet", "This library only handles chords.");
  }

  return {
    title: page?.tab?.song_name?.trim() || splitTitle(pageTitle(html)).title,
    artist: page?.tab?.artist_name?.trim() || "",
    source,
    key: page?.tab_view?.meta?.tonality || page?.tab?.tonality_name || undefined,
    capo: page?.tab_view?.meta?.capo ?? page?.tab?.capo ?? undefined,
    sourceUrl: url,
    via: "Ultimate Guitar",
  };
}

export interface SearchHit {
  title: string;
  artist: string;
  url: string;
  /** "Chords" or "Ukulele Chords" — the two kinds this library can read. */
  type: string;
  version: number;
  rating: number;
  votes: number;
  key?: string;
}

interface UgSearchRow {
  type?: string;
  song_name?: string;
  artist_name?: string;
  tab_url?: string;
  version?: number;
  rating?: number;
  votes?: number;
  tonality_name?: string;
}

interface UgSearchStore {
  store?: { page?: { data?: { results?: UgSearchRow[] } } };
}

const SEARCHABLE_TYPES = new Set(["Chords", "Ukulele Chords"]);

/** Chord sheets, in Ultimate Guitar's own order, from a search results page. */
export function parseUgSearch(html: string): SearchHit[] {
  const rows = ugStore<UgSearchStore>(html).store?.page?.data?.results ?? [];
  const hits: SearchHit[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    // Rows with no type are adverts for the paid apps; the typed ones cover
    // tablature, bass, drums and video too, none of which this library reads.
    if (!row.type || !SEARCHABLE_TYPES.has(row.type)) continue;
    // Every version of a song comes back separately, but the same tab can
    // appear twice when it matched on both title and artist.
    if (!row.tab_url || seen.has(row.tab_url)) continue;
    seen.add(row.tab_url);
    hits.push({
      title: row.song_name?.trim() ?? "",
      artist: row.artist_name?.trim() ?? "",
      url: row.tab_url,
      type: row.type,
      version: row.version ?? 1,
      rating: row.rating ?? 0,
      votes: row.votes ?? 0,
      key: row.tonality_name || undefined,
    });
  }
  return hits;
}

/** Searches Ultimate Guitar by song title, artist, or both at once. */
export async function searchUltimateGuitar(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(q)}`;
  // A search that matches nothing answers 404, with an empty result set in the
  // page as usual — that's an empty list, not a failure.
  return parseUgSearch((await fetchPage(url, true)).body);
}

/** The span of a page's text between its first and last chord line. */
function chordRegion(text: string): string | null {
  const lines = text.split("\n");
  const flags = lines.map((l) => looksLikeChordLine(l));
  const count = flags.filter(Boolean).length;
  if (count < 4) return null;
  const first = flags.indexOf(true);
  const last = flags.lastIndexOf(true);
  return lines.slice(first, last + 2).join("\n");
}

/** Most chord sites keep the sheet inside <pre>; take the biggest such block. */
function importGeneric(html: string, url: string): ImportResult {
  const cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");

  const blocks = [...cleaned.matchAll(/<pre[^>]*>([\s\S]*?)<\/pre>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((t) => t.trim().length > 40)
    .sort((a, b) => b.length - a.length);

  let body = blocks[0] ?? "";
  if (!body) {
    // No <pre>: fall back to the largest block that a chord-ish class marks up.
    const div = [...cleaned.matchAll(/<(div|section)[^>]*class="[^"]*(chord|lyric|song|tab)[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi)]
      .map((m) => stripTags(m[3]))
      .filter((t) => t.trim().length > 40)
      .sort((a, b) => b.length - a.length);
    body = div[0] ?? "";
  }
  if (!body.trim()) {
    // Last resort: read the whole page as text and keep the stretch of lines
    // that actually contains chords. Column alignment is usually lost here,
    // so this only fires when the structured attempts found nothing.
    body = chordRegion(stripTags(cleaned)) ?? "";
  }
  if (!body.trim()) {
    throw new ImportError(
      "No chord sheet found on that page",
      "Copy the chords from the page and use the Paste tab instead.",
    );
  }

  const source = textToChordPro(body);
  if (!/\[[^\]]+\]/.test(source)) {
    throw new ImportError("Found text but no chords on that page", "Use the Paste tab if the layout is unusual.");
  }

  const { title, artist } = splitTitle(pageTitle(cleaned));
  return { title, artist, source, sourceUrl: url, via: new URL(url).hostname.replace(/^www\./, "") };
}

export async function importFromUrl(rawUrl: string): Promise<ImportResult> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new ImportError("That doesn't look like a URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new ImportError("Only http and https links work");

  const { body, contentType } = await fetchPage(url.toString());

  if (contentType.includes("text/plain")) {
    const { title, artist } = splitTitle(url.pathname.split("/").pop() ?? "");
    return { title, artist, source: textToChordPro(body), sourceUrl: url.toString(), via: "plain text" };
  }

  const host = url.hostname.replace(/^www\./, "");
  if (host.endsWith("ultimate-guitar.com")) return importUltimateGuitar(body, url.toString());
  return importGeneric(body, url.toString());
}

/**
 * Pulls a leading "Title / Artist" header off pasted text. Only fires when a
 * blank line closes the header, which is what separates a real heading from
 * the first line of lyrics.
 */
function takeHeading(text: string): { title: string; artist: string; rest: string } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;

  const header: string[] = [];
  while (i < lines.length && header.length < 2) {
    const line = lines[i].trim();
    if (!line) break;
    if (line.length > 60 || looksLikeChordLine(line) || /^[[(]/.test(line)) break;
    header.push(line);
    i++;
  }
  // The blank line is the proof; without it these are just lyrics.
  if (!header.length || i >= lines.length || lines[i].trim()) {
    return { title: "", artist: "", rest: text };
  }
  return {
    title: header[0],
    artist: (header[1] ?? "").replace(/^by\s+/i, "").trim(),
    rest: lines.slice(i).join("\n"),
  };
}

/** Import path for text the user pasted in directly. */
export function importFromText(text: string, titleHint = "", artistHint = ""): ImportResult {
  let title = titleHint;
  let artist = artistHint;

  const directiveTitle = /\{\s*(?:title|t)\s*:\s*([^}]+)\}/i.exec(text);
  const directiveArtist = /\{\s*(?:artist|subtitle|st)\s*:\s*([^}]+)\}/i.exec(text);
  if (!title && directiveTitle) title = directiveTitle[1].trim();
  if (!artist && directiveArtist) artist = directiveArtist[1].trim();

  let body = text;
  if (!title && !directiveTitle) {
    const heading = takeHeading(text);
    if (heading.title) {
      title = heading.title;
      if (!artist) artist = heading.artist;
      body = heading.rest;
    }
  }

  const source = textToChordPro(body);
  if (!source.trim()) throw new ImportError("Nothing to import");

  return { title, artist, source, sourceUrl: "", via: "pasted text" };
}
