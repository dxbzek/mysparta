# 09 — Launch audit

A twelve-agent audit of the whole product (combat feel, first-time experience,
progression and economy, art direction, performance, accessibility, audio,
secondary screens), with every high-severity finding adversarially verified
against the source before anything was changed. 64 findings; 15 confirmed
critical/high, none refuted; 5 systemic gaps from a completeness pass.

The section split below is **shipped** vs **backlog**. Shipped items are in
the codebase now, gated by the 96-test suite and verified in the browser.

## Root cause analysis

Four patterns produced almost every finding:

1. **Systems built in core, never surfaced in the client.** Favour accrued,
   synced and rescue-coded but was unspendable and invisible; `seenPlans`
   scouting is written after every fight and read nowhere; the milestone
   guarantee generated the offer but the picker ignored it. The sim was
   finished; the game around it wasn't.
2. **One clock, two timelines.** The narration clock scaled with 2× speed and
   player-visible countdowns, while CSS animation durations, SFX delays and
   the quake stayed at 1× — so audio led video by ~200 ms on every hit and 2×
   looked broken.
3. **Parchment tokens applied outside parchment.** Ink colours designed for
   panel backgrounds were reused over dark arena paintings (held-weapon chips
   at ~1.4:1) and bright accents were reused as body text on parchment
   (`.line-trump` at 1.44:1).
4. **The integer-pixel rule enforced in one place, broken in others.** The
   fight stage measures and repaints at integer scale; the Hall portrait
   stretched fractionally; busts, pets and icons still do (backlog).

## Shipped this pass

Gameplay/economy
- **Favour reroll** — Favour shown in the topbar, spendable in the level-up
  modal (1 Favour = one final redraw; milestone guarantees still honoured;
  History's `(rerolled)` tag now reachable). The game's only earned
  meta-currency is alive.
- **Gear-pool exhaustion fallback** — once all 46 pieces are owned, daily-task
  and win-loot drops pay a +2 XP Rift bounty instead of silently nothing.
- **Rescue-restore data loss fixed** — restoring a code now lands in a free
  roster slot instead of overwriting the active hunter.

Combat feel
- **2× speed compresses the choreography** (`--spd` CSS var drives every
  fight animation duration/delay; SFX contact delays scale with it).
- **Audio/video sync** — impacts, blocks and dodges land at visual contact
  (~290 ms) instead of 95 ms; the crit quake fires at the moment of contact.
- **Three lunge trajectories** cycled per-side (sprint, low rush with skid,
  hop-in overhead) — a 30-beat fight no longer loops one GIF.
- **Right fanfare guaranteed** — winner by `result.winner`, not name substring.
- Verdict subline speaks player language ("takes it in 34 exchanges"), not
  engine telemetry.

Art / a11y
- **Hall portrait repainted at integer scale** like the fight stage — the
  most-viewed art no longer fractionally smeared.
- **Stage HUD legible on all 14 arenas** — held-weapon chips and HP text use
  light ink with a dark halo instead of parchment ink over night skies.
- **AA contrast for feed accents** — `--gold-ink/--lapis-ink/--terracotta-ink/
  --olive-ink` text variants (≥4.5:1 on parchment) for trump/defend/crit
  lines, epithets, scouting text.
- **Reward modal is a real dialog** — focus trapped, Escape claims.
- **Codex works on touch** — tap any tile for its detail (title-attr tooltips
  never fire on phones); weapon rewards show their damage/speed/reach bars at
  the claim moment.

Audio
- **Humanised combat cues** — frequencies/gains jitter a few percent per blow
  (melodic cues stay exact); no two strikes bit-identical.
- **Brickwall limiter** after the glue compressor — stacked cues can't clip.
- **Unmuting mid-fight restores the crowd**; gear drops are audible
  (`sound.drop()` was dead code); mute-button feedback un-inverted.

Technical
- **Self-hosted type** — Silkscreen + Karla latin woff2 inlined (~63 KB);
  zero Google Fonts requests; the game's face survives offline/CSP/file://.
- **Error boundary** — a render crash now shows a parchment card with the
  rescue code, Reload, and explicit last-resort reset, instead of a blank
  page (and, with a poisoned save, a permanent crash loop).
- **Two-tab safety** — a `storage` listener rebases on saves written by other
  tabs instead of clobbering them.
- **2× preference persisted**; mute toggle no longer persists the whole save
  and schedules a cloud push; roster Retire auto-disarms like Delete; rescue
  code falls back to a selectable code box when the clipboard is denied (and
  the backup button is separated from Delete Hunter).

## Backlog (verified, unimplemented — priority order)

P1 — next session
1. Level-30 XP cliff: +61 % cost step, 71 % of the curve in the last 20
   levels (`xp.ts`). **Needs design sign-off** — rewrites GDD §6.2 canon.
2. Thrown beats play effect-before-cause (target recoils ~250 ms before the
   javelin arrives).
3. KO blow has no hit-stop/thud — the biggest moment weighs less than a crit.
4. Surface `seenPlans` scouting on rival cards ("Fought before — opens with…").
5. Per-arena ambience flavours (wind/rumble/night layers, zero bytes).
6. Daily tasks pay nothing partial — per-task +1 XP, all-three keeps the drop.
7. Corrupt-save slot reads as empty and gets overwritten by the Forge
   (distinguish empty/corrupt, `.bak` the bytes).

P2
8. Pixel-art fight effects (burst/slash/javelin/laurel are smooth vector SVG
   over a pixel stage) → then delete the ~600-line retired cartoon system in
   `art.tsx`.
9. Arena wash renders behind the fighters (sprites ignore scene lighting) —
   one z-index.
10. Layer-recolour cache + LRU for `lookStrip`/`stripCache`/`arenaScene`
    (100–400 ms main-thread bursts on board mounts; unbounded memory).
11. Integer-snap PixIcon/WeaponIcon/SkillIcon/PetSprite/FighterBust cells.
12. Forge tabs: full ARIA tab keyboard contract; `aria-pressed` on
    gear chips/swatches; SR announcement of verdict + rewards; live-region
    silencing on Skip.
13. Free unlimited "New rivals" refresh is refresh-scummable — 1 Favour after
    the first daily refresh (second Favour sink).
14. Forge step 2 has no way back to change the name.
15. Stances/gambits never explained — display names in narration + a Codex
    "How a fight works" case.

P3 / roadmap
- Comeback mechanic after consecutive-loss days (design call).
- Ladder league dividers + scroll-to-you + disjoint name pools.
- History screen icons/milestone landmarks; kit-chip tap-peek on rival cards.
- Share surface (verdict + Hall) with `navigator.share`, og:image.
- Floater remount fix; beat-keyed slot remount only when that side animates.
- Storage-denied session warning banner.
- Settings popover (mute + default speed + reduced-motion) when the topbar
  outgrows three pills.
- Seasonal "Aristeia cycle" reset with a prestige mark, per the GDD's own
  level-50 soft-cap language — the natural LiveOps beat when a backend lands.

## LiveOps recommendation

Stay client-only until retention data justifies a backend. The rotating task
pool, roster, and rescue codes give a full daily loop without a server. When
one lands: defence-snapshot PvP (the `ChampionSnapshot` type is already the
wire format), weekly ladders per league tier, then the Aristeia seasonal
reset. Nothing in the current save shape blocks any of it.
