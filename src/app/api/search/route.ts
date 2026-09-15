import { NextRequest, NextResponse } from "next/server";
import { ImportError, searchUltimateGuitar } from "@/lib/import";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const results = await searchUltimateGuitar(req.nextUrl.searchParams.get("q") ?? "");
    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof ImportError) {
      return NextResponse.json({ error: err.message, hint: err.hint }, { status: 422 });
    }
    return NextResponse.json({ error: "Search failed unexpectedly" }, { status: 500 });
  }
}
