import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSong } from "@/lib/db";
import { setlistFor } from "@/lib/playlists";
import { SongView } from "@/components/SongView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ list?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const song = await getSong((await params).id);
  if (!song) return { title: "Not found — Chords" };
  return { title: `${song.title}${song.artist ? ` — ${song.artist}` : ""}` };
}

export default async function SongPage({ params, searchParams }: Props) {
  const song = await getSong((await params).id);
  if (!song) notFound();
  // Opened from a playlist, the song knows what comes next.
  const setlist = await setlistFor(song.id, (await searchParams).list);
  return <SongView song={song} setlist={setlist} />;
}
