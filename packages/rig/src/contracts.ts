/**
 * FROZEN CONTRACT (work package 0). The rig: bones, flat shapes, clips, poses, the two art packs
 * and the `Rig` object every consumer draws with.
 *
 * Rules of this package:
 *  - It imports types from "@rankzero/core" and nothing else. No browser types, no clock.
 *    (The capsule test double also reads the frozen identity table WEAPON_META.)
 *  - Everything is authored facing right, in stage units (the stage is 360 x 240, a scrapper is
 *    84 units tall), with y growing downward. The host scales the canvas; the rig never does.
 *  - One timing source. The stage reads every clip length and event time from `clipInfo()`.
 *    The swing clips are fixed by the timing table of the rules: punch, flick, swing and thrust
 *    are 280 ms with `contact` at 150; smash is 380 with `contact` at 240; throw has `release`
 *    at 180 and no `contact`.
 *  - An extra combo swing is the same clip played faster by the stage; the rig holds no second
 *    clip. The speed-up is NOT one straight scale (280 with contact at 150 would give 118, a
 *    smash 139). The stage maps clip time in two straight pieces around the strike:
 *    [0, strike] of the clip onto the first part of the short swing and [strike, end] onto the
 *    rest, so the strike lands exactly on the table's time for every attack clip. An extra
 *    throw uses the same two pieces around `release`, then its normal flight. `comboClipTime`
 *    below is that mapping, and the one copy of it. The two numbers of the short swing (220
 *    and 120 in the timing table) live in the stage's tuning file.
 *  - Clip fallback. Until the content pack lands, a rig built from the gate pack alone holds 13
 *    of the 23 scrapper clips. THE RIG applies `CLIP_FALLBACK`, inside `clipInfo`, `samplePose`
 *    and `strikePoint`: a content clip name answers with its gate clip. Only a name outside
 *    `SCRAPPER_CLIPS` (or outside `COMPANION_CLIPS` for a companion) falls back to "idle", with
 *    one warning. The stage never applies a fallback and never needs to know which rig it has.
 *    (Content v2 added a 24th scrapper clip, "block-shield": a block with the shield raised.)
 *    Two fallbacks change the timeline and the stage must cope: `throw` becomes a clip with a
 *    `contact` and no `release`, and `smash` becomes 280 with contact at 150. So the stage reads
 *    the strike of a clip with `strikeTime`, which takes `release` when there is no `contact`.
 *  - The engine is not scrapper-shaped. `RigDef.bones` is free-form, so a four-legged companion
 *    needs no engine change.
 *  - Missing art never throws. A missing effect or Move prop draws nothing and warns once, a
 *    missing arena draws the yard and warns once, a missing icon gives a plain ring.
 *  - Gate-only rig. A rig built from the gate pack alone (`createRig(gatePack)`, the seam from
 *    the first integration to the content merge) still answers for everything the gate pack
 *    has no art for, with fixed stand-ins, never shipped:
 *      companions: a placeholder body at the rules' size (content v2 pets at the capsule rig's sizes; Raccoon 26 units tall, Goose 40, Boar
 *        52 tall and 70 long) with a mouth at its front end, and the clip times of
 *        `PLACEHOLDER_COMPANION_CLIPS` (attack 280 with contact at 150);
 *      a weapon outside `GATE_WEAPONS`: a straight bar `placeholderLength(reach)` long (Reach
 *        from WEAPON_META), gripped at one end at the item's own size, its `tip` at the far end,
 *        no `grip2`, no links (a weapon that bends is drawn straight), drawn in both hands for a
 *        pair. Its strike point is that far end;
 *      a shield: a `SHIELD_PLACEHOLDER` slab of its own size held at its inner edge on the back
 *        forearm, in its own flat colour.
 *    `capsuleGateRig` follows the same rule, so the stage lane tests against what the real rig
 *    will do. A rig test checks `createRig(gatePack)` against this rule.
 *  - Aim. A clip with a `contact` bends toward a target height when the caller asks (`Aim`), so
 *    the striking end meets a short target or a tall one. See `samplePose` and `strikePoint`.
 *  - Things have one size. `Dress.scale` and the build size the body. A weapon, a shield or a Move
 *    prop is drawn at its own size in the hand, in flight and on the floor, so it never changes
 *    size when it is thrown, dropped or snatched.
 */
