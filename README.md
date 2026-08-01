# AGOGE

*You don't control the fight. You author the fighter.*

**AGOGE** (working title) is an original browser-based auto-battler RPG inspired by the core loop and progression magic of MyBrute (2009) — and deliberately **not a clone**. You speak a name, the Fates forge you a **Champion**, and that Champion trains, brawls and builds a legend in an eternal arena-academy outside time. Fights are fully automatic 30–45-second spectacles shareable as URLs; your skill lives in *authorship*: drafting your Champion's destiny one **Thread of Fate** at a time, out-thinking rivals with a three-slot **Battle Plan**, and growing a **Lineage** of protégés who carry your sigil.

This repository contains the complete research, game design and technical documentation set — plus a **playable prototype** implementing the real deterministic combat sim from the GDD.

## Play the prototype

```bash
pnpm install
pnpm dev        # → http://localhost:5173
pnpm test       # deterministic-sim test suite
pnpm build      # production build
```

Speak a name → the Fates forge your Champion (name-seeded Omen, stats, kit) → set a Battle Plan (Stance / Gambit / Trump) → fight rivals in the Arena → draft your destiny through 1-of-3 Threads of Fate on every level-up. Six Vigor per day (banked to 12), Kleos rating, weapon draw-order authoring, the Tapestry build history — all running on `packages/core`, the pure deterministic sim (mulberry32 seeded PRNG, integer maths, sim v1) that will later run server-side per `docs/04-technical-architecture.md`.

| Package | What it is |
|---|---|
| `packages/core` | Deterministic fight sim + champion generation + draft engine + XP curve. All 24 weapons, 30 skills, 4 beasts, 7 gambits, 10 trump triggers from the GDD. Zero I/O, fully seeded, covered by determinism/invariant/draft-rule tests. |
| `apps/web` | React 19 + Vite prototype client: Forge, Champion Hall, Arena board, Battle Plan sheet, fight theatre with paced narration, Threads of Fate drafts, Tapestry. Saves to localStorage (the server replaces this in MVP). |

Prototype simplifications (deliberate, documented in code): localStorage stands in for the server; rivals are generated ghosts rather than real players' snapshots; the fight theatre is DOM-animated (PixiJS arrives with real art); beasts intercept 25% of attacks so beast-hunting counterplay exists (the GDD specifies only the Nemean Cub's 30% guardian redirect).

## The design in one table

| MyBrute's magic (kept) | MyBrute's failure (fixed) | AGOGE's answer |
|---|---|---|
| 10-second name-only onboarding | Whole fate locked at creation | Name seeds flavour; growth is a 1-of-3 draft with earned rerolls |
| 3-fights-a-day ritual | Pure gate, nothing to decide | 6 Vigor/day + a 10-second Battle Plan mindgame per fight |
| Slot-machine level-ups | Ruined builds, no recourse | Milestone guarantees, Favour rerolls, Aristeia rebirth |
| Pupil/master viral loop | Destroyed by proxy farms | Capped, activity-gated, non-power Lineage rewards |
| Shareable fight URLs | Died with Flash | Web-native deterministic replays with OG-image cards |
| Free and friendly | Monetisation killed the loop | Cosmetics, season Chronicle, supporter Oath — never power |

## Document set

