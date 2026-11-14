# Provenance

Where the rules, numbers, names and art of Rank Zero come from. This file says only what is true on the day it was last changed, and it is updated when that changes.

Last changed: 14 November 2026, at the start of the rebuild. The repo holds contracts, fixtures and a test rig. It holds no sim, no balance table, no art and no sound yet.

## The genre and what was learned from it

Rank Zero belongs to a known genre: you name a fighter, it fights by itself, you pick one of two rewards at each level, and you come back the next day. The best-known game of that kind is a 2009 browser auto-fighter, which today has a community-run revival.

Before this game was designed, the following were learned about that genre by reading public pages and public code in a browser:

- the shape of the play loop (one name in, a fixed number of fights a day, a two-card level-up);
- the turn structure of a fight (a timeline of actors, a short script of independent rolls per turn);
- the kinds of stat a weapon carries (speed, damage, reach, and chances to hit, block, combo and disarm).

That is knowledge of how a genre works. Nothing else was taken.

## What was not taken

- No code. Nothing was cloned, downloaded, vendored or installed from that game or its revival.
- No data table. No table of weapons, skills or pets was copied into this repo.
- No art, sprite, sound, font or screenshot.
- No name and no text. The setting (a scrap league in a yard behind a depot), the words (scrapper, bout, Locker, Kit, Route) and every weapon, skill and companion name are this game's own. The weapons are ordinary objects. The reference's set of joke weapons and its trio of pets are not used.

`tools/check-banned-terms.mjs` runs in CI and fails the build if a name of that game, its studio or its revival appears in any file.

## Numbers, as of today

This is the part that must stay exact.

- **No balance number is in the repo yet.** The sim does not exist. The tables of weapon, skill and companion numbers arrive with it.
- What the repo does hold: the list of 63 ids; for each weapon its rarity, tags, swing clip and Reach (`WEAPON_META`); a rarity word for every perk (`RARITY_OF`); the five rarity weights; and two hand-written test bouts whose damage values were worked out from this game's own formulas.
- **How the first values were set.** The design brief set every first value by the role the item plays (fast multi-hitter, slow big hit, reach, and so on), with the genre's public tables as one input among others.
- **A review before the build changed 13 of the 28 weapon rows.** Three rows were broken (they missed most swings), five were weak, and five sat too close to a row of the genre's public table and were moved away from it. The review used a rough model, not the game's sim.
- **Rows tuned by this game's own sim so far: 0.** When the sim lands, its balance pass tunes from its own results and from the roles, never toward another game's table, and this file will then list how many rows moved.

## Art and sound, as of today

- No art file is in the repo. The stick-and-capsule figures in `packages/rig/src/testing/` are a test double written in code.
- All game art will be flat vector data drawn in code from one shared vocabulary of parts. No tracing, no redrawing from another game's art, no generated images.
- No sound and no font is in the repo. Each one will get a row in `CREDITS.md` with its source, author, licence and fetch date.

## The earlier build

An earlier build of this project lived in this repo. It was removed in the first commit of the rebuild, and git history keeps it. One source file was kept: `packages/core/src/prng.ts`, which holds two well-known public algorithms (the mulberry32 generator and the FNV-1a hash) and small whole-number helpers.

## A note on what this file is

These are design rules and a record of how the work was done. They are not legal advice.
