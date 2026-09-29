import Link from "next/link";
import type { Metadata } from "next";
import { listSongs } from "@/lib/db";
import { listPlaylists, resolveSongs } from "@/lib/playlists";
import { NewPlaylist } from "@/components/NewPlaylist";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Playlists — Chords" };

export default async function PlaylistsPage() {
  const [playlists, songs] = await Promise.all([listPlaylists(), listSongs()]);
  const rows = playlists.map((p) => ({ ...p, songs: resolveSongs(p, songs) }));

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
          <h1 className="text-[1.7rem] leading-none font-semibold tracking-[-0.02em]">Playlists</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {rows.length === 0 ? "A set, a rehearsal, an evening." : `${rows.length} playlist${rows.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <ThemeToggle className="-mr-1 shrink-0" />
      </div>

      <NewPlaylist className="mt-5" />

      {rows.length > 0 && (
        <ul className="mt-5 divide-y divide-rule border-y border-rule">
          {rows.map((p) => (
            <li key={p.id}>
              <Link href={`/playlists/${p.id}`} className="flex items-center gap-3 py-3 active:bg-accent-soft">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{p.name}</p>
                  <p className="truncate text-[13px] text-muted">
                    {p.songs.length === 0
                      ? "Empty"
                      : p.songs
                          .slice(0, 3)
                          .map((s) => s.title)
                          .join(" · ") + (p.songs.length > 3 ? " …" : "")}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[12px] text-faint tabular-nums">{p.songs.length}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {songs.length === 0 && (
        <p className="mt-10 text-center text-[13px] text-faint">
          There are no songs to put in one yet.{" "}
          <Link href="/import" className="underline decoration-rule-strong underline-offset-2 hover:text-muted">
            Import one first
          </Link>
          .
        </p>
      )}
    </div>
  );
}