| Document | Covers |
|---|---|
| [docs/00-vision.md](docs/00-vision.md) | **The canonical design contract** — pillars, world, vocabulary, numbers, tech canon |
| [docs/01-research-analysis.md](docs/01-research-analysis.md) | MyBrute teardown (all three generations), nine comparable games, market gap |
| [docs/02-gdd-core.md](docs/02-gdd-core.md) | GDD I: world, onboarding, combat system & formulas, arsenal, progression |
| [docs/03-gdd-systems.md](docs/03-gdd-systems.md) | GDD II: Arena, tournaments, PvE Gauntlet, Phalanx guilds, Sagas, economy, social |
| [docs/04-technical-architecture.md](docs/04-technical-architecture.md) | Stack, deterministic sim core, API, auth, anti-cheat, observability, scaling, costs |
| [docs/05-database-schema.md](docs/05-database-schema.md) | Full Postgres DDL (61 tables), ERDs, Redis keyspace, data lifecycle |
| [docs/06-ui-ux.md](docs/06-ui-ux.md) | Wireframes, flows, responsive system, accessibility, motion spec |
| [docs/07-monetisation-liveops.md](docs/07-monetisation-liveops.md) | Chronicle pass, Patron's Oath, shop, revenue model, LiveOps calendar |
| [docs/08-roadmap.md](docs/08-roadmap.md) | Milestones, prioritisation, risk register, 49 PR-sized implementation increments |
| [docs/research/](docs/research/) | Raw research appendices (gameplay, community, market, tech) |

### Mapping to the original brief's deliverables

1. **MyBrute & similar-games analysis** → `01-research-analysis.md` (+ `docs/research/`)
2. **Innovation & differentiation opportunities** → `01-research-analysis.md` Part 2, `00-vision.md` §3
3. **Full Game Design Document** → `02-gdd-core.md` + `03-gdd-systems.md`
4. **Recommended technology stack** → `04-technical-architecture.md` (canon in `00-vision.md` §6)
5. **Database schema** → `05-database-schema.md`
6. **System architecture** → `04-technical-architecture.md`
7. **UI/UX wireframe recommendations** → `06-ui-ux.md`
8. **Feature roadmap** → `08-roadmap.md` §1–2
9. **Monetisation strategy** → `07-monetisation-liveops.md` §1–4
10. **LiveOps & content update plan** → `07-monetisation-liveops.md` §5–7
11. **Risks & mitigations** → `08-roadmap.md` §3
12. **Phased implementation plan for Claude Code** → `08-roadmap.md` §4 (49 PR-sized increments)

## Key facts

- **Stack:** TypeScript monorepo (pnpm + Turborepo) — pure deterministic sim core shared by server and client, React 19 + Vite + PixiJS web app, Fastify + tRPC API, Supabase (Postgres + anonymous-first Auth), Redis (leaderboards + BullMQ), PostHog/Sentry. ~$40–55/month infra until traction; portrait-first PWA → Capacitor for iOS/Android with no rewrite.
- **Fairness is the brand:** identical Vigor for everyone forever; no loot boxes, no paid power, no paid rerolls. Monetisation is cosmetics, a retroactive never-expiring season Chronicle ($9.99/Saga) and a QoL-only Patron's Oath ($4.99/mo).
- **Targets:** D1 ≥ 35%, D7 ≥ 15%, D30 ≥ 8%; 3–6-minute sessions; launch estimated May–June 2027 for a solo developer working with Claude Code.

## Open decisions

Consequential calls flagged during design, awaiting an owner's ruling (each has a recommendation in its document):

1. **Daily reset at 00:00 UTC** (`04` §7.1) — aligns Agon maths, but check against the target audience's evening hours.
2. **Defenders earn Kleos only, never XP** (`02` §6.1) — the reading of "2 XP per win" that Kleos exchange is built on.
3. **Siege Marks as a separate 2/day token** vs spending Vigor on the Titan raid (`03` §4.2) — second token to teach vs ladder-fight cannibalisation.
4. **Account-scoped wallets** — Favour earned by one Champion can reroll another's drafts (`05` §1).
5. **Chronicle track lives under the Labors tab** rather than beside the Shop (`06` §2).
6. **Dark "golden dusk" theme only at launch**; light theme deferred (`06` §6).
7. **Saga Patron Bundle ($19.99)** — keep, or drop as bundle-maths dilution (`07` §2.7).
8. **Beta viral gate K ≥ 0.15** before launch spend, or a softer 0.10 with strong D7 (`08` §6).
9. **Alpha across the December 2026 holidays** — accept ~6 productive weeks or shift to January (`08` §1).
10. **IP-differentiation legal review pre-Beta** vs deferring to pre-Launch at higher risk (`08` §3).
