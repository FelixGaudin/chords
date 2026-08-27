"use client";

import { useState } from "react";
import { SongEditor, EditorValues } from "./SongEditor";

type Mode = "url" | "paste";

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

export function ImportFlow() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [draft, setDraft] = useState<(EditorValues & { via: string }) | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "url" ? { url } : { text }),
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
        {(["url", "paste"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] ${
              mode === m ? "bg-ink font-medium text-paper" : "text-muted hover:text-ink"
            }`}
          >
            {m === "url" ? "From a link" : "Paste text"}
          </button>
        ))}
      </div>

      {mode === "url" ? (
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
      ) : (
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
        onClick={run}
        disabled={busy || (mode === "url" ? !url.trim() : !text.trim())}
        className="mt-5 inline-flex h-10 items-center rounded-full bg-ink px-5 text-[14px] font-medium text-paper disabled:opacity-40"
      >
        {busy ? "Reading…" : mode === "url" ? "Fetch chords" : "Convert"}
      </button>
    </div>
  );
}
