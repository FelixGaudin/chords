import { NextRequest, NextResponse } from "next/server";
import { deleteSong, getSong, saveSong, Song } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const song = await getSong((await params).id);
  if (!song) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(song);
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const id = (await params).id;
  const existing = await getSong(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Partial<Song>;
  const next: Song = {
    ...existing,
    title: (body.title ?? existing.title).trim() || existing.title,
    artist: (body.artist ?? existing.artist).trim(),
    source: body.source ?? existing.source,
    key: body.key || undefined,
    capo: body.capo || undefined,
    sourceUrl: body.sourceUrl ?? existing.sourceUrl,
    favorite: body.favorite ?? existing.favorite,
  };
  return NextResponse.json(await saveSong(next));
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const ok = await deleteSong((await params).id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
