# Rank Zero

Name a scrapper. Watch them fight.

Rank Zero is a browser game in the "name a fighter, watch it fight by itself, pick one of two rewards when it levels up, come back tomorrow" genre. It is an original game: its theme, names, art, text and numbers are its own.

## State of this branch

The game is being rebuilt from an empty tree. **There is nothing to play yet.** What exists today:

- four empty-but-typed packages with their frozen contracts,
- a reducer that plays a bout log forward, and a checker for the log rules,
- three hand-written bout fixtures and a stick-figure test rig that the lanes build against,
- the repo checks (banned terms, file ownership, size budgets) and CI,
- a placeholder page.

The earlier build of this project was removed in the first commit of the rebuild. Git history keeps it.

## Layout

| Path | Package | Holds | Rules |
|---|---|---|---|
| `packages/core` | `@rankzero/core` | ids, content, creation, progression, the sim, the bout log, the reducer | Pure whole-number code. No browser, no clock, no unseeded randomness. Ids only, never player text. |
| `packages/rig` | `@rankzero/rig` | bones, flat vector parts, clips, poses, drawing | Pure. Draws through a small Canvas 2D subset, so the same code draws in a browser and in Node. |
| `packages/stage` | `@rankzero/stage` | the fight player: timeline, choreography, effects, HUD data, sound cues | Pure. Every frame is a function of the time `t`. |
| `apps/web` | `@rankzero/web` | the React app: screens, fight screen, saves, sound, text | The only place with browser code and player text. |
| `tools/` | | checks, renders, recordings | Dev only. `.mjs` runs with Node, `.ts` runs with `tsx`. |

Dependencies point one way: `core` <- `rig` <- `stage` <- `web`.

The source of the three pure packages compiles without the DOM library and without Node types, so a browser or Node call in it is a compile error (a contract test proves it). Their tests compile with Node types (`tsconfig.test.json`), so a test may read files and hash. The tools have their own `tools/tsconfig.json`, and `pnpm typecheck` checks all of them.

## Commands

Needs Node 24 (CI runs 24) and pnpm 10 (the exact pnpm version is pinned in `package.json`).

```
pnpm install --frozen-lockfile
pnpm dev            # the web app on a local port
pnpm typecheck      # every package
pnpm test           # every package, one after another, two workers each
pnpm build          # typecheck, then the static site in apps/web/dist
pnpm check:terms    # banned names and words
pnpm check:owners   # one owner per file
pnpm smoke          # draws the test rig in Node, writes .review/wp0/smoke.png, fails without a woff2 font
pnpm budgets        # size budgets of the built site (run pnpm build first)
```

These scripts are declared in `package.json` but their tools arrive with later work: `sheet`, `spacing`, `render-bout`, `audit`, `find-bout`, `balance`, `parity`, `record-bout`, `build-audio`, `subset-fonts`, `session`, `shots`, `a11y`.

On a loaded machine a red test run is rerun once before it is believed.

## Working in this repo

**One writer per file.** `OWNERS.json` maps every path to one lane. `pnpm check:owners` fails when a file has no owner or two, and when a lane branch (`rebuild/v2-<lane>`) changes a file it does not own.

**Frozen contracts.** These files are the interfaces between the lanes. Only the lead changes them, and a change bumps `CONTRACT_REV`:

- `packages/core/src/contracts/` (ids, scrappers, content shapes, the bout log and its rules, the reducer, the log checker, the sim's API)
- `packages/rig/src/contracts.ts`
- `packages/stage/src/contracts.ts`
- `apps/web/src/contracts.ts`

**Seam files.** Package `index.ts` files, `apps/web/src/main.tsx` and `apps/web/src/seams/` are where finished lanes are joined. Only the lead edits them.

**Building before the other lanes exist.**

- Fixtures: `import { BOUT_FIXTURES, SNAPSHOTS } from "@rankzero/core/fixtures"`. Three bout logs (`bout-gate`, `bout-all-steps`, `bout-cap`) and six snapshots, checked by the reducer. They are frozen objects: clone one before changing it in a test.
- Checking a log: `checkLog(log)` from `@rankzero/core` returns every broken log rule as a sentence. The rules themselves are written at the top of `packages/core/src/contracts/log.ts`.
- Test rig: `import { capsuleRig } from "@rankzero/rig/testing"`. A complete `Rig` made of sticks, with the real clip lengths and contact times, five recoloured arenas, and strike and hit points measured from what it draws. Both bend a swing toward an aimed height, so the striking end meets a short target or a tall one. `capsuleGateRig` is the same double limited to what a gate-only rig has (13 gate clips with the clip fallback, placeholder companions, straight placeholder weapons, a placeholder Car Door), for testing that path. The app gets its rig from `apps/web/src/seams/rig.ts` only.
- Drawing in Node: `tools/lib/node-canvas.ts`. Drawing in the browser: `apps/web/src/seams/canvas.ts`.
- Opening a browser from a tool: `tools/lib/browser.mjs` (`withBrowser`), which allows one browser at a time on the machine.

**Banned terms.** `pnpm check:terms` keeps the names of other games, and the words of the earlier build, out of every file. One test may name the earlier build's storage prefix, to prove those keys are never touched: `apps/web/test/state/legacy-keys.test.ts` (listed in `tools/banned-terms.allow`).

**Evidence.** Contact sheets, renders and screenshots go to `.review/`, which is git-ignored. A picture counts as evidence only after someone has opened it.

## Originality and licences

Nothing from another game enters this repo: no code, data tables, art, sound, fonts, text or screenshots. All art is flat vector data drawn in code. Sounds and fonts must be CC0, SIL OFL 1.1, Apache 2.0, OGA-BY or CC BY with credit, and each one gets a row in [CREDITS.md](CREDITS.md). How the rules were arrived at is in [docs/PROVENANCE.md](docs/PROVENANCE.md).
