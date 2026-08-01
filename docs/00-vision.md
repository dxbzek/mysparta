# AGOGE — Vision Brief (Canonical Design Contract)

> **Working title:** AGOGE *(alternatives held in reserve: KLEOS, ARISTEIA)*
> **Tagline:** *"You don't control the fight. You author the fighter."*
> **Genre:** Persistent async auto-battler RPG · Browser-first, mobile-ready
> **Session length:** 3–6 minutes · **Progression horizon:** months–years
> **Status:** This document is the single source of truth for names, numbers and pillars. Every other design document must conform to it. British spelling throughout (monetisation, armour, favour).

---

## 1. The one-paragraph pitch

AGOGE is a browser RPG where you speak a name and the Fates forge you a **Champion** — a mythic warrior who trains, brawls and builds a legend in an eternal arena-academy outside time. Fights are fully automatic, 30–45 second spectacles you can share as a URL; your skill lives in *authorship*: drafting your Champion's destiny one **Thread of Fate** at a time, setting a three-slot **Battle Plan** that out-thinks your rival's, and growing a **Lineage** of protégés who carry your sigil. It captures MyBrute's legendary 10-second onboarding and 5-minute daily appointment — and fixes everything that killed it: no permanently ruined builds, real tactical agency, an actual endgame, abuse-proof virality, and monetisation players can respect.

## 2. Design pillars (in priority order)

1. **Ten seconds to delight.** Name → Champion → first fight, before any signup. Anonymous-first auth upgrades invisibly to a full account.
2. **Author, don't operate.** All combat is deterministic and automatic. Player expression = fate drafts + Battle Plans + loadouts. Never add mid-fight input.
3. **A ritual, not a grind.** Daily Vigor rations keep sessions short and precious. The game must respect a 5-minute player completely and reward them fully.
4. **No ruined Champions, ever.** Every random offer is a *draft with choice*; every build has a path to relevance; Aristeia rebirth converts any dead-end into legacy.
5. **Legend is social.** Every fight is a shareable replay URL. Every player can be someone's Mentor. Prestige (Kleos) is the endgame currency of respect.
6. **Fair is the brand.** Zero pay-to-win, zero paid randomness, no energy-for-money. We sell identity (cosmetics), ritual (season Chronicle), and comfort (QoL) — never power.

## 3. What we take from MyBrute — and what we fix

| MyBrute's magic (keep) | MyBrute's failure (fix) | AGOGE's answer |
|---|---|---|
| Name-only creation, seeded character | Whole fate locked at creation; bad seeds unfixable | Name seeds *flavour + starting kit*; growth is drafted 1-of-3 (**Threads of Fate**) with earned rerolls (**Favour**) |
| 3 fights/day appointment mechanic | Pure gate, nothing to decide | 6 **Vigor**/day (bank cap 12); each fight preceded by a 10-second **Battle Plan** decision |
| Slot-machine level-up reveal | 2 options, often both bad | 1-of-3 draft, milestone levels guarantee categories; visible **Tapestry** records the path |
| Pupil/master referral XP | Proxy-scripted farms destroyed ladders | **Lineage**: capped, activity-gated, *non-power* rewards (sigils, Obols, titles) |
| Shareable brute URL + fight replays | Flash death killed it all | Web-native deterministic replays with OG-image cards; PWA, no plugins |
| Collection completionism (weapons/skills/pets) | No endgame past collection | **Aristeia** prestige, Olympian league, Titan Sieges, Gauntlet of Labors, seasonal Sagas |
| Free, friendly, funny | Monetisation removed the viral loop (Muxxu) | Monetise cosmetics/ritual/comfort; virality is sacred and free |

## 4. World & lore (original — this is NOT ancient Greece or Sparta-the-place)

**The Eternal Agoge** is an arena-academy adrift outside time — a ring of bronze halls and marble terraces suspended in a golden dusk, where the **Moirai** (the three Fates) weave champions out of memory and myth. No one dies here: a felled Champion bursts into bronze dust and reforms in their alcove, grinning. What persists is **Kleos** — glory — etched forever into the **Stele of Deeds**.

You, the player, are a **Mentor**: an unseen patron voice. Your Champion is your work of art.

