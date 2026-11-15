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
- **Clip ends in the guard.** The stage cuts between clips with no blend, so every clip starts
  and ends within 30 degrees of the stance (forearm and hand), and the loops it can leave at any
  frame (idle, dash, backpedal) stay there all through: the run keeps the guard up, the free fist
  pumps only a little. The jump-in start, the knockout's end and the win loop are exempt.
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
- **Pets** (`content/pet-clips.ts`): a gait is a sine per leg with its own phase (the swing
  phase folds the lower leg and tucks the foot), so legs take turns; tails and wings `lag`.
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
