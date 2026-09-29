"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Name it and go — a playlist starts empty and fills from the song pages. */
export function NewPlaylist({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create it");
      router.push(`/playlists/${data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create it");
      setSaving(false);
    }
  }

  return (
    <div className={className}>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="New playlist — “Friday set”, “Campfire”…"
          className="h-10 min-w-0 flex-1 rounded-xl border border-rule bg-raised px-3 text-[14px] placeholder:text-faint focus:border-rule-strong focus:outline-none"
        />
        <button
          type="button"
          onClick={create}
          disabled={!name.trim() || saving}
          className="h-10 shrink-0 rounded-xl bg-ink px-4 text-[13px] font-medium text-paper disabled:opacity-40"
        >
          Create
        </button>
      </div>
      {error && <p className="mt-2 text-[13px] text-accent">{error}</p>}
    </div>
  );
}