import type { CompanionId, GearId, GearSlot, HeldId, Look, PerkId, PropId, ShieldId, SkillId, StageId, StatKey, TalentId } from "@rankzero/core";

export type RigId = "scrapper" | CompanionId;
export const SCRAPPER_BONES = ["root","pelvis","torso","head","armB.up","armB.lo","handB",
  "armF.up","armF.lo","handF","legB.up","legB.lo","footB","legF.up","legF.lo","footF"] as const;
export type BoneId = (typeof SCRAPPER_BONES)[number];

export const SCRAPPER_CLIPS = ["idle","enter","dash","backpedal","brace","punch","flick","swing",
  "smash","thrust","throw","draw","hit-light","hit-heavy","block","evade","snared","power-up",
  "drink","slam","slammed","ko-fall","win","block-shield"] as const;         // 24 (content v2: block-shield)
export const GATE_CLIPS = ["idle","enter","dash","backpedal","brace","punch","flick","swing",
  "draw","hit-light","evade","ko-fall","win"] as const;                      // 13
export const COMPANION_CLIPS = ["idle","run","attack","hit","ko","flee"] as const;
export type ScrapperClip = (typeof SCRAPPER_CLIPS)[number];
export type GateClip = (typeof GATE_CLIPS)[number];
export type ContentClip = Exclude<ScrapperClip, GateClip>;
export type CompanionClip = (typeof COMPANION_CLIPS)[number];
/** Used only until the content pack lands. Never shipped. Applied by the rig, never by the stage
 *  (see "Clip fallback" above). */
export const CLIP_FALLBACK: Record<ContentClip, GateClip> = { smash: "swing", thrust: "flick",
  throw: "flick", "hit-heavy": "hit-light", block: "brace", snared: "brace", "power-up": "win",
  drink: "draw", slam: "swing", slammed: "ko-fall", "block-shield": "brace" };

export const GATE_WEAPONS = ["fists","pipe","pocket-knife"] as const;
export type GateWeapon = (typeof GATE_WEAPONS)[number];
export type GateUi = "pause" | "play" | "speed1" | "speed2" | "skip" | "sound" | "mute" | "replay";
export type ContentUi = "gear" | "back" | "dice" | "plus" | "locker" | "kit" | "bouts" | "close";

export type FaceId = "neutral" | "grit" | "shout" | "dazed" | "grin";
/** The fixed item colours ("sign" red, "cone" orange, "pink", "paint" blue) are real objects' own
 *  paint (`FIXED` in gate/style.ts). */
export type ColourSlot = "ink" | "skin" | "hair" | "top" | "bottom" | "shoes" | "accent" | "metal" | "wood" | "white"
  | "sign" | "cone" | "pink" | "paint"
  /** Body equipment's own colours (CONTRACT_REV 8): a hard hat's and a rubber glove's yellow, denim,
   *  tyre rubber, a rain boot's green, black leather, khaki, suede, a dark visor. */
  | "yellow" | "denim" | "rubber" | "green" | "leather" | "khaki" | "suede" | "visor"
  /** Content v3 batch 4: a black eye's bruise (a look's face). */
  | "bruise";
export type Ease = "linear" | "in" | "out" | "inOut" | "back" | "snap";

/** One bone. `limit` is the range its own rotation may take, in degrees, lowest first: the way a
 *  real elbow or knee bends. A rig test samples every clip and fails outside the range. A bone
 *  with no limit turns freely. */
export interface BoneDef { id: string; parent: number /* index, -1 = root */; x: number; y: number;
  limit?: readonly [min: number, max: number] }
export interface RigDef { id: RigId; height: number /* units */; bones: readonly BoneDef[] }
/** One flat shape. `shade` is the single darker cel shape allowed per part. The outline is always Night Ink. */
/** `flip` (items only): the path painted instead of `d` when the item is drawn mirrored (its
 *  transform turns it over, as for a holder facing left), so lettering such as the stop sign's
 *  never reads backwards. */
