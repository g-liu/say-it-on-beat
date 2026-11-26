# Say It on Beat: violin class edition

A classroom version of the "Say the Word on Beat" game for violin class. Eight cards appear one at a time over a drum beat. Then each card lights up on the beat, and the class says it out loud.

Open `index.html` in a browser. There's no install, build step or internet connection needed. All the notation is drawn in SVG and the music is made with Web Audio.

## Categories

Pick one category or several. Picking several mixes them together in each round.

- **Note names**: each string, open to 4th finger, in home position. You can limit it to certain strings (G, D, A, E).
- **Basic note values**: eighth, quarter, half and whole notes, and their rests
- **Advanced note values**: dotted notes, triplets, sixteenths
- **Note names with sharps** / **with flats**
- **Key signatures**: up to 4 sharps or 4 flats
- **Clefs**: treble, bass, alto, tenor
- **Triple meter rhythms (3/4)** and **Double meter rhythms (4/4)**: one measure per card, with a basic or advanced level. Rhythm cards get their own rounds, because each card lasts a full measure.
- **Dynamics**: pp to ff, sfz, fp, crescendo and decrescendo
- **Symbols**: bowing, articulation, dynamics, repeats, endings, D.C. al Fine, coda, accidentals

## Running a round

1. **Count-in** (one bar)
2. **Watch**: the 8 cards appear, one per beat
3. **Say it!**: each card lights up on the beat (rhythm cards stay lit for one measure)
4. **Answers** (optional): every card shows what to say

Options: starting tempo, number of rounds, speed up each round, show answers, and memory mode, where cards flip face down before the class says them. Settings are saved in the browser.

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

- `js/notation.js`: SVG staff, clefs, notes, rests and symbols
- `js/content.js`: the categories and their cards
- `js/audio.js`: drum machine, bass and chords
- `js/game.js`: setup screen, round planning, beat scheduling, controls
