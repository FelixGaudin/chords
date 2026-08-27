import { FrettedInstrument } from "@/lib/instruments";
import { Voicing } from "@/lib/voicings";

interface Props {
  voicing: Voicing;
  instrument: FrettedInstrument;
  /** Show finger numbers and open-string names. */
  detailed?: boolean;
  className?: string;
}

const SG = 13; // gap between strings
const FG = 16; // gap between frets
const PAD_X = 11;
const PAD_TOP = 15;

export function ChordDiagram({ voicing, instrument, detailed = false, className }: Props) {
  const n = instrument.strings.length;
  const fretted = voicing.frets.filter((f): f is number => f !== null && f > 0);
  const top = fretted.length ? Math.max(...fretted) : 0;
  // A shape with open strings has to be drawn against the nut, whatever its
  // lowest fretted note is — an open G is frets 1-3, not "position 2".
  const hasOpen = voicing.frets.some((f) => f === 0);
  const startFret = hasOpen || voicing.baseFret <= 1 ? 1 : voicing.baseFret;
  // Never clamp below the highest fretted note, or its dot lands off the grid.
  const rows = Math.max(4, top - startFret + 1);
  const openNut = startFret === 1;

  const gridW = (n - 1) * SG;
  const gridH = rows * FG;
  const padBottom = detailed ? 13 : 4;
  const w = gridW + PAD_X * 2;
  const h = gridH + PAD_TOP + padBottom;

  const x = (i: number) => PAD_X + i * SG;
  const y = (fret: number) => PAD_TOP + (fret - startFret + 0.5) * FG;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      role="img"
      aria-label={`Fingering: ${voicing.frets.map((f) => (f === null ? "muted" : f)).join(", ")}`}
      fill="none"
    >
      {/* Frets */}
      {Array.from({ length: rows + 1 }, (_, j) => (
        <line
          key={`f${j}`}
          x1={x(0)}
          x2={x(n - 1)}
          y1={PAD_TOP + j * FG}
          y2={PAD_TOP + j * FG}
          stroke="currentColor"
          strokeOpacity={j === 0 && openNut ? 1 : 0.28}
          strokeWidth={j === 0 && openNut ? 2.6 : 1}
          strokeLinecap="round"
        />
      ))}

      {/* Strings */}
      {Array.from({ length: n }, (_, i) => (
        <line
          key={`s${i}`}
          x1={x(i)}
          x2={x(i)}
          y1={PAD_TOP}
          y2={PAD_TOP + gridH}
          stroke="currentColor"
          strokeOpacity={0.28}
          strokeWidth={1}
        />
      ))}

      {/* Position marker when the shape sits up the neck */}
      {!openNut && (
        <text
          x={x(0) - 5}
          y={PAD_TOP + FG * 0.72}
          fontSize={9}
          textAnchor="end"
          fill="currentColor"
          fillOpacity={0.62}
          fontWeight={600}
        >
          {startFret}
        </text>
      )}

      {/* Open and muted strings */}
      {voicing.frets.map((f, i) =>
        f === null ? (
          <g key={`m${i}`} stroke="currentColor" strokeOpacity={0.45} strokeWidth={1.3} strokeLinecap="round">
            <line x1={x(i) - 3} y1={PAD_TOP - 9} x2={x(i) + 3} y2={PAD_TOP - 3} />
            <line x1={x(i) - 3} y1={PAD_TOP - 3} x2={x(i) + 3} y2={PAD_TOP - 9} />
          </g>
        ) : f === 0 ? (
          <circle
            key={`o${i}`}
            cx={x(i)}
            cy={PAD_TOP - 6}
            r={3.1}
            stroke="currentColor"
            strokeOpacity={0.5}
            strokeWidth={1.3}
          />
        ) : null,
      )}

      {/* Barre */}
      {voicing.barre && (
        <rect
          x={x(voicing.barre.from) - 4.1}
          y={y(voicing.barre.fret) - 4.1}
          width={x(voicing.barre.to) - x(voicing.barre.from) + 8.2}
          height={8.2}
          rx={4.1}
          fill="currentColor"
        />
      )}

      {/* Finger dots */}
      {voicing.frets.map((f, i) => {
        if (f === null || f === 0) return null;
        const inBarre = voicing.barre && f === voicing.barre.fret && i >= voicing.barre.from && i <= voicing.barre.to;
        if (inBarre && !detailed) return null;
        return (
          <g key={`d${i}`}>
            {!inBarre && <circle cx={x(i)} cy={y(f)} r={4.7} fill="currentColor" />}
            {detailed && voicing.fingers[i] > 0 && (
              <text
                x={x(i)}
                y={y(f) + 2.9}
                fontSize={7.5}
                textAnchor="middle"
                fontWeight={700}
                fill="var(--color-raised)"
              >
                {voicing.fingers[i]}
              </text>
            )}
          </g>
        );
      })}

      {/* String names */}
      {detailed &&
        instrument.strings.map((s, i) => (
          <text
            key={`l${i}`}
            x={x(i)}
            y={h - 3}
            fontSize={7.5}
            textAnchor="middle"
            fill="currentColor"
            fillOpacity={0.45}
          >
            {s.label}
          </text>
        ))}
    </svg>
  );
}