export interface Shape { bone: string; d: string; slot: ColourSlot; shade?: string; z: number; flip?: string }
export interface Key { t: number /* ms */; rot?: Readonly<Record<string, number>> /* degrees by bone id */;
  root?: readonly [number, number]; scale?: readonly [number, number] /* squash, 12% max */;
  face?: FaceId; ease?: Ease }
export interface Clip { duration: number; loop: boolean; keys: readonly Key[];
  events: readonly { t: number; name: "contact" | "release" | "land" | "step" }[];
  lag?: Readonly<Record<string, number>>;   // follow-through: ms this bone trails its keys
  plant?: readonly string[];                // foot bones pinned to the floor by two-bone IK
  stepped?: number }                        // 0 = smooth; 24 = hold poses at 24 fps (fallback lever)
export interface ClipInfo { durationMs: number; loop: boolean; events: Clip["events"] }

/** How far back a pose remembers its front hand, for a weapon that bends (see `Pose.trail`). */
export const TRAIL_STEP_MS = 40;
export const TRAIL_LEN = 4;
/** `rot` holds one angle per bone of that rig, in the order of its `RigDef.bones`. `root.x` and
 *  `root.y` are an offset from the actor's place in units (y is negative above the floor);
 *  `root.sx` and `root.sy` are the squash. `lift` is how far the feet are above the floor, for
 *  the ground shadow. A pose is plain data: equal inputs give equal poses.
 *
 *  `trail` is what lets a chain trail the hand although a draw call sees one pose and no past:
 *  the direction the front hand pointed (degrees, in the actor's own frame, before mirroring)
 *  at t - 40, t - 80, t - 120 and t - 160 ms of the same clip, newest first. `samplePose` fills
 *  it for the scrapper rig, by sampling the clip again; it is still a pure function of t.
 *  A clip that does not loop holds its first pose before t = 0 and its last pose after its end,
 *  and the trail is read from the time asked for: well after the end it is all the last pose,
 *  so a chain comes to rest. A pose with no `trail` draws a bending weapon straight. */
export interface Pose { rig: RigId; rot: readonly number[] /* degrees, in bone order */;
  root: { x: number; y: number; sx: number; sy: number }; face: FaceId; lift: number /* units above the floor */;
  trail?: readonly number[] }

/**
 * The Canvas 2D subset we call: flat fills and strokes, paths, transforms and text. Left out on
 * purpose: the canvas effects property (one browser does not ship it; the hit flash is a redraw
 * in white instead), blended fills, patterns, images and every browser type.
 * A browser `CanvasRenderingContext2D` and the Node canvas context both satisfy it.
 * Colours are written as strings only. A path made by `DrawEnv.path()` is passed to
 * `fill`, `stroke` or `clip`.
 */
export interface Ctx2D {
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(radians: number): void;
  scale(x: number, y: number): void;
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, start: number, end: number, counterclockwise?: boolean): void;
  ellipse(x: number, y: number, rx: number, ry: number, rotation: number, start: number, end: number, counterclockwise?: boolean): void;
  rect(x: number, y: number, w: number, h: number): void;
  fill(path?: unknown): void;
  stroke(path?: unknown): void;
  clip(path?: unknown): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  strokeText(text: string, x: number, y: number, maxWidth?: number): void;
  measureText(text: string): { width: number };
  setLineDash(segments: number[]): void;
  get fillStyle(): unknown;
  set fillStyle(colour: string);
  get strokeStyle(): unknown;
  set strokeStyle(colour: string);
  lineWidth: number;
  lineCap: "butt" | "round" | "square";
  lineJoin: "round" | "bevel" | "miter";
  miterLimit: number;
  lineDashOffset: number;
  globalAlpha: number;
  font: string;
  textAlign: "left" | "right" | "center" | "start" | "end";
  textBaseline: "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom";
}
/** What a draw call needs from its host. `path` turns an SVG path string into the host's own
 *  path object and caches it; the rig never builds one itself. */
export interface DrawEnv { ctx: Ctx2D; path(d: string): unknown /* a cached Path2D */ }

/** The small real objects three Moves use: the can of an Energy Drink, the whistle, the air horn.
 *  (The tarp and the firecrackers fly, so they are effects: `FxKind` "tarp" and "crackers".) */
