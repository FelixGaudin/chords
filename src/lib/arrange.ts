import { parseChord, preferFlatsForKey, transposeSymbol } from "./music";
import { parseSheet, Sheet, transposeSource } from "./sheet";
import type { Song } from "./db";

export interface Arrangement {
  sheet: Sheet;
  /** What the song sounds like. */
  soundingKey: string | null;
  /** The key of the shapes you finger. */
  shapeKey: string | null;
  /** Spelling the rendered chords use. */
  preferFlats: boolean;
  baseCapo: number;
  isKeyboard: boolean;
}

/** A song as it should be played: transposed, re-fingered for the capo, or shown at pitch on piano. */
export function arrangeSong(
  song: Pick<Song, "source" | "key" | "capo">,
  { transpose, capo, isKeyboard }: { transpose: number; capo: number; isKeyboard: boolean },
): Arrangement {
  const baseSheet = parseSheet(song.source);

  // A sheet's printed chords are the shapes you finger, already accounting for
  // whatever capo it was written for. So the stored key (which is what the
  // song sounds like) has to come back down by that capo to give the shape key.
  const baseCapo = song.capo ?? 0;
  const declaredKey = song.key || baseSheet.meta.key || null;
  const shapeKeyBase = declaredKey ? transposeSymbol(declaredKey, -baseCapo) : (baseSheet.chords[0] ?? null);

  // A capo is a fretted-instrument device. On a keyboard there's nothing to
  // clamp, so the piano is always shown at the pitch the song actually sounds
  // — moving the capo away from the sheet's own only re-fingers the frets.
  const shapeShift = transpose - (capo - baseCapo);
  const soundShift = transpose + baseCapo;
  const shift = isKeyboard ? soundShift : shapeShift;

  const basePc = shapeKeyBase ? (parseChord(shapeKeyBase)?.root ?? null) : null;
  const mod12 = (n: number) => ((n % 12) + 12) % 12;

  // The sounding key keeps the spelling the source gave it: a song written as
  // Db shouldn't be relabelled C# just because the shapes are in C.
  // The source's own spelling only speaks for the key it was written in. Once
  // transposed, the new key picks its own accidentals — otherwise a song
  // written in Db would still be calling F# "Gb" two keys later.
  const soundingFlats = preferFlatsForKey(
    basePc === null ? null : mod12(basePc + soundShift),
    transpose === 0 ? (declaredKey ?? shapeKeyBase ?? undefined) : undefined,
  );
  const shapeFlats = preferFlatsForKey(
    basePc === null ? null : mod12(basePc + shapeShift),
    shapeShift === 0 ? (shapeKeyBase ?? undefined) : undefined,
  );
  const preferFlats = isKeyboard ? soundingFlats : shapeFlats;

  return {
    sheet: shift === 0 ? baseSheet : parseSheet(transposeSource(song.source, shift, preferFlats)),
    soundingKey: shapeKeyBase ? transposeSymbol(shapeKeyBase, soundShift, soundingFlats) : null,
    shapeKey: shapeKeyBase ? transposeSymbol(shapeKeyBase, shapeShift, shapeFlats) : null,
    preferFlats,
    baseCapo,
    isKeyboard,
  };
}
