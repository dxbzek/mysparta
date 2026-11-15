# Rank Zero art rules (the rig lane's parts vocabulary)

Style 13, "gritty comic, sodium streetlight" (owner pick, 15 November 2026): adult figures about
7.3 heads tall with real fingers and an angular face (brow, eye, nose, jaw, ear), a rough ink
outline, teal shadow with halftone dots, grime, and a night alley lit orange by a street lamp.
Everything is vector art drawn in code with the Canvas 2D subset of the rig contract: no canvas
filter, no gradient, no pattern, no image. The content lane (WP6) follows this file and imports
the shared code; it never copies it.

## Files

| File | What it holds | Who edits |
|---|---|---|
| `packages/rig/src/gate/style.ts` | every colour (palettes, teal shadow, lamp, alley, icons), line weights, the light, halftone and rough-line numbers | rig lane |
| `packages/rig/src/gate/vocab.ts` | the shape makers: `limb`, `inkLine`, `ellipsePoly`, `roundRect`, `quad`, `dPoly`; and what the painter derives from a shape (rough line, halftone, thickness) | rig lane; frozen for WP6 at the look approval |
| `packages/rig/src/gate/skeleton.ts` | the 18-bone scrapper rig, joint limits, builds, `GRIP_ROT`, secondary motion | rig lane; frozen for WP6 at the look approval |
| `packages/rig/src/gate/parts/*` | two complete looks (heads, hair, faces, accessories, tops, bottoms, shoes, hands) | rig lane |
| `packages/rig/src/gate/clips/*` | the 13 gate clips, the pose kit, and `throw.ts` (a content clip handed to WP6) | rig lane |
| `packages/rig/src/engine/*` | sampling, IK, the painter, SVG data, `createRig`; the probe rig | rig lane |

## The two shared rules

1. **The outline rule.** Every part gets a rough Night Ink (`#14152B`) outline drawn under the
   fills of its outline group, `LINE.figure` (1.9 units, about 2 px on a phone) for bodies,
   `LINE.item` for held items. The rough line is the part's own polygon cut into short pieces
   that wander up to `ROUGH.amp` from the edge, made once per path from a seed of the path, so
   it never flickers. Every stroke the rig makes is `#14152B`; a test checks it.
2. **The one cel-shade rule.** A part has its lit colour and one shadow colour (`shadeOf`: teal
   under light colours, deep teal under dark ones). The light is fixed in the world, from the
   upper left (the lamp): the painter clips to the part, fills the shadow, lays halftone dots,
   then fills the lit colour again pushed toward the lamp by 34% of the part's thickness. What
   stays uncovered on the far side is the dotted shadow. It works at any angle a bone turns to.
   `Shape.shade` adds one fixed shadow shape (under a jaw) when a part needs it.

## Shapes

- A `Shape.d` is absolute `M x y L ... Z` polygons only. Make it with `vocab.ts`; do not write C
  or A commands (the painter reads the points back).
- A shape lives in its bone's frame: origin on the joint, y down, a limb hanging along +y at
  rest. `limb(len, [[t, front, back], ...])` makes a limb with rounded ends that overlap into
  the next segment, so a joint reads as one limb.
- `z`: the integer part is the **outline group** (all outlines of a group go under all its
  fills), the fraction orders shapes inside it. Scrapper groups: back leg 10, back foot 11, back
  arm 20, back hand 22, pelvis 30, torso 31, head 40, ear 41, face 42, beard 43, hair 44, front
  leg 50, front foot 51, front arm 60, held item 61, front hand 62. A hand is over its item.
- Slot `"ink"`: a line or a dark detail (brows, eyes, seams, knuckle lines). Filled, no outline,
  no shadow. Make thin lines with `inkLine(points, width)`.
- Back limbs are veiled in teal (`BACK_VEIL`), so they read as behind the body.
- An open hand is the same hand set with the bone named `"handF:open"` / `"handB:open"`; the
  engine shows it when that hand holds nothing and the face is dazed, or when the grip lets go.

## Skeleton