export type MoveProp = "can" | "whistle" | "horn";
/** How one actor is dressed for one frame.
 *  `held`: null and "fists" both draw empty hands.
 *  `scale` is 1 for a normal scrapper. It sizes the body, not what the hands hold.
 *  `tint: "white"` redraws every part in white (the hit flash).
 *  `lead` is which arm does what the clip keys for the front arm. "B" swaps the two arms, so
 *  the back hand makes the swing: the stage sets it on every second swing of a combo when the
 *  held item is a pair (`WEAPON_META[id].pair`: bare fists, Knuckle Dusters, Screwdrivers).
 *  The rig reads it only for a pair and ignores it for anything else. Default "F".
 *  `prop` is a Move's object, drawn in the back hand while the Move's clip plays, so a held
 *  weapon stays where it is.
 *  `shield` is the shield on the back forearm, or null. It turns with the forearm; the
 *  "block-shield" clip raises it in front of the body. */
export interface Dress { look?: Look; held: HeldId | null; shield: ShieldId | null; scale: number; tint?: "white";
  lead?: "F" | "B"; prop?: MoveProp;
  /** Body equipment worn (CONTRACT_REV 8), one per slot, drawn on its bones over the look. */
  gear?: Partial<Record<GearSlot, GearId>> }

/** The look parts a piece of gear may hide while it is worn (a full-face helmet hides the hair, the
 *  face and the accessory; boots hide the shoes). */
export type LookPart = "hair" | "face" | "accessory" | "shoes"
  /** (content v3 batch 4) `crown`: the hair is cut at the brim (a hat sits over the crown);
   *  `headwear`: an accessory worn on the head (`AppearanceSet.headwear`) is taken off; `eyewear`:
   *  glasses (`AppearanceSet.eyewear`) are taken off. */
  | "crown" | "headwear" | "eyewear";
/**
 * One piece of body equipment as it is drawn on the fighter (CONTRACT_REV 8). `shapes` sit on the
 * scrapper's own bones (head, torso, arms, hands, legs, feet; a hand shape may end in ":open" like
 * the look's hands) at the z of the parts they cover plus a little, so they turn and bend with the
 * body. `hide` takes look parts away while it is worn. `hands`, `top` and `bottom` repaint the look's
 * skin of the hands, its top or its bottom in another slot (gloves, a jacket, trousers), so the
 * piece follows every finger and every crease of the body it covers.
 */
export interface GearArt { slot: GearSlot; shapes: readonly Shape[]; hide?: readonly LookPart[];
  hands?: ColourSlot; top?: ColourSlot; bottom?: ColourSlot; arms?: ColourSlot }
/** Where the feet stand, in stage units, and which way the actor faces (1 = right, -1 = left). */
export interface Place { x: number; y: number; facing: 1 | -1 }
/** A point given as an offset from an actor's `Place`, for an actor that faces right: x is
 *  forward, y is negative above the floor, both in stage units. `toStage` turns it into a stage
 *  point for an actor that may face left. */
export interface Offset { x: number; y: number }

/** Something a hand holds. `shapes` are drawn in the item's own units with the grip at
 *  `grip.x, grip.y`; `grip.rot` is the angle between the hand bone and the item's +x. */
export interface PropArt { shapes: readonly Omit<Shape, "bone">[]; grip: { x: number; y: number; rot: number } }
/** One link of a weapon that bends. Its shapes are drawn along its own +x from its start. */
export interface WeaponSegment { length: number; shapes: readonly Omit<Shape, "bone">[] }
/**
 * One weapon drawing. It serves the hand, the flight, the floor and the 28 and 44 px icons.
 *  `tip` is the striking end in the weapon's own units, the part that the weapon's `use` line
 *    says hits. At the contact frame the stage puts THIS point on the target.
 *  `grip2` is where the back hand holds a weapon that takes both hands on one shaft. The engine
 *    pins the back hand to it with two-bone IK on every frame (1 unit or less).
 *  `offhand` marks a pair: the same drawing is drawn again in the back hand.
 *  `segments` makes the weapon bend (`WEAPON_META[id].flex`): three or more links. Link 0 starts
 *    at the grip and turns with the hand. Link k starts where link k - 1 ends and points where
 *    the hand pointed k x 40 ms earlier (`Pose.trail[k - 1]`), so the far end arrives late.
 *    Such a weapon has no `shapes` of its own (an empty list), `length` is the sum of its
 *    links, and `tip` is its far end when it lies straight. In flight and on the floor it is
 *    drawn straight.
 * Every weapon has `hands: 2` in WEAPON_META exactly when its art has `grip2` or `offhand`
 * (bare fists aside); a rig test checks it for each pack.
 */
