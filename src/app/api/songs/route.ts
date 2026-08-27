import { NextRequest, NextResponse } from "next/server";
import { listSongs, makeId, saveSong, Song } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listSongs());
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<Song>;
  const title = (body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "A title is required" }, { status: 400 });
  if (!(body.source ?? "").trim()) return NextResponse.json({ error: "The song is empty" }, { status: 400 });

  const now = new Date().toISOString();
  const song: Song = {
    id: await makeId(title, body.artist ?? ""),
    title,
    artist: (body.artist ?? "").trim(),
    source: body.source ?? "",
    sourceUrl: body.sourceUrl || undefined,
    key: body.key || undefined,
    capo: body.capo || undefined,
    createdAt: now,
    updatedAt: now,
  };
  return NextResponse.json(await saveSong(song), { status: 201 });
}
