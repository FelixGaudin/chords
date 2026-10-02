"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import type { SongSummary } from "@/lib/db";
import type { Playlist } from "@/lib/playlists";

export function PlaylistView({
  playlist,
  songs,
  library,
}: {
  playlist: Playlist;
  songs: SongSummary[];
  library: SongSummary[];
}) {
  const router = useRouter();
  // The order is edited here and written back on every change, so the list
  // reorders under the finger without waiting for a round trip.
  const [ids, setIds] = useState(() => songs.map((s) => s.id));
  const [name, setName] = useState(playlist.name);
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const byId = useMemo(() => new Map(library.map((s) => [s.id, s])), [library]);
  const rows = useMemo(
    () => ids.map((id) => byId.get(id)).filter((s): s is SongSummary => s !== undefined),
    [ids, byId],
  );

  const candidates = useMemo(() => {
    const inList = new Set(ids);
    const q = query.trim().toLowerCase();
    return library
      .filter((s) => !inList.has(s.id))
      .filter((s) => !q || `${s.title} ${s.artist}`.toLowerCase().includes(q));
  }, [library, ids, query]);

  async function persist(patch: Partial<Pick<Playlist, "name" | "songIds">>) {
    setError(null);
    try {
      const res = await fetch(`/api/playlists/${playlist.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Could not save");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  }

  function setOrder(next: string[]) {
    setIds(next);
    persist({ songIds: next });
  }

  function move(index: number, by: number) {
    const to = index + by;
    if (to < 0 || to >= ids.length) return;
    const next = [...ids];
    [next[index], next[to]] = [next[to], next[index]];
    setOrder(next);
  }

  function saveName() {
    setRenaming(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === playlist.name) {
      setName(playlist.name);
      return;
    }
    persist({ name: trimmed });
  }

  // Each song goes in at the key and capo it was last left at, and those
  // only live in this browser — so they ride along with the request.
  async function downloadPdf() {
    setError(null);
    setExporting(true);
    try {
      const tunings: Record<string, unknown> = {};
      let instrument: unknown = null;
      try {
        instrument = JSON.parse(localStorage.getItem("chords:prefs") ?? "{}").instrument;
        for (const id of ids) tunings[id] = JSON.parse(localStorage.getItem(`chords:song:${id}`) ?? "{}");
      } catch {
        /* storage blocked: the sheets go out as written */
      }
      const res = await fetch(`/api/playlists/${playlist.id}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrument, tunings }),
      });
      if (!res.ok) throw new Error("Could not make the PDF");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not make the PDF");
    } finally {
      setExporting(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete the playlist “${playlist.name}”? The songs stay in the library.`)) return;
    await fetch(`/api/playlists/${playlist.id}`, { method: "DELETE" });
    router.push("/playlists");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <Link href="/playlists" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Playlists
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  setName(playlist.name);
                  setRenaming(false);
                }
              }}
              className="w-full rounded-lg border border-rule bg-raised px-2 py-1 text-[1.5rem] font-semibold tracking-[-0.02em] focus:border-rule-strong focus:outline-none"
            />
          ) : (
            <h1
              onClick={() => setRenaming(true)}
              className="cursor-text text-[1.7rem] leading-none font-semibold tracking-[-0.02em]"
              title="Click to rename"
            >
              {playlist.name}
            </h1>
          )}
          <p className="mt-1.5 text-[13px] text-muted">
            {rows.length === 0 ? "No songs yet" : `${rows.length} song${rows.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          {rows.length > 0 && (
            <button
              type="button"
              onClick={downloadPdf}
              disabled={exporting}
              className="rounded-lg px-2 py-1.5 text-[13px] text-muted hover:bg-accent-soft hover:text-ink disabled:opacity-40"
            >
              {exporting ? "PDF…" : "PDF"}
            </button>
          )}
          <button type="button" onClick={remove} className="rounded-lg px-2 py-1.5 text-[13px] text-muted hover:bg-accent-soft hover:text-ink">
            Delete
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-[13px] text-accent">{error}</p>}

      {rows.length > 0 && (
        <ul className="mt-5 divide-y divide-rule border-y border-rule">
          {rows.map((song, i) => (
            <li key={song.id} className="flex items-center gap-2 py-2">
              <span className="w-5 shrink-0 text-right font-mono text-[12px] text-faint tabular-nums">{i + 1}</span>
              <Link href={`/songs/${song.id}?list=${playlist.id}`} className="min-w-0 flex-1 py-1">
                <p className="truncate text-[15px] font-medium">{song.title}</p>
                <p className="truncate text-[13px] text-muted">{song.artist || "Unknown artist"}</p>
              </Link>
              <div className="flex shrink-0 items-center">
                <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <path d="M4 9.5 8 5.5l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </IconButton>
                <IconButton label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                  <path d="M4 6.5 8 10.5l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </IconButton>
                <IconButton label={`Remove ${song.title}`} onClick={() => setOrder(ids.filter((id) => id !== song.id))}>
                  <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5">
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-rule bg-raised px-3.5 text-[13px]"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            Add songs
          </button>
        ) : (
          <div className="rounded-xl border border-rule bg-raised p-3">
            <div className="flex gap-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the library"
                className="h-9 min-w-0 flex-1 rounded-lg border border-rule bg-paper px-3 text-[14px] placeholder:text-faint focus:border-rule-strong focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setQuery("");
                }}
                className="h-9 shrink-0 px-2 text-[13px] text-muted hover:text-ink"
              >
                Done
              </button>
            </div>
            {candidates.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-faint">
                {library.length === ids.length ? "Every song is already in here." : "Nothing matches."}
              </p>
            ) : (
              <ul className="mt-2 max-h-72 overflow-y-auto">
                {candidates.map((song) => (
                  <li key={song.id}>
                    <button
                      type="button"
                      onClick={() => setOrder([...ids, song.id])}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-accent-soft"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px]">{song.title}</p>
                        <p className="truncate text-[12px] text-muted">{song.artist || "Unknown artist"}</p>
                      </div>
                      <span className="shrink-0 text-[18px] leading-none text-faint">+</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-lg p-1.5 text-muted hover:bg-accent-soft hover:text-ink disabled:pointer-events-none disabled:opacity-25"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
