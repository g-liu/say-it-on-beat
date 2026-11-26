# Say It on Beat: violin and viola class edition

A classroom version of the "Say the Word on Beat" game for violin class. Eight cards appear one at a time over a drum beat. Then each card lights up on the beat, and the class says it out loud.

Play it at **https://g-liu.github.io/say-it-on-beat/**, or open `index.html` in a browser. There's no install, build step or internet connection needed. The notation uses the Leland music font (the one MuseScore uses), built into the stylesheet, and the music is made with Web Audio.

## Violin, viola or both

The switch at the top of the setup screen picks the instrument for the whole page:

- **Violin**: notes in treble clef; home position on G D A E.
- **Viola**: notes in alto clef; home position on C G D A (the C string is C D E F, the same high-2 pattern).
- **Both**, for a mixed class: home position on all five strings, ranges go down to the viola's C, and cards that show notes (note names, key signatures, scale degrees) can be in treble or alto clef, or **alternate** between them on consecutive cards.

Markings (dynamics, bowings, clefs and so on) are the same for every instrument.

## Categories

The setup screen has two tabs:

- **Notes, reading & markings**: everything you turn on here is mixed together in each round.
- **Rhythms**: rhythm cards last a whole measure, so rhythms are practiced on their own.

Only the open tab is played. Each tab has categories split into subcategories. Tick a subcategory's checkbox to turn it on (it remembers what you picked last time, or starts with its defaults), pick individual items with the chips, or press **All** to pick every chip.

- **Note names**
  - **Home position**: G A B C, D E F♯ G, A B C♯ D, E F♯ G♯ A B, on the strings you pick
  - **Diatonic note names**, chosen one of three ways:
    - **Scale**: one menu that goes around the circle of fifths: C major and A natural, harmonic and melodic minor, then 1 sharp through 6 sharps, then 1 flat through 6 flats. Each major key is followed by its relative minors. Scales are 1 or 2 octaves, starting from the lowest tonic at or above open G. Melodic minor includes both the raised (going up) and natural (coming down) 6th and 7th. G♯ and D♯ minor use double sharps.
    - **Chromatic**: every natural, sharp and flat in a range you pick. C♯ and D♭ are separate cards.
    - **Pick notes**: choose exact spellings (C♯ is not the same card as D♭; E♯, B♯, C♭ and F♭ are available too), in a range you pick.
- **Note values**
  - **Basic**: eighth, quarter, half and whole notes and their rests
  - **Advanced**: dotted notes, sixteenths, triplets
- **Note reading**
  - **Key signatures**: name the major key, from C through 6 sharps and 6 flats
  - **Scale degrees**: a note in a key (with its key signature); the class names its scale degree, shown as a number with a circumflex, like 3̂. Pick the degrees (1–7) and the keys (any major or minor key, default C major; minor keys use natural minor). One key is recommended; several keys is difficult.
  - **Intervals**: two notes from a key's scale, with its key signature, one after the other or together; the class names the interval ("Major 3rd"). Pick the intervals (unison to major 10th) and the keys.
- **Chords**: each subcategory has chips in four tiers (Simple, Medium, Advanced, Uncommon); Simple is picked when you turn it on.
  - **Naming chords**: a chord in notation with no key signature; the class names it ("D minor", "G7"). Simple: major, minor, dominant 7th. Medium: diminished, 1st and 2nd inversions. Advanced: augmented, major/minor/half-diminished/diminished 7ths, add 2, add 4, 9ths, 11ths, sus. Uncommon: 13ths, minor-major 7th, 6th chords, 7♭9.
  - **Spelling chords**: a Roman numeral in a key ("IV in C major"); the class spells it from the bass up ("F A C"). Simple: I, IV, V, V7 (i, iv, V, V7 in minor). Medium: ii, iii, vi, vii°, cadential 6/4. Advanced: 7th chords, augmented, Italian/French/German augmented sixths, add 2, add 4, V9, V11. Uncommon: Neapolitan, secondary dominants, borrowed chords, V13. Pick the keys (any major or minor key), and show Roman numerals or function names ("Subdominant").
  - **Cadences**: two chords in a key; the class names the cadence. Simple: perfect and imperfect authentic, half, plagal. Medium: deceptive, half cadences from ii6 and the cadential 6/4. Advanced: Phrygian half, Picardy third. Uncommon: minor plagal, deceptive to ♭VI.
