import { NextRequest, NextResponse } from "next/server";
import { cleanIds, deletePlaylist, getPlaylist, Playlist, savePlaylist } from "@/lib/playlists";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const playlist = await getPlaylist((await params).id);
  if (!playlist) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(playlist);
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const existing = await getPlaylist((await params).id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Partial<Playlist>;
  const next: Playlist = {
    ...existing,
    name: (body.name ?? existing.name).trim() || existing.name,
    songIds: body.songIds === undefined ? existing.songIds : cleanIds(body.songIds),
  };
  return NextResponse.json(await savePlaylist(next));
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const ok = await deletePlaylist((await params).id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
