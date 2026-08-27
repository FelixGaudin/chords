import { ChordDiagram } from "./ChordDiagram";
import { PianoDiagram } from "./PianoDiagram";
import { INSTRUMENTS, InstrumentId, isFretted } from "@/lib/instruments";
import { midiToPc, parseChord, pcToNote } from "@/lib/music";
import { generateVoicings, isOpenPosition, pianoVoicing } from "@/lib/voicings";

/** How many alternative shapes to offer per chord. */
export const POSITIONS = 4;

/** A single small diagram, used in the strip of chords above a song. */
export function ChordMini({
  symbol,
  instrument,
  position = 0,
}: {
  symbol: string;
  instrument: InstrumentId;
  position?: number;
}) {
  const chord = parseChord(symbol);
  const inst = INSTRUMENTS[instrument];
  if (!chord) return null;

  return (
    <div className="flex w-fit shrink-0 flex-col items-center gap-1">
      <span className="font-mono text-[13px] leading-none font-semibold text-accent">{symbol}</span>
      {isFretted(inst) ? (
        (() => {
          const shapes = generateVoicings(chord, inst, POSITIONS);
          const v = shapes[Math.min(position, shapes.length - 1)];
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
  position = 0,
  onSelectPosition,
}: {
  symbol: string;
  instrument: InstrumentId;
  preferFlats?: boolean;
  position?: number;
  onSelectPosition?: (index: number) => void;
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
        <FrettedShape symbol={symbol} instrument={instrument} position={position} onSelectPosition={onSelectPosition} />
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

function FrettedShape({
  symbol,
  instrument,
  position,
  onSelectPosition,
}: {
  symbol: string;
  instrument: InstrumentId;
  position: number;
  onSelectPosition?: (index: number) => void;
}) {
  const chord = parseChord(symbol);
  const inst = INSTRUMENTS[instrument];
  if (!chord || !isFretted(inst)) return null;

  const shapes = generateVoicings(chord, inst, POSITIONS);
  if (!shapes.length) {
    return <p className="mt-4 text-sm text-muted">No playable shape for this chord on the {inst.name.toLowerCase()}.</p>;
  }
  const index = Math.min(Math.max(position, 0), shapes.length - 1);

  // Label by where the hand sits. "open" matches what the diagram draws, but
  // falls back to fret numbers if it wouldn't tell two shapes apart.
  let labels = shapes.map((v) => (isOpenPosition(v) ? "open" : `${v.baseFret}fr`));
  if (new Set(labels).size !== labels.length) labels = shapes.map((v) => `${v.baseFret}fr`);

  return (
    <>
      <ChordDiagram voicing={shapes[index]} instrument={inst} detailed className="mt-3 h-[104px] w-auto text-ink" />
      {shapes.length > 1 && onSelectPosition && (
        <div className="mt-3 flex flex-wrap gap-1">
          {/* Buttons run up the neck, while the stored index stays the one
              generateVoicings gave it — so index 0 is still the default. */}
          {shapes
            .map((shape, i) => ({ shape, i }))
            .sort((a, b) => a.shape.baseFret - b.shape.baseFret)
            .map(({ shape, i }) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelectPosition(i)}
                className={`rounded-md px-2 py-1 font-mono text-[11px] leading-none ${
                  i === index ? "bg-ink text-paper" : "bg-paper text-muted hover:text-ink"
                }`}
              >
                {labels[i]}
              </button>
            ))}
        </div>
      )}
    </>
  );
}
