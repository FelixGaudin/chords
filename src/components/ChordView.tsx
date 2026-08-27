import { ChordDiagram } from "./ChordDiagram";
import { PianoDiagram } from "./PianoDiagram";
import { INSTRUMENTS, InstrumentId, isFretted } from "@/lib/instruments";
import { midiToPc, parseChord, pcToNote } from "@/lib/music";
import { generateVoicings, pianoVoicing } from "@/lib/voicings";

/** A single small diagram, used in the strip of chords above a song. */
export function ChordMini({ symbol, instrument }: { symbol: string; instrument: InstrumentId }) {
  const chord = parseChord(symbol);
  const inst = INSTRUMENTS[instrument];
  if (!chord) return null;

  return (
    <div className="flex w-fit shrink-0 flex-col items-center gap-1">
      <span className="font-mono text-[13px] leading-none font-semibold text-accent">{symbol}</span>
      {isFretted(inst) ? (
        (() => {
          const v = generateVoicings(chord, inst, 1)[0];
          return v ? (
            <ChordDiagram voicing={v} instrument={inst} className="h-[74px] w-auto text-ink" />
          ) : (
            <NoShape />
          );
        })()
      ) : (
        (() => {
          const p = pianoVoicing(chord);
          return <PianoDiagram notes={p.notes} root={p.root} bass={p.bass} className="h-[40px] w-auto text-ink" />;
        })()
      )}
    </div>
  );
}

function NoShape() {
  return <span className="text-[11px] text-faint">no shape</span>;
}

/** The expanded panel shown when a chord is tapped. */
export function ChordDetail({
  symbol,
  instrument,
  preferFlats = false,
}: {
  symbol: string;
  instrument: InstrumentId;
  preferFlats?: boolean;
}) {
  const chord = parseChord(symbol);
  const inst = INSTRUMENTS[instrument];
  if (!chord) return <p className="text-sm text-muted">Not a chord we recognise.</p>;

  return (
    <div>
      <h3 className="font-mono text-xl font-semibold text-accent">{symbol}</h3>
      {chord.approximate && (
        <p className="mt-1 text-xs text-faint">
          “{chord.suffix}” isn’t a suffix we know — showing the closest basic shape.
        </p>
      )}

      {isFretted(inst) ? (
        <FrettedShape symbol={symbol} instrument={instrument} />
      ) : (
        (() => {
          const p = pianoVoicing(chord);
          return (
            <div className="mt-4">
              <PianoDiagram notes={p.notes} root={p.root} bass={p.bass} detailed className="h-[86px] w-auto text-ink" />
              <p className="mt-2 text-xs text-muted">
                Left hand plays {pcToNote(midiToPc(p.bass), preferFlats)} in the bass.
              </p>
            </div>
          );
        })()
      )}
    </div>
  );
}

function FrettedShape({ symbol, instrument }: { symbol: string; instrument: InstrumentId }) {
  const chord = parseChord(symbol);
  const inst = INSTRUMENTS[instrument];
  if (!chord || !isFretted(inst)) return null;
  const voicing = generateVoicings(chord, inst, 1)[0];

  if (!voicing) {
    return <p className="mt-4 text-sm text-muted">No playable shape for this chord on the {inst.name.toLowerCase()}.</p>;
  }
  // The string names under the diagram already spell the tuning, so there's
  // nothing left worth captioning.
  return <ChordDiagram voicing={voicing} instrument={inst} detailed className="mt-3 h-[104px] w-auto text-ink" />;
}
