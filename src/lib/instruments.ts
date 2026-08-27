export type InstrumentId = "guitar" | "piano" | "ukulele" | "banjo";

export interface StringSpec {
  /** MIDI note of the open string. */
  open: number;
  /** Lowest fret this string can be stopped at (banjo 5th string starts at 5). */
  minFret?: number;
  /** Short label shown under the diagram. */
  label: string;
}

export interface FrettedInstrument {
  id: Exclude<InstrumentId, "piano">;
  name: string;
  kind: "fretted";
  /** Strings ordered left-to-right as drawn on a chord diagram. */
  strings: StringSpec[];
  tuningName: string;
  /** Highest fret to search when generating voicings. */
  maxFret: number;
  /** How many frets one hand can span comfortably. */
  maxSpan: number;
}

export interface KeyboardInstrument {
  id: "piano";
  name: string;
  kind: "keyboard";
}

export type Instrument = FrettedInstrument | KeyboardInstrument;

export const INSTRUMENTS: Record<InstrumentId, Instrument> = {
  guitar: {
    id: "guitar",
    name: "Guitar",
    kind: "fretted",
    tuningName: "E A D G B E",
    maxFret: 14,
    maxSpan: 4,
    strings: [
      { open: 40, label: "E" },
      { open: 45, label: "A" },
      { open: 50, label: "D" },
      { open: 55, label: "G" },
      { open: 59, label: "B" },
      { open: 64, label: "E" },
    ],
  },
  piano: { id: "piano", name: "Piano", kind: "keyboard" },
  ukulele: {
    id: "ukulele",
    name: "Ukulele",
    kind: "fretted",
    tuningName: "G C E A",
    maxFret: 14,
    maxSpan: 4,
    strings: [
      { open: 67, label: "G" },
      { open: 60, label: "C" },
      { open: 64, label: "E" },
      { open: 69, label: "A" },
    ],
  },
  banjo: {
    id: "banjo",
    name: "Banjo",
    kind: "fretted",
    tuningName: "g D G B D (open G)",
    maxFret: 14,
    maxSpan: 4,
    strings: [
      { open: 67, minFret: 5, label: "g" },
      { open: 50, label: "D" },
      { open: 55, label: "G" },
      { open: 59, label: "B" },
      { open: 62, label: "D" },
    ],
  },
};

export const INSTRUMENT_ORDER: InstrumentId[] = ["guitar", "piano", "ukulele", "banjo"];

export function isFretted(i: Instrument): i is FrettedInstrument {
  return i.kind === "fretted";
}