export interface WeaponArt extends PropArt { length: number;
  tip: { x: number; y: number }; grip2?: { x: number; y: number }; offhand?: true;
  segments?: readonly WeaponSegment[] }
/** 24-unit box. `w` is the ink outline width of one shape (default `LINE.icon`): a thin part of a
 *  weapon icon takes a thinner line, or the outline swallows its fill. */
export interface IconArt { shapes: readonly { d: string; slot: ColourSlot | "self"; shade?: string; w?: number }[] }
export type FxKind = "burst" | "dust" | "spark" | "whoosh" | "tarp" | "tape" | "crackers"
  | "rings" /* Whistle, Air Horn */ | "plus" /* heal */ | "trail" /* Haymaker swing */;
/** `progress` runs from 0 to 1 over the life of the effect. `seed` picks its cosmetic variation. */
/** `size`: the drawn size of the body an effect covers (the tarp over a pet), `w` across and `h`
 *  above the floor line; without it the effect is drawn at a fighter's size. `neck` (CONTRACT_REV
 *  6): the tarp over a fighter hangs from this height over the floor line, across the shoulders,
 *  so the head shows above it; without it the sheet covers the whole body (a pet). */
export interface FxSize { w: number; h: number; neck?: number }

export type FxDraw = (env: DrawEnv, progress: number, at: Place, seed: number, size?: FxSize) => void;
/** One arena: the back wall layer and the floor layer of the 360 x 240 stage, with its own small
 *  crowd on the back layer. `crowdBounce` runs from 0 to 1 (0 = the crowd stands still).
 *  Every arena keeps the stage geometry: the floor line, the home marks and the companion marks
 *  are the same in all five, so the choreography never changes with the place. */
export type StageDraw = (env: DrawEnv, layer: "back" | "floor", crowdBounce: number) => void;
export interface Palette { top: string; bottom: string; shoes: string; accent: string }
export interface AppearanceSet {            // list lengths may be under LOOK_SPACE in the gate pack; an index wraps
  /** `belly` (content v3 batch 4, optional): the front of the trunk pushed forward round the stomach
   *  by this share of its depth (engine/build.ts), for a heavy build; `head` (optional) widens the
   *  head and neck across the head bone (a heavy man's fuller face, a wiry one's gaunt one). */
  builds: readonly { scale: number; limb: number; torso: number; belly?: number; head?: number;
    /** (optional) the pelvis drawn this much deeper down the body (a heavy build's seat), so wide
     *  thighs stay covered round the hip pins in every bend. A drawing scale, never a bone length. */
    seat?: number;
    /** (optional) the legs' width when it is not the arms' (`limb`). */
    leg?: number }[];
  heads: readonly Shape[][]; hair: readonly Shape[][]; faces: readonly Record<FaceId, Shape[]>[];
  tops: readonly Shape[][]; bottoms: readonly Shape[][]; shoes: readonly Shape[][];
  accessories: readonly Shape[][]; hands: readonly Shape[];
  skin: readonly string[]; hairColor: readonly string[]; palettes: readonly Palette[];
  /** Content v3 batch 4 (optional): accessories worn on the head (a cap, a beanie, glasses,
   *  headphones, a headband, a bandage). Head gear that hides "headwear" takes them off, so a hard hat
   *  never sits on a cap. */
  headwear?: readonly number[];
  /** Accessories worn over the eyes (dark glasses): goggles take them off (LookPart "eyewear"). */
  eyewear?: readonly number[];
  /** Accessories that sit over the crown (a cap, a beanie): the hair is cut at the brim under them,
   *  as under a hat worn as gear (LookPart "crown"). */
  crownwear?: readonly number[] }

