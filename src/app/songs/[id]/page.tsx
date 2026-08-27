import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSong } from "@/lib/db";
import { SongView } from "@/components/SongView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const song = await getSong((await params).id);
  if (!song) return { title: "Not found — Chords" };
  return { title: `${song.title}${song.artist ? ` — ${song.artist}` : ""}` };
}

export default async function SongPage({ params }: Props) {
  const song = await getSong((await params).id);
  if (!song) notFound();
  return <SongView song={song} />;
}
