# Overnight decisions

One line per decision made while Geoffrey was away: request number, what was chosen, the main alternative, and where to change it.

| Req | Decision | Alternative | Where to change |
| --- | --- | --- | --- |
| 1 | Two tabs above the categories: "Notes, reading & markings" and "Rhythms". Only the open tab is played; picks in the other tab are kept but ignored. | A separate "mode" switch, or disabling the other categories in place | `TABS` in js/content.js; `tabSubs`/`activeSubs` in js/game.js |
| 1 | A subcategory's checkbox now switches it on/off: on restores its last picks (or its defaults), off clears them but remembers them. A small "All" button picks every chip. | Checkbox = select all / clear (old behavior) | `.selall` change handler and `defaultChips` in js/game.js; `defaults` on a subcategory in js/content.js |
| 1 | Final barline moved to Repeats along with repeat sign, endings, D.C. al Fine, Fine, Coda; accidentals stay in Bowing & articulation. | Leave final barline in Bowing & articulation | `REPEAT_ITEMS` / `RELOCATED_CHIPS` in js/content.js |
| 1 | Old saved settings that had both rhythms and other cards on open on the "Notes, reading & markings" tab. | Open on Rhythms | `loadSettings` in js/game.js |