export interface GatePack {                 // the rig lane: packages/rig/src/gate/pack.ts
  scrapper: RigDef;
  clips: Record<GateClip, Clip>;
  weapons: Record<GateWeapon, WeaponArt>;
  looks: AppearanceSet;                     // 2 full looks, 3 builds
  stages: Record<"yard", StageDraw>;        // the gate draws one arena; the other four are content
  fx: Record<"burst" | "dust" | "spark" | "whoosh", FxDraw>;
  icons: Record<`stat:${StatKey}` | `ui:${GateUi}`, IconArt>;
}
export interface ContentPack {              // the content-art lane: packages/rig/src/content/pack.ts
  clips: Record<ContentClip, Clip>;
  weapons: Record<Exclude<HeldId, GateWeapon>, WeaponArt>;
  /** Content v2: the six shields (they replace the one `door`). `grip` is the inner handle on
   *  the back forearm; `tip` is the middle of the face that takes a blow. */
  shields: Record<ShieldId, WeaponArt>;
  props: Record<MoveProp, PropArt>;
  stages: Record<Exclude<StageId, "yard">, StageDraw>;
  looks: AppearanceSet;                     // full LOOK_SPACE counts; re-uses the gate parts as its first entries
  companions: Record<CompanionId, { rig: RigDef; shapes: readonly Shape[]; clips: Record<CompanionClip, Clip> }>;
  fx: Record<"tarp" | "tape" | "crackers" | "rings" | "plus" | "trail", FxDraw>;
  /** Skills and content UI; since the review of 15 Nov 2026 also every shield and every held
   *  item (fists, the gate's pipe and knife included), drawn for 28-64 px. `rig.icon` uses these
   *  over the engine's whole-weapon drawing, which turns a long pole into a hairline and a
   *  weapon drawn as links into an empty icon. */
  icons: Record<SkillId | `ui:${ContentUi}` | ShieldId | HeldId | GearId | `talent:${TalentId}`, IconArt> & Partial<Record<CompanionId, IconArt>>;
  /** Body equipment (CONTRACT_REV 8): every piece drawn on the bones of its slot. */
  gear: Record<GearId, GearArt>;
  /** Animation pass (16 Nov 2026), optional: the clip variants a held item plays in place of a
   *  base clip (`uses[held][base]` names one of `variants`), so each weapon is used the way the
   *  real object is. A variant keeps its base clip's length and events (a rig test). */
  variants?: Readonly<Record<string, Clip>>;
  uses?: Readonly<Partial<Record<HeldId, Readonly<Record<string, string>>>>>;
}
/** `talent:<id>`: a talent node of the tree (CONTRACT_REV 9). */
export type IconRef = PerkId | "fists" | `stat:${StatKey}` | `ui:${GateUi | ContentUi}` | `talent:${TalentId}`;
export interface SvgPart { d: string; fill: string; stroke?: string; strokeWidth?: number; transform?: string }
export interface SvgArt { viewBox: string; parts: SvgPart[] }

/**
 * A request to bend a clip toward a target. `y` is the height the striking end must have at the
 * clip's `contact` time: an `Offset` y from the attacker's place (negative above the floor),
 * normally the y of the target's `hitPoint`. `dress` is the attacker's own dress, because where
 * the striking end is depends on the held item, the build and `Dress.scale`.
 *
 * Rules every rig keeps:
 *  - Only a clip with a `contact` event (after the clip fallback) bends. Any other clip ignores
 *    the aim: a throw's item is carried to the target by its flight, not by the arm.
 *  - The bend is full at the contact time and fades smoothly to none at the clip's start and
 *    end, so the clip still starts and ends on its own poses. It is a pure function of t.
 *  - Reach. `strikePoint(rig, clip, dress, y).y` is within `AIM_TOLERANCE` of `y` for every `y`
 *    that is a `hitPoint` of a target the stage may aim at: a scrapper aims at the head or the
 *    body of any rig, a companion at the body of any rig, in every build and at every
 *    `Dress.scale` from 1 to 1.15 of attacker and target. Outside that the rig gets as close as
 *    it can and never throws.
 *  - How it bends is the rig's choice, inside `BoneDef.limit`: a scrapper leans at the waist,
 *    turns at the shoulders and bends the knees; a companion lowers its head or leaps. The bend
 *    moves the strike point's x too, and the stage stops the attacker on that x.
 *  - Without an aim a clip plays exactly as keyed.
 */
