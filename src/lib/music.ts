/** Note names, chord-symbol parsing, and transposition. */

export const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const NOTE_BASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Pitch class (0-11) for a note name like "C#", "Bb", "Fbb". Null if unparseable. */
export function noteToPc(name: string): number | null {
  const m = /^([A-Ga-g])([#b♯♭x]*)$/.exec(name.trim());
  if (!m) return null;
  let pc = NOTE_BASE[m[1].toUpperCase()];
  for (const ch of m[2]) {
    if (ch === "#" || ch === "♯") pc += 1;
    else if (ch === "x") pc += 2;
    else pc -= 1;
  }
  return ((pc % 12) + 12) % 12;
}

export function pcToNote(pc: number, preferFlats = false): string {
  const i = ((pc % 12) + 12) % 12;
  return preferFlats ? FLAT_NAMES[i] : SHARP_NAMES[i];
}

/** Interval sets (semitones from root) per chord suffix. */
const QUALITIES: Record<string, number[]> = {
  "": [0, 4, 7],
  M: [0, 4, 7],
  maj: [0, 4, 7],
  m: [0, 3, 7],
  min: [0, 3, 7],
  "-": [0, 3, 7],
  "5": [0, 7],
  dim: [0, 3, 6],
  "°": [0, 3, 6],
  dim7: [0, 3, 6, 9],
  "°7": [0, 3, 6, 9],
  aug: [0, 4, 8],
  "+": [0, 4, 8],
  sus: [0, 5, 7],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "6": [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  min6: [0, 3, 7, 9],
  "69": [0, 4, 7, 9, 2],
  "6/9": [0, 4, 7, 9, 2],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  M7: [0, 4, 7, 11],
  Δ: [0, 4, 7, 11],
  Δ7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  min7: [0, 3, 7, 10],
  "-7": [0, 3, 7, 10],
  mmaj7: [0, 3, 7, 11],
  "m(maj7)": [0, 3, 7, 11],
  mM7: [0, 3, 7, 11],
  m7b5: [0, 3, 6, 10],
  ø: [0, 3, 6, 10],
  ø7: [0, 3, 6, 10],
  "7sus4": [0, 5, 7, 10],
  "7sus": [0, 5, 7, 10],
  "7b5": [0, 4, 6, 10],
  "7#5": [0, 4, 8, 10],
  "7b9": [0, 4, 7, 10, 1],
  "7#9": [0, 4, 7, 10, 3],
  "7#11": [0, 4, 7, 10, 6],
  "7b13": [0, 4, 7, 10, 8],
  "9": [0, 4, 7, 10, 2],
  maj9: [0, 4, 7, 11, 2],
  M9: [0, 4, 7, 11, 2],
  m9: [0, 3, 7, 10, 2],
  "9sus4": [0, 5, 7, 10, 2],
  add9: [0, 4, 7, 2],
  "add2": [0, 4, 7, 2],
  madd9: [0, 3, 7, 2],
  "m(add9)": [0, 3, 7, 2],
  add11: [0, 4, 7, 5],
  "11": [0, 7, 10, 2, 5],
  m11: [0, 3, 7, 10, 2, 5],
  "13": [0, 4, 7, 10, 2, 9],
  maj13: [0, 4, 7, 11, 2, 9],
  m13: [0, 3, 7, 10, 2, 9],
};

/**
 * Tones the voicing must contain. The fifth is droppable in dense chords but
 * essential where it defines the quality (power/dim/aug chords).
 */
function essentialIntervals(suffix: string, intervals: number[]): number[] {
  const s = suffix.toLowerCase();
  if (intervals.length <= 3) return intervals;
  const keepFifth = /dim|aug|\+|°|b5|#5|ø/.test(s);
  const third = intervals.find((i) => i === 3 || i === 4 || i === 2 || i === 5);
  const seventh = intervals.find((i) => i === 10 || i === 11 || i === 9);
  const out = new Set<number>([0]);
  if (third !== undefined) out.add(third);
  if (seventh !== undefined) out.add(seventh);
  if (keepFifth) for (const i of intervals) if (i === 6 || i === 8 || i === 7) out.add(i);

  // The extension the chord is named after has to be heard, or a C9 is just a
  // C7. Altered forms are checked before the plain ones so 7b9 doesn't match /9/.
  const add = (i: number) => {
    if (intervals.includes(i)) out.add(i);
  };
  if (/b9/.test(s)) add(1);
  else if (/#9/.test(s)) add(3);
  else if (/9/.test(s)) add(2);
  if (/#11/.test(s)) add(6);
  else if (/11/.test(s)) add(5);
  if (/b13/.test(s)) add(8);
  else if (/13/.test(s)) add(9);
  if (/6/.test(s)) add(9);
  return [...out];
}

export interface Chord {
  /** Original text, e.g. "F#m7/C#". */
  symbol: string;
  root: number;
  suffix: string;
  bass: number | null;
  /** Pitch classes making up the chord. */
  pcs: number[];
  /** Pitch classes a voicing may not omit. */
  essential: number[];
  /** True when the suffix wasn't recognised and a triad was assumed. */
  approximate: boolean;
}

const CHORD_RE = /^([A-G][#b♯♭]?)([^/]*)(?:\/([A-G][#b♯♭]?))?$/;

export function parseChord(symbol: string): Chord | null {
  const raw = symbol.trim().replace(/[♯]/g, "#").replace(/[♭]/g, "b");
  if (!raw) return null;
  const m = CHORD_RE.exec(raw);
  if (!m) return null;
  const root = noteToPc(m[1]);
  if (root === null) return null;
  const suffix = (m[2] ?? "").trim();
  const bass = m[3] ? noteToPc(m[3]) : null;

  const normalised = suffix.replace(/\s+/g, "");
  let intervals = QUALITIES[normalised];
  let approximate = false;
  if (!intervals) {
    const alt = QUALITIES[normalised.toLowerCase()];
    if (alt) intervals = alt;
  }
  if (!intervals) {
    // Unknown suffix: fall back to the closest base triad so we still render something.
    if (/^(m|min|-)/.test(normalised)) intervals = QUALITIES["m"];
    else if (/^(dim|°)/.test(normalised)) intervals = QUALITIES["dim"];
    else if (/^(aug|\+)/.test(normalised)) intervals = QUALITIES["aug"];
    else if (/^sus2/.test(normalised)) intervals = QUALITIES["sus2"];
    else if (/^sus/.test(normalised)) intervals = QUALITIES["sus4"];
    else intervals = QUALITIES[""];
    approximate = normalised.length > 0;
  }

  const pcs = [...new Set(intervals.map((i) => (root + i) % 12))];
  const essential = [...new Set(essentialIntervals(normalised, intervals).map((i) => (root + i) % 12))];
  if (bass !== null) essential.push(bass);

  return { symbol: raw, root, suffix, bass, pcs, essential: [...new Set(essential)], approximate };
}

/**
 * Strict test used when guessing whether a line of a scraped page is a chord
 * line. parseChord() is lenient and falls back to a triad for unknown
 * suffixes, which would happily read lyrics like "Be" or "Fade" as chords, so
 * here the suffix has to be one we actually know.
 */
export function isStrictChord(token: string): boolean {
  let t = token.trim().replace(/[♯]/g, "#").replace(/[♭]/g, "b");
  if (!t || t.length > 14) return false;
  if (t.startsWith("(") && t.endsWith(")")) t = t.slice(1, -1);
  const m = CHORD_RE.exec(t);
  if (!m) return false;
  if (noteToPc(m[1]) === null) return false;
  if (m[3] !== undefined && noteToPc(m[3]) === null) return false;
  const suffix = (m[2] ?? "").replace(/\s+/g, "").replace(/^\((.*)\)$/, "$1");
  if (suffix in QUALITIES) return true;
  return suffix.toLowerCase() in QUALITIES;
}

/**
 * Removes the bar lines and repeat dots that chord grids hang off a chord.
 * Sites write outros as "|Am D |G", so the bar arrives glued to the chord with
 * no space; without this the whole token reads as neither chord nor bar.
 * Only touched when a bar is actually present, so "Am:" is left alone.
 */
export function stripBars(token: string): string {
  if (!/[|¦]/.test(token)) return token;
  return token.replace(/^[|¦:]+/, "").replace(/[|¦:]+$/, "");
}

/** Tokens that legitimately share a line with chords. */
const CHORD_LINE_NOISE = /^(?:[|:/%\-–—.()\[\]*]+|[xX]\d+|\d+[xX]|N\.?C\.?|\d+)$/;

export function isChordLineToken(token: string): boolean {
  const bare = stripBars(token);
  return isStrictChord(bare) || CHORD_LINE_NOISE.test(bare.trim()) || bare === "";
}

/** Drops parenthesised asides so only the chord tokens remain. */
export function stripAsides(line: string): string {
  return line.replace(/\([^()]*\)/g, " ");
}

/**
 * True when a line reads as chords rather than lyrics. Requires at least one
 * real chord and near-unanimous agreement from the remaining tokens.
 */
export function looksLikeChordLine(line: string): boolean {
  // Sheets often pin a note to a chord line — "F (hit the E string) C". The
  // aside is ignored here; every token outside it still has to be a chord.
  const tokens = stripAsides(line).trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  let chords = 0;
  for (const t of tokens) {
    if (isStrictChord(stripBars(t))) chords++;
    else if (!isChordLineToken(t)) return false;
  }
  if (chords === 0) return false;
  // A lone token is ambiguous ("A" could be a lyric), so ask for wide spacing
  // or a suffix that no English word carries.
  if (tokens.length === 1 && chords === 1) return tokens[0].length > 1 || /\s{2,}/.test(line);
  return true;
}

/** Keys whose signatures use flats — used to pick enharmonic spelling after transposing. */
const FLAT_KEYS = new Set([1, 3, 5, 8, 10]); // Db, Eb, F, Ab, Bb

export function preferFlatsForKey(keyPc: number | null, original?: string): boolean {
  if (original && /b/.test(original)) return true;
  if (keyPc === null) return false;
  return FLAT_KEYS.has(keyPc);
}

export function transposeSymbol(symbol: string, semitones: number, preferFlats = false): string {
  const chord = parseChord(symbol);
  if (!chord) return symbol;
  const root = pcToNote(chord.root + semitones, preferFlats);
  const bass = chord.bass === null ? "" : "/" + pcToNote(chord.bass + semitones, preferFlats);
  return root + chord.suffix + bass;
}

/** Interval name for display, e.g. root / 3rd / b7. */
export function degreeLabel(pc: number, rootPc: number): string {
  const i = ((pc - rootPc) % 12 + 12) % 12;
  return (
    { 0: "R", 1: "b9", 2: "9", 3: "b3", 4: "3", 5: "4", 6: "b5", 7: "5", 8: "#5", 9: "6", 10: "b7", 11: "7" } as Record<
      number,
      string
    >
  )[i];
}

export const midiToPc = (midi: number) => ((midi % 12) + 12) % 12;
