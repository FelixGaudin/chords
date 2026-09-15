# Chords

A chord songbook. Chords and lyrics only — no tablature, no ads, no login.

Search Ultimate Guitar from the app (or paste a song in), and it becomes a clean,
transposable page with fingering hints for **guitar, piano, ukulele and banjo**.
Built to be read off a phone propped on a music stand.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

For everyday use:

```bash
npm run build && npm start
```

### With Docker

```bash
docker compose up -d --build      # http://localhost:23647
docker compose logs -f
docker compose down
```

`./data` is bind-mounted into the container, so the library stays a folder of
JSON files on the host — same files, whether you run it with Docker or not.

Two knobs, both optional:

| Variable     | Default | Purpose                                        |
| ------------ | ------- | ---------------------------------------------- |
| `CHORDS_PORT` | `23647` | Host port to publish                           |
| `CHORDS_UID`  | `1000`  | User the container runs as — must own `./data`  |
| `CHORDS_GID`  | `1000`  | Group to match                                 |

If `id -u` isn't 1000, start it with `CHORDS_UID=$(id -u) CHORDS_GID=$(id -g)
docker compose up -d`, or the container won't be able to write to the mount.

Songs are plain JSON files in `data/songs/`. Back the folder up, sync it, or
edit the files by hand — there's no database. Set `CHORDS_DATA_DIR` to keep them
somewhere else.

## What it does

**Import.** Search Ultimate Guitar by title, artist or both and pick a version
off the list — the sheet is fetched on the click, no visit to the site needed.
Songs you already have are flagged in that list: *Already imported* for the very
sheet, *In library* for another version of the same song, since Ultimate Guitar
lists a dozen versions of everything. The same note sits above the editor before
you save, so a duplicate is never a surprise.
Pasting an Ultimate Guitar link works the same way: the chord sheet is pulled
out of the page and converted. Other chord sites are read generically: the sheet is
usually inside a `<pre>` block, and failing that the page text is scanned for
the stretch of lines that look like chords. Sites that block automated requests
will say so, and the *Paste text* tab always works — it understands both the
usual "chords above lyrics" layout and ChordPro with `[brackets]`.

**Reading.** Chords stay glued to the syllable they sit above, and lines reflow
instead of scrolling sideways, so a wide sheet still reads on a narrow screen.
Transpose, move the capo, resize the text, or start a steady auto-scroll (which
keeps the screen awake while it runs). Settings stick per song.

**Chord hints.** Every chord in the song appears as a diagram in a strip at the
top. Point at any chord — in the sheet or in the strip — and a card shows its
shapes with fingering numbers and the notes it's built from; click to pin the
card open, Escape or a click away to dismiss. Phones have no pointer, so there
a tap opens the same thing as a sheet from the bottom of the screen. Shapes are
*worked out from each instrument's tuning* rather
than looked up, so unusual chords work as well as common ones — with a handful
of hand-checked shapes (open C, F, G…) taking priority where a player would
expect the familiar one.

### Capo, and what the numbers mean

A sheet's printed chords are the shapes you finger, already accounting for the
capo it was written for. So Hallelujah imports as *key Db, capo 1* and prints C
and Am — the shapes. Moving the capo away from that re-fingers the song at a new
position without changing how it sounds; transposing changes the key itself.

A capo is a fretted-instrument device, so **piano ignores it entirely** and
shows the chords at the pitch the song actually sounds — Hallelujah reads Db and
Bbm on piano while the guitar reads C and Am. The capo control disappears when
piano is selected, because there is nothing for it to do.

## Checks

```bash
npm run check          # typecheck + both suites below
npm run check:chords   # every chord shape must actually spell its chord
npm run check:import   # entity decoding, conversion, duplicate matching
npm run build
```

`check:chords` validates the hand-written and movable shapes, then generates
every quality on every root for every fretted instrument — around 1850 shapes —
asserting each one contains only chord tones, keeps its essential notes, and
stays inside a four-fret span.

`check:import` covers the scraping layer, mostly HTML entities: song pages are
full of accents, and an entity the decoder doesn't know leaks through as raw
`&Ccedil;` text. It also pins down what counts as a duplicate — the same sheet,
another version of the same song, or a different song that happens to share a
title.

## Layout

```
src/lib/music.ts        note names, chord parsing, transposition
src/lib/voicings.ts     shape generator + the hand-checked shapes
src/lib/instruments.ts  tunings
src/lib/sheet.ts        ChordPro -> render structure
src/lib/convert.ts      "chords above lyrics" -> ChordPro
src/lib/import.ts       fetching and scraping song pages
src/lib/duplicates.ts   matching an import against the library
src/lib/db.ts           JSON file storage
Dockerfile              three-stage build -> standalone server image
docker-compose.yml      published port + the ./data bind mount
```
