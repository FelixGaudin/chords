/**
 * Lays a playlist out as a songbook PDF: a contents page, then one song per
 * page, set the way the screen sets it — chords riding above the syllable
 * they belong to, lines wrapping between words, sections kept on one page.
 */
import { PDFDocument, PDFFont, PDFPage, rgb, RGB, StandardFonts } from "pdf-lib";
import { groupLine, Line, Section, Sheet } from "./sheet";

export interface PrintedSong {
  title: string;
  artist: string;
  sheet: Sheet;
  soundingKey: string | null;
  shapeKey: string | null;
  capo: number;
  baseCapo: number;
  isKeyboard: boolean;
}

const PAGE: [number, number] = [595.28, 841.89]; // A4
const MARGIN_X = 48;
const MARGIN_TOP = 52;
const MARGIN_BOTTOM = 56;
const WIDTH = PAGE[0] - 2 * MARGIN_X;
const TOP = PAGE[1] - MARGIN_TOP;

const LYRIC = 11;
const CHORD = LYRIC * 0.82;
const CHORD_ONLY = LYRIC * 0.9;

const hex = (h: number) => rgb(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);
const INK = hex(0x1a1917);
const MUTED = hex(0x6b6862);
const FAINT = hex(0x94908a);
const RULE = hex(0xe4e0d9);
const ACCENT = hex(0x9a5518);

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  mono: PDFFont;
  monoBold: PDFFont;
}

/** A run of the page: measured first, so it can be moved to the next page whole. */
interface Block {
  height: number;
  draw: (page: PDFPage, top: number) => void;
}

// The standard PDF fonts only speak WinAnsi — fine for accents, but anything
// beyond (a Greek title, an emoji) would throw, so it is swapped for "?".
const encodable = new Map<string, boolean>();
function clean(font: PDFFont, text: string): string {
  let out = "";
  for (const ch of text.replace(/\t/g, "    ")) {
    let ok = encodable.get(ch);
    if (ok === undefined) {
      try {
        font.encodeText(ch);
        ok = true;
      } catch {
        ok = false;
      }
      encodable.set(ch, ok);
    }
    out += ok ? ch : "?";
  }
  return out;
}

function width(font: PDFFont, text: string, size: number): number {
  return font.widthOfTextAtSize(clean(font, text), size);
}

function draw(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color: RGB) {
  if (text) page.drawText(clean(font, text), { x, y, size, font, color });
}

