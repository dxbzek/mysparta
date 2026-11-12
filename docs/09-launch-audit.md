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

Items keep their original numbers so older notes still point at the right
thing. 2–7, 9 and 14 shipped in the seventh pass (below).

P1 — next session
1. Level-30 XP cliff: +61 % cost step, 71 % of the curve in the last 20
   levels (`xp.ts`). **Needs design sign-off** — rewrites GDD §6.2 canon.
   *Seventh-pass note:* not touched in this pass, but `xp.ts` no longer
   matches this entry — commit `8d0e8ee` ("Take the cliff out of the XP
   curve") already ramps the third band (30→31 costs 33, not 50; 29→30
   costs 31 under both curves). What is
   left is the decision: sign that curve off and update GDD §6.2, or restore
   `level + 20`.

P2
8. Pixel-art fight effects (burst/slash/javelin/laurel are smooth vector SVG
   over a pixel stage) → then delete the ~600-line retired cartoon system in
   `art.tsx`.
10. Layer-recolour cache + LRU for `lookStrip`/`stripCache`/`arenaScene`
    (100–400 ms main-thread bursts on board mounts; unbounded memory).
11. Integer-snap PixIcon/WeaponIcon/SkillIcon/PetSprite/FighterBust cells.
12. Forge tabs: full ARIA tab keyboard contract; `aria-pressed` on
    gear chips/swatches; SR announcement of verdict + rewards; live-region
    silencing on Skip.
13. Free unlimited "New rivals" refresh is refresh-scummable — 1 Favour after
    the first daily refresh (second Favour sink).
15. Stances/gambits never explained — display names in narration + a Codex
    "How a fight works" case.
16. *(found in the seventh pass)* The struck-body flash is dead CSS:
    `.fig-inner.flash > svg, .fig-inner.flash .hero-sprite` matches nothing,
    because the paper-doll fighter renders neither. Retarget it at
    `.fighter-fig` or delete it.
17. *(found in the seventh pass)* Arena washes are layered correctly now, but
    12 of the 14 start at the top and are gone by about head height, so on
    those arenas the figures still read as unlit. The other two — Sunken Mist
    and Ember Hollow — are anchored at the bottom of the stage and do tint the
    fighters' lower bodies, the held-weapon chips and the damage numbers (at
    most 0.16 alpha). Stronger or lower washes are an art call.
18. *(found in the seventh pass)* Per-arena ambience and the KO thud have not
    been listened to — levels and filters need an ear before launch.

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

---

## Second pass — full design + gameplay sweep

Driven by "fix everything… ALL OF IT DESIGN GAMEPLAY". Audited every screen at
320/390/844-landscape/1280/2560 with a real level-19 save, drove the loop end
to end, and fixed in priority order.

### Shipped

**Crash / robustness**
- `weapon()`, `skill()`, `beast()` and `omen()` threw on an unknown id, so a
  save naming content we renamed took the whole Hall down behind the error
  boundary — which reads to a player as "my hunter is gone". They warn and
  fall back now, with a test.

**Combat feel**
- Reverb: the SFX were bone dry. A synthesised arena (1.1s dark impulse, 18ms
  pre-delay) on a send; combat placed in stereo by who threw it; presence
  shelf +4 → +2 dB now the room carries it; melodies stay mostly dry.
- Mending got a beat — drop, drink, green bloom with motes, and the HP bar
  flares. It was a number over an idle sway.
- Hit-stop on the killing blow: +420ms hold, every animation frozen, white
  flash. Anchored by a test to the last-line-is-an-epilogue invariant.
- Beasts: the rank was 160px of animal beside a 52px fighter starting 89px off
  a 342px stage. 32px, overlapped into a rank, per-beast breathing offsets.
  Also un-broke their facing — a CSS animation on `transform` was eating the
  inline `scaleX(-1)`, so every beast on the right faced backwards.

**Screens**
- Closet promoted to its own page; the Hall keeps a worn strip that taps in.
- Character creation rebuilt to the standard shape: fixed stage, scrolling
  option sheet, every option a chip on a rail. It was a `<select>` form.