Bones (the contract's 16, then two of ours at the end): root, pelvis, torso, head, armB.up,
armB.lo, handB, armF.up, armF.lo, handF, legB.up, legB.lo, footB, legF.up, legF.lo, footF,
**held** (the grip; the held item is its child and turns with the wrist; a clip turns it away
from the hand to drop a weapon), **hair** (hangs from the crown; no clip keys it, it is moved by
secondary motion from the head's turn and the body's travel, `SECONDARY` in skeleton.ts).

Signs: clockwise on screen is positive. Torso and head: positive leans forward. Upper arm and
thigh: negative swings forward. **Elbows bend only negative (-160 to 2), knees only positive
(-2 to 160)**; wrists, ankles, head and torso have limits too. A test samples every frame of
every clip against all of them. No torso split (chest and abdomen) was made: the 16+2 bones and
`lag` gave enough bend; WP6 needs no new bone.

A hand holds an item in a hammer grip: with the hand neutral, the item points along
`GRIP_ROT` (-10 degrees from the hand bone's +x), i.e. roughly across the forearm, as a real
fist does. A weapon's own `grip.rot` turns that (the Pocket Knife uses +40, a forward fist grip
with the blade along the forearm). So **a level weapon needs the forearm pointing down-forward**,
the way a real club meets its target; a straight arm forward points the item up.

## Clips

- Write keys with the pose kit (`gate/clips/kit.ts`): hips (`root`), lean (`pelvis`, `torso`,
  `head`), a wrist target or arm angles, an ankle target or leg angles, the item's world angle
  (`aim`, with the weapon's `grip`). The kit solves the angles once with the engine's IK and
  unwraps them so a joint turns the short way. Each spec inherits what it leaves out.
- `plant: ["footB","footF"]` pins those feet where they stood at t = 0; the hips then move
  freely over them. A clip without `plant` is dropped onto the floor by its lowest point; a key
  with root y < 0 is a jump of that height.
- `lag` per bone gives follow-through and overlap (head 30 to 45 ms behind the chest, the free
  arm 70 to 80). In a one-shot clip the lag fades over the last `lag` ms so the clip ends on its
  own pose.
- Timing comes from the rules' table only (punch, flick, swing, thrust 280 with contact at 150;
  smash 380 at 240; throw release 180, 260 in all). Every attack: one contact, a wind-up of 8
  units or more against the strike lasting 60 ms or more, 60% of the travel in the last 80 ms,
  an overshoot of 10% past the contact pose, settled within 150 ms. No bone turns more than 45
  degrees in a 60 fps frame. Torso, head and free arm peak 30 to 80 ms apart.
- Eases: `in` = u^1.7 (a strike), `out` = 1-(1-u)^2 (a settle), `inOut` cubic. A segment that
  must turn a big angle fast can be `linear` (no ease) to stay under 45 degrees a frame.

## A real body (anatomy lines, owner 15 Nov 2026: "arms are twisting")

What made the arms twist in the first bout, measured on every 60 fps frame (before / after,
all 13 gate clips plus the throw, plain and aimed at two heights): forearms and hands turning
up to 78 degrees in one frame (83 frames over 25 / 0), wrists bent to 91 degrees (13 / 0),
upper arms swung up behind the back to 159 (12 / 0), arms pulled to 99% of their length
(41 / 0), and, in the bout itself, clip switches that turned a forearm 164 to 180 degrees
between two frames (brace to dash, dash to swing). No elbow or knee ever flipped side: the IK
was not the cause; the keys and the clip ends were. The rules that keep it fixed:

- **IK.** `engine/ik.ts` bends every elbow and knee to its own side only (from the bone's
  limit: elbows negative, knees positive), keeps the solution continuous (the upper bone stays
  within 180 degrees of its last angle) and can cap the reach (`maxReach`). A planted leg is
  never pulled straight: the engine sinks the hips instead (`PLANT_REACH`, 98.5%).
- **Folded arms by angles, long arms by IK.** A wrist target close to the shoulder (a guard at
  the chin, a fist cocked by the ear) makes two-bone IK ill-conditioned: a small move of the
  target swings the upper arm a long way. Key a folded arm as `{ up, lo }` (the stance's back
  arm, every free arm, the swing and throw wind-ups) and use `at` only for an arm that reaches
  out (35% of its length or more).
- **`ANATOMY` in skeleton.ts**: arm reach at most 95% (move the hips, not the arm), leg 99%;
  wrist -70 to +80; shoulder from -185 (past overhead) to 65 (behind the back); a forearm or a
  hand turns at most 25 degrees a frame (2 more when an aim at the far end of the height range
  adds its bend); no near forearm in the back of the trunk, no held item through the head or
  the trunk. `test/gate/anatomy.test.ts` checks all of it on every frame, each line with a
  planted-fault control.
- **Clip ends in the guard.** Every clip starts and ends within 30 degrees of the stance
  (forearm and hand), and the idle and the backpedal stay there all through. The jump-in start,
  the knockout's end and the win loop are exempt. Since the stage crossfades every cut
  (stage/src/blend.ts), the run's pumping arms, the brace's raised guard and the evade's start
  may sit up to 100 degrees off (`FADE_SWITCH`): a 230 ms crossfade closes that at 11 degrees a
  frame at most.
- **Kinetic chain.** Strikes move proximal to distal, the way people do (standard
  biomechanics, no motion data or game animation was copied): punch = weight back, then the back
  leg pushes, hips turn in, chest follows, the arm straightens last with the forearm on the line
  of the punch, the rear fist stays at the chin; club swing = hips, then chest, then the upper
  arm drives down, the elbow opens, the wrist snaps last, the free arm pulls back against it;
  knife = a short hip-shoulder push with the elbow tucked along the ribs; hit = the head snaps
  first, then the chest, then the hips, and the back foot steps back to catch the weight;
  knockout = the knees buckle, the hips drop, the back lands, the arms trail. Joint angles were
  set by these rules and the ranges above; the free CMU motion capture data was not used.
- A strike's weapon turns at an even rate through the delivery (linear keys from the top of
  the wind-up to the contact): an eased 280 ms swing would need a wrist faster than a real one.

