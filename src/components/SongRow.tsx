import Link from "next/link";
import type { SongSummary } from "@/lib/db";

/** One line in a song listing, shared by the library and artist pages. */
export function SongRow({ song, showArtist = true }: { song: SongSummary; showArtist?: boolean }) {
  return (
    <li>
      <Link href={`/songs/${song.id}`} className="flex items-center gap-3 py-3 active:bg-accent-soft">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">{song.title}</p>
          {showArtist && <p className="truncate text-[13px] text-muted">{song.artist || "Unknown artist"}</p>}
        </div>
        <span className="shrink-0 font-mono text-[12px] text-faint tabular-nums">
          {song.key ?? ""}
          {song.key && song.capo ? " · " : ""}
          {song.capo ? `capo ${song.capo}` : ""}
        </span>
      </Link>
    </li>
  );
}
