"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/** Reads whichever theme is actually in force, system default included. */
function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => setTheme(currentTheme()), []);

  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("chords:theme", next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink ${className}`}
    >
      {theme === "dark" ? (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1m11-5l-1.1 1.1M5.1 10.9L4 12m8 0l-1.1-1.1M5.1 5.1L4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M13.5 9.6A5.9 5.9 0 0 1 6.4 2.5a5.9 5.9 0 1 0 7.1 7.1z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
