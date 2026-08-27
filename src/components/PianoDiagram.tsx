import { midiToPc, pcToNote } from "@/lib/music";

interface Props {
  /** MIDI notes to light up, expected within C3–B4. */
  notes: number[];
  root: number;
  bass: number;
  detailed?: boolean;
  className?: string;
}

const LOW = 48; // C3
const OCTAVES = 2;
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const BLACK = [
  { pc: 1, after: 0 },
  { pc: 3, after: 1 },
  { pc: 6, after: 3 },
  { pc: 8, after: 4 },
  { pc: 10, after: 5 },
];

const WW = 13;
const WH = 56;
const BW = 8.4;
const BH = 35;

export function PianoDiagram({ notes, root, bass, detailed = false, className }: Props) {
  const on = new Set(notes);
  const whiteCount = OCTAVES * 7;
  const w = whiteCount * WW;
  const h = WH + (detailed ? 12 : 2);

  const fillFor = (midi: number, black: boolean) =>
    on.has(midi) ? "var(--color-accent)" : black ? "var(--color-key-alt)" : "var(--color-key)";

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      role="img"
      aria-label={`Notes: ${notes.map((n) => pcToNote(midiToPc(n))).join(", ")}`}
    >
      {Array.from({ length: whiteCount }, (_, i) => {
        const octave = Math.floor(i / 7);
        const midi = LOW + octave * 12 + WHITE_PCS[i % 7];
        const lit = on.has(midi);
        return (
          <g key={`w${i}`}>
            <rect
              x={i * WW}
              y={0}
              width={WW}
              height={WH}
              rx={1.5}
              fill={fillFor(midi, false)}
              stroke="var(--color-key-alt)"
              strokeOpacity={0.45}
              strokeWidth={0.9}
            />

          </g>
        );
      })}

      {Array.from({ length: OCTAVES }, (_, octave) =>
        BLACK.map(({ pc, after }) => {
          const midi = LOW + octave * 12 + pc;
          const x = (octave * 7 + after + 1) * WW - BW / 2;
          const lit = on.has(midi);
          return (
            <rect
              key={`b${octave}-${pc}`}
              x={x}
              y={0}
              width={BW}
              height={BH}
              rx={1.4}
              fill={fillFor(midi, true)}
              stroke="var(--color-key)"
              strokeOpacity={0.3}
              strokeWidth={0.7}
            />
          );
        }),
      )}
    </svg>
  );
}