export interface Aim { y: number; dress: Dress }
/** How close an aimed strike gets to the height asked for, in stage units. */
export const AIM_TOLERANCE = 1;

/** Clip times of a placeholder companion in a gate-only rig (see the header). */
export const PLACEHOLDER_COMPANION_CLIPS: Readonly<Record<CompanionClip, ClipInfo>> = {
  idle: { durationMs: 1200, loop: true, events: [] },
  run: { durationMs: 240, loop: true, events: [{ t: 0, name: "step" }, { t: 120, name: "step" }] },
  attack: { durationMs: 280, loop: false, events: [{ t: 150, name: "contact" }] },
  hit: { durationMs: 300, loop: false, events: [] },
  ko: { durationMs: 600, loop: false, events: [{ t: 400, name: "land" }] },
  flee: { durationMs: 240, loop: true, events: [{ t: 0, name: "step" }, { t: 120, name: "step" }] },
};
/** Length in units of the stand-in for a weapon with no art: 12 plus 10 for each point of Reach
 *  (12 for a Thrown weapon or Knuckle Dusters, 52 for a Bike Chain). */
export function placeholderLength(reach: number): number { return 12 + 10 * reach; }
/** The stand-in shields: a flat slab `w` wide and `h` tall, held at its inner edge (the Car Door
 *  keeps the first panel's 22 x 32). */
export const SHIELD_PLACEHOLDER: Readonly<Record<ShieldId, { w: number; h: number }>> = {
  "car-door": { w: 22, h: 32 }, "bin-lid": { w: 18, h: 18 }, "wooden-pallet": { w: 26, h: 30 },
  "ironing-board": { w: 12, h: 44 }, "skateboard": { w: 8, h: 30 }, "riot-shield": { w: 24, h: 42 },
};

/** Everything a consumer may call. The stage and the app get a Rig by injection. */
export interface Rig {
  /** Length, loop flag and events of a clip, after the clip fallback (see the header). */
  clipInfo(rig: RigId, clip: string): ClipInfo;
  /** The pose of a clip at a time. Pure. A loop clip wraps; any other clip holds its last pose.
   *  With `aim`, a clip with a contact is bent toward the aim (see `Aim`); the stage passes the
   *  same aim on every frame of that swing, and for the trail the rig bends the past samples the
   *  same way. */
  samplePose(rig: RigId, clip: string, tMs: number, aim?: Aim): Pose;
  drawActor(env: DrawEnv, pose: Pose, dress: Dress, at: Place): void;
  /**
   * The grip point of the leading hand of this pose, as a stage point: where a thrown weapon
   * leaves, where a Snatch takes from. It takes the dress because the drawn hand depends on
   * `dress.scale`, the build and `dress.lead`; it is the hand `drawActor` draws for the same
   * arguments. `rot` is the angle of a held item in degrees, in the actor's own frame, before
   * mirroring: pass it to `drawProp` with the same `facing` and the item is drawn exactly as
   * it sits in the hand. For a companion it is the mouth, with `rot` 0.
   */
  handAnchor(pose: Pose, dress: Dress, at: Place): { x: number; y: number; rot: number };
  /** An item in flight or on the floor, at its own size. Its grip is put at `at.x, at.y`;
   *  `rot` is in degrees, in the item's own frame before mirroring, as `handAnchor` gives it.
   *  The stage chooses the height at which an item lies on the floor. */
  drawProp(env: DrawEnv, item: PropId, at: Place & { rot: number }): void;
  /** One layer of an arena. An arena whose art has not landed draws the yard and warns once. */
  drawStage(env: DrawEnv, stage: StageId, layer: "back" | "floor", crowdBounce: number): void;
  /**
   * Accurate weapon use by construction. Where the striking end is at the strike time of a clip
   * (`strikeTime` of its `clipInfo`): the weapon's `tip`, the leading fist when the hands are
   * empty, a companion's mouth or tusk. For the "throw" clip it is the release point: the
   * hand's grip point, where `handAnchor` is at that time.
   * The answer is an `Offset` from the actor's place for an actor that faces right, in stage
   * units, measured from the same pose and the same maths `drawActor` uses. It already holds
   * the clip's own lunge (`Pose.root`), the squash, `dress.scale`, the build, `dress.lead`
   * and the held item with its trail. A clip with no strike gives the point at t = 0.
   * With `aimY`, it is the striking end of `samplePose(rig, clip, strike, { y: aimY, dress })`:
   * the clip bent toward that height, so its y is within `AIM_TOLERANCE` of `aimY` wherever
   * `Aim` promises reach.
   */
  strikePoint(rig: RigId, clip: string, dress: Dress, aimY?: number): Offset;
  /**
   * The place on a standing target (its idle pose at t = 0) that a swing lands on: the middle
   * of the head, or the middle of the body (for a long body, a four-legged companion, the
   * middle of its front half: the side its enemy stands on). An `Offset` from the target's
   * place for a target that faces right, with `dress.scale` and the build in it. It lies
   * inside the drawn figure. The stage aims the swing at it (`strikePoint` with this y as
   * `aimY`, and the same `Aim` in `samplePose`) and stops the attacker at the floor x where the
   * two points meet, so the striking end touches the target at any height `Aim` covers.
   */
  hitPoint(rig: RigId, dress: Dress, zone: "head" | "body"): Offset;
  drawFx(env: DrawEnv, fx: FxKind, progress: number, at: Place, seed: number, size?: FxSize): void;
  portrait(look: Look): SvgArt;                                             // React cards and portraits
  companionPortrait(id: CompanionId): SvgArt;
  icon(ref: IconRef): SvgArt;                                               // missing art gives a plain ring
  /** Animation pass (16 Nov 2026), additive and optional: the clip a scrapper really plays to
   *  use what it holds, for a base attack clip name (`WEAPON_META.clip`, or "throw"). A Bat's
   *  "swing" is the two-hand "swing-2h", a Boomerang's "throw" the side-arm "throw-side", and so
   *  on (`content/clips/use.ts`). Every variant has its base clip's length and events, so the
   *  timeline does not change. `samplePose` (with an `Aim`) and `strikePoint` already pick the
   *  variant from the dress; the stage needs this only where it samples without a dress (the
   *  throw). A rig with no variants answers the base name. */
  attackClip?(held: HeldId | null, base: string): string;
}
export type CreateRig = (gate: GatePack, content?: ContentPack) => Rig;     // the rig lane: engine/createRig.ts

