/**
 * Generates playable chord shapes for any fretted instrument from its tuning,
 * rather than relying on a fixed chord dictionary. Shapes are enumerated with
 * span/pitch pruning and then ranked by a playability score.
 */
import { Chord, midiToPc } from "./music";
import { FrettedInstrument } from "./instruments";

export interface Voicing {
  /** Per string, left to right. null = muted, 0 = open. */
  frets: (number | null)[];
  /** Finger number per string (0 = open/muted). */
  fingers: number[];
  /** Lowest fretted fret, or 0 when the shape is all open. */
  baseFret: number;
  barre: { fret: number; from: number; to: number } | null;
  score: number;
}

interface Option {
  fret: number | null;
  pc: number;
  midi: number;
}

/** Shapes that players actually use, which beat anything a scorer would pick. */
export const CANONICAL: Record<string, Record<string, (number | null)[]>> = {
  guitar: {
    C: [null, 3, 2, 0, 1, 0],
    Cmaj7: [null, 3, 2, 0, 0, 0],
    C7: [null, 3, 2, 3, 1, 0],
    Cm: [null, 3, 5, 5, 4, 3],
    D: [null, null, 0, 2, 3, 2],
    Dm: [null, null, 0, 2, 3, 1],
    D7: [null, null, 0, 2, 1, 2],
    Dmaj7: [null, null, 0, 2, 2, 2],
    Dm7: [null, null, 0, 2, 1, 1],
    Dsus4: [null, null, 0, 2, 3, 3],
    Dsus2: [null, null, 0, 2, 3, 0],
    E: [0, 2, 2, 1, 0, 0],
    Em: [0, 2, 2, 0, 0, 0],
    E7: [0, 2, 0, 1, 0, 0],
    Em7: [0, 2, 2, 0, 3, 0],
    Emaj7: [0, 2, 1, 1, 0, 0],
    F: [1, 3, 3, 2, 1, 1],
    Fmaj7: [null, null, 3, 2, 1, 0],
    Fm: [1, 3, 3, 1, 1, 1],
    G: [3, 2, 0, 0, 0, 3],
    G7: [3, 2, 0, 0, 0, 1],
    Gmaj7: [3, 2, 0, 0, 0, 2],
    Gm: [3, 5, 5, 3, 3, 3],
    A: [null, 0, 2, 2, 2, 0],
    Am: [null, 0, 2, 2, 1, 0],
    A7: [null, 0, 2, 0, 2, 0],
    Am7: [null, 0, 2, 0, 1, 0],
    Amaj7: [null, 0, 2, 1, 2, 0],
    Asus4: [null, 0, 2, 2, 3, 0],
    Asus2: [null, 0, 2, 2, 0, 0],
    B7: [null, 2, 1, 2, 0, 2],
    Bm: [null, 2, 4, 4, 3, 2],
    B: [null, 2, 4, 4, 4, 2],
    Bb: [null, 1, 3, 3, 3, 1],
    Bbm: [null, 1, 3, 3, 2, 1],
    Esus4: [0, 2, 2, 2, 0, 0],
    "G/B": [null, 2, 0, 0, 0, 3],
    "D/F#": [2, 0, 0, 2, 3, 2],
    "C/G": [3, 3, 2, 0, 1, 0],
  },
  ukulele: {
    C: [0, 0, 0, 3],
    Cm: [0, 3, 3, 3],
    C7: [0, 0, 0, 1],
    Cmaj7: [0, 0, 0, 2],
    D: [2, 2, 2, 0],
    Dm: [2, 2, 1, 0],
    D7: [2, 2, 2, 3],
    E: [4, 4, 4, 2],
    Em: [0, 4, 3, 2],
    E7: [1, 2, 0, 2],
    F: [2, 0, 1, 0],
    Fm: [1, 0, 1, 3],
    F7: [2, 3, 1, 3],
    G: [0, 2, 3, 2],
    Gm: [0, 2, 3, 1],
    G7: [0, 2, 1, 2],
    A: [2, 1, 0, 0],
    Am: [2, 0, 0, 0],
    A7: [0, 1, 0, 0],
    Am7: [0, 0, 0, 0],
    B: [4, 3, 2, 2],
    Bm: [4, 2, 2, 2],
    B7: [2, 3, 2, 2],
    Bb: [3, 2, 1, 1],
    Bbm: [3, 1, 1, 1],
  },
  banjo: {
    // Open G tuning already spells a G chord, and C is the other shape every
    // chart agrees on. Everything else is generated, which for the banjo's
    // re-entrant drone gives better answers than a remembered chart does.
    G: [0, 0, 0, 0, 0],
    C: [0, 2, 0, 1, 2],
  },
};

