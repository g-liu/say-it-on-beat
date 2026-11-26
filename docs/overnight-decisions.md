# Overnight decisions

One line per decision made while Geoffrey was away: request number, what was chosen, the main alternative, and where to change it.

| Req | Decision | Alternative | Where to change |
| --- | --- | --- | --- |
| 1 | Two tabs above the categories: "Notes, reading & markings" and "Rhythms". Only the open tab is played; picks in the other tab are kept but ignored. | A separate "mode" switch, or disabling the other categories in place | `TABS` in js/content.js; `tabSubs`/`activeSubs` in js/game.js |
| 1 | A subcategory's checkbox now switches it on/off: on restores its last picks (or its defaults), off clears them but remembers them. A small "All" button picks every chip. | Checkbox = select all / clear (old behavior) | `.selall` change handler and `defaultChips` in js/game.js; `defaults` on a subcategory in js/content.js |
| 1 | Final barline moved to Repeats along with repeat sign, endings, D.C. al Fine, Fine, Coda; accidentals stay in Bowing & articulation. | Leave final barline in Bowing & articulation | `REPEAT_ITEMS` / `RELOCATED_CHIPS` in js/content.js |
| 1 | Old saved settings that had both rhythms and other cards on open on the "Notes, reading & markings" tab. | Open on Rhythms | `loadSettings` in js/game.js |
| 2 | The instrument switch sits in the page header. Violin = treble clef, Viola = alto clef, Both = a "Clef for notes" choice: Alternate (default), Treble or Alto. Alternate means card 1 treble, card 2 alto, and so on, even when a pattern repeats a card. | Default Both to treble only; alternate per round instead of per card | `INSTRUMENTS`, `CLEF_MODES`, `clefFor` in js/content.js |
| 2 | Key signature cards also follow the clef (they show a clef even though they have no notes). Clef cards and other Markings never change. | Keep key signature cards in treble always | `KEY_ITEMS` in js/content.js (`draw` vs `svg`) |
| 2 | Viola home position on the A string is A B C♯ D (like the violin's A string); only the violin's top string (E) gets the 4th-finger B. | Add E5 (4th finger) to the viola's A string | `HOME_SEMIS` in js/content.js |
| 2 | When you switch instrument and every string of the old one was picked in Home position, every string of the new one gets picked. | Leave the picks alone (C string would start off) | `instrumentSwitch` handler in js/game.js |
| 2 | Scale degree cards keep starting at or above G3 for every instrument. | Start at the viola's C3 in viola mode | `degreePool` in js/content.js |
