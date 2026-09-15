"use client";

import { useState } from "react";
import { SongEditor, EditorValues } from "./SongEditor";
import type { SearchHit } from "@/lib/import";

type Mode = "search" | "url" | "paste";

const MODE_LABELS: Record<Mode, string> = {
  search: "Search",
  url: "From a link",
  paste: "Paste text",
};

interface ImportResponse {
  title: string;
  artist: string;
  source: string;
  key?: string;
  capo?: number;
  sourceUrl: string;
  via: string;
  error?: string;
  hint?: string;
}

interface SearchResponse {
  results?: SearchHit[];
  error?: string;
  hint?: string;
}

/** "ukulele · v3 · F#m · ★4.6 (2497)" — whatever the result actually has. */
function describe(hit: SearchHit): string {
  const parts: string[] = [];
  if (hit.type === "Ukulele Chords") parts.push("ukulele");
  if (hit.version > 1) parts.push(`v${hit.version}`);
  if (hit.key) parts.push(hit.key);
  if (hit.votes) parts.push(`★${hit.rating.toFixed(1)} (${hit.votes})`);
  return parts.join(" · ");
}

export function ImportFlow() {
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [draft, setDraft] = useState<(EditorValues & { via: string }) | null>(null);

  async function importFrom(payload: { url: string } | { text: string }) {
    setError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as ImportResponse;
      if (!res.ok) {
        setError({ message: data.error ?? "Import failed", hint: data.hint });
        return;
      }
      setDraft({
        title: data.title,
        artist: data.artist,
        key: data.key ?? "",
        capo: data.capo ?? 0,
        source: data.source,
        sourceUrl: data.sourceUrl || undefined,
        via: data.via,
      });
    } catch {
      setError({ message: "Could not reach the server" });
    }
  }

  async function run() {
    setBusy(true);
    await importFrom(mode === "url" ? { url } : { text });
    setBusy(false);
  }

  async function pick(hit: SearchHit) {
    setPicked(hit.url);
    await importFrom({ url: hit.url });
    setPicked(null);
  }

  async function search() {
    setBusy(true);
    setError(null);
    setHits(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = (await res.json()) as SearchResponse;
      if (!res.ok) setError({ message: data.error ?? "Search failed", hint: data.hint });
      else setHits(data.results ?? []);
    } catch {
      setError({ message: "Could not reach the server" });
    } finally {
      setBusy(false);
    }
  }

  if (draft) {
    return (
      <div>
        <p className="mb-5 rounded-xl border border-rule bg-raised px-3.5 py-2.5 text-[13px] text-muted">
          Imported from <span className="text-ink">{draft.via}</span>. Check it over, fix anything the parser got
          wrong, then save.
        </p>
        <SongEditor initial={draft} onCancel={() => setDraft(null)} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex w-fit gap-1 rounded-full bg-raised p-0.5 ring-1 ring-rule">
        {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] ${
              mode === m ? "bg-ink font-medium text-paper" : "text-muted hover:text-ink"
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {mode === "search" && (
        <div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && query.trim() && search()}
            placeholder="Song title, artist, or both"
            className="h-11 w-full rounded-xl border border-rule bg-raised px-3.5 text-[14px] placeholder:text-faint focus:border-rule-strong focus:outline-none"
          />
          <p className="mt-2 text-[12.5px] text-faint">
            Searches Ultimate Guitar and lists the chord sheets. Pick one and it imports straight away.
          </p>

          {hits?.length === 0 && (
            <p className="mt-4 text-[13px] text-muted">
              No chord sheets for that. Try fewer words, or just the artist.
            </p>
          )}

          {hits && hits.length > 0 && (
            <ul className="mt-4 divide-y divide-rule overflow-hidden rounded-xl border border-rule">
              {hits.map((hit) => (
                <li key={hit.url}>
                  <button
                    type="button"
                    onClick={() => pick(hit)}
                    disabled={picked !== null}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-raised disabled:opacity-40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px]">{hit.title}</span>
                      <span className="block truncate text-[12.5px] text-muted">{hit.artist}</span>
                    </span>
                    <span className="shrink-0 text-[12px] text-faint">
                      {picked === hit.url ? "Reading…" : describe(hit)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {mode === "url" && (
        <div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && url && run()}
            placeholder="https://tabs.ultimate-guitar.com/tab/…"
            className="h-11 w-full rounded-xl border border-rule bg-raised px-3.5 text-[14px] placeholder:text-faint focus:border-rule-strong focus:outline-none"
          />
          <p className="mt-2 text-[12.5px] text-faint">
            Ultimate Guitar works best. Other chord sites are read generically — if one blocks us, paste the text
            instead.
          </p>
        </div>
      )}

      {mode === "paste" && (
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder={"C                 G\nSomewhere over the rainbow"}
            className="h-64 w-full resize-y rounded-xl border border-rule bg-raised p-3.5 font-mono text-[12.5px] leading-[1.55] placeholder:text-faint focus:border-rule-strong focus:outline-none"
          />
          <p className="mt-2 text-[12.5px] text-faint">
            Chords above lyrics, or ChordPro with [brackets] — both are understood.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-rule bg-accent-soft px-3.5 py-3">
          <p className="text-[13.5px] font-medium text-ink">{error.message}</p>
          {error.hint && <p className="mt-1 text-[12.5px] text-muted">{error.hint}</p>}
        </div>
      )}

      <button
        type="button"
        onClick={mode === "search" ? search : run}
        disabled={
          busy ||
          picked !== null ||
          (mode === "search" ? !query.trim() : mode === "url" ? !url.trim() : !text.trim())
        }
        className="mt-5 inline-flex h-10 items-center rounded-full bg-ink px-5 text-[14px] font-medium text-paper disabled:opacity-40"
      >
        {busy ? "Reading…" : mode === "search" ? "Search" : mode === "url" ? "Fetch chords" : "Convert"}
      </button>
    </div>
  );
}