function analyse(frets: (number | null)[], inst: FrettedInstrument) {
  const fretted = frets.filter((f): f is number => f !== null && f > 0);
  const baseFret = fretted.length ? Math.min(...fretted) : 0;
  const top = fretted.length ? Math.max(...fretted) : 0;
  const span = fretted.length ? top - baseFret + 1 : 0;

  // A barre is worthwhile when the lowest fret is used by several strings.
  const atBase: number[] = [];
  frets.forEach((f, i) => {
    if (f === baseFret && baseFret > 0) atBase.push(i);
  });
  let barre: Voicing["barre"] = null;
  // A barre is only drawn when the shape can't be fingered any other way:
  // Em (022000) is two fingers, while Bm (x24432) has five stopped strings and
  // so has to be barred. Drawing every adjacent pair as a barre misleads.
  if (atBase.length >= 2 && fretted.length > 4) {
    const from = atBase[0];
    const to = atBase[atBase.length - 1];
    // An open string under the finger would be muted by it, so that's no barre.
    const blocked = frets.slice(from, to + 1).some((f) => f === 0);
    if (!blocked) barre = { fret: baseFret, from, to };
  }

  const fingers = new Array(frets.length).fill(0);
  let next = 1;
  if (barre) {
    for (let i = barre.from; i <= barre.to; i++) if (frets[i] === barre.fret) fingers[i] = 1;
    next = 2;
  }
  const remaining = frets
    .map((f, i) => ({ f, i }))
    .filter((x) => x.f !== null && x.f > 0 && fingers[x.i] === 0)
    .sort((a, b) => (a.f as number) - (b.f as number) || a.i - b.i);
  for (const r of remaining) {
    fingers[r.i] = Math.min(next, 4);
    next++;
  }
  const fingerCount = barre ? 1 + remaining.length : remaining.length;

  return { baseFret, span, barre, fingers, fingerCount, fretted };
}

function score(
  frets: (number | null)[],
  chord: Chord,
  inst: FrettedInstrument,
  essential: number[],
): number | null {
  const sounding: { midi: number; pc: number; index: number }[] = [];
  frets.forEach((f, i) => {
    if (f === null) return;
    const midi = inst.strings[i].open + f;
    sounding.push({ midi, pc: midiToPc(midi), index: i });
  });
  if (sounding.length < Math.min(3, inst.strings.length)) return null;

  const pcs = new Set(sounding.map((s) => s.pc));
  for (const need of essential) if (!pcs.has(need)) return null;

  const { baseFret, span, barre, fingerCount } = analyse(frets, inst);
  if (span > inst.maxSpan) return null;
  if (fingerCount > 4) return null;

  let s = 0;
  const openCount = frets.filter((f) => f === 0).length;
  const mutedCount = frets.filter((f) => f === null).length;

  // Open strings pin the diagram to the nut, so a shape that also reaches high
  // up the neck draws as an unreadably tall grid. Rank those last.
  if (openCount > 0) {
    const highest = Math.max(0, ...frets.map((f) => f ?? 0));
    if (highest > 5) s += (highest - 5) * 2.5;
  }

  s -= openCount * 2.2;
  s -= sounding.length * 0.9;
  s += baseFret * 1.15;
  s += fingerCount * 1.4;
  s += Math.max(0, span - 1) * 1.2;
  s += mutedCount * 1.6;
  if (barre) s += 1.2;

  // Muted strings wedged between sounding ones are hard to damp cleanly.
  const first = frets.findIndex((f) => f !== null);
  const last = frets.length - 1 - [...frets].reverse().findIndex((f) => f !== null);
  for (let i = first; i <= last; i++) if (frets[i] === null) s += 3.5;

  // Bass note. Slash chords name their bass explicitly; otherwise the root is
  // wanted underneath. Re-entrant tunings (ukulele, banjo) can't honour this.
  const wantBass = chord.bass ?? chord.root;
  const lowest = sounding.reduce((a, b) => (a.midi <= b.midi ? a : b));
  const bassWeight = inst.id === "guitar" ? 7 : 1.5;
  if (lowest.pc !== wantBass) s += bassWeight;
  if (chord.bass !== null && lowest.pc !== chord.bass) s += 6;

  // Prefer the root to be the leftmost sounding string, which reads as the
  // chord's "home" position even on re-entrant instruments.
  if (sounding[0].pc !== chord.root) s += 0.8;

  return s;
}

