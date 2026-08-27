/**
 * Guards the chord engine: every shape it can show must actually spell the
 * chord it claims. Run with `npm run check:chords`.
 */
import { CANONICAL, generateVoicings } from "../src/lib/voicings";
import { INSTRUMENTS, INSTRUMENT_ORDER, isFretted } from "../src/lib/instruments";
import { midiToPc, parseChord, pcToNote, SHARP_NAMES } from "../src/lib/music";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error("  FAIL " + msg);
};

function checkShape(instId: string, symbol: string, frets: (number | null)[], label: string) {
  const inst = INSTRUMENTS[instId as keyof typeof INSTRUMENTS];
  if (!isFretted(inst)) return;
  const chord = parseChord(symbol);
  if (!chord) return fail(`${label} ${symbol}: unparseable`);

  if (frets.length !== inst.strings.length) return fail(`${label} ${symbol}: ${frets.length} frets for ${inst.strings.length} strings`);

  const sounding = frets
    .map((f, i) => (f === null ? null : inst.strings[i].open + f))
    .filter((m): m is number => m !== null);
  if (!sounding.length) return fail(`${label} ${symbol}: nothing sounds`);

  const pcs = [...new Set(sounding.map(midiToPc))];
  const foreign = pcs.filter((p) => !chord.pcs.includes(p));
  const missing = chord.essential.filter((p) => !pcs.includes(p));
  if (foreign.length) fail(`${label} ${instId} ${symbol} [${frets.join(",")}]: notes outside the chord — ${foreign.map((p) => pcToNote(p)).join(",")}`);
  if (missing.length) fail(`${label} ${instId} ${symbol} [${frets.join(",")}]: missing ${missing.map((p) => pcToNote(p)).join(",")}`);

  const fretted = frets.filter((f): f is number => f !== null && f > 0);
  if (fretted.length) {
    const span = Math.max(...fretted) - Math.min(...fretted) + 1;
    if (span > inst.maxSpan) fail(`${label} ${instId} ${symbol}: spans ${span} frets`);
  }
  for (let i = 0; i < frets.length; i++) {
    const f = frets[i];
    const lo = inst.strings[i].minFret ?? 0;
    if (f !== null && f !== 0 && f < lo) fail(`${label} ${instId} ${symbol}: string ${i} fretted below ${lo}`);
  }
}

console.log("Checking hand-written shapes…");
for (const [instId, table] of Object.entries(CANONICAL)) {
  for (const [symbol, frets] of Object.entries(table)) checkShape(instId, symbol, frets, "canonical");
}

console.log("Checking generated shapes across every root and quality…");
const QUALITIES = ["", "m", "7", "maj7", "m7", "dim", "aug", "sus2", "sus4", "6", "m6", "9", "m9", "add9", "7sus4", "m7b5", "13", "11"];
let generated = 0;
let empty = 0;
for (const instId of INSTRUMENT_ORDER) {
  const inst = INSTRUMENTS[instId];
  if (!isFretted(inst)) continue;
  for (const root of SHARP_NAMES) {
    for (const q of QUALITIES) {
      const symbol = root + q;
      const chord = parseChord(symbol);
      if (!chord) {
        fail(`${symbol}: unparseable`);
        continue;
      }
      const voicings = generateVoicings(chord, inst, 3);
      if (!voicings.length) {
        empty++;
        console.error(`  NO SHAPE ${instId} ${symbol}`);
        continue;
      }
      for (const v of voicings) {
        generated++;
        checkShape(instId, symbol, v.frets, "generated");
      }
    }
  }
}

console.log(`\n${generated} generated shapes checked, ${empty} chords with no shape at all.`);
if (failures || empty) {
  console.error(`${failures} failures.`);
  process.exit(1);
}
console.log("All chord shapes spell their chord correctly.");
