"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChordSheet } from "./ChordSheet";
import { parseSheet } from "@/lib/sheet";

export interface EditorValues {
  title: string;
  artist: string;
  key: string;
  capo: number;
  source: string;
  sourceUrl?: string;
}

export function SongEditor({
  initial,
  songId,
  onCancel,
}: {
  initial: EditorValues;
  songId?: string;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sheet = useMemo(() => parseSheet(values.source), [values.source]);
  const set = <K extends keyof EditorValues>(k: K, v: EditorValues[K]) => setValues((s) => ({ ...s, [k]: v }));

  async function save() {
    if (!values.title.trim()) {
      setError("Give the song a title first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(songId ? `/api/songs/${songId}` : "/api/songs", {
        method: songId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      router.push(`/songs/${data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  }

  async function remove() {
    if (!songId || !confirm(`Delete “${values.title}”? This can't be undone.`)) return;
    setSaving(true);
    await fetch(`/api/songs/${songId}`, { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <input className={inputClass} value={values.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Artist">
          <input className={inputClass} value={values.artist} onChange={(e) => set("artist", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Key">
            <input
              className={inputClass}
              value={values.key}
              placeholder="auto"
              onChange={(e) => set("key", e.target.value)}
            />
          </Field>
          <Field label="Capo">
            <input
              type="number"
              min={0}
              max={11}
              className={inputClass}
              value={values.capo}
              onChange={(e) => set("capo", Number(e.target.value) || 0)}
            />
          </Field>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className={labelClass}>Chords &amp; lyrics</span>
            <span className="text-[11px] text-faint">chords in [brackets]</span>
          </div>
          <textarea
            value={values.source}
            onChange={(e) => set("source", e.target.value)}
            spellCheck={false}
            className="h-[26rem] w-full resize-y rounded-xl border border-rule bg-raised p-3 font-mono text-[12.5px] leading-[1.55] focus:border-rule-strong focus:outline-none"
          />
        </div>
        <div>
          <span className={labelClass}>Preview</span>
          <div className="mt-1.5 h-[26rem] overflow-auto rounded-xl border border-rule bg-raised p-4">
            {sheet.sections.length ? (
              <ChordSheet sheet={sheet} />
            ) : (
              <p className="text-[13px] text-faint">Nothing to show yet.</p>
            )}
          </div>
        </div>
      </div>

      {error && <p className="mt-4 text-[13px] text-accent">{error}</p>}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-[14px] font-medium text-paper disabled:opacity-50"
        >
          {saving ? "Saving…" : songId ? "Save changes" : "Add to library"}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="text-[14px] text-muted hover:text-ink">
            Start over
          </button>
        ) : (
          <Link href={songId ? `/songs/${songId}` : "/"} className="text-[14px] text-muted hover:text-ink">
            Cancel
          </Link>
        )}
        {songId && (
          <button type="button" onClick={remove} className="ml-auto text-[13px] text-faint hover:text-accent">
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-xl border border-rule bg-raised px-3 text-[14px] placeholder:text-faint focus:border-rule-strong focus:outline-none";
const labelClass = "text-[11px] font-medium tracking-[0.12em] text-faint uppercase";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
