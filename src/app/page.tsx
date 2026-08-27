import Link from "next/link";
import { listSongs } from "@/lib/db";
import { SongList } from "@/components/SongList";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const songs = await listSongs();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-[1.7rem] leading-none font-semibold tracking-[-0.02em]">Chords</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {songs.length === 0 ? "Chords, and nothing else." : `${songs.length} song${songs.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
        <ThemeToggle className="-mr-1" />
        <Link
          href="/import"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[13px] font-medium text-paper"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          Add song
        </Link>
        </div>
      </header>

      {songs.length === 0 ? <EmptyState /> : <SongList songs={songs} />}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-14 text-center">
      <p className="text-[15px] text-muted">Nothing here yet.</p>
      <p className="mx-auto mt-2 max-w-sm text-[13px] text-faint">
        Paste an Ultimate Guitar link — or any chord sheet you have lying around — and it lands here as a clean,
        transposable page.
      </p>
      <Link
        href="/import"
        className="mt-5 inline-flex h-9 items-center rounded-full border border-rule bg-raised px-4 text-[13px]"
      >
        Import your first song
      </Link>
    </div>
  );
}