// ------------------------------------------------------------------ tiny shared helpers

/** An `Offset` of an actor as a stage point: x is mirrored for an actor that faces left. */
export function toStage(at: Place, p: Offset): { x: number; y: number } {
  return { x: at.x + at.facing * p.x, y: at.y + p.y };
}

/** When a clip strikes, in ms: its `contact` event, or its `release` event when it has no
 *  contact (a throw). `null` for a clip that has neither. */
export function strikeTime(info: ClipInfo): number | null {
  let release: number | null = null;
  for (const e of info.events) {
    if (e.name === "contact") return e.t;
    if (e.name === "release" && release === null) release = e.t;
  }
  return release;
}

/**
 * Clip time for an extra combo swing: the clip played in `lengthMs` with its strike at
 * `strikeAtMs` (220 and 120 in the timing table). Two straight pieces: [0, strikeAtMs] maps
 * onto [0, strike] of the clip and [strikeAtMs, lengthMs] onto [strike, end]. `tMs` is the time
 * since the short swing began; it is held inside the swing. A clip with no strike, or a strike
 * at one of its ends, is scaled in one piece.
 */
export function comboClipTime(info: ClipInfo, tMs: number, lengthMs: number, strikeAtMs: number): number {
  const d = info.durationMs;
  if (!(lengthMs > 0) || !(d > 0)) return 0;
  const t = tMs < 0 || tMs !== tMs ? 0 : tMs > lengthMs ? lengthMs : tMs;
  const strike = strikeTime(info);
  if (strike === null || strike <= 0 || strike >= d || !(strikeAtMs > 0) || strikeAtMs >= lengthMs) return (t * d) / lengthMs;
  return t <= strikeAtMs
    ? (t * strike) / strikeAtMs
    : strike + ((t - strikeAtMs) * (d - strike)) / (lengthMs - strikeAtMs);
}
