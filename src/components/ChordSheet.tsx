"use client";

import { Chunk, Sheet } from "@/lib/sheet";

interface Atom {
  chord: string | null;
  text: string;
}

/**
 * Splits a line into groups that must not break across a wrap. A group holds
 * exactly one word plus any spacing and chords that belong with it, so a chord
 * never gets separated from the syllable it sits above.
 */
function groupLine(chunks: Chunk[]): Atom[][] {
  const atoms: Atom[] = [];
  for (const c of chunks) {
    if (c.text === "") {
      atoms.push({ chord: c.chord, text: "" });
      continue;
    }
    const parts = c.text.match(/\s+|\S+/g) ?? [];
    parts.forEach((p, i) => atoms.push({ chord: i === 0 ? c.chord : null, text: p }));
  }

  const groups: Atom[][] = [];
  let current: Atom[] = [];
  const hasWord = (g: Atom[]) => g.some((a) => a.text.trim() !== "");
  for (const a of atoms) {
    if (a.text.trim() !== "" && hasWord(current)) {
      groups.push(current);
      current = [];
    }
    current.push(a);
  }
  if (current.length) groups.push(current);
  return groups;
}

interface Props {
  sheet: Sheet;
  onChordClick?: (symbol: string, el: HTMLElement) => void;
  onChordHover?: (symbol: string, el: HTMLElement) => void;
  onChordLeave?: () => void;
}

export function ChordSheet({ sheet, onChordClick, onChordHover, onChordLeave }: Props) {
  return (
    <div className="sheet">
      {sheet.sections.map((section, si) => (
        <section key={si} className="sheet-section mb-6 last:mb-0">
          {section.label && (
            <h2 className="mb-1.5 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
              {section.label}
            </h2>
          )}
          {section.lines.map((line, li) => {
            if (line.kind === "blank") return <div key={li} className="sheet-spacer" />;
            if (line.kind === "comment")
              return (
                <p key={li} className="my-1 text-[0.9em] text-muted italic">
                  {line.text}
                </p>
              );

            const groups = groupLine(line.chunks);
            const hasLyrics = line.chunks.some((c) => c.text.trim() !== "");
            return (
              <div key={li} className={`sheet-line${hasLyrics ? "" : " sheet-line--chords"}`}>
                {groups.map((group, gi) => (
                  <span key={gi} className="sheet-group">
                    {group.map((atom, ai) => (
                      <span key={ai} className="sheet-unit">
                        {atom.chord && (
                          <button
                            type="button"
                            className="sheet-chord"
                            onClick={(e) => onChordClick?.(atom.chord as string, e.currentTarget)}
                            onMouseEnter={(e) => onChordHover?.(atom.chord as string, e.currentTarget)}
                            onMouseLeave={() => onChordLeave?.()}
                            onFocus={(e) => onChordHover?.(atom.chord as string, e.currentTarget)}
                            onBlur={() => onChordLeave?.()}
                          >
                            {atom.chord}
                          </button>
                        )}
                        {hasLyrics && <span className="sheet-lyric">{atom.text || " "}</span>}
                      </span>
                    ))}
                  </span>
                ))}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
