import Link from "next/link";
import type { Metadata } from "next";
import { ChordChart } from "@/components/ChordChart";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = { title: "Chord chart — Chords" };

export default function ChordsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Songs
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.7rem] leading-none font-semibold tracking-[-0.02em]">Chord chart</h1>
          <p className="mt-1.5 text-[13px] text-muted">The shapes you reach for most. Tap one for other positions.</p>
        </div>
        <ThemeToggle className="-mr-1 shrink-0" />
      </div>

      <ChordChart />
    </div>
  );
}