Small canonical cast (extend freely, don't rename):
- **The Herald** — booming, affectionate announcer; tutorial voice and hype-man.
- **Lachesis** — the middle Fate; presents Threads of Fate at each level-up, dry wit.
- **Bronte** — one-armed forge-mistress; runs the cosmetic Forge and the shop.
- **Krios** — a chained Titan beneath the arena; the Phalanx (guild) raid boss.

**Art direction:** Greek-vase-painting-meets-modern-motion. Flat, bold 2D characters (terracotta, bronze, lapis, ivory palette), thick silhouettes readable at phone size, exaggerated squash-and-stretch fight animation, painterly backdrops. Warm and witty, never grimdark, never "300". Think *Hades' confidence at Alto's Odyssey's simplicity*.

## 5. Canonical vocabulary & numbers (authors: conform exactly)

### Identity
| Concept | Canonical name |
|---|---|
| Game | **AGOGE** (working title) |
| Player | **Mentor** |
| Player's fighter | **Champion** |
| Guild | **Phalanx** (cap 30 members) |
| Season (8–10 weeks) | **Saga** (patronised by a god: e.g. *Saga of Ares*) |

### Core stats (visible)
| Stat | Governs |
|---|---|
| **Might** | Melee damage |
| **Grace** | Evasion, accuracy, combo, thrown damage |
| **Tempo** | Attack interval, initiative |
| **Grit** | HP pool, companion capacity |

- **HP = 50 + 6 × Grit + 2 × level.** Derived combat stats (initiative, interval, counter, combo, block, accuracy, disarm, armour, crit) exist but are **documented in an in-game Codex** — transparency is a feature, unlike MyBrute's hidden stats.
- **Vigor** (fight tokens): 6/day at daily reset, bank cap 12. Identical for all players forever. Day-one bonus: +6.
- XP: 2 per win, 1 per loss; fight vs higher-rated yields +1 bonus. Soft level cap 50 per Aristeia cycle.

### Progression
- **Threads of Fate** — on level-up, draft **1 of 3** offers (stat +3 / stat +2&+1 / weapon / skill / companion). At least one stat offer always present; milestone levels (5, 10, 15…) guarantee at least one non-stat offer.
- **Favour** — earned reroll tokens (never purchasable). Reroll one draft entirely.
- **Tapestry** — the visible, shareable history of every draft your Champion took.
- **Aristeia** — prestige rebirth available at level 30+: Champion resets to level 1, keeps name, cosmetic legacy sigils and a small *account-wide* lineage perk (+1 Favour per Saga, cosmetic border tiers). Full re-draft of the build.

### Combat
- Fully automatic, server-simulated, deterministic (seed + sim version + combatant snapshots → identical replay). Fight length 30–45 s, skippable, 2× speed.
- **Battle Plan** (set pre-fight, 3 slots — the tactical mindgame):
  - **Stance:** *Aggressive / Measured / Guarded* (shifts derived-stat weights).
  - **Gambit:** opening behaviour (e.g. *Hurl First, Close the Gap, Hold Ground, Feint*).
  - **Trump:** a conditioned ultimate — *"When first bloodied → Wrath of Herakles"*.
- Attacker sees the defender's public loadout and *last-known* Battle Plan, not the current one — bluffing is the metagame.

### Arsenal (launch content)
- **6 weapon disciplines, 24 weapons:** **Doru** (spear — reach/counter), **Xiphos** (blade — balanced), **Cestus** (fists — fast/combo), **Labrys** (great-axe — slow/huge), **Akontia** (thrown — Grace-scaled, armour-piercing), **Aspis** (shield — defence, disarmable).
- **~30 skills** in three families: **Boons** (passives), **Techniques** (auto-triggered actives), **Trumps** (player-conditioned ultimates).
- **Beasts of Legend** (companions, Grit tax): **Lykos** wolf (−2 Grit, up to 3), **Kalydon Boar** (−5), **Stymphal Shrike** (−4, fast harasser), **Nemean Cub** (−6, tank). One non-wolf beast max.
- Equipment is **horizontal** (unlocks and trade-offs, not +power tiers). No gear-grind, no upgrade currencies on gear.

### Modes & meta
- **Arena** — async PvP vs 6 rivals near your **Kleos** rating (Glicko-2). Leagues per Saga: **Bronze → Silver → Gold → Marble → Olympian**.
- **Agon** — daily single-elimination tournament, auto-resolved hourly; prestige laurels, no XP. **Grand Agon** closes each Saga.
- **Gauntlet of Labors** — weekly 12-rung PvE ladder vs authored bosses with modifiers; source of **Trophies**.
- **Phalanx** (guild): **Titan Siege** (persistent raid boss Krios, damage accumulates for days), **Skirmish** (opt-in war: 7 champions/day per side, first to 4 wins), phalanx banner cosmetics.
- **Labors** — 3 short daily quests + 1 weekly **Epic Labor**. **Eternal Flame** streak with **Ember** freezes (humane, Duolingo-style).
- **Lineage** — challenge links; a new player who joins through your link becomes your **Protégé**. Rewards are capped, D7-activity-gated and non-power: sigils, Obols, titles, both-sided cosmetic boons. Every fight has a shareable replay URL.
- **Stele of Deeds** — achievements; feed titles and Kleos-adjacent bragging rights.

### Economy
| Currency | Nature | Sources | Sinks |
|---|---|---|---|
| **Obols** | Soft, earned | Fights, Labors, Lineage, pass | Cosmetics, Forge, slot expansion |
| **Ichor** | Premium (paid) | Purchase only | Cosmetics, Chronicle, slots — **never power** |
| **Favour** | Reroll token | Play milestones only | Fate-draft rerolls |
| **Trophies** | PvE material | Gauntlet, Sieges | Forge (cosmetic crafting) |
| **Kleos** | Rating/prestige | Ranked fights | League placement (not spendable) |

- **Forge** (crafting): cosmetic-only — transmute Trophies and duplicate unlocks into skins, VFX palettes, victory poses, arena backdrops. No stat crafting.

### Monetisation (ethical, cosmetic/ritual/comfort)
- **Chronicle** — season pass, **$9.99/Saga**: dual-track (free + premium), ~60 tiers, cosmetics + Obols + Ember freezes; **retroactive and never expires** (Deep Rock Galactic model — buy any past Chronicle, progress at leisure).
- **Patron's Oath** — **$4.99/month** supporter subscription: QoL only (extra loadout presets, full Tapestry analytics, replay theatre, profile flair, monthly cosmetic gift). **No Vigor, no XP, no power.**
- **Cosmetics shop** — direct purchase only, prices visible in real currency terms. **No loot boxes, no paid randomness** (EU regulatory posture + our brand).
- **Champion slots** — 2 free, more via Obols or Ichor (convenience, capped at 6).
- Red lines: never sell Vigor, XP, stats, rerolls, gear, or ranked entry. The Bazaar's 2025 revolt is our cautionary tale.

### KPI targets
- D1 ≥ 35% · D7 ≥ 15% · D30 ≥ 8% (GameAnalytics medians: 27/8/<3 — we aim top quartile).
- Median session 3–6 min, 1.5–2.5 sessions/day. Conversion to payer ≥ 3% by M6; ARPDAU target modest, LTV via longevity.

## 6. Technical canon (details in the architecture doc — do not contradict)

- **TypeScript monorepo** (pnpm + Turborepo): `packages/core` (pure deterministic sim: mulberry32 seeded PRNG, integer maths, `simVersion` on every fight), `packages/protocol` (shared types/schemas), `apps/web` (React 19 + Vite; PixiJS canvas for the fight scene, DOM for UI), `apps/api` (Fastify + tRPC), `apps/admin` (internal React admin).
- **Supabase**: Postgres (source of truth) + Auth (anonymous-first → linked account, cross-device cloud save by construction). **Redis** (Upstash): leaderboard sorted sets, BullMQ job queues (tournaments, resets). SSE/polling first for live brackets; sockets only when proven necessary.
- **Server-authoritative everything**: client sends intent, server picks seeds and simulates, client is a pure replay renderer. This is the anti-cheat foundation.
- Fights stored as: seed + simVersion + both combatant snapshots (JSONB) + result; replays re-simulated on demand.
- **PostHog** (analytics + flags + A/B), **Sentry**, **pino + OpenTelemetry**. Hosting: Cloudflare Pages (web) + Fly.io (api) + Supabase + Upstash; ~$30–60/month until traction.
- **Mobile path:** responsive portrait-first PWA from day one (44 px touch targets, safe-area insets, <3 MB initial payload) → Capacitor wrap for iOS/Android with push + IAP adapters. No rewrite.

## 7. Document map (the full deliverable set)

| Doc | Contents |
|---|---|
| `00-vision.md` | This contract |
| `01-research-analysis.md` | MyBrute & market teardown, innovation opportunities |
| `02-gdd-core.md` | GDD I: world, loop, combat, stats, arsenal, progression |
| `03-gdd-systems.md` | GDD II: PvP/PvE, Phalanx, Sagas, economy, social, endgame |
| `04-technical-architecture.md` | Stack, system design, security, anti-cheat, scaling |
| `05-database-schema.md` | Postgres DDL, ERD, Redis keyspace |
| `06-ui-ux.md` | Wireframes, flows, responsive & accessibility spec |
| `07-monetisation-liveops.md` | Monetisation detail, LiveOps calendar, content cadence |
| `08-roadmap.md` | Milestones, prioritisation, risks, phased implementation plan |
| `research/` | Raw research appendices (gameplay, community, market, tech) |
