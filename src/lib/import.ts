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

async function fetchPage(url: string): Promise<{ body: string; contentType: string }> {
  let res: Response;
  try {
    res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow", signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    throw new ImportError(
      `Could not reach ${new URL(url).hostname}`,
      err instanceof Error ? err.message : undefined,
    );
  }
  if (!res.ok) {
    throw new ImportError(
      `${new URL(url).hostname} replied ${res.status}`,
      res.status === 403 || res.status === 429
        ? "The site is blocking automated requests. Open the page in your browser and paste the text instead."
        : undefined,
    );
  }
  return { body: await res.text(), contentType: res.headers.get("content-type") ?? "" };
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (full, name: string) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return NAMED_ENTITIES[name.toLowerCase()] ?? full;
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
  const m = /<div[^>]+class="js-store"[^>]+data-content="([^"]*)"/i.exec(html);
  if (!m) throw new ImportError("Ultimate Guitar page had no song data", "The page layout may have changed.");

  let data: UgStore;
  try {
    data = JSON.parse(decodeEntities(m[1])) as UgStore;
  } catch {
    throw new ImportError("Could not read Ultimate Guitar's song data");
  }

  const page = data.store?.page?.data;
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
