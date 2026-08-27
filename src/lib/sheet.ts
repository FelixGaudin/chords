/**
 * Songs are stored as a ChordPro-flavoured text with inline [chords].
 * This turns that source into a structure the renderer can lay out.
 */
import { parseChord, transposeSymbol } from "./music";

export interface Chunk {
  chord: string | null;
  text: string;
}

export type Line =
  | { kind: "lyrics"; chunks: Chunk[] }
  | { kind: "comment"; text: string }
  | { kind: "blank" };

export interface Section {
  label: string | null;
  lines: Line[];
}

export interface SheetMeta {
  title?: string;
  artist?: string;
  key?: string;
  capo?: number;
  tempo?: number;
}

export interface Sheet {
  meta: SheetMeta;
  sections: Section[];
  /** Distinct chord symbols in order of first appearance. */
  chords: string[];
}

const DIRECTIVE = /^\{\s*([a-zA-Z_]+)\s*(?::\s*([\s\S]*?))?\s*\}$/;

const SECTION_STARTS: Record<string, string> = {
  start_of_verse: "Verse",
  sov: "Verse",
  start_of_chorus: "Chorus",
  soc: "Chorus",
  start_of_bridge: "Bridge",
  sob: "Bridge",
  start_of_tab: "Tab",
  sot: "Tab",
};

export function parseSheet(source: string): Sheet {
  const meta: SheetMeta = {};
  const sections: Section[] = [];
  const chordOrder: string[] = [];
  const seen = new Set<string>();

  let current: Section = { label: null, lines: [] };
  const flush = () => {
    // Trailing blank lines only add dead space between sections.
    while (current.lines.length && current.lines[current.lines.length - 1].kind === "blank") current.lines.pop();
    if (current.lines.length || current.label) sections.push(current);
  };
  const startSection = (label: string | null) => {
    flush();
    current = { label, lines: [] };
  };

  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    const dir = DIRECTIVE.exec(trimmed);
    if (dir) {
      const name = dir[1].toLowerCase();
      const value = (dir[2] ?? "").trim();
      switch (name) {
        case "title":
        case "t":
          meta.title = value;
          break;
        case "artist":
        case "subtitle":
        case "st":
          meta.artist = value;
          break;
        case "key":
          meta.key = value;
          break;
        case "capo":
          meta.capo = Number.parseInt(value, 10) || 0;
          break;
        case "tempo":
          meta.tempo = Number.parseInt(value, 10) || undefined;
          break;
        case "section":
          startSection(value || null);
          break;
        case "comment":
        case "c":
        case "ci":
          current.lines.push({ kind: "comment", text: value });
          break;
        default:
          if (name in SECTION_STARTS) startSection(value || SECTION_STARTS[name]);
          else if (name.startsWith("end_of") || name === "eov" || name === "eoc" || name === "eob") startSection(null);
          break;
      }
      continue;
    }

    if (!trimmed) {
      if (current.lines.length) current.lines.push({ kind: "blank" });
      continue;
    }

    const chunks = parseLyricLine(line);
    for (const c of chunks) {
      if (c.chord && !seen.has(c.chord)) {
        seen.add(c.chord);
        chordOrder.push(c.chord);
      }
    }
    current.lines.push({ kind: "lyrics", chunks });
  }
  flush();

  return { meta, sections, chords: chordOrder };
}

function parseLyricLine(line: string): Chunk[] {
  const chunks: Chunk[] = [];
  const re = /\[([^\]]*)\]/g;
  let last = 0;
  let pendingChord: string | null = null;
  let m: RegExpExecArray | null;

  while ((m = re.exec(line)) !== null) {
    const text = line.slice(last, m.index);
    if (text || pendingChord !== null) chunks.push({ chord: pendingChord, text });
    pendingChord = m[1].trim() || null;
    last = m.index + m[0].length;
  }
  const tail = line.slice(last);
  if (tail || pendingChord !== null) chunks.push({ chord: pendingChord, text: tail });
  if (!chunks.length) chunks.push({ chord: null, text: line });
  return chunks;
}

/** Rewrites every chord in the source, leaving lyrics and directives alone. */
export function transposeSource(source: string, semitones: number, preferFlats: boolean): string {
  if (!semitones) return source;
  return source.replace(/\[([^\]]*)\]/g, (full, inner: string) => {
    const sym = inner.trim();
    if (!sym || !parseChord(sym)) return full;
    return `[${transposeSymbol(sym, semitones, preferFlats)}]`;
  });
}

/** Best guess at the song's key: the first chord, unless one is declared. */
export function inferKey(sheet: Sheet): string | null {
  if (sheet.meta.key) return sheet.meta.key;
  return sheet.chords[0] ?? null;
}
