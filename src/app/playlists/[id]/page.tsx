import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listSongs } from "@/lib/db";
import { getPlaylist, resolveSongs } from "@/lib/playlists";
import { PlaylistView } from "@/components/PlaylistView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const playlist = await getPlaylist((await params).id);
  return { title: playlist ? `${playlist.name} — Chords` : "Not found — Chords" };
}

export default async function PlaylistPage({ params }: Props) {
  const playlist = await getPlaylist((await params).id);
  if (!playlist) notFound();

  const library = await listSongs();
  return <PlaylistView playlist={playlist} songs={resolveSongs(playlist, library)} library={library} />;
}
