# Technical Architecture for a Scalable Browser Auto-Battler RPG

Research report for a MyBrute-inspired (not cloned) async-PvP browser RPG. Target: TypeScript everywhere, thousands of CCU, budget hosting, later mobile from the same codebase. Reflects 2024–2026 practice.

---

## 1. Deterministic Combat Simulation

### The core pattern
The industry-standard pattern for async auto-battlers is: **server runs the fight once from a seed, persists a compact result + step log, and the client replays it as an animation**. The same seed + same inputs + same sim version must always produce the same fight. This is the same principle as deterministic lockstep in RTS games, minus the networking: "do not use any truly random numbers, but precalculated ones based on a fixed random seed; have a constant simulation rate, and detach the frame rate from the sim rate" (Unity forum consensus, echoed in Cliffski's 2026 deterministic space auto-battler devlog).

Concrete reference: **the actual LaBrute revival (Zenoo/labrute, the Eternaltwin remake of MyBrute)** is a pnpm-workspace TypeScript monorepo with `client/` (React + Vite + MUI), `server/` (Node + Express + Prisma + PostgreSQL), and a **`core/` package shared between front and back**. The server generates the fight; the client fetches a fight record by UUID (e.g. `labrute.eternaltwin.org/-MyBrute/fight/<uuid>`) and animates the stored step list. This is the exact architecture to emulate.

**OpenFrontIO** (browser RTS, TypeScript) is the best open example of the shared-sim discipline at larger scale: `src/core/` runs identically in Node and the browser; the server coordinates turns; and "game archives can be re-executed deterministically by loading a GameRecord" — i.e. replays are just (seed + inputs), not video or state snapshots.

### RNG choice
- Use a tiny, seedable PRNG — **mulberry32 or splitmix32** (32-bit state, ~1 line each) or `seedrandom` for string seeds. Mulberry32 "lets you replay generated game worlds from a seed"; its state is small enough to copy/branch.
- **One PRNG instance per fight**, passed explicitly through the sim — never `Math.random()`. Optionally separate streams per subsystem (loot roll vs. combat roll) to avoid call-order coupling.
- Determinism killers to ban in the sim package: `Date.now()`, `Math.random()`, object-key iteration order dependence, `Array.sort` without a total-order comparator, floating-point accumulation across platforms (prefer integers for HP/damage — MyBrute-style stats are integers anyway, so this is cheap), and any locale/Intl call.

### Sim package design
- `packages/game-core`: pure functions, zero I/O, zero DOM/Node APIs. Exports `simulateFight(seed, fighterA, fighterB, config) -> { winner, steps[], finalState }`.
- **Version the sim** (`simVersion` stored on every fight row). When you rebalance, old replays must run on the old rules — either keep old code paths behind the version flag, or accept that old replays only store the step log (not re-simulate). Storing the full step log as JSONB makes old replays immune to balance patches; storing only the seed is smaller but couples replays to code versions. Pragmatic answer: **store both** — seed + version for verification, step log for playback.
- Golden tests: fixture seeds with snapshot step logs in CI catch accidental nondeterminism instantly.

### How Super Auto Pets does it
Super Auto Pets' Arena "selects an opponent from a database of teams created by other players on the same turn" — opponents are **ghosts** (snapshots), not live players. Battles are computed server-side by the Team Wood Games server and clients request "the output for a battle" for replay/sharing. That is the model: **snapshot the defender's loadout at fight time**, store it in the fight record so the replay never breaks when the defender levels up.

---

## 2. Backend for a TS Monorepo

| Option | Fit | Notes (2025–26) |
|---|---|---|
| **Fastify** | Best default | 2–3× faster than Express-class frameworks, JSON-schema validation built in, minimal opinions; pairs cleanly with tRPC |
| **Hono** | Best if edge-curious | Web-standards, zero-dep core, runs on Node/Bun/Workers; Hono RPC gives typed clients |
| **NestJS** | Overkill here | DI + enterprise structure; slower iteration for a 1–3 person game team |
| **Express** | Only for LaBrute parity | The actual labrute remake uses it; fine, but Fastify is the modern pick |

API style: **tRPC wins for a pure-TS monorepo** ("in 2026, tRPC wins for pure TypeScript monorepos; ts-rest when you need REST+OpenAPI; Hono RPC for edge"). A game API is a private API consumed only by your own client — you don't need OpenAPI or GraphQL flexibility. GraphQL adds resolver complexity and caching pain for zero benefit at this scale. Keep 2–3 plain REST endpoints only where needed (webhooks, health, share-link fight fetch for social embeds).

### Supabase-as-backend vs. dedicated Node service
- **Supabase for MVP is pragmatic**: Postgres + Auth + Realtime + Storage + Edge Functions, $0 to start, **Pro $25/mo**; typical stacks report "$0–200/month for the first 6 months, then $75–150/month at 1,000+ users." No lock-in on data (standard Postgres, exportable), but "client libraries and auth create coupling that makes migration harder the longer you stay."
- **Key caveat for this game**: Edge Functions run **Deno, not Node**, and are a poor home for a CPU-bound fight simulator or scheduled tournaments. The fight sim wants a long-lived Node process.
- **Recommended hybrid (best of both)**: Supabase for Postgres + Auth + Storage; a **small dedicated Node (Fastify + tRPC) service** owning the sim, matchmaking, and jobs, connecting to Supabase's Postgres via the pooler. Migration path is then trivial: Supabase is "just Postgres + Auth" and the Node service already owns all game logic — you can later self-host Postgres or swap auth without touching the sim.

---

## 3. Database Design (Postgres) + Redis

### Schema patterns
- **Relational core, JSONB leaves.** `players`, `characters` (a player can own several brutes-equivalents), `items`, `character_items`, `fights`, `seasons`, `guilds`, `guild_members`, `tournaments`, `tournament_entries` as normal relational tables. Use JSONB for the parts that churn with balance patches: `characters.loadout jsonb` (skills/weapons/pet equivalents), `fights.steps jsonb` (event-sourced fight log), `config` tables (labrute itself stores env config in a DB `Config` table).
- **Event-sourced fight log**: the canonical Postgres event-store shape is `(id, aggregate_id uuid, sequence_number, event_type text, event_data jsonb, created_at)` with PK `(aggregate_id, sequence_number)`; **GIN indexes on JSONB paths** keep payload queries fast into the millions of rows. For fights specifically: one `fights` row (seed, sim_version, attacker snapshot, defender snapshot, winner, xp/gold deltas) + `steps` JSONB array. Fights are immutable — perfect fit.
- **Snapshot the combatants** into the fight row (see §1) — never join back to live character state for replays.
- Partition or cron-archive `fights` by month once it's your biggest table; keep hot 30 days, move the rest to cold storage/R2 as JSON.

### Redis roles
- **Leaderboards: sorted sets are the canonical answer.** ZADD/ZREVRANK are O(log N) (~27 comparisons at 100M members); 100M members ≈ 6 GB RAM; a single instance sustains 100K+ ops/s; single-threaded execution makes concurrent score updates race-free. Key-per-scope naming (`lb:global:alltime`, `lb:global:weekly:2026-W22`, `lb:guild:<id>:daily`) makes daily/weekly/season boards trivial — create new keys, EXPIRE old ones, archive top-N to Postgres at rollover.
- **Matchmaking**: for MyBrute-style async PvP you don't need real matchmaking — query N candidate ghosts near the player's level/ELO (`ZRANGEBYSCORE` on an ELO sorted set, or plain Postgres index). Redis queues only matter if you add live events.
- **Rate limiting**: token bucket per user/IP in Redis (`INCR`+`EXPIRE` or a Lua script); also protects the fight endpoint (see §6).

### Job queues
- **BullMQ (Redis)**: the full-featured pick — priorities, delayed jobs, repeatable/cron jobs, rate limiting, parent-child flows; "the most complete and battle-hardened."
- **pg-boss (Postgres)**: no extra infra, `SKIP LOCKED` concurrency, ACID with your game data (job + state change in one transaction), LISTEN/NOTIFY dispatch.
- **Recommendation**: if Redis is already in the stack for leaderboards, use **BullMQ** for the daily-tournament pipeline (a repeatable job at tournament time that generates brackets, then fans out per-round fight-sim jobs). If you defer Redis, pg-boss covers the MVP fine and migrates to BullMQ later; 2026 consensus: "BullMQ for feature-rich processing, pg-boss for Postgres-based queues without Redis."

---

## 4. Real-Time: Where It Actually Helps

Be honest about the genre: **MyBrute is ~95% request/response.** Fights are precomputed; nothing needs sub-second delivery.

- **Genuinely worth realtime**: live tournament bracket updates during the daily tournament window, guild chat, presence ("3 guildmates online"), "you were attacked" toasts.
- **Fine with polling**: everything else — fight results, XP, shop, even brackets outside the live window (poll every 30–60 s).
- **SSE** is an underused middle ground: one-way server→client (bracket progress, notifications) with zero library weight and trivial proxying.

| Option | Verdict |
|---|---|
| **Supabase Realtime** | Fine if all-in on Supabase, but limits bite: **Free 200 / Pro 500 concurrent connections** (more via support), $10/1,000 peak connections, $2.50/1M messages. Thousands of CCU all holding sockets gets costly; it's DB-change-centric. |
| **Socket.IO** | "The pragmatic default for self-hosted Node" — rooms, auto-reconnect, Redis adapter for horizontal scale. Best fit for the dedicated-Node-service architecture. |
| **Ably** | Managed, guaranteed delivery/history/presence — pay for reliability you don't need yet. |
| **PartyKit / Durable Objects** | Stateful room-per-tournament on the edge is elegant (each room a Durable Object with persistent state), but DOs are single-threaded with ~150-connection practical concurrency per object — fine for one bracket room, a new platform dependency otherwise. |

**Recommendation**: polling + SSE at MVP; add Socket.IO (with Redis adapter) on the Node service when guild chat / live brackets ship.

---

## 5. Auth: Guest-First Is the Killer Requirement

Instant onboarding (name your character, fight within 30 seconds, no signup wall) is core to the MyBrute loop, so **anonymous auth that upgrades losslessly is the deciding feature**.

- **Supabase Auth** supports this natively: `signInAnonymously()` creates a real authenticated user; later `updateUser()` (email/phone) or `linkIdentity()` (OAuth, with manual linking enabled) converts it — **"the user ID remains the same so data associated with the user ID carries over."** RLS can distinguish anon vs. permanent users. Pricing: **50K MAU free, then ~$0.00325/MAU** — an order of magnitude cheaper than Clerk at scale.
- **Clerk**: best DX and prebuilt UI, but **$0.02/MAU after 10K free** — at 100K MAU that's ~$1,800+/mo vs. Supabase's ~$160. Wrong cost curve for a free game with anonymous accounts inflating MAU.
- **Lucia is deprecated (early 2025)**; its successor **Better Auth** (open-source, BYO Postgres, has an anonymous plugin) is the right choice *if* you go fully self-hosted Node and want zero per-MAU cost.
- **Custom JWT**: don't — you'll rebuild refresh rotation, OAuth, email verification for no upside.

**Cross-device cloud saves fall out for free**: with server-authoritative state, the "save" is just the DB rows keyed by user ID; upgrading anon→email account is what makes progress portable across devices. Prompt the upgrade at emotional peaks (first tournament win, level 10), not at first launch.

**Recommendation**: Supabase Auth (fits the §2 hybrid); Better Auth as the migration target if you ever leave Supabase.

---

## 6. Anti-Cheat for Async PvP

Async PvP against ghosts is the easiest genre to secure — if you follow one rule: **the client never reports outcomes.**

1. **Server-side-only simulation**: client sends only intent ("fight opponent X"); server picks the seed, runs `game-core`, persists the result, returns seed + log for animation. "All combat calculations, damage, loot and gold are processed entirely on the server, so the client can't fake a hit or spawn items." The client is purely a renderer — there is nothing to hack except the display.
2. **Server-side cooldowns/energy**: fights-per-day tracked server-side; "bypassing them in the browser console triggers an anomaly flag and blocks the action."
3. **Rate limiting**: per-user and per-IP token buckets on mutation endpoints (fight, level-up, shop) to stop scripted grinding and scraping.
4. **Multi-account detection signals**: shared IP/subnet + device fingerprint + signup-time clustering; behavioral signals (accounts that only fight one beneficiary — "feeder" detection via win-trading graphs); disposable-email domains; velocity of account creation per IP. Score, don't insta-ban; queue for review in the admin panel.
5. **Replay validation**: because the sim is deterministic, any fight can be re-run from (seed, snapshots, simVersion) to verify the stored outcome — cheap spot-auditing of suspicious accounts, and your own defense against server bugs.
6. **Economy anomaly detection**: emit a ledger event for every currency source/sink (Roblox-style economy events); alert on "duplicate transaction IDs, negative balances, or anomalous item movements" and quantile-based outliers (gold/day per account vs. cohort) "before they destabilize the economy." A daily job + one dashboard is enough at this scale.

---

## 7. Analytics & LiveOps

- **PostHog Cloud, not self-hosted.** Free tier: **1M events + 1M feature-flag requests + 5K replays/month**; ~$300–500/mo at 5M events. Self-hosting "makes economic sense over ~$1,500/mo cloud spend AND with ops capacity" (self-host infra alone ≈ $450/mo + engineer time). Feature flags + A/B testing are included — one tool covers analytics, flags, and experiments (e.g. A/B the onboarding flow or level-up choice UI).
- **Event taxonomy** (define before launch, version it): identity (`player_id`, `anon`, platform), progression (`character_created`, `level_up` {level, stat_choice}, `skill_unlocked`), core loop (`fight_started`, `fight_ended` {winner, duration, opponent_elo_delta}, `tournament_entered/won`), economy (`currency_earned/spent` {source/sink, amount, balance_after}), retention (`session_start`, D1/D7/D30 come free), monetization later. Snake_case, past tense, one shared `analytics.ts` enum in the monorepo so client and server can't drift.
- **Sentry** for errors on both client and server (source maps for the minified client are the main setup cost); its free tier is fine for MVP.
- **Structured logging + OTel**: pino JSON logs with `traceId`/`spanId` injected via `@opentelemetry/instrumentation-pino`; "structured JSON logging correlated with traces is the 2026 baseline." Ship to a cheap sink (Axiom, Grafana Cloud free tier, or SigNoz). Instrument the fight-sim duration and queue depths as custom metrics — those are your capacity signals.

---

## 8. Admin / Game-Ops Panel

What a game-ops panel must do: **player lookup** (by name/email/IP/device), inspect character + inventory + fight history, **grant/revoke** currency/items/XP with an audit log, **ban/shadowban/unban** with reason codes, review anti-cheat flag queues, **economy dashboards** (sources vs. sinks, gold supply over time), and **content config** (weapon/skill stats, event toggles) editable without deploys.

| Option | Verdict |
|---|---|
| **Retool** | 10× faster to first dashboard, but $10–50/user/mo, and "complex custom JS becomes unmaintainable"; fine as a stopgap |
| **AdminJS** | Auto-generates React CRUD from your models, MIT, self-hosted, Node-native — good middle ground, custom actions for ban/grant |
| **Custom Next.js (or a `/admin` area in your existing React app)** | "Takes days, costs $25/mo, stays yours forever"; wins because game ops needs are *behavioral* (flag queues, economy charts, config editors), not CRUD |

**Recommendation**: start with AdminJS or a thin custom admin behind Supabase Auth role checks; the audit log table (`admin_actions`: who, what, target, before/after JSONB) is non-negotiable from day one. Content config lives in DB tables (labrute precedent: its `Config` table) or versioned JSON, hot-reloaded, so balance changes don't require deploys — but remember sim versioning (§1) when balance affects fights.

---

## 9. Hosting & Scaling on a Budget

Load reality check: "thousands of CCU" in an async game ≈ low hundreds of requests/second, with the fight sim (a few ms of CPU per fight) as the only hot path. This fits on very small hardware if the API is stateless.

| Platform | Cost shape | Notes |
|---|---|---|
| **Fly.io** | shared-cpu-1x/512MB ≈ **$3.32/mo**; egress $0.02/GB (NA/EU); scale-to-zero via `auto_stop_machines` | Cheapest at scale; multi-region later |
| **Railway** | ~$5/mo/service usage-based; web+DB+worker ≈ **$10–15/mo** | Best DX for hobby scale; no scale-to-zero |
| **Render** | Same setup **$21–34/mo**; since Apr 2026 flat workspace fees (Hobby $0 / Pro $25 / Scale $499) | Most predictable, most expensive |
| **Hetzner + Docker (Coolify)** | CX23 ≈ **€3.99/mo**; CPX32 (4 vCPU/8GB) ≈ $17/mo; Coolify = self-hosted Heroku (builds, SSL, 280+ one-click services incl. Postgres/Redis) | Cheapest raw compute by far; budget "40–60 hours of debugging over 3 months" ops tax |
| **Cloudflare Workers** | Near-free API tier | Great for the static client + edge cache; awkward for long-lived sim/queue workers |

**Recommended MVP topology (~$30–60/mo all-in):**
- Static client on Cloudflare Pages/CDN (free, cache-immutable hashed assets; game art/sprites via CDN or R2).
- 2× small stateless Fastify instances (Fly.io or one Hetzner box with Docker) behind the platform LB — stateless API scales horizontally by adding instances; all state in Postgres/Redis.
- Supabase Pro ($25) for Postgres+Auth, or self-hosted Postgres+Redis on the Hetzner box.
- **Connection pooling is mandatory**: many small API instances × Postgres connections = exhaustion. Use **transaction-mode pooling** (Supabase's Supavisor on port 6543 — session mode on 6543 was deprecated Feb 28, 2025; PgBouncer is deprecated on Supabase in favor of Supavisor, which is multi-threaded and supports prepared statements in transaction mode; self-hosters: PgBouncer 1.25.1+).
- Growth path: bigger Hetzner box → read replica → partition fights → only then think about regions.

---

## 10. Mobile Without a Rewrite

**Consensus 2025 path: responsive web app → PWA → Capacitor wrap for the stores — one codebase, three distributions.** "Build with web + Capacitor: your app works as a PWA AND can be wrapped as a native app for the stores." Real-world: a Bubblewrap-wrapped PWA hit 50K downloads; Capacitor hybrids run in production fleets. React Native "reuse" is a myth for a DOM/PixiJS game — it's a rewrite of the entire view layer; reject it.

**Decide up-front so the wrap is cheap later:**
1. **Responsive, portrait-first layout** from day one (MyBrute's cell/arena UI maps naturally to portrait); test at 360×640.
2. **Touch targets ≥ 44px**, no hover-dependent UI (tooltips need tap equivalents), safe-area insets (`env(safe-area-inset-*)`).
3. **Asset pipeline**: hashed, CDN-served sprite atlases sized for mobile GPUs; total initial payload budget (<3 MB) for mobile networks; lazy-load fight animations.
4. **Abstract platform services** behind interfaces now — storage, notifications, IAP, share — so web uses Web APIs and the Capacitor build swaps in native plugins (push notifications for "tournament starting" is the big retention win the wrap unlocks).
5. **Server-side state (§5)** means no local-save migration problem when users install the app.
6. Mind store policies: Apple dislikes thin wrappers — ship the wrap with at least one native capability (push, haptics) and real app-like navigation.

---

## Recommended Stack (Summary)

| Layer | Pick |
|---|---|
| Monorepo | pnpm workspaces: `game-core` (pure sim), `server`, `client`, `shared-types` (mirrors Zenoo/labrute layout) |
| Sim | Pure TS, mulberry32 per-fight PRNG, integer math, simVersion, seed+step-log stored |
| API | Fastify + tRPC on a dedicated Node service |
| Data | Supabase Postgres (Supavisor transaction pooling) + JSONB fight logs; Redis for leaderboards/rate limits |
| Jobs | BullMQ (pg-boss if deferring Redis) for daily tournaments |
| Realtime | Polling/SSE first; Socket.IO + Redis adapter for chat/brackets |
| Auth | Supabase Auth anonymous → identity linking; Better Auth as exit path |
| Analytics/Ops | PostHog Cloud (events+flags+A/B), Sentry, pino+OTel |
| Admin | AdminJS or thin custom admin + audit log |
| Hosting | CF Pages (client) + Fly.io/Hetzner (API) ≈ $30–60/mo MVP |
| Mobile | Responsive PWA → Capacitor wrap |

---

## Sources

- Zenoo/labrute (TypeScript LaBrute remake): https://github.com/Zenoo/labrute
- Eternaltwin LaBrute fight replay URLs: https://labrute.eternaltwin.org/-MyBrute/cell ; Eternal Twinpedia: https://wiki.eternal-twin.net/mybrute
- OpenFrontIO architecture (shared core, deterministic replays): https://deepwiki.com/openfrontio/OpenFrontIO
- Deterministic sim discussion (HN): https://news.ycombinator.com/item?id=11584128 ; Unity seedable RNG thread: https://discussions.unity.com/t/seedable-deterministic-rng-slay-the-spire-balatro-spelunky-etc/1583758
- Cliffski, "Building a deterministic space auto-battler" (2026): https://www.positech.co.uk/cliffsblog/2026/06/07/building-a-deterministic-space-auto-battler/
- Super Auto Pets basics/ghost matchmaking: https://superautopets.wiki.gg/wiki/The_Basics ; sandbox/replay proxying: https://benmillersoftware.medium.com/sandbox-mode-in-super-auto-pets-ca1ffd51d639
- Mulberry32 RNG: https://www.4rknova.com/blog/2026/03/01/mulberry32-rng ; https://emanueleferonato.com/2026/01/08/understanding-how-to-use-mulberry32-to-achieve-deterministic-randomness-in-javascript/ ; splitmix32: https://jkomyno.dev/gists/splitmix32-prng/
- NestJS vs Fastify vs Hono: https://encore.dev/articles/nestjs-vs-fastify-vs-hono ; tRPC vs ts-rest vs Hono RPC: https://www.pkgpulse.com/guides/hono-rpc-vs-trpc-vs-ts-rest-type-safe-api-clients-2026
- Supabase vs alternatives / MVP stack costs: https://encore.dev/articles/supabase-alternatives ; https://www.sashido.io/en/blog/startup-mvp-backend-in-2026-tools-tradeoffs-trends ; https://www.buildmvpfast.com/alternatives/supabase
- Redis leaderboards: https://oneuptime.com/blog/post/2026-01-27-gaming-leaderboards-redis-sorted-sets/view ; https://levelop.dev/blog/100m-players-updating-scores-every-second-redis-gets-you-to-v1
- BullMQ vs pg-boss: https://www.pkgpulse.com/guides/bullmq-vs-bee-queue-vs-pg-boss-job-queues-nodejs-2026 ; https://dev.to/aws-builders/i-removed-redis-from-my-stack-and-used-postgresql-for-job-queues-instead-2lp5
- Event sourcing in Postgres: https://reintech.io/blog/postgresql-event-sourcing-storing-event-streams ; https://dev.to/kspeakman/event-storage-in-postgres-4dk2
- Realtime comparisons: https://ably.com/compare/socketio-vs-supabase ; https://www.pkgpulse.com/guides/best-realtime-libraries-2026 ; Supabase Realtime pricing/limits: https://supabase.com/docs/guides/realtime/pricing ; https://supabase.com/docs/guides/realtime/limits
- Durable Objects: https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/ ; https://www.briangershon.com/blog/developing-real-time-games-with-cloudflare-durable-objects-and-websockets/
- Supabase anonymous sign-ins & identity linking: https://supabase.com/docs/guides/auth/auth-anonymous ; https://supabase.com/blog/anonymous-sign-ins ; https://supabase.com/docs/guides/auth/auth-identity-linking
- Auth pricing comparisons: https://makerkit.dev/blog/tutorials/better-auth-vs-clerk ; https://www.buildmvpfast.com/blog/best-auth-providers-2026-clerk-supabase-comparison
- Server-side anti-cheat: https://viddlerage.itch.io/project-void/devlog/1459124/patch-12-anti-cheat ; https://medium.com/@amol346bhalerao/how-game-developers-detect-and-stop-cheating-in-real-time-0aa4f1f52e0c
- Economy anomaly detection: https://oneuptime.com/blog/post/2026-03-31-clickhouse-virtual-currency-flow/view ; https://create.roblox.com/docs/production/analytics/economy-events ; https://stagefoursecurity.com/blog/2025/05/13/securing-in-game-economies/
- PostHog pricing / self-host: https://posthog.com/pricing ; https://schematichq.com/blog/posthog-pricing ; https://cotera.co/articles/posthog-self-hosted-guide
- pino + OpenTelemetry: https://www.npmjs.com/package/@opentelemetry/instrumentation-pino ; https://1xapi.com/blog/structured-logging-nodejs-pino-opentelemetry-2026
- Admin panel comparisons: https://aidxn.com/blog/retool-vs-custom-internal-admin-dashboard-2026/ ; https://www.buildmvpfast.com/best/internal-tools
- Hosting pricing: https://expresstech.io/render-vs-railway-vs-fly-io-2026-pricing-showdown/ ; https://techsy.io/en/blog/railway-vs-render-vs-fly-io ; Hetzner+Coolify: https://ceaksan.com/en/hetzner-coolify-self-hosting-reality ; https://www.buildmvpfast.com/blog/saas-hetzner-under-10-dollars-scale-10k-mrr-2026
- Connection pooling: https://supabase.com/docs/guides/database/connecting-to-postgres ; https://supabase.github.io/supavisor/migrating/pgbouncer/ ; https://nerdleveltech.com/production-postgres-pooling-pgbouncer-supabase-supavisor-tutorial
- PWA vs Capacitor: https://nextnative.dev/comparisons/pwa-vs-native-app ; https://www.flex.com.ph/articles/bubblewrap-vs-capacitor-my-2-year-test-results ; https://without.systems/progressive-web-to-native-mobile-with-capacitor
