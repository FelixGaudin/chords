import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { slugify } from "./slug";

export interface Song {
  id: string;
  title: string;
  artist: string;
  /** ChordPro source. */
  source: string;
  sourceUrl?: string;
  key?: string;
  capo?: number;
  favorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SongSummary = Omit<Song, "source"> & { chordCount: number };

/**
 * Where the library lives. Overridable so a container can point it at a
 * mounted volume; read lazily so the value isn't frozen at build time.
 */
function dataDir(): string {
  const override = process.env.CHORDS_DATA_DIR;
  return override ? path.resolve(override) : path.join(process.cwd(), "data", "songs");
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

export async function makeId(title: string, artist: string): Promise<string> {
  const base = [slugify(artist), slugify(title)].filter(Boolean).join("-") || "song";
  await ensureDir();
  const existing = new Set(await listIds());
  if (!existing.has(base)) return base;
  for (let i = 2; i < 200; i++) if (!existing.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${crypto.randomBytes(3).toString("hex")}`;
}

async function listIds(): Promise<string[]> {
  await ensureDir();
  const files = await fs.readdir(dataDir());
  return files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
}

const filePath = (id: string) => path.join(dataDir(), `${encodeURIComponent(id)}.json`);

export async function getSong(id: string): Promise<Song | null> {
  try {
    const raw = await fs.readFile(filePath(id), "utf8");
    return JSON.parse(raw) as Song;
  } catch {
    return null;
  }
}

export async function listSongs(): Promise<SongSummary[]> {
  const ids = await listIds();
  const songs = await Promise.all(ids.map((id) => getSong(id)));
  return songs
    .filter((s): s is Song => s !== null)
    .map(({ source, ...rest }) => ({
      ...rest,
      chordCount: new Set([...source.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1])).size,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function saveSong(song: Song): Promise<Song> {
  await ensureDir();
  const next = { ...song, updatedAt: new Date().toISOString() };
  await fs.writeFile(filePath(song.id), JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function deleteSong(id: string): Promise<boolean> {
  try {
    await fs.unlink(filePath(id));
    return true;
  } catch {
    return false;
  }
}
