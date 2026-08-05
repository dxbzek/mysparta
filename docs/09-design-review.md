# RANK ZERO — screen-by-screen design review

> A pass over every screen the player can reach, asking one question each:
> **what is this screen for, and does it look like someone decided that?**
> Recorded so the next pass has a baseline to argue with rather than a blank
> page. Reviewed at 1100×860 desktop and 375×812 mobile, prototype build.

## The rules this game's UI follows

Written down because they were implicit, and an implicit rule cannot be
broken on purpose.

1. **One verb per screen.** Every screen has at most one gold `.btn.primary`.
   Gold means *the thing you came here to do*; everything else is ghost or
   tiny. The Arena is the deliberate exception — its six Fight buttons *are*
   the screen, one per rival.
2. **The champion is the hero image.** Where the champion appears they are
   full bleed and pixel-exact, never a thumbnail beside text.
3. **Numbers earn their place.** A stat is a labelled bar with its value on
   it, not a number on a dotted line. Nothing is repeated between the top bar
   and a card.
4. **Prose is a phone's first casualty.** Every aside is `.say-more` and
   disappears under 560px; the sentence still reads without it.
5. **One palette.** Parchment ground, ink text, gold for action, terracotta
   for danger, olive/red for win/loss. No imported neon.

## Screen verdicts

| Screen | Purpose | Verdict |
| --- | --- | --- |
| **Forge** | Name → hunter, then make them yours | Two steps, no scrollbar, one gold verb per step. The name field is the whole first screen, which is right: the name *is* the character. |
| **Hall** | Your champion, and the button that matters | 6 cards, 1 `h2`, 5 `h3`, exactly one gold button. Portrait full bleed; Fight above the fold on a 812px phone. Tasks demoted to a small toggle after review. |
| **Arena** | Choose an opponent | Six rival cards, each a decision: threat label, kit at a glance, the exact rating you win or lose. Standings sit *below* the board they comment on. |
| **Fight** | Watch it happen | Stage scales to an integer pixel factor from both width and height; verdict banner above the fighters; rewards wrap inside the stage. Feed doubles as the screen-reader account. |
| **Codex** | Everything the Rift can give | 125 tiles in four counted cases, greyed until found. Its job is desire, and a greyed tile does that better than a list. |
| **Ladder** | Where you stand | 31 rows, your seat highlighted, and a line naming exactly who to beat next — the retention hook, stated rather than implied. |
| **Level-up modal** | The payoff | Two facts and a Claim. Shrunk twice after review; art on a pet reveal, not on a stat line. |

## Known and accepted

- **Level 40→50 costs ~740 fights** (~4 months at 6/day). Deliberate per
  `02-gdd-core.md` §6.2 — Aristeia at 30 is the intended exit, not the cap.
- **The sprite base is LPC** (CC BY-SA 3.0 / GPL 3.0, credited in the
  footer); arenas, icons, pets, VFX and all audio are generated in-engine.
- **No FPS number.** Every animation is CSS on the compositor, and the
  harness throttles `requestAnimationFrame` offscreen, so a real figure needs
  a device. Heap held at 19 MB across a dozen fights — no leak signal.

## Open, and not mine to close

- **Deployment.** `apps/api` and `migrations/0001_cloud_save.sql` exist and
  are tested; nothing is pointed at a database yet.
- **Feel.** Whether this reads as a commercial indie game is a judgment that
  needs hands on it, on a real phone. Every finding in this document that
  came from *looking* — the whitespace, the oversized cards, the misaligned
  steppers — was found by a person pointing, not by a sweep.
