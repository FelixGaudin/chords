"use client";

import { useEffect, useState } from "react";
import type { Playlist } from "@/lib/playlists";

/**
 * The song's membership, edited from the song itself. Playlists are loaded on
 * open rather than with the page, since most readings never touch them.
 */
export function AddToPlaylist({ songId }: { songId: string }) {
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/playlists")
      .then((r) => r.json())
      .then(setPlaylists)
      .catch(() => setError("Could not load your playlists"));

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function toggle(playlist: Playlist) {
    const inList = playlist.songIds.includes(songId);
    const songIds = inList ? playlist.songIds.filter((id) => id !== songId) : [...playlist.songIds, songId];
    setPlaylists((ps) => (ps ?? []).map((p) => (p.id === playlist.id ? { ...p, songIds } : p)));
    const res = await fetch(`/api/playlists/${playlist.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songIds }),
    });
    if (!res.ok) setError("Could not save");
  }

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const res = await fetch("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed, songIds: [songId] }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not create it");
      return;
    }
    setPlaylists((ps) => [...(ps ?? []), data as Playlist].sort((a, b) => a.name.localeCompare(b.name)));
    setName("");
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Add to playlist"
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M2 4h8M2 8h8M2 12h5M12 7.5v6M9 10.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute top-10 right-0 z-50 w-64 rounded-xl border border-rule bg-raised p-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            {playlists === null ? (
              <p className="px-2 py-3 text-[13px] text-faint">Loading…</p>
            ) : playlists.length === 0 ? (
              <p className="px-2 pt-2 pb-1 text-[13px] text-faint">No playlists yet.</p>
            ) : (
              <ul className="max-h-64 overflow-y-auto">
                {playlists.map((p) => {
                  const inList = p.songIds.includes(songId);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => toggle(p)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-accent-soft"
                      >
                        <span className={`shrink-0 ${inList ? "text-accent" : "text-faint"}`}>
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                            {inList ? (
                              <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            ) : (
                              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            )}
                          </svg>
                        </span>
                        <span className="truncate text-[13px]">{p.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-1 flex gap-1.5 border-t border-rule pt-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="New playlist"
                className="h-8 min-w-0 flex-1 rounded-lg border border-rule bg-paper px-2 text-[13px] placeholder:text-faint focus:border-rule-strong focus:outline-none"
              />
              <button
                type="button"
                onClick={create}
                disabled={!name.trim()}
                className="h-8 shrink-0 rounded-lg bg-ink px-2.5 text-[12px] font-medium text-paper disabled:opacity-40"
              >
                Add
              </button>
            </div>
            {error && <p className="px-2 pt-1.5 text-[12px] text-accent">{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
