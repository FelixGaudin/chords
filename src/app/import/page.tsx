import Link from "next/link";
import { listSongs } from "@/lib/db";
import { ImportFlow } from "@/components/ImportFlow";

export const metadata = { title: "Add a song — Chords" };
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  // What's already here, so the picker can flag a song you've saved before.
  const library = (await listSongs()).map(({ id, title, artist, sourceUrl }) => ({ id, title, artist, sourceUrl }));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Songs
      </Link>
      <h1 className="mt-3 text-[1.6rem] leading-none font-semibold tracking-[-0.02em]">Add a song</h1>
      <p className="mt-1.5 text-[13px] text-muted">
        Import from a link, or paste chords straight in. Everything is converted to one clean format.
      </p>
      <div className="mt-6">
        <ImportFlow library={library} />
      </div>
    </div>
  );
}
