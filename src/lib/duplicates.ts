/**
 * Spotting a song the library already holds, before a second copy lands in it.
 * Ultimate Guitar lists every version of a song as its own result, so one
 * search comes back with the same song a dozen times over — the job here is to
 * say which of those rows you have already saved.
 *
 * Kept free of node imports so the import picker can use it in the browser.
 */
import { slugify } from "./slug";

export interface SongLike {
  title: string;
  artist: string;
  sourceUrl?: string;
}

/** A saved song, reduced to the fields a duplicate check needs. */
export interface LibraryEntry extends SongLike {
  id: string;
}

export interface DuplicateMatch {
  song: LibraryEntry;
  /** The very same sheet, or another version of a song already saved. */
  kind: "same-sheet" | "same-song";
}

/**
 * "Wonderwall (Acoustic)" and "Wonderwall" are the same song: a parenthesised
 * aside is how a chord site labels a version, not part of the name.
 */
function key(s: string): string {
  return slugify(s.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " "));
}

function sheetKey(url: string | undefined): string {
  return (url ?? "").trim().replace(/\/+$/, "");
}

/** The song `candidate` would duplicate, or null if the library has nothing like it. */
export function findDuplicate(library: readonly LibraryEntry[], candidate: SongLike): DuplicateMatch | null {
  const url = sheetKey(candidate.sourceUrl);
  if (url) {
    const sameSheet = library.find((s) => sheetKey(s.sourceUrl) === url);
    if (sameSheet) return { song: sameSheet, kind: "same-sheet" };
  }

  const title = key(candidate.title);
  if (!title) return null;
  const artist = key(candidate.artist);
  const sameSong = library.find((s) => {
    if (key(s.title) !== title) return false;
    // A missing artist on either side shouldn't hide the match: pasted sheets
    // often arrive as a title and nothing else.
    const theirs = key(s.artist);
    return !artist || !theirs || theirs === artist;
  });
  return sameSong ? { song: sameSong, kind: "same-song" } : null;
}