function truncate(font: PDFFont, text: string, size: number, max: number): string {
  if (width(font, text, size) <= max) return text;
  let t = text;
  while (t && width(font, `${t}…`, size) > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function wrapWords(font: PDFFont, text: string, size: number, max: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (current && width(font, next, size) > max) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

/** Text drawn in pieces of different colours, one after the other. */
function drawRuns(page: PDFPage, runs: [string, RGB][], x: number, y: number, font: PDFFont, size: number) {
  for (const [text, color] of runs) {
    draw(page, text, x, y, font, size, color);
    x += width(font, text, size);
  }
}

function lineBlocks(line: Line, f: Fonts): Block[] {
  if (line.kind === "blank") return [{ height: LYRIC * 0.75, draw: () => {} }];

  if (line.kind === "comment") {
    const size = LYRIC * 0.9;
    return wrapWords(f.italic, line.text, size, WIDTH).map((text) => ({
      height: size * 1.45,
      draw: (page, top) => draw(page, text, MARGIN_X, top - size * 1.1, f.italic, size, MUTED),
    }));
  }

  const hasLyrics = line.chunks.some((c) => c.text.trim() !== "");
  const chordSize = hasLyrics ? CHORD : CHORD_ONLY;
  const chordPad = chordSize * (hasLyrics ? 0.5 : 0.9);

  // Each group is a word with its chords; a group never breaks, rows do.
  type Unit = { chord: string | null; text: string; width: number };
  const groups = groupLine(line.chunks).map((group) =>
    group.map((atom): Unit => {
      const cw = atom.chord ? width(f.monoBold, atom.chord, chordSize) + chordPad : 0;
      const tw = hasLyrics ? width(f.regular, atom.text, LYRIC) : 0;
      return { chord: atom.chord, text: hasLyrics ? atom.text : "", width: Math.max(cw, tw) };
    }),
  );

  const rows: Unit[][] = [];
  let row: Unit[] = [];
  let used = 0;
  for (const group of groups) {
    const w = group.reduce((sum, u) => sum + u.width, 0);
    if (row.length && used + w > WIDTH) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push(...group);
    used += w;
  }
  if (row.length) rows.push(row);

  const repeat = line.repeat === undefined ? null : `×${line.repeat}`;
  const chordH = chordSize * 1.4;
  const lyricH = LYRIC * 1.35;

  return rows.map((units, ri) => {
    const withChords = units.some((u) => u.chord);
    const height = Math.max((withChords ? chordH : 0) + (hasLyrics ? lyricH : 0), LYRIC * 1.4);
    return {
      height,
      draw: (page, top) => {
        const bottom = top - height;
        const lyricBase = bottom + LYRIC * 0.32;
        const chordBase = hasLyrics ? bottom + lyricH + chordSize * 0.32 : lyricBase;
        let x = MARGIN_X;
        for (const u of units) {
          if (u.chord) draw(page, u.chord, x, chordBase, f.monoBold, chordSize, ACCENT);
          if (u.text.trim()) draw(page, u.text, x, lyricBase, f.regular, LYRIC, INK);
          x += u.width;
        }
        if (repeat && ri === rows.length - 1) {
          const size = LYRIC * 0.72;
          const w = width(f.regular, repeat, size);
          const bx = x + LYRIC * 0.4;
          page.drawRectangle({
            x: bx,
            y: lyricBase - size * 0.35,
            width: w + size,
            height: size * 1.45,
            borderColor: RULE,
            borderWidth: 0.75,
          });
          draw(page, repeat, bx + size / 2, lyricBase, f.regular, size, MUTED);
        }
      },
    };
  });
}

function sectionBlocks(section: Section, f: Fonts): Block[] {
  const blocks: Block[] = [];
  if (section.label) {
    const size = 7.5;
    const label = section.label.toUpperCase();
    blocks.push({
      height: size * 1.4 + 4,
      draw: (page, top) => {
        // Letter-spaced by hand: pdf-lib has no tracking option.
        let x = MARGIN_X;
        for (const ch of label) {
          draw(page, ch, x, top - size * 1.1, f.bold, size, MUTED);
          x += width(f.bold, ch, size) + size * 0.14;
        }
      },
    });
  }
  for (const line of section.lines) blocks.push(...lineBlocks(line, f));
  return blocks;
}

class Writer {
  page!: PDFPage;
  y = TOP;
  /** Drawn at the top of every page the current piece runs onto. */
  onContinue: (() => void) | null = null;

  constructor(private doc: PDFDocument) {}

  newPage() {
    this.page = this.doc.addPage(PAGE);
    this.y = TOP;
  }

  fits(height: number) {
    return this.y - height >= MARGIN_BOTTOM;
  }

  place(block: Block) {
    if (!this.fits(block.height)) {
      this.newPage();
      this.onContinue?.();
    }
    block.draw(this.page, this.y);
    this.y -= block.height;
  }

  /** Moves to a fresh page first if the run would split but could fit whole on one. */
  placeTogether(blocks: Block[]) {
    const total = blocks.reduce((sum, b) => sum + b.height, 0);
    const lead = blocks.slice(0, 2).reduce((sum, b) => sum + b.height, 0);
    if (!this.fits(total) && (total <= TOP - MARGIN_BOTTOM || !this.fits(lead))) {
      this.newPage();
      this.onContinue?.();
    }
    for (const b of blocks) this.place(b);
  }

  gap(height: number) {
    this.y -= height;
  }
}

export async function renderPlaylistPdf(name: string, songs: PrintedSong[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(name);
  doc.setCreator("Chords");

  const f: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    mono: await doc.embedFont(StandardFonts.Courier),
    monoBold: await doc.embedFont(StandardFonts.CourierBold),
  };
  const w = new Writer(doc);

  // ---- contents --------------------------------------------------------
  w.newPage();
  w.place({ height: 30, draw: (page, top) => draw(page, name, MARGIN_X, top - 22, f.bold, 24, INK) });
  const count = `${songs.length} song${songs.length === 1 ? "" : "s"}`;
  w.place({ height: 30, draw: (page, top) => draw(page, count, MARGIN_X, top - 12, f.regular, 10, MUTED) });

  // Page numbers are only known once the songs are laid out, so each row
  // remembers where its number goes.
  const pageSlots: { page: PDFPage; y: number }[] = [];
  const rowH = 22;
  const numCol = 22;
  const rightCol = 70;
  songs.forEach((song, i) => {
    w.place({
      height: rowH,
      draw: (page, top) => {
        const base = top - rowH + 7;
        if (i === 0) page.drawLine({ start: { x: MARGIN_X, y: top }, end: { x: MARGIN_X + WIDTH, y: top }, thickness: 0.5, color: RULE });
        const num = String(i + 1);
        draw(page, num, MARGIN_X + numCol - 6 - width(f.mono, num, 9), base, f.mono, 9, FAINT);
        const avail = WIDTH - numCol - rightCol;
        const title = truncate(f.bold, song.title, 11, avail);
        draw(page, title, MARGIN_X + numCol, base, f.bold, 11, INK);
        const rest = avail - width(f.bold, title, 11);
        if (song.artist && rest > 30) {
          draw(page, truncate(f.regular, ` — ${song.artist}`, 11, rest), MARGIN_X + numCol + width(f.bold, title, 11), base, f.regular, 11, MUTED);
        }
        if (song.soundingKey) draw(page, song.soundingKey, MARGIN_X + WIDTH - rightCol + 8, base, f.mono, 9, MUTED);
        page.drawLine({ start: { x: MARGIN_X, y: top - rowH }, end: { x: MARGIN_X + WIDTH, y: top - rowH }, thickness: 0.5, color: RULE });
        pageSlots.push({ page, y: base });
      },
    });
  });

  // ---- songs -----------------------------------------------------------
  const firstPages: number[] = [];
  songs.forEach((song, i) => {
    w.onContinue = null;
    w.newPage();
    firstPages.push(doc.getPageCount());

    w.place({ height: 14, draw: (page, top) => draw(page, `${i + 1} / ${songs.length}`, MARGIN_X, top - 8, f.mono, 8, FAINT) });
    w.place({ height: 24, draw: (page, top) => draw(page, song.title, MARGIN_X, top - 18, f.bold, 18, INK) });
    if (song.artist) w.place({ height: 16, draw: (page, top) => draw(page, song.artist, MARGIN_X, top - 12, f.regular, 11, MUTED) });

    const runs: [string, RGB][] = [];
    if (song.soundingKey) runs.push(["Key ", FAINT], [song.soundingKey, MUTED]);
    if (!song.isKeyboard && song.capo > 0 && song.shapeKey) {
      runs.push([`${runs.length ? "  ·  " : ""}Capo ${song.capo} — play in `, FAINT], [song.shapeKey, MUTED]);
    }
    if (song.isKeyboard && song.baseCapo > 0) runs.push([`${runs.length ? "  ·  " : ""}shown as it sounds`, FAINT]);
    if (runs.length) w.place({ height: 16, draw: (page, top) => drawRuns(page, runs, MARGIN_X, top - 11, f.regular, 9) });
    w.gap(14);

    w.onContinue = () => {
      w.place({
        height: 22,
        draw: (page, top) => draw(page, `${song.title} — continued`, MARGIN_X, top - 8, f.regular, 8, FAINT),
      });
    };
    for (const section of song.sheet.sections) {
      w.placeTogether(sectionBlocks(section, f));
      w.gap(LYRIC * 1.5);
    }
  });

  pageSlots.forEach(({ page, y }, i) => {
    const num = String(firstPages[i]);
    draw(page, num, MARGIN_X + WIDTH - width(f.mono, num, 9), y, f.mono, 9, FAINT);
  });

  const pages = doc.getPages();
  pages.forEach((page, i) => {
    const y = MARGIN_BOTTOM / 2;
    draw(page, truncate(f.regular, name, 8, WIDTH - 60), MARGIN_X, y, f.regular, 8, FAINT);
    const num = `${i + 1} / ${pages.length}`;
    draw(page, num, MARGIN_X + WIDTH - width(f.mono, num, 8), y, f.mono, 8, FAINT);
  });

  return doc.save();
}
