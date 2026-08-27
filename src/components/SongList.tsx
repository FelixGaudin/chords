"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SongSummary } from "@/lib/db";

export function SongList({ songs }: { songs: SongSummary[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter((s) => `${s.title} ${s.artist}`.toLowerCase().includes(q));
  }, [songs, query]);

  return (
    <>
      <div className="relative mt-5">
        <svg
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
        >
          <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.5" />
          <path d="m10.6 10.6 3.1 3.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title or artist"
          className="h-10 w-full rounded-xl border border-rule bg-raised pr-3 pl-9 text-[14px] placeholder:text-faint focus:border-rule-strong focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 text-center text-[14px] text-muted">No song matches “{query}”.</p>
      ) : (
        <ul className="mt-4 divide-y divide-rule border-y border-rule">
          {filtered.map((song) => (
            <li key={song.id}>
              <Link href={`/songs/${song.id}`} className="flex items-center gap-3 py-3 active:bg-accent-soft">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{song.title}</p>
                  <p className="truncate text-[13px] text-muted">{song.artist || "Unknown artist"}</p>
                </div>
                <span className="shrink-0 font-mono text-[12px] text-faint tabular-nums">
                  {song.key ?? ""}
                  {song.key && song.capo ? " · " : ""}
                  {song.capo ? `capo ${song.capo}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
