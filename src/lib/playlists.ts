import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { listSongs, siblingDir, SongSummary } from "./db";
import { slugify } from "./slug";

export interface Playlist {
  id: string;
  name: string;
  /** Song ids, in playing order. */
  songIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Where a song sits in the playlist it was opened from. */
export interface Setlist {
  id: string;
  name: string;
  /** 1-based, for reading. */
  position: number;
  total: number;
  prev: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
}

/** Beside the songs, so `data/` stays the one folder worth backing up. */
const dataDir = () => siblingDir("playlists");

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

const filePath = (id: string) => path.join(dataDir(), `${encodeURIComponent(id)}.json`);

async function listIds(): Promise<string[]> {
  await ensureDir();
  const files = await fs.readdir(dataDir());
  return files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
}

export async function makePlaylistId(name: string): Promise<string> {
  const base = slugify(name) || "playlist";
  const existing = new Set(await listIds());
  if (!existing.has(base)) return base;
  for (let i = 2; i < 200; i++) if (!existing.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${crypto.randomBytes(3).toString("hex")}`;
}

export async function getPlaylist(id: string): Promise<Playlist | null> {
  try {
    const raw = await fs.readFile(filePath(id), "utf8");
    return JSON.parse(raw) as Playlist;
  } catch {
    return null;
  }
}

export async function listPlaylists(): Promise<Playlist[]> {
  const ids = await listIds();
  const all = await Promise.all(ids.map((id) => getPlaylist(id)));
  return all.filter((p): p is Playlist => p !== null).sort((a, b) => a.name.localeCompare(b.name));
}

export async function savePlaylist(playlist: Playlist): Promise<Playlist> {
  await ensureDir();
  const next = { ...playlist, updatedAt: new Date().toISOString() };
  await fs.writeFile(filePath(playlist.id), JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function deletePlaylist(id: string): Promise<boolean> {
  try {
    await fs.unlink(filePath(id));
    return true;
  } catch {
    return false;
  }
}

/** Keeps the order, drops the blanks: a song can be deleted out from under a playlist. */
export function resolveSongs(playlist: Playlist, library: SongSummary[]): SongSummary[] {
  const byId = new Map(library.map((s) => [s.id, s]));
  return playlist.songIds.map((id) => byId.get(id)).filter((s): s is SongSummary => s !== undefined);
}

/** Order without repeats — a setlist plays a song once. */
export function cleanIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0))];
}

/**
 * The playlist a song was opened from, if it was. Returns null when the song
 * isn't in it any more, so a stale link just reads as a plain song page.
 */
export async function setlistFor(songId: string, playlistId: string | undefined): Promise<Setlist | null> {
  if (!playlistId) return null;
  const playlist = await getPlaylist(playlistId);
  if (!playlist) return null;

  const songs = resolveSongs(playlist, await listSongs());
  const i = songs.findIndex((s) => s.id === songId);
  if (i < 0) return null;

  const step = (s: SongSummary | undefined) => (s ? { id: s.id, title: s.title } : null);
  return {
    id: playlist.id,
    name: playlist.name,
    position: i + 1,
    total: songs.length,
    prev: step(songs[i - 1]),
    next: step(songs[i + 1]),
  };
}
