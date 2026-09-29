import { NextRequest, NextResponse } from "next/server";
import { cleanIds, listPlaylists, makePlaylistId, Playlist, savePlaylist } from "@/lib/playlists";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listPlaylists());
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<Playlist>;
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Give the playlist a name" }, { status: 400 });

  const now = new Date().toISOString();
  const playlist: Playlist = {
    id: await makePlaylistId(name),
    name,
    songIds: cleanIds(body.songIds),
    createdAt: now,
    updatedAt: now,
  };
  return NextResponse.json(await savePlaylist(playlist), { status: 201 });
}
