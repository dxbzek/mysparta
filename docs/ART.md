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

## Weapons

`WeaponArt` in the weapon's own units, +x along it, the grip at `grip`. `tip` is the part the
brief's table says hits (the Pipe's coupling, the knife's point, the knuckles). The stage puts
`tip` on the target; the engine pins the back hand to `grip2` (two-bone IK, 1 unit or less in
every frame of the swing and thrust clips at a bat-like spacing). Items are drawn at their own
size, never scaled with the body. Flexible weapons: `segments` (3 or more links) that follow
`Pose.trail`.

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
