"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChordSheet } from "./ChordSheet";
import { ChordDetail, ChordMini } from "./ChordView";
import { ChordPopover } from "./ChordPopover";
import { ThemeToggle } from "./ThemeToggle";
import { AddToPlaylist } from "./AddToPlaylist";
import { INSTRUMENTS, INSTRUMENT_ORDER, InstrumentId } from "@/lib/instruments";
import { parseChord, preferFlatsForKey, transposeSymbol } from "@/lib/music";
import { parseSheet, transposeSource } from "@/lib/sheet";
import type { Song } from "@/lib/db";
import type { Setlist } from "@/lib/playlists";
import { slugify } from "@/lib/slug";

const SCROLL_SPEEDS = [12, 20, 30, 44, 64];

type Source = "sheet" | "strip";

export function SongView({ song, setlist = null }: { song: Song; setlist?: Setlist | null }) {
  const [transpose, setTranspose] = useState(0);
  const [capo, setCapo] = useState(song.capo ?? 0);
  const [instrument, setInstrument] = useState<InstrumentId>("guitar");
  const [fontStep, setFontStep] = useState(0);
  const [showHints, setShowHints] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  // Where the chord was pointed at. Only the chord section lets you change the
  // fingering; in the song itself the card is a read-only reminder.
  const [hint, setHint] = useState<{ symbol: string; el: HTMLElement; source: Source } | null>(null);
  const [activeSource, setActiveSource] = useState<Source>("sheet");
  const [pinned, setPinned] = useState(false);
  const [canHover, setCanHover] = useState(false);
  // Chosen fingering per chord, keyed by instrument so a guitar choice doesn't
  // leak onto the ukulele. Transposing renames the chords, which retires the
  // old entries by itself.
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [scrolling, setScrolling] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [ready, setReady] = useState(false);

  // Preferences: instrument and text size are global, tuning per song.
  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem("chords:prefs") ?? "{}");
      if (g.instrument && g.instrument in INSTRUMENTS) setInstrument(g.instrument);
      if (typeof g.fontStep === "number") setFontStep(g.fontStep);
      if (typeof g.showHints === "boolean") setShowHints(g.showHints);
      const s = JSON.parse(localStorage.getItem(`chords:song:${song.id}`) ?? "{}");
      if (typeof s.transpose === "number") setTranspose(s.transpose);
      if (typeof s.capo === "number") setCapo(s.capo);
      if (s.positions && typeof s.positions === "object") setPositions(s.positions);
    } catch {
      /* first run, or storage blocked */
    }
    setReady(true);
  }, [song.id]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("chords:prefs", JSON.stringify({ instrument, fontStep, showHints }));
  }, [ready, instrument, fontStep, showHints]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(`chords:song:${song.id}`, JSON.stringify({ transpose, capo, positions }));
  }, [ready, song.id, transpose, capo, positions]);

  const positionOf = useCallback(
    (symbol: string) => positions[`${instrument}|${symbol}`] ?? 0,
    [positions, instrument],
  );
  const choosePosition = useCallback(
    (symbol: string, index: number) => {
      setPositions((p) => ({ ...p, [`${instrument}|${symbol}`]: index }));
      // Swapping the shape replaces the diagram under the pointer, which can
      // make the browser fire mouseleave and dismiss the card mid-choice.
      // Picking a position is deliberate, so keep the card up to compare.
      clearTimers();
      setPinned(true);
    },
    [instrument],
  );

  // Hover only exists where there's a pointing device; phones keep the
  // tap-to-open sheet. `any-hover` rather than `hover` so a laptop that also
  // has a touchscreen still gets the card from its mouse.
  useEffect(() => {
    const mq = window.matchMedia("(any-hover: hover) and (any-pointer: fine)");
    const sync = () => setCanHover(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimers = () => {
    if (enterTimer.current) clearTimeout(enterTimer.current);
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  };

  const showHint = useCallback(
    (symbol: string, el: HTMLElement, source: Source) => {
      // A pinned card stays put; hovering elsewhere shouldn't steal it.
      if (!canHover || pinned) return;
      clearTimers();
      // A short delay keeps the card from flashing as the pointer crosses a line.
      enterTimer.current = setTimeout(() => setHint({ symbol, el, source }), 90);
    },
    [canHover, pinned],
  );

  const hideHint = useCallback(() => {
    if (!canHover) return;
    clearTimers();
    // Grace period so the pointer can travel from the chord into the card.
    leaveTimer.current = setTimeout(() => {
      setHint((h) => (pinned ? h : null));
    }, 150);
  }, [canHover, pinned]);

  const handleChordClick = useCallback(
    (symbol: string, el: HTMLElement, source: Source) => {
      if (!canHover) {
        setActive(symbol);
        setActiveSource(source);
        return;
      }
      clearTimers();
      // Clicking pins the card open so the pointer can leave it alone.
      setHint({ symbol, el, source });
      setPinned((was) => !(was && hint?.symbol === symbol));
    },
    [canHover, hint?.symbol],
  );

  const closeHint = useCallback(() => {
    clearTimers();
    setPinned(false);
    setHint(null);
  }, []);

  useEffect(() => () => clearTimers(), []);

  // A pinned card is dismissed the way any popover is.
  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeHint();
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[role="tooltip"]') && !t.closest(".sheet-chord") && !t.closest("[data-chord-chip]")) closeHint();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [pinned, closeHint]);

  const baseSheet = useMemo(() => parseSheet(song.source), [song.source]);

  // A sheet's printed chords are the shapes you finger, already accounting for
  // whatever capo it was written for. So the stored key (which is what the
  // song sounds like) has to come back down by that capo to give the shape key.
  const baseCapo = song.capo ?? 0;
  const declaredKey = song.key || baseSheet.meta.key || null;
  const shapeKeyBase = declaredKey ? transposeSymbol(declaredKey, -baseCapo) : (baseSheet.chords[0] ?? null);

  // A capo is a fretted-instrument device. On a keyboard there's nothing to
  // clamp, so the piano is always shown at the pitch the song actually sounds
  // — moving the capo away from the sheet's own only re-fingers the frets.
  const isKeyboard = instrument === "piano";
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

  const sheet = useMemo(
    () => parseSheet(transposeSource(song.source, shift, preferFlats)),
    [song.source, shift, preferFlats],
  );

  // Changing instrument or key re-renders the sheet, which both renames the
  // chords and detaches the element any hover card is anchored to. Drop it.
  useEffect(() => {
    closeHint();
  }, [instrument, shift, closeHint]);

  const soundingKey = shapeKeyBase ? transposeSymbol(shapeKeyBase, soundShift, soundingFlats) : null;
  const shapeKey = shapeKeyBase ? transposeSymbol(shapeKeyBase, shapeShift, shapeFlats) : null;

  useAutoScroll(scrolling, SCROLL_SPEEDS[speedIdx], () => setScrolling(false));

  const reset = useCallback(() => {
    setTranspose(0);
    setCapo(song.capo ?? 0);
  }, [song.capo]);

  return (
    <div className="min-h-dvh pb-24">
      <header className="mx-auto w-full max-w-3xl px-4 pt-4">
        <div className="no-print flex items-baseline gap-2">
          <Link
            href={setlist ? `/playlists/${setlist.id}` : "/"}
            className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-muted hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
              <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="truncate">{setlist ? setlist.name : "Songs"}</span>
          </Link>
          {setlist && (
            <span className="shrink-0 text-[13px] text-faint tabular-nums">
              {setlist.position} of {setlist.total}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[1.6rem] leading-tight font-semibold tracking-[-0.015em]">{song.title}</h1>
            {song.artist && (
              <p className="mt-0.5 text-[15px]">
                <Link
                  href={`/artists/${slugify(song.artist)}`}
                  className="text-muted decoration-rule-strong underline-offset-2 hover:text-ink hover:underline"
                >
                  {song.artist}
                </Link>
              </p>
            )}
          </div>
          <div className="no-print flex shrink-0 items-center gap-1">
            <AddToPlaylist songId={song.id} />
            <ThemeToggle />
            <Link href={`/songs/${song.id}/edit`} className="rounded-lg px-2 py-1.5 text-[13px] text-muted hover:bg-accent-soft hover:text-ink">
              Edit
            </Link>
          </div>
        </div>
        <p className="mt-2 text-[13px] text-faint">
          {soundingKey && (
            <>
              Key <span className="text-muted">{soundingKey}</span>
            </>
          )}
          {!isKeyboard && capo > 0 && shapeKey && (
            <>
              <span className="mx-1.5">·</span>Capo {capo} — play in <span className="text-muted">{shapeKey}</span>
            </>
          )}
          {isKeyboard && baseCapo > 0 && (
            <>
              <span className="mx-1.5">·</span>shown as it sounds
            </>
          )}
          {song.sourceUrl && (
            <>
              <span className="mx-1.5">·</span>
              <a href={song.sourceUrl} target="_blank" rel="noreferrer" className="no-print underline decoration-rule-strong underline-offset-2 hover:text-muted">
                source
              </a>
            </>
          )}
        </p>
      </header>

      <div className="no-print sticky top-0 z-30 mt-3 border-y border-rule bg-paper/92 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 overflow-x-auto px-4 py-2 no-scrollbar">
          <Stepper
            label="Transpose"
            value={transpose > 0 ? `+${transpose}` : String(transpose)}
            onDec={() => setTranspose((t) => Math.max(-11, t - 1))}
            onInc={() => setTranspose((t) => Math.min(11, t + 1))}
          />
          {!isKeyboard && (
            <Stepper
              label="Capo"
              value={String(capo)}
              onDec={() => setCapo((c) => Math.max(0, c - 1))}
              onInc={() => setCapo((c) => Math.min(11, c + 1))}
            />
          )}
          <Select
            value={instrument}
            onChange={(v) => setInstrument(v as InstrumentId)}
            options={INSTRUMENT_ORDER.map((id) => ({ value: id, label: INSTRUMENTS[id].name }))}
          />
          <div className="flex h-9 shrink-0 items-center rounded-full border border-rule bg-raised">
            <button type="button" onClick={() => setFontStep((f) => Math.max(-2, f - 1))} className="h-full rounded-l-full px-3 text-[12px] text-muted hover:text-ink" aria-label="Smaller text">
              A−
            </button>
            <span className="h-4 w-px bg-rule" />
            <button type="button" onClick={() => setFontStep((f) => Math.min(6, f + 1))} className="h-full rounded-r-full px-3 text-[15px] text-muted hover:text-ink" aria-label="Larger text">
              A+
            </button>
          </div>
          <button
            type="button"
            onClick={() => setScrolling((s) => !s)}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] ${
              scrolling ? "border-accent bg-accent-soft text-accent" : "border-rule bg-raised text-ink"
            }`}
          >
            {scrolling ? <PauseIcon /> : <PlayIcon />}
            Scroll
          </button>
          {scrolling && (
            <Stepper
              label="Speed"
              value={`${speedIdx + 1}×`}
              onDec={() => setSpeedIdx((i) => Math.max(0, i - 1))}
              onInc={() => setSpeedIdx((i) => Math.min(SCROLL_SPEEDS.length - 1, i + 1))}
            />
          )}
          {(transpose !== 0 || (!isKeyboard && capo !== baseCapo)) && (
            <button type="button" onClick={reset} className="h-9 shrink-0 px-2 text-[13px] text-muted hover:text-ink">
              Reset
            </button>
          )}
        </div>

        {sheet.chords.length > 0 && (
          <div className="border-t border-rule">
            <div className="mx-auto w-full max-w-3xl px-4">
              <button
                type="button"
                onClick={() => setShowHints((s) => !s)}
                className="flex w-full items-center gap-1.5 py-1.5 text-[11px] font-medium tracking-[0.12em] text-faint uppercase hover:text-muted"
              >
                <Chevron open={showHints} />
                {sheet.chords.length} chords
              </button>
              {showHints && (
                <div className="flex gap-4 overflow-x-auto pb-2.5 no-scrollbar">
                  {sheet.chords.map((c) => (
                    <button
                      key={c}
                      type="button"
                      data-chord-chip
                      className="shrink-0"
                      onClick={(e) => handleChordClick(c, e.currentTarget, "strip")}
                      onMouseEnter={(e) => showHint(c, e.currentTarget, "strip")}
                      onMouseLeave={hideHint}
                      onFocus={(e) => showHint(c, e.currentTarget, "strip")}
                      onBlur={hideHint}
                    >
                      <ChordMini symbol={c} instrument={instrument} position={positionOf(c)} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <main
        className="mx-auto w-full max-w-3xl px-4 pt-5"
        style={{ ["--sheet-size" as string]: `${1 + fontStep * 0.09}rem` }}
      >
        <ChordSheet
          sheet={sheet}
          onChordClick={(sym, el) => handleChordClick(sym, el, "sheet")}
          onChordHover={(sym, el) => showHint(sym, el, "sheet")}
          onChordLeave={hideHint}
        />

        {setlist && <SetlistNav setlist={setlist} />}
      </main>

      {canHover && hint && (
        <ChordPopover
          symbol={hint.symbol}
          anchor={hint.el}
          instrument={instrument}
          preferFlats={preferFlats}
          position={positionOf(hint.symbol)}
          onSelectPosition={hint.source === "strip" ? (i) => choosePosition(hint.symbol, i) : undefined}
          pinned={pinned}
          onClose={closeHint}
          onPointerEnter={clearTimers}
          onPointerLeave={hideHint}
        />
      )}

      {active && (
        <>
          <div className="no-print fixed inset-0 z-40 bg-black/25" onClick={() => setActive(null)} aria-hidden />
          <div className="no-print fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-rule bg-raised p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_40px_rgba(0,0,0,0.18)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[27rem] sm:rounded-2xl sm:border">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex flex-wrap gap-1 rounded-2xl bg-paper p-0.5">
                {INSTRUMENT_ORDER.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setInstrument(id)}
                    className={`rounded-full px-2.5 py-1 text-[12px] ${
                      instrument === id ? "bg-raised font-medium text-ink shadow-sm" : "text-muted"
                    }`}
                  >
                    {INSTRUMENTS[id].name}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setActive(null)} className="p-1 text-muted hover:text-ink" aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <ChordDetail
              symbol={active}
              instrument={instrument}
              preferFlats={preferFlats}
              position={positionOf(active)}
              onSelectPosition={activeSource === "strip" ? (i) => choosePosition(active, i) : undefined}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** What comes next in the set, sitting where the song runs out. */
function SetlistNav({ setlist }: { setlist: Setlist }) {
  const step = (song: { id: string; title: string } | null, back: boolean) =>
    song ? (
      <Link
        href={`/songs/${song.id}?list=${setlist.id}`}
        className={`flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl border border-rule bg-raised px-3.5 py-2.5 hover:border-rule-strong ${
          back ? "items-start" : "items-end text-right"
        }`}
      >
        <span className="text-[11px] tracking-[0.12em] text-faint uppercase">{back ? "Previous" : "Next"}</span>
        <span className="w-full truncate text-[14px] font-medium">{song.title}</span>
      </Link>
    ) : (
      <span className="flex-1" />
    );

  return (
    <nav className="no-print mt-10 border-t border-rule pt-4">
      <div className="flex items-stretch gap-2">
        {step(setlist.prev, true)}
        {step(setlist.next, false)}
      </div>
      <p className="mt-2.5 text-center text-[12px] text-faint">
        <Link href={`/playlists/${setlist.id}`} className="hover:text-muted">
          {setlist.name} — {setlist.position} of {setlist.total}
        </Link>
      </p>
    </nav>
  );
}

/** Scrolls the page steadily and keeps the screen awake while it runs. */
function useAutoScroll(active: boolean, pxPerSecond: number, onEnd: () => void) {
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    let carry = 0;

    const step = (now: number) => {
      carry += (pxPerSecond * (now - last)) / 1000;
      last = now;
      const whole = Math.floor(carry);
      if (whole > 0) {
        carry -= whole;
        const before = window.scrollY;
        window.scrollBy(0, whole);
        if (window.scrollY === before) {
          endRef.current();
          return;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const stop = () => endRef.current();
    window.addEventListener("wheel", stop, { passive: true });

    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock
      ?.request("screen")
      .then((l) => {
        lock = l;
      })
      .catch(() => {
        /* unsupported or denied — scrolling still works */
      });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", stop);
      lock?.release().catch(() => {});
    };
  }, [active, pxPerSecond]);
}

function Stepper({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="flex h-9 shrink-0 items-center rounded-full border border-rule bg-raised">
      <button type="button" onClick={onDec} className="h-full rounded-l-full px-2.5 text-muted hover:text-ink" aria-label={`${label} down`}>
        −
      </button>
      <span className="flex items-baseline gap-1.5 px-0.5 text-[13px] whitespace-nowrap">
        <span className="text-faint">{label}</span>
        <span className="min-w-[1.4rem] text-center tabular-nums">{value}</span>
      </span>
      <button type="button" onClick={onInc} className="h-full rounded-r-full px-2.5 text-muted hover:text-ink" aria-label={`${label} up`}>
        +
      </button>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative h-9 shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 appearance-none rounded-full border border-rule bg-raised pr-7 pl-3 text-[13px] text-ink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-faint" width="9" height="9" viewBox="0 0 10 6" fill="none" aria-hidden>
        <path d="m1 1 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const PlayIcon = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
    <path d="M3 1.5 10 6l-7 4.5z" />
  </svg>
);
const PauseIcon = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
    <rect x="2.5" y="1.5" width="2.7" height="9" rx="0.6" />
    <rect x="6.8" y="1.5" width="2.7" height="9" rx="0.6" />
  </svg>
);
const Chevron = ({ open }: { open: boolean }) => (
  <svg width="9" height="9" viewBox="0 0 10 6" fill="none" className={open ? "" : "-rotate-90"} aria-hidden>
    <path d="m1 1 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