- **Markings**
  - **Dynamics**: pp to ff, sfz, fp, crescendo and decrescendo
  - **Bowing & articulation**: bowings, slur and tie, articulations, fermata, pizz./arco, accidentals
  - **Repeats**: repeat sign, endings, D.C. al Fine, Fine, coda, final barline
  - **Clefs**: treble, bass, alto, tenor
  - **Advanced & contemporary**: marcato, staccatissimo, accent combinations, portato, Bartók and buzz pizzicato, harmonics, tremolo, glissando, X noteheads, quarter tones, short and long fermatas, caesura, sfp, al niente, col legno, sul ponticello, sul tasto, flautando, con/senza sordino, senza vibrato
- **Rhythms** (its own tab): one measure per card.
  - **Time signatures**: Simple (2/4, 3/4, 4/4, common time C, cut time ¢, 3/8, 6/8) and Complex (2/2, 3/2, 5/4, 7/8, 9/8, 12/8). C and ¢ work exactly like 4/4 and 2/2. 2/4, 3/4 and 4/4 are picked when you turn it on. With several, each round uses the next one.
  - **Note values**: buttons with the note symbols: sixteenths, eighths, quarters, halves, whole notes, dotted eighth + sixteenth, dotted quarters, dotted halves, triplets (in simple meters), duplets (in 6/8, 9/8, 12/8) and rests. Values that don't fit the picked time signatures are greyed out. Defaults: eighths, quarters, halves, wholes, dotted halves (for 3/4) and rests.
  - Compound meters beat in dotted quarters, and 7/8 is grouped 2+2+3, with the music following the meter. Simple meters are counted "1 e & a" (and "1 trip let"); x/8 meters are counted by eighths. Turn on **Clap the rhythm** to have the computer clap each card during "Say it!".

## Running a round

1. **Count-in** (one bar)
2. **Watch**: the 8 cards appear, one per beat
3. **Say it!**: each card lights up on the beat (rhythm cards stay lit for one measure)
4. **Answers** (optional): every card shows what to say

**Card order.** By default ("Progressively more random") the first rounds follow patterns, where each letter is a different card:

| Round | Level | Example patterns |
| --- | --- | --- |
| 1–2 | Easy | `AABB AABB`, `AAAA BBBB`, `ABBB ABBB`, `AABB CCCC` |
| 3 | Medium | `ABAB BABA`, `ABAB CDCD` |
| 4 | Hard | `ABCA BCAB`, `ABAA BCBB` |
| 5 on | Random | no pattern |

You can switch to random every round instead. The current level shows under the round number.

Options: starting tempo (40–220 BPM), number of rounds, speed up each round by a percentage (1–25%, default 5%, up to 400 BPM), show answers, and memory mode, where cards flip face down before the class says them. Settings are saved in the browser.

**Preview cards** shows every card in the selected categories with its answer.

## Keyboard

| Key | Action |
| --- | --- |
| Space | Start / pause / resume |
| F | Full screen |
| R | Restart this round |
| N or → | Next round |
| A | Show or hide answers |
| Q | End and go back to setup |

The on-screen controls hide while the game is running. Move the mouse to bring them back.

## Files

- `js/notation.js`: places Leland's symbols (clefs, notes, rests, accidentals, dynamics, articulations) and draws staff lines, stems, beams and barlines in SVG
- `css/music-font.css`: the symbols the app uses from Leland, embedded so the page works offline. Generated; don't edit.
- `tools/build_font.py`: rebuilds `css/music-font.css` from the submodule
- `vendor/leland`: the [Leland](https://github.com/MuseScoreFonts/Leland) font, as a git submodule
- `js/theory.js`: spelling notes, keys, intervals, chords and cadences (no drawing). `node tools/check_theory.js` prints every chord, cadence and interval answer for checking.
- `js/content.js`: the categories, subcategories and cards, and the rhythm generator
- `js/audio.js`: drum machine, bass, chords and clap, following the time signature
- `js/game.js`: setup screen, round planning, beat scheduling, controls

## Hosting

GitHub Pages serves the site from the root of `main` (Settings → Pages → Deploy from a branch → `main` / root), so every push updates it. `.nojekyll` tells Pages to serve the files as they are.

## Music font

The symbols come from [Leland](https://github.com/MuseScoreFonts/Leland), copyright MuseScore BVBA, under the SIL Open Font License 1.1 (`fonts/OFL.txt`). The license reserves the name "Leland", so the trimmed copy in `css/music-font.css` is named "SayItOnBeat Music".

To rebuild it, for example after updating Leland or adding a symbol to `GLYPHS` in `js/notation.js` and `CODEPOINTS` in the script:

```
git submodule update --init
pip install fonttools
python3 tools/build_font.py
```
