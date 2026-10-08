"use client";

import { useEffect, useState } from "react";
import { ChordDetail, ChordMini } from "./ChordView";
import { INSTRUMENTS, INSTRUMENT_ORDER, InstrumentId } from "@/lib/instruments";

// The spellings most songbooks use: sharps for C#/F#, flats for the rest.
const ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

const QUALITIES = [
  { suffix: "", label: "Major" },
  { suffix: "m", label: "Minor" },
  { suffix: "7", label: "7" },
  { suffix: "m7", label: "m7" },
  { suffix: "maj7", label: "maj7" },
  { suffix: "sus4", label: "sus4" },
  { suffix: "dim", label: "dim" },
];

const DEFAULT_QUALITIES = ["", "m", "7"];

export function ChordChart() {
  const [instrument, setInstrument] = useState<InstrumentId>("guitar");
  const [selected, setSelected] = useState<string[]>(DEFAULT_QUALITIES);
  const [active, setActive] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [ready, setReady] = useState(false);

  // Shares the instrument preference with the song pages.
  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem("chords:prefs") ?? "{}");
      if (g.instrument && g.instrument in INSTRUMENTS) setInstrument(g.instrument);
    } catch {
      /* first run, or storage blocked */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      const g = JSON.parse(localStorage.getItem("chords:prefs") ?? "{}");
      localStorage.setItem("chords:prefs", JSON.stringify({ ...g, instrument }));
    } catch {
      /* storage blocked */
    }
  }, [ready, instrument]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActive(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const toggle = (suffix: string) =>
    setSelected((s) =>
      s.includes(suffix) ? (s.length > 1 ? s.filter((x) => x !== suffix) : s) : [...s, suffix],
    );
  // Keep the columns in the canonical order whatever order they were picked in.
  const columns = QUALITIES.filter((q) => selected.includes(q.suffix));

  const open = (symbol: string) => {
    setActive(symbol);
    setPosition(0);
  };

  return (
    <>
      <div className="mt-5 flex flex-col gap-2">
        <div className="flex w-fit flex-wrap gap-1 rounded-2xl bg-accent-soft p-0.5">
          {INSTRUMENT_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setInstrument(id)}
              className={`rounded-full px-2.5 py-1 text-[12px] ${
                instrument === id ? "bg-raised font-medium text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {INSTRUMENTS[id].name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {QUALITIES.map((q) => {
            const on = selected.includes(q.suffix);
            return (
              <button
                key={q.label}
                type="button"
                onClick={() => toggle(q.suffix)}
                aria-pressed={on}
                className={`rounded-full border px-2.5 py-1 font-mono text-[11px] leading-none ${
                  on ? "border-ink bg-ink text-paper" : "border-rule bg-raised text-muted hover:text-ink"
                }`}
              >
                {q.label}
              </button>
            );
          })}
        </div>
        {(() => {
          const inst = INSTRUMENTS[instrument];
          return inst.kind === "fretted" ? <p className="text-[12px] text-faint">Tuning {inst.tuningName}</p> : null;
        })()}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-rule">
              <th className="w-10" />
              {columns.map((q) => (
                <th key={q.label} className="py-2 text-left text-[12px] font-medium text-muted">
                  {q.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {ROOTS.map((root) => (
              <tr key={root}>
                <th scope="row" className="pr-3 text-left align-middle font-mono text-[15px] font-semibold">
                  {root}
                </th>
                {columns.map((q) => {
                  const symbol = root + q.suffix;
                  return (
                    <td key={q.label} className="py-3 pr-4 align-top">
                      <button
                        type="button"
                        onClick={() => open(symbol)}
                        className="rounded-lg p-1 hover:bg-accent-soft"
                        aria-label={`${symbol}, other shapes`}
                      >
                        <ChordMini symbol={symbol} instrument={instrument} />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {active && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setActive(null)} aria-hidden />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-rule bg-raised p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_40px_rgba(0,0,0,0.18)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[27rem] sm:rounded-2xl sm:border">
            <div className="flex justify-end">
              <button type="button" onClick={() => setActive(null)} className="-mt-1 p-1 text-muted hover:text-ink" aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <ChordDetail
              symbol={active}
              instrument={instrument}
              preferFlats={active.includes("b")}
              position={position}
              onSelectPosition={setPosition}
            />
          </div>
        </>
      )}
    </>
  );
}