- Codex split into five tabbed shelves: 3,065px → 1,356.
- Weapons became a board you tap; wardrobe became its twin.
- Stat bars read to 60 and band red/orange/gold/green with an over-scale mark.
- Hall nav 300px → 148; rival kit two rows → one; Arena 2,051 → 1,769.

**Accessibility**
- One `TabRail`/`TabPanel` for Forge, Codex and Closet with the full contract:
  arrow keys, Home/End, roving tabindex, `aria-controls` to a real tabpanel.
  Three screens previously promised `role="tab"` and delivered none of it.
- Option chips use `aria-pressed`, not a `role="radio"` we do not navigate.
- Today's Tasks closes on Escape.

**Pacing**
- The XP row states the pace ("~2d"). The curve steepens sharply at level 30
  and nothing said so, which reads as breakage rather than difficulty. The
  curve itself is untouched — that is canon and a design call.

### Verified

No horizontal overflow and no error boundary on any screen at 320, 390,
844-landscape, 1280 or 2560. Full loop drives clean: arena → fight → verdict →
continue → level-up draft → claim, with vigor, rating, record and level all
moving correctly. 64 web tests, 20 core, 19 api.

### Still open

- **Art direction.** Zek wants MyBrute's flat-cartoon look. Their sheet is
  Motion Twin's and cannot be used. The free CC0 sets are either pixel (what
  ships today) or painted; neither is that idiom. Needs either a paid cartoon
  pack or hand-drawn SVGs for 25 weapons + 8 beasts.
- Level-30 XP cliff itself (GDD §6.2 canon).
- Thrown-beat effect-before-cause; per-arena ambience; paperdoll/arenaScene
  LRU caches; Favour cost on board refresh; Forge back-to-name.

## Third pass (2026-09-06)

Played a fresh hunter from name entry to level 16 in the pane; fixed what
the playthrough surfaced:

- **Header spoiled the verdict.** The save is written when the bell rings, so
  the rating pill showed the loss while the first blow landed. The theatre now
  carries `kleosBefore` and the header holds it until Continue.
- **Fight log never scrolled.** A smooth `scrollTo` restarted every ~600ms
  never reached the bottom; instant scroll now.
- **"Takes it in 1310 exchanges"** was sim ticks. Counts attack events: blows.
- **Stats card stretched to 536px** beside the champion at ≥1100px with four
  numbers spread down it. The third column is a stack now: Stats, then
  Weapons filling the rest. Skills & Pets spans the row.
- **Worn strip showed five copies of the champion's face.** Gear has icons
  (`gearArt.tsx`): cuirass / helm / mantle / charm / laurel in the weapon
  cartoon hand, coloured by the piece. Closet cards use them too.
- **Beasts were 32px ants piled under a 156px doll**, the rival's hound
  invisible. They scale one step below the stage (64px at 3×) and stand in a
  rank between hunter and enemy, overlapping a third.
- **Beasts hit for 1 at level 16** — flat 4–6 through 12 armour. Damage adds
  `floor(owner Strength / 4)`.
- **A combo kept savaging a beast it had already felled.** Target drops to
  the hunter once the beast is down.
- **"Frozen for 250 ticks"** and "guard down 300 ticks" leaked sim units into
  the log.
- **Phone header wrapped to two rows (115px)** once the Favour pill appeared.
  Compact pills under 420px; one 43px row from 360px up.
- `#/` routes to the Hall instead of nowhere.

## Fourth pass — one art direction (2026-09-06)

Zek: *"it's ugly though even our skills and pets"*, then *"One art direction"*.

The game was three idioms at once: LPC pixel dolls on the stage, CC0 32px
roguelike tiles for skills and beasts, hand-drawn vector for weapons and gear.
Searched itch.io, CraftPix, gamedevmarket and Envato Elements for a coherent
bought set — Envato is stock illustration (mascots, no rigs); itch's cartoon
animals are 3D or top-down; the one real candidate is Robert Brooks
(gamedeveloperstudio) at ~£15/pack. Nothing there beat drawing them.

So: **everything but the fighter is now drawn in one hand.**
- `beastArt.tsx` — all 8 beasts. Wolf, Raven, Boar, Guard Dog, Fox, Firebird,
  Hound, Tortoise, all facing left, on the same shared parts (Quad, Head, Ear,
  Tail, Eye) so they read as one artist.
