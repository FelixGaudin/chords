import { NextRequest, NextResponse } from "next/server";
import { ImportError, importFromText, importFromUrl } from "@/lib/import";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { url?: string; text?: string; title?: string; artist?: string };
  try {
    const result = body.url
      ? await importFromUrl(body.url)
      : importFromText(body.text ?? "", body.title ?? "", body.artist ?? "");
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ImportError) {
      return NextResponse.json({ error: err.message, hint: err.hint }, { status: 422 });
    }
    return NextResponse.json({ error: "Import failed unexpectedly" }, { status: 500 });
  }
}
