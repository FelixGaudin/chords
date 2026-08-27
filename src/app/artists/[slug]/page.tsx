import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listSongs } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { SongRow } from "@/components/SongRow";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/** Songs grouped by the slug of their artist, so casing and punctuation don't split one artist in two. */
async function songsByArtist(slug: string) {
  const songs = (await listSongs()).filter((s) => s.artist && slugify(s.artist) === slug);
  return { songs, name: songs[0]?.artist ?? "" };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await songsByArtist((await params).slug);
  return { title: name ? `${name} — Chords` : "Not found — Chords" };
}

export default async function ArtistPage({ params }: Props) {
  const { songs, name } = await songsByArtist((await params).slug);
  if (!songs.length) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Songs
      </Link>
      <h1 className="mt-3 text-[1.7rem] leading-none font-semibold tracking-[-0.02em]">{name}</h1>
      <p className="mt-1.5 text-[13px] text-muted">
        {songs.length} song{songs.length === 1 ? "" : "s"}
      </p>
      <ul className="mt-5 divide-y divide-rule border-y border-rule">
        {songs.map((song) => (
          <SongRow key={song.id} song={song} showArtist={false} />
        ))}
      </ul>
    </div>
  );
}
