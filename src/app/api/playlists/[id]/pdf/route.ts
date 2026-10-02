import { NextRequest, NextResponse } from "next/server";
import { arrangeSong } from "@/lib/arrange";
import { getSong, Song } from "@/lib/db";
import { renderPlaylistPdf } from "@/lib/pdf";
import { getPlaylist } from "@/lib/playlists";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Transpose and capo live in the browser, so the page sends them along:
 * `{ instrument, tunings: { [songId]: { transpose, capo } } }`.
 */
interface Body {
  instrument?: unknown;
  tunings?: unknown;
}

const int = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;

export async function POST(req: NextRequest, { params }: Ctx) {
  const playlist = await getPlaylist((await params).id);
  if (!playlist) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const isKeyboard = body.instrument === "piano";
  const tunings = (body.tunings && typeof body.tunings === "object" ? body.tunings : {}) as Record<string, unknown>;

  const songs = (await Promise.all(playlist.songIds.map((id) => getSong(id)))).filter((s): s is Song => s !== null);
  const printed = songs.map((song) => {
    const t = (tunings[song.id] ?? {}) as { transpose?: unknown; capo?: unknown };
    const capo = int(t.capo, 0, 11) ?? song.capo ?? 0;
    const arranged = arrangeSong(song, { transpose: int(t.transpose, -11, 11) ?? 0, capo, isKeyboard });
    return { title: song.title, artist: song.artist, capo, ...arranged };
  });

  const pdf = await renderPlaylistPdf(playlist.name, printed);
  const filename = `${slugify(playlist.name) || "playlist"}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(`${playlist.name}.pdf`)}`,
      "Cache-Control": "no-store",
    },
  });
}
