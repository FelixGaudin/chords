"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ChordDetail } from "./ChordView";
import { InstrumentId } from "@/lib/instruments";

interface Props {
  symbol: string;
  /** The chord element the card points at. */
  anchor: HTMLElement;
  instrument: InstrumentId;
  preferFlats: boolean;
  position: number;
  /** Omitted where the fingering is not meant to be changed. */
  onSelectPosition?: (index: number) => void;
  /** Pinned cards survive the pointer leaving, and gain a close button. */
  pinned: boolean;
  onClose: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

interface Position {
  left: number;
  top: number;
}

export function ChordPopover({
  symbol,
  anchor,
  instrument,
  preferFlats,
  position,
  onSelectPosition,
  pinned,
  onClose,
  onPointerEnter,
  onPointerLeave,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Position | null>(null);

  // Re-measured on scroll so the card tracks its chord while auto-scroll runs.
  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      // A detached anchor measures as all-zero and would fling the card into
      // the corner; hold the last good position instead.
      if (!el || !anchor.isConnected) return;
      const a = anchor.getBoundingClientRect();
      const { offsetWidth: w, offsetHeight: h } = el;
      const gap = 10;
      const margin = 8;

      let top = a.bottom + gap;
      if (top + h > window.innerHeight - margin && a.top - gap - h > margin) top = a.top - gap - h;
      top = Math.max(margin, Math.min(top, window.innerHeight - h - margin));

      const left = Math.max(
        margin,
        Math.min(a.left + a.width / 2 - w / 2, window.innerWidth - w - margin),
      );
      setPos({ left, top });
    };

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchor, symbol, instrument, position]);

  return (
    <div
      ref={ref}
      role="tooltip"
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0 }}
      className={`no-print fixed z-50 w-auto max-w-[20rem] min-w-[10rem] rounded-xl border border-rule bg-raised p-3.5 shadow-[0_10px_34px_rgba(0,0,0,0.16)] ${
        pos ? "" : "pointer-events-none opacity-0"
      }`}
    >
      {pinned && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2.5 right-2.5 p-1 text-faint hover:text-ink"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
      )}
      <ChordDetail
        symbol={symbol}
        instrument={instrument}
        preferFlats={preferFlats}
        position={position}
        onSelectPosition={onSelectPosition}
      />
    </div>
  );
}
