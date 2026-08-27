/**
 * Turns the two-line "chords above lyrics" layout used by tab sites into the
 * inline ChordPro form the app stores.
 */
import { isStrictChord, looksLikeChordLine, stripAsides } from "./music";

interface RawLine {
  text: string;
  /** Set when the source told us outright that this line holds chords. */
  forcedChord?: boolean;
}

const SECTION_WORDS =
  "verse|chorus|pre-?chorus|bridge|intro|outro|solo|refrain|interlude|instrumental|coda|tag|break|ending|hook|riff|part|chords|repeat";

const SECTION_RE = new RegExp(`^[\\[(]?\\s*((?:${SECTION_WORDS})\\b[^\\]):]*)\\s*[\\])]?\\s*:?\\s*$`, "i");
const BRACKET_HEADER_RE = /^\[([^\]]{1,40})\]$/;

/** Bar lines and repeat signs: layout marks, not chords. */
const BAR_TOKEN = /^[|¦:]+$/;

/** Strips the marks that decorate a grid so the rest can be inspected. */
function stripGridMarks(line: string): string {
  return line.replace(/[|¦]/g, " ").replace(/(?:^|\s)\(?(?:[xX]\s*\d{1,2}|\d{1,2}\s*[xX])\)?(?=\s|$)/g, " ");
}

function expandTabs(line: string, width = 4): string {
  let out = "";
  for (const ch of line) {
    if (ch === "\t") out += " ".repeat(width - (out.length % width));
    else out += ch;
  }
  return out;
}

function sectionLabel(line: string): string | null {
  const t = line.trim();
  if (!t || t.length > 44) return null;
  const bracket = BRACKET_HEADER_RE.exec(t);
  if (bracket && !isStrictChord(bracket[1])) return titleCase(bracket[1]);
  const m = SECTION_RE.exec(t);
  if (m) return titleCase(m[1].trim());
  return null;
}

function titleCase(s: string): string {
  return s.replace(/\S+/g, (w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w)).trim();
}

/** Places chord markers into the lyric line at the columns they sat above. */
function merge(chordLine: string, lyricLine: string): string {
  const tokens: { pos: number; text: string }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chordLine)) !== null) tokens.push({ pos: m.index, text: m[0] });
  if (!tokens.length) return lyricLine;

  const chars: string[] = [...lyricLine.replace(/[[\]]/g, "")];
  // Insert from the right so earlier positions stay valid.
  for (const t of [...tokens].sort((a, b) => b.pos - a.pos)) {
    while (chars.length < t.pos) chars.push(" ");
    // Repeat marks and bar lines ride along as plain text; only real chords
    // get bracketed, or "x2" would render as a chord.
    if (BAR_TOKEN.test(t.text)) continue;
    chars.splice(t.pos, 0, isStrictChord(t.text) ? `[${t.text}]` : t.text);
  }
  return chars.join("").trimEnd();
}

/** Brackets the chords in a line, dropping the bar lines that frame a grid. */
function chordsOnly(chordLine: string): string {
  // A line carrying prose keeps its original spacing, since that positions the
  // chords above the words. Note names inside the aside are prose, not chords.
  if (hasAside(chordLine)) {
    return chordLine
      .trimEnd()
      .split(/(\([^()]*\))/)
      .map((part) =>
        part.startsWith("(")
          ? part
          : part
              .split(/(\s+)/)
              .map((t) => (t.trim() === "" ? t : isStrictChord(t) ? `[${t}]` : t))
              .join(""),
      )
      .join("");
  }
  // A bare grid renders as chords alone, so its column spacing is never drawn;
  // normalising it keeps the stored source readable once the bars are gone.
  return chordLine
    .trim()
    .split(/\s+/)
    .filter((t) => t && !BAR_TOKEN.test(t))
    .map((t) => (isStrictChord(t) ? `[${t}]` : t))
    .join(" ");
}

/** Whether a chord line also carries prose, e.g. a playing note in brackets. */
function hasAside(chordLine: string): boolean {
  return stripAsides(chordLine).trim() !== chordLine.trim();
}

function linesToChordPro(lines: RawLine[]): string {
  const isChord = (l: RawLine | undefined) =>
    !!l && (l.forcedChord ?? (l.text.trim() !== "" && looksLikeChordLine(l.text)));
  const isBlank = (l: RawLine | undefined) => !l || l.text.trim() === "";

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text;

    if (isBlank(line)) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }

    if (!line.forcedChord) {
      const label = sectionLabel(text);
      if (label) {
        if (out.length && out[out.length - 1] !== "") out.push("");
        out.push(`{section: ${label}}`);
        continue;
      }
    }

    if (isChord(line)) {
      const next = lines[i + 1];
      // Only pair with a genuine lyric line; two chord lines in a row are an
      // instrumental passage, not a chord/lyric couple. A line carrying an
      // aside keeps its own row, so the note doesn't land inside the lyrics.
      if (!hasAside(text) && next && !isBlank(next) && !isChord(next) && !sectionLabel(next.text)) {
        out.push(merge(text, next.text));
        i++;
      } else {
        out.push(chordsOnly(text));
      }
      continue;
    }

    out.push(text.replace(/[[\]]/g, "").trimEnd());
  }

  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

/** True when the text already carries inline [chord] markers next to lyrics. */
export function looksLikeChordPro(text: string): boolean {
  const lines = text.split("\n");
  let inline = 0;
  for (const l of lines) {
    if (/\{\s*(title|t|artist|st|subtitle|soc|sov|start_of_\w+|section)\s*[:}]/i.test(l)) return true;
    if (/\[[A-G][^\]]{0,10}\]\s*\S/.test(l)) inline++;
  }
  return inline >= 2;
}

export function textToChordPro(text: string): string {
  const normalised = text.replace(/\r\n?/g, "\n");
  if (looksLikeChordPro(normalised)) return normalised.trim();
  return linesToChordPro(normalised.split("\n").map((text) => ({ text: expandTabs(text) })));
}

/**
 * Ultimate Guitar marks chords with [ch]…[/ch], which removes all guesswork:
 * a line is a chord line exactly when it holds nothing but marked chords.
 */
export function ugContentToChordPro(content: string): string {
  const stripped = content
    .replace(/\r\n?/g, "\n")
    // Strip the markers only: swallowing the newline after [/tab] would weld
    // the next chord line onto the end of the current lyric line.
    .replace(/\[\/?tab\]/g, "")
    .replace(/\[\/?(?:syllable|chorus)\]/g, "");

  const lines: RawLine[] = stripped.split("\n").map((line) => {
    const hasMarker = /\[ch\]/.test(line);
    const withoutChords = line.replace(/\[ch\](.*?)\[\/ch\]/g, "");
    // Marked chords plus at most a parenthesised note still make a chord line.
    const forcedChord = hasMarker && stripAsides(stripGridMarks(withoutChords)).trim() === "";
    return { text: expandTabs(line.replace(/\[ch\](.*?)\[\/ch\]/g, "$1")), forcedChord };
  });

  return linesToChordPro(lines);
}