- `skillArt.tsx` — all 30 skills, grouped boon / technique / trump, each icon
  saying what the skill *does* rather than what its myth name is.
- `gearArt.tsx` (earlier this session) — the five gear slots.
- The Crawl tiles stay wired as a fallback but nothing shipped renders one:
  `.tile-art` count is 0 on every screen.

Four beasts and seven skills were redrawn after looking at them at size:
the Guard Dog's mane read as a hat, the Hound's three heads merged into a
blob, the Raven had no beak, the Boar's tusks vanished, Bronze Hide and
Pankration both read as sandwiches, Wrath's fire didn't show, Hermes' sandal
was a bracket. Rule that keeps paying: draw it, render it at 44px and 150px,
look at it, fix what does not read.

**Still open:** the fight stage's paper dolls are the last borrowed idiom.
Closing it means replacing the fighter rig — bought (£14.95 Brute Knight pack
has swappable helmet/armour/weapon maps) or drawn with its own frames.

## Fifth pass — the beasts get rigged (2026-09-06)

Zek: *"maybe it can do like an animated one?"*, then *"Like per character one"*.

Every beast is now a puppet rather than a picture. `beastArt.tsx` wraps each
head, body, leg pair, tail and wing in a `.bp-*` group with its own pivot
(`transform-box: view-box`, pivots given in the 32-box's own units), and
`BEAST_MOTION` gives each animal a gait and its own clock:

| gait | beasts | idle |
| --- | --- | --- |
| prowl | Wolf, Boar, Guard Dog, Fox, Hound | body breathes, head sniffs, tail sways, a paw shifts |
| perch | Raven, Firebird | body puffs, wings beat, head SNAPS between angles (`steps(1)`) |
| plod | Tortoise | neck cranes in and out, legs alternate, everything slow |

On a lunge the animal commits as one: crouch, stretch, head bite, legs kick,
tail whip — and the Hound's second and third heads bite 60ms and 120ms late.

Two things learned the hard way:
- **The parts must not translate.** The wrapper (`.beast-dash-*`) already
  carries the animal across the stage; a `translateX` in `bpBite` as well tore
  the head a third of a body-length off the neck at the peak. Parts rotate;
  the wrapper travels.
- **The old wrapper bob had to go** for drawn beasts
  (`.beast-idle:has(svg.pet-sprite) { animation: none }`) — running a shared
  1.2s bob under per-part idles put every beast back on one rhythm, which is
  the exact fault the rig exists to fix.

**Verifying animation in a hidden Browser pane:** clocks never advance, so
sampling `getComputedStyle` twice always returns the same matrix. Scrub
instead — `el.getAnimations().forEach(a => { a.pause(); a.currentTime = t })`,
then read the transform or screenshot. That is how every pose here was checked.

## Sixth pass — the icons stay drawn

The beasts are generated art now. The weapons and skills are not, and this
records why, so the attempt is not repeated from scratch.

Six generation rounds, ~170 renders, on the same four or five test subjects
before the full run:

| # | Setup | What came back |
|---|---|---|
| 1 | Paraphrased style, wolf reference, img2img 0.85 | Ornate engraved chrome weapons standing in grass |
| 2 | Wolf's style string verbatim, wolf reference | A Spartan warrior **holding** every weapon, all six renders |
| 3 | txt2img, "character art" removed | Objects at last — inside laurel wreaths, with gradients; the sling was a handbag |
| 4 | 640px, "die-cut sticker" framing | The model drew the white sticker border as part of the picture |
| 5 | IconsRedmond / CuteCartoon SDXL LoRA | Style solved: flat, single object, clean outline |
| 6 | LoRA + diagonal pose + reworded subjects, 25+25 × 3 seeds | ~80% of weapons and ~60% of skills are the right object |

Two findings, in order of how much they cost to learn.

**The style lock was never the reference image.** Every early attempt fed
objects through img2img off the approved wolf, because that is how the beasts
were style-locked. But the wolf itself was txt2img: the prompt was the style,
and the reference only ever contributed composition. A quadruped is a bad
composition for a shield, which is why rounds 1 and 2 failed — and why the
phrase "character art", copied in faithfully from the beasts' prompt, put a
warrior in frame holding each weapon.

**A LoRA fixed the style and could not fix the rest.** IconsRedmond V2 (SDXL,
in `models/loras`) produced flat single objects immediately, where four rounds
of prompt wording had not. What it did not give was *one* look across fifty
assets: hot-pink lungs beside a gold 3D sun beside a grey brick photo beside
flat black glyphs. Nor subject reliability — Titan Grip came back a
bodybuilder, Gorgon's Glare a cartoon frog, Hermes' Rush a women's high-heeled
sandal, the maul a stone face in all three seeds.

So the generated icons are not shipped. `cartoonArt.tsx` and `skillArt.tsx`
stay: they are one hand, drawn from a shared parts vocabulary, and at the
32–64px these render at, a drawn silhouette reads better than a 640px raster
reduced to a thumbnail. The split that remains is deliberate — beasts are
generated because they are large on the stage and an animal is a dense prior;
icons are drawn because they are small and specific.

The renders and a per-subject picks file are kept in the session scratchpad
rather than the repo. If this is revisited, the lever not yet pulled is the
beasts' own trick applied to icons: approve one, then img2img the other
forty-nine off it to force a single palette and line weight — at the cost of
subject accuracy, which is already the weaker half.

**Two machine-level traps, both of which cost a run:**
- ComfyUI's desktop install runs from its own venv
  (`ComfyUI-Installs/ComfyUI/ComfyUI/.venv/Scripts/python.exe`); the
  `standalone-env` python next to it has no torch.
- Another Claude session on this machine runs its own ComfyUI on **8188**.
  When ours died, that one took the port, and every request then failed
  validation against *its* model paths, which have no LoRAs — presenting as a
  flat `HTTP 400` with no obvious cause. Ours runs on 8289 now.

## Seventh pass (2026-11-12)

The P1 backlog that needed no design sign-off, plus two one-line P2s. One
commit per item on `feat/launch-backlog-p1`. Each was driven in headless
Chrome (playwright-core against `pnpm dev`, 390px unless said otherwise) as
well as unit-tested; where something was not verified, it says so.

**P1 #2 — the javelin lands before anyone flinches.** On a thrown beat the
target recoiled, the burst popped and the number floated on the melee clock
(~280ms) while the javelin flew until 530ms; the impact *sound* fired at 0ms.
The moment of contact now lives in `beats.ts`: a thrown beat lands when the
flight ends (210ms launch + 260ms in the air = 470ms), the stage carries
`thrown-beat`, and the reaction, burst, number, quake and impact sound all
wait for it. The flight follows 2× speed (it did not), and a thrown line holds
180ms longer so the later reaction is not cut by the next beat.
*Verified:* `beats.test.ts` (contact per beat, hold, and that the CSS
overrides sit below their base rules). In Chrome, computed delays on a live
thrown beat read missile 0.21s + 0.26s, reaction/burst 0.47s, number 0.49s;
scrubbing the beat to 300ms and 460ms showed the target's transform still
`none` with the javelin mid-flight, and recoiling at 560ms.

**P1 #3 — the killing blow.** The second pass's hit-stop was applied for the
*whole* killing beat: measured in Chrome, `hitstop` went on at 0ms with every
fighter `animation-play-state: paused` — the swing that ended the fight never
played. The beat now runs to contact, freezes there for 420ms with the flash,
then releases into one heavy lurch of the stage (`ko-shake`, wider and slower
than a crit's quake). `sound.ko()` lands on the frozen frame: a falling sub, a
dull body thud, the room a beat late, the crowd's intake of breath — layered
over the weapon's own impact. Reduced motion keeps the hold and the sound and
drops the flash, freeze and lurch.
*Verified:* `koSchedule` tests (contact, release, 2×). In Chrome on a real KO:
`hitstop` at ~300ms into the beat, `ko-shake` at ~725ms, fighters running
again. **Not verified:** how the thud sounds — nobody has listened to it.

**P1 #7 — a save that will not read is not an empty slot.** A slot is now
`empty`, `ok` or `corrupt` (`slotState`), and `firstFreeSlot` only hands out
`empty`. The first read of a corrupt slot copies its bytes verbatim to
`<slot key>.bak` and leaves the slot alone; `persist()` and `wipe()` copy
unreadable bytes aside before replacing them; the error boundary's reset
copies before it wipes. The Forge says the saved hunter could not be read; the
Hunters screen shows a "Damaged save" card with a two-tap "Free this slot";
and a damaged active slot no longer hides a healthy hunter behind the Forge.
*Verified:* seven tests in `save.test.ts` ("a save that will not read").
Played in Chrome: forged a hunter, truncated `agoge.save.v1` to half its
bytes, reloaded, forged a second hunter — it went to `agoge.save.v1.1`, and
slot 0 and `agoge.save.v1.bak` both still held the truncated bytes; freeing
the slot kept the `.bak`.

**P1 #6 — two tasks out of three is worth something.** Each daily task pays
+1 XP once, the moment it is finished; all three still drops the gear on top.
`settleQuests()` is pure; paid tasks are remembered by metric in
`quests.paid`. A same-day save from before this change has no `paid` list and
is paid once for whatever it had already finished.
*Verified:* five tests ("daily tasks pay as they are finished"). Played in
Chrome twice: a fresh hunter through all twelve day-one fights, reading
`agoge.save.v1` after every bout and every level-up claim — XP gained matched
the verdict pills on every fight, `paid` grew 1 → 2 → 3 without repeating, the
drop landed with the third, and claims left total XP unchanged.

**P1 #4 — the board remembers who you have fought.** A rival already fought
carries one line: "Fought before — last opened with war cry, guarded." It says
*last* because rivals re-plan with every board; the tooltip says so too.
*Verified:* four tests ("scouting a rival you have fought"). In Chrome at 390
and 1280: fought two of six rivals; exactly those two cards carried the line,
matching the log and `save.seenPlans`; no horizontal scroll.

**P2 #9 — the wash is above the figures.** `.stage-wash` is `z-index: 2`
(over fighters and weather, under the HP bars and arena chip). The VS badge
had no z-index and went dull under the lifted wash, so it joins the HUD at 2.
*Verified:* looked at before/after captures on Ember Hollow and Midnight
Hollow. Honest result: the order is right and the HUD is unchanged, and on 12
of the 14 arenas the fighters look the same, because the wash starts at the
top and is gone by about head height (backlog 17). Sunken Mist and Ember
Hollow are the exception: their washes are strongest at ground level
(`arenas.ts`), so since this change they lie over the fighters' legs, the
held-weapon chips and the damage numbers.
*Corrected in the eighth pass* — this note first said every wash ends above
head height, and named Ember Hollow as a capture that showed no change.

**P2 #14 — a way back to the name.** "Change name" on Forge step two returns
to the name field with the name in it. Same name back keeps the styling;
a different name starts from that hunter's own look.
*Verified:* played in Chrome — styled, went back, same name (aura kept),
back again, corrected the name (fresh look), started, read the save: one
hunter under the corrected name. No unit test (screen state only).

**P1 #5 — fourteen arenas stop sharing one room.** `ambienceFor(arena)` reads
a flavour off the arena's own weather, ground and skyline — storm, rumble,
wind, night, water, stands, or the original crowd — and `sound.arenaIn`
lays one to three extra beds of the shared noise loop under the crowd, each
on its own slow clock. Unmuting mid-fight restores the arena's flavour.
*Verified:* `ambience.test.ts` (mapping, ≥5 flavours in use, every bed
≤0.06 gain, swells cannot flip phase). In Chrome each flavour was started and
stopped and its looped sources and LFOs counted against the table, and a full
unmuted fight ran to the verdict with no errors. **Not verified:** the sound
itself — it has not been listened to (backlog 18).

### Suite

106 web/core/api tests before this pass on a fresh install (65 + 22 + 19, one
skipped in each of web and core); 134 after (93 + 22 + 19). `pnpm typecheck`
and `pnpm build` clean after every commit.

### Method note

`playwright-core` is already a root dev dependency and the machine's own
Chrome runs it headless (`chromium.launch({ channel: "chrome" })`), so nothing
was installed. Screenshots taken straight after a navigation catch the
`cardRise` fade-in and look washed out — wait ~800ms first.