function enumerate(chord: Chord, inst: FrettedInstrument, limit = 4000): (number | null)[][] {
  const pcSet = new Set(chord.pcs);
  if (chord.bass !== null) pcSet.add(chord.bass);
  const perString: Option[][] = inst.strings.map((str) => {
    const opts: Option[] = [{ fret: null, pc: -1, midi: -1 }];
    const lo = str.minFret ?? 0;
    for (let f = 0; f <= inst.maxFret; f++) {
      if (f !== 0 && f < lo) continue;
      if (f === 0 && lo > 0) {
        // Open is always available even on a short string (the banjo drone).
      }
      const midi = str.open + f;
      const pc = midiToPc(midi);
      if (pcSet.has(pc)) opts.push({ fret: f, pc, midi });
    }
    return opts;
  });

  const results: (number | null)[][] = [];
  const current: (number | null)[] = new Array(inst.strings.length).fill(null);

  const walk = (i: number, lo: number, hi: number) => {
    if (results.length >= limit) return;
    if (i === inst.strings.length) {
      results.push([...current]);
      return;
    }
    for (const opt of perString[i]) {
      let nlo = lo;
      let nhi = hi;
      if (opt.fret !== null && opt.fret > 0) {
        nlo = Math.min(lo, opt.fret);
        nhi = Math.max(hi, opt.fret);
        if (nhi - nlo + 1 > inst.maxSpan) continue;
      }
      current[i] = opt.fret;
      walk(i + 1, nlo, nhi);
      current[i] = null;
      if (results.length >= limit) return;
    }
  };
  walk(0, Infinity, -Infinity);
  return results;
}

const cache = new Map<string, Voicing[]>();

export function generateVoicings(chord: Chord, inst: FrettedInstrument, count = 4): Voicing[] {
  const key = `${inst.id}|${chord.symbol}|${count}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const shapes = enumerate(chord, inst);
  // Dense chords can be unplayable with every tone present, so drop the least
  // characteristic requirements until something fits under four fingers.
  const third = chord.pcs.find((pc) => {
    const i = (pc - chord.root + 12) % 12;
    return i === 3 || i === 4 || i === 2 || i === 5;
  });
  const seventh = chord.pcs.find((pc) => {
    const i = (pc - chord.root + 12) % 12;
    return i === 10 || i === 11;
  });
  const tiers: number[][] = [
    chord.essential,
    [chord.root, ...(third === undefined ? [] : [third]), ...(seventh === undefined ? [] : [seventh])],
    [chord.root, ...(third === undefined ? [] : [third])],
    [chord.root],
  ];

  let scored: Voicing[] = [];
  for (const essential of tiers) {
    scored = [];
    for (const frets of shapes) {
      const s = score(frets, chord, inst, essential);
      if (s === null) continue;
      const { baseFret, barre, fingers } = analyse(frets, inst);
      scored.push({ frets, fingers, baseFret, barre, score: s });
    }
    if (scored.length) break;
  }
  scored.sort((a, b) => a.score - b.score);

  // Keep shapes distinct: one per hand position, so the list offers real
  // alternatives up and down the neck instead of near-duplicates.
  const out: Voicing[] = [];
  const seenPositions = new Set<number>();
  for (const v of scored) {
    if (seenPositions.has(v.baseFret)) continue;
    seenPositions.add(v.baseFret);
    out.push(v);
    if (out.length >= count) break;
  }
  for (const v of scored) {
    if (out.length >= count) break;
    if (!out.includes(v)) out.push(v);
  }

  const canon = CANONICAL[inst.id]?.[chord.symbol];
  if (canon && canon.length === inst.strings.length) {
    const { baseFret, barre, fingers } = analyse(canon, inst);
    const existing = out.findIndex((v) => v.frets.join(",") === canon.join(","));
    if (existing >= 0) out.splice(existing, 1);
    out.unshift({ frets: canon, fingers, baseFret, barre, score: -99 });
    out.length = Math.min(out.length, count);
  }

  cache.set(key, out);
  return out;
}

/**
 * Notes for the piano diagram: the bass in the lower octave of the drawn
 * keyboard, the chord tones stacked in the upper one so a shape always fits.
 */
export function pianoVoicing(chord: Chord): { notes: number[]; bass: number; root: number } {
  const bassPc = chord.bass ?? chord.root;
  const bass = 48 + bassPc;
  const upper = chord.pcs.map((pc) => 60 + pc);
  return { notes: [...new Set([bass, ...upper])].sort((a, b) => a - b), bass, root: chord.root };
}
