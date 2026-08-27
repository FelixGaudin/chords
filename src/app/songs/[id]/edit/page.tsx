import Link from "next/link";
import { notFound } from "next/navigation";
import { getSong } from "@/lib/db";
import { SongEditor } from "@/components/SongEditor";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const song = await getSong((await params).id);
  if (!song) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <Link href={`/songs/${song.id}`} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to song
      </Link>
      <h1 className="mt-3 mb-6 text-[1.6rem] leading-none font-semibold tracking-[-0.02em]">Edit song</h1>
      <SongEditor
        songId={song.id}
        initial={{
          title: song.title,
          artist: song.artist,
          key: song.key ?? "",
          capo: song.capo ?? 0,
          source: song.source,
          sourceUrl: song.sourceUrl,
        }}
      />
    </div>
  );
}
