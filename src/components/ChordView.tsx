import { ChordDiagram } from "./ChordDiagram";
import { PianoDiagram } from "./PianoDiagram";
import { INSTRUMENTS, InstrumentId, isFretted } from "@/lib/instruments";
import { degreeLabel, midiToPc, parseChord, pcToNote } from "@/lib/music";
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
  limit = 4,
}: {
  symbol: string;
  instrument: InstrumentId;
  preferFlats?: boolean;
  limit?: number;
}) {
  const chord = parseChord(symbol);
  const inst = INSTRUMENTS[instrument];
  if (!chord) return <p className="text-sm text-muted">Not a chord we recognise.</p>;

  const noteList = chord.pcs
    .slice()
    .sort((a, b) => ((a - chord.root + 12) % 12) - ((b - chord.root + 12) % 12))
    .map((pc) => ({ name: pcToNote(pc, preferFlats), degree: degreeLabel(pc, chord.root) }));

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-mono text-xl font-semibold text-accent">{symbol}</h3>
        <p className="text-sm text-muted">
          {noteList.map((n, i) => (
            <span key={n.name + i}>
              {i > 0 && <span className="text-faint"> · </span>}
              {n.name}
              <span className="text-faint"> {n.degree}</span>
            </span>
          ))}
        </p>
      </div>
      {chord.approximate && (
        <p className="mt-1 text-xs text-faint">
          “{chord.suffix}” isn’t a suffix we know — showing the closest basic shape.
        </p>
      )}

      {isFretted(inst) ? (
        <FrettedShapes symbol={symbol} instrument={instrument} limit={limit} />
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

function FrettedShapes({ symbol, instrument, limit }: { symbol: string; instrument: InstrumentId; limit: number }) {
  const chord = parseChord(symbol);
  const inst = INSTRUMENTS[instrument];
  if (!chord || !isFretted(inst)) return null;
  const voicings = generateVoicings(chord, inst, limit);

  if (!voicings.length) {
    return <p className="mt-4 text-sm text-muted">No playable shape found for this chord on the {inst.name.toLowerCase()}.</p>;
  }

  return (
    <>
      <div className="mt-4 flex gap-4 overflow-x-auto pb-1 no-scrollbar">
        {voicings.map((v, i) => (
          <div key={i} className="shrink-0">
            <ChordDiagram voicing={v} instrument={inst} detailed className="h-[104px] w-auto text-ink" />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-faint">
        {inst.name} · {inst.tuningName}
        {voicings.length > 1 && ` · ${voicings.length} positions`}
      </p>
    </>
  );
}