### Measured on the drawn picture (owner, 16 Nov 2026: "Dislocation of arms")

`test/gate/drawn.test.ts` measures the part list `drawActor` paints (`inspect.parts`: every
part's own polygon put on the stage by the transform it is painted with), not bone angles: every
scrapper clip, gate, content and per-weapon variants, with fists, a one-hand, three two-hands, a
pair both ways round, a shield, a Move prop and each variant's own item, three builds, both
facings, every 60 fps frame, plain and aimed (73,272 frames). Before / after (frames over the
line): limbs drawn off their rest length by more than 2% 4,078 / 0 (worst 8.9%, a forearm in
`enter`); joint pieces opening a notch over 0.5 units 3,360 / 0 (worst 1.13, hips, wrists,
elbows); shoulders and wrists past a real arm as drawn 5,404 / 0 (worst: power-up's cocked fist
wrapped 95 degrees past the shoulder behind the head, drink's wrist 20 past); forearms turning
over 25 degrees a frame 178 / 0 (worst 179, the back arm spinning round a tyre in `snared`; the
two-hand back arm snapping in `ko-fall`). Parts drawn apart, hands off what they hold and arms
rooted outside the trunk were 0 before and after: the hierarchy was never broken, the picture
was. `npx tsx packages/rig/test/gate/drawn-audit.ts report <dir>` prints the numbers and draws
the 12 worst frames; `throws <png>` draws the five throws with the flying item. The rules:

- **No uneven squash.** A key's `scale` is drawn as one even size change (its area): squashed
  1.08 x 0.92, a jointed body's limbs drawn across the squash grew 8% and shrank along it.
- **Round caps.** Arm and leg pieces end in full half circles of their own width at both ends
  (`limb(..., round 1)`), so each covers a whole disc round its pin and no bend opens a notch.
- **Keys inside the range.** A fist cocked for a big blow goes up in front and behind the head
  (power-up), never round behind the back; a can tips up by the arm rising, not by a wrist past
  70; a dropped item's turn out of the hand only grows (an `item` angle in ko-fall put it back in
  the fist for a frame, and a two-hand item back in both hands).
- **The back hand lets go rather than dislocate.** On a two-hand item the front hand may be
  drawn in or out at most `REACH_PULL[0]` (10 units, never pushed out at all to unfold a fold);
  the back hand eases off the item (back to its own keyed arm) when holding would need more
  pull (`REACH_PULL`), would fold it within `FOLD_LET_GO` of its shoulder (where a small shift of
  grip2 swings the whole arm round), or would turn either shoulder past its range
  (`BACK_LET_GO`). Its IK is capped at `TWO_HAND_REACH`, so a held arm is never straight. The
  front grip opening (`held` 5 to 35 degrees) lets go over 30 degrees, not 15. Every rule is
  a function of the pose alone, so the picture stays a pure function of time.
- **The right hand.** The item is drawn in the leading hand (the back hand only for a pair
  leading with it), a second copy only for a pair or an off-hand item, the shield strapped to
  the back wrist, a Move prop in the back hand; a fighter facing left is the exact mirror.
- **Throws** start their flight at the drawn hand at the release (the stage's `handAnchor`),
  the hand moving forward. Overarm: weight back, step, hips, chest, the arm over the shoulder,
  release in front of the head. Side-arm (Boomerang, Hubcap): a backhand, the hand drawn in to
  the chest at shoulder height and unfolding level, the wrist snapping flat. Bowl (Tyre): deep
  crouch, swung low and released at knee height in front. Darts: elbow up, a flick by the eye.

## Movement (owner, 16 Nov 2026: "make sure characters have animation for walks, run, dodge etc, block properly")

Poses and timing come from Eadweard Muybridge, "Animal Locomotion" (1887, public domain): plate 62
(running at full speed) for the dash, plate 8 (walking, side view) read backwards for the
backpedal, plates 336 and 338 (boxing: ducks and sways) for the evade, plates 336 and 340 (a
forearm raised into a lead) for the brace and the blocks, plate 163 (standing jump) for the
evade's push and landing. Joint angles were read off the plates; no game art was used.

- **Feet that travel (`Stride`, engine/sample.ts).** The stage carries a running or backing
  fighter at a steady speed while the clip plays in place, so a foot on the floor must move back
  in figure space at exactly that speed. A clip's `stride` lists each foot's contacts: the times
  it is down and the point of the shoe it stands on (`TOE` or `HEEL`, the sole's corners in
  kit.ts). From touchdown that point is held on the floor and carried at `speed`; the leg
  reaches it by IK and the foot keeps its keyed angle, so it rolls on that point. A contact that
  starts as another of the same foot ends takes over its spot (toe, then heel). A `move` adds an
  extra figure-x by time (the block's front foot holding its place while the stage slides the
  body back). Speeds are the stage's: `RUN_SPEED` = `BEAT.dashSpeed` 560 u/s,
  `BACK_SPEED` = `BEAT.dashBackSpeed` 250 u/s (was 640: no backward walk in a 240 ms cycle covers
  that); test/gate/movement.test.ts reads tuning.ts and checks both.
- **Dash.** Two 120 ms steps, 72 ms on the toe and 48 in the air; the toe lands 24 ahead of the
  hip and leaves 16 behind; knee drive to hip height; the trunk leans 20; each arm swings against
  its own leg, elbows bent, the free arm further than the weapon arm. t = 0 is the back foot's
  push-off.
- **Backpedal.** Legs step one behind the other in guard, 132 ms down per foot (a moment on
  both feet each step): toe first, the heel down, the toe up last; 33 units a step.
- **Idle and brace.** On the balls of the feet (both feet stand on their toes, heels lifting
  and settling), three small bounces a loop, breathing over the loop. The brace drops the knees,
  pushes the back heel up and raises the weapon forearm in front of the face (`GUARD_UP`).
- **Evade.** The trunk tips back and the chin tucks before the feet leave the floor; at the
  blow (110 ms, the stage's `evadeLead`) the head is 6 or more units back; the back foot lands
  first. The stage carries the hop.
- **Blocks.** They play from the blow, from `GUARD_UP`: the forearms are driven back, the back
  foot steps back at once and the front foot holds its place, then steps back. A shield block
  holds the back forearm at about -124 degrees, where the shield stands square.

### Footwork in real bouts (movement pass 2)

Measured on the drawn feet of whole bouts (stage test/feet.test.ts, lib/feet.ts: the sole's toe
and heel corners, every 60 fps frame, a corner within 0.35 of the floor is down), the first pass
still slid: the stage eased the dash (0 to about 840 u/s) under a loop drawn for 560, walked
fighters home on an eased slide under the backpedal, slid an evader back after the hop and a
blocker home after the block. Worst slide during footwork, three fixtures and two find-bout bouts:
53.1 units before, 0.22 after. The rule now: **the stage moves a fighter only the way its clip is
drawn for**, and every footwork clip starts and ends on the idle's toe spots (`TOE_F`, `TOE_B`).
Footwork clips are content variants the stage asks for by name (content/clips/footwork.ts; a
gate-only rig plays its idle there and the stage keeps the same timing, tuning.ts
`FOOTWORK.fallback`, which rig test/gate/movement.test.ts checks against the clips).

- **Short ways shuffle.** Home marks are 80 units apart, so most approaches are 5 to 40 units
  (a dash cycle is 134). A way shorter than `FOOTWORK.runFrom` (46 x the fighter's size), and
  every way home, is the boxer's bounce step `shuffle` (180 ms): the knees dip, the toes leave
  their spots straight up at 50 ms, the stage carries the body (34 units at most, on an arc of a
  third of its length) only until 120 ms, when both toes land straight down on their spots. A
  fighter set in a raised guard first plays the brace back to its start.
- **The run: push-off, dash, brake.** From the brace's end, `dash-push` (52 ms, Muybridge plate
  62's first stride): the back toe drives while the body speeds up from rest to the run speed at
  an even rate (14.56 units). Whole dash cycles at the run speed. Then `brake` (158 ms): it starts
  on the dash's pose at 12 ms, in the air; the stage keeps the run speed through the flight,
  fitting its first 40 ms to the distance and playing the last 8 at 1x (the front toe paws back
  onto its spot); at 48 ms the front foot plants 14 units ahead of its guard spot and the body
  slows to rest at an even rate by 98 ms, the hips sinking over the bent knee, the back foot down
  behind at 80 ms; then it rises into the guard. The run speed and distances are scaled by the
  fighter's drawn size (its build), since the rig draws a foot's travel in figure units; the run
  is planned on the floor's x (a way into the depth is carried in the air or along with the run).
- **Two dodges.** `slip` (300 ms): from the raised guard the knees drop and the trunk dips under
  the blow, the head 9 units or more lower at 110 ms, both toes planted. The evade is the
  hop-back: both toes on the floor until 60 ms, the stage carries the hop (22 units on a 14-unit
  arc) until 270 ms, the back toe then the front come straight down on their guard spots; he
  stays there and shuffles home with everyone else. The choice (stage effects.ts `dodgeOf`): a
  blow that comes straight in (fists, a light weapon, a jab, a flick, a thrust, a throw) is
  slipped; a heavy weapon, a two-hand swing or smash, a blade's slash (a duck would put the head
  under it) or a pet going for the legs is hopped away from; any other one-hand side swing goes by
  the log's seed and the step (`OUTCOME.slipShare`). No sim change.
- **Blocks.** The stage moves the blocker back 6 units (x its size) exactly as the block's feet
  are drawn for and leaves him there (no slide home); he shuffles home at the next way home. The
  back toe holds its spot as it leaves, both lifted feet clear the floor (they used to hang toe
  down and drag), and the block ends on the idle's feet. A defender standing idle when a block or
  a dodge comes raises the guard first (the brace, fitted into the moments before).
- **No chained contacts across a one-shot clip's end.** sample.ts reads a contact that starts at
  0 as taking over from one that ends at the clip's length (right for a loop), so in a one-shot
  clip the last contacts end a hair early (219.9, 319.9). An engine fix would retire that.
- **Not footwork, not yet fixed.** A blow's knockback still slides the target's planted feet
  4 to 20 units out and back (the worst slide left in a whole bout, 33 units, all knockback,
  flinch and fall frames), a block's recoil slides the attacker 5 units, and a few attack clips
  end with the feet off their guard spots (the thrust's lunge, the two-hand heave), so the
  crossfade into the idle drifts them up to 3 units. The test leaves those frames out by name
  (`FOOTWORK_CLIPS`, the knockback and recoil nudges, the crossfade out of any other clip).

## Weapons

`WeaponArt` in the weapon's own units, +x along it, the grip at `grip`. `tip` is the part the
brief's table says hits (the Pipe's coupling, the knife's point, the knuckles). The stage puts
`tip` on the target; the engine pins the back hand to `grip2` (two-bone IK, 1 unit or less in
every frame of every clip, see below). Items are drawn at their own
size, never scaled with the body. Flexible weapons: `segments` (3 or more links) that follow
`Pose.trail`.

### Using each weapon the way the real object is (animation pass, 16 Nov 2026)

Owner, after playing: "Lots of unrealistic arms or usage of weapons." Measured before the pass
(every two-hand weapon, every clip it can play, every build at size 1 and 1.15): the back arm
needed up to 1.38 of its length to hold `grip2` (Tyre in ko-fall; power-up 1.17, win 1.33, enter
and throw 1.26), so the drawn back hand sat up to 10 units off the shaft; the content clips were
gate stand-ins (smash played the one-hand club swing at 280 ms, thrust played the knife flick,
the pole weapons poked upward, the Anvil and the Chair were swung like sticks).

- **One clip per real use.** `WEAPON_META.clip` is the base clip the stage asks for; the content
  pack's `uses[held][base]` names the clip the rig really plays (`content/clips/use.ts`): the
  two-hand side swing (`swing-2h`: Bat, Cricket Bat, Rebar), the low-to-high sweep
  (`swing-low`: Golf Club, Hockey Stick), the fencing lunge (`thrust-1h`: Plunger, Umbrella,
  Garden Shears), and four throws besides the overarm lob (`throw-side`: Boomerang, Hubcap;
  `throw-roll`: Tyre; `throw-flick`: Darts; `throw-heave`: any two-hand weapon thrown away).
  A variant keeps its base clip's length and events. `samplePose` with an `Aim`, and
  `strikePoint`, pick the variant from the dress; `rig.attackClip(held, base)` names it for a
  caller that samples without a dress (the stage's throw).
- **Both hands on one shaft, always.** A clip keys the front arm; `figure()` in createRig puts
  the back hand on `grip2`. Where the keyed pose puts `grip2` beyond 94% of the back arm (or
  folded onto the shoulder), the front hand is drawn in (or out) just enough, the item keeping
  its angle as far as the front wrist bends; the back fist turns along the shaft only as far as
  its wrist bends (`BACK_WRIST`). The back hand lets go over 15 degrees of the front grip
  opening (a knockout drop) and while it holds a Move prop.
- **The fist grip decides the arm.** An item in a fist stands across the forearm
  (`GRIP_ROT`): to hold it level the forearm must point at least 20 degrees down (wrist
  = aim - grip - forearm + 90 within -70..80). Key such poses with
  `F: { dir, reach, aim }` (`gate/clips/kit.ts`: the wrist put `reach` of the arm from the
  shoulder, `dir` degrees below forward), arms angled down to a level shaft, hands at the hip.
  Items held otherwise say so in their art: `FOIL_GRIP` (Umbrella, Plunger, Garden Shears, along
  the forearm), `CLUB_GRIP` (Golf Club, Hockey Stick, hanging head down), `DART_GRIP`.
- **Pets drawn frame by frame (rotoscope)**: the stray dog since v3 (15 Nov 2026; owner: "Dog
  doesn't look like a dog"). Its body and legs are whole silhouettes, one per drawn frame, on
  shapes named `body@N`; the engine draws a frame's shapes only while the pet's `frame` bone
  rounds to N (`engine/sample.ts` `frameAt`, `hullAt`; untagged shapes draw in every frame), and
  the floor, the mouth and the hit point use that frame's own outline. Run and flee play six
  frames traced from Muybridge's galloping hound (plate 710; `pets/dog-frames.ts` is generated
  from the photographs: thresholded, legs lost to blur traced by hand, legs and tail thickened,
  the head cut off); standing and lying are drawn by hand at the same proportions. Head, jaw,
  ears and the hand-drawn tail stay on bones so they turn. Frames step, never blend: a clip's
  `frame` key changes in two keys at one time, just before the beat (`pets/frames.ts`).
  - The alley cat is traced the same way from Muybridge plate 718 (trot frames 3 to 8 run, gallop
    frames 13 to 18 flee); standing, the arched-back hiss and lying are drawn to match.
  - Where no motion series exists, the torso is traced from one public-domain or CC0 photo and the
    limbs stay on bones for the motion (`pets/traced-torsos.ts`): boar (plate 674 sow, shoulders
    raised into a hump, crest along the traced back), goose (CC0 snow goose), raccoon and crow
    (USFWS photos). The traced torso is one rigid picture, so those rigs keep the spine still.
- **Pets drawn from life** (`content/pets/`, the other five; the four-legged ones share
  `quad-build.ts` and the gait function `quad.ts`). The rules:
  - Draw the animal standing, in stage units, from real anatomy (`pets/anatomy.ts`: `smooth`
    outlines through control points, placed on their bones through the rest pose). Body masses
    (hips, loin, chest, neck, head) overlap in ONE outline group, never boxes or capsules; a
    piece drawn over another meets it with an edge that faces back or up (the lamp's side), so
    no shadow crescent cuts across the body. The goose neck is three bones under one outline:
    overlapping pieces, each cut on a slant at its base, no stripes.
  - Legs bend the animal's way, and the limits say so: a quadruped stands on its toes; the hind
    stifle points forward and the hock (the visible backward bend, the ankle) back; the elbow
    points back and the wrist folds the paw back and up in the swing; a bird's heel points back.
    The foot type is the animal's: the dog and the cat on their toes, the raccoon on its whole
    hind sole (plantigrade), the boar on hooves.
  - Feet are placed, not swung: a clip says where each foot's sole touches and at what angle,
    and `legIK` solves the leg. In stance the foot is on the floor and slides back at the body's
    one speed; the heel peels up (the end bone turns forward over the toe) toward the push-off;
    the swing arcs the foot's joint, the folded paw hanging from it.
  - Gaits from Muybridge, Animal Locomotion (1887, public domain): the dog's run is a trot in
    diagonal pairs (plate 706), its flee a rotary gallop with two flights (plate 710); the goose
    waddles, the body bobbing over each foot; the raccoon, cat (plate 718) and boar (plate 674)
    trot to run and gallop to flee; the crow hops to run and flaps low to flee (plate 756, the
    pigeon: full downstroke, folded upstroke). Wings are three blades (coverts, secondaries,
    primaries) that lie stacked and fan apart as they open. `test/content/pets.test.ts` checks
    the bends, the planted feet, the footfall order, the one-outline bodies and neck, the sizes.
  - Readability: the crow carries a blue-grey sheen (the accent slot) on crown, nape, back and
    wing coverts and a pale eye, so it is a clear silhouette on the dark arena. Movement pass 2
    lightened it (gate/style.ts `COMPANION_COLOURS.crow`): body #5A667E blue-grey, wing tips
    #323A4A, sheen #8494B0; the near-black #2A2A30 body vanished on the night arena. A pet's ink
    outline scales with its drawn size (`petLine` in engine/createRig: the square root of its
    height over a fighter's, never under half the fighter's line).
  - Sizes: drawn at their share of a fighter (84 units): dog 30%, goose 35%, raccoon 22%, cat
    25%, crow 20%, boar 41% (cap 45%). `PET_UNIT` (content/pets.ts) hands each pet to the rig
    a little larger, so the stage's `PET_SCALE` (packages/stage layout, measured on the real art)
    stays under 1 for the capsule test rig's stand-ins too.
  Tails and wings `lag`.
- `pnpm sheet --mode use-all` (every weapon's use strip, full rig) and `--mode pets` (every pet
  clip). `test/content/use.test.ts` holds the lines; `test/content/use-audit.ts` prints the
  back-arm numbers (`npx tsx packages/rig/test/content/use-audit.ts --rows`).

## Arena

`gate/yard.ts`: the alley. Top 46% wall (brick, the lamp and its stepped glow, a lit window, a
shutter with a stencilled 0, chain-link fences with four crowd heads that bob on a hit), bottom
54% asphalt (the lamp's pool of light in stepped flat ellipses, grime, cracks, the worn painted
ring, a puddle). All static shapes are generated once from a seed into path strings. Any new
arena keeps the floor line and the home marks.

## Checking art

- `pnpm sheet --mode a1 | joints | keys | frames | onion | video | use | all` and
  `pnpm spacing`, with `--rig <id> --clip <name|all> --pack gate|throw|probe --held <id>`.
  Output goes to `.review/wp2/`. Open every sheet.
- `packages/rig/test/gate/*` and `test/engine/*` hold the numeric lines. They are proxies: a
  clip that passes and still looks stiff on the sheet fails.
