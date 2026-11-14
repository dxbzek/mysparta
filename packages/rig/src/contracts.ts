/**
 * FROZEN CONTRACT (work package 0). The rig: bones, flat shapes, clips, poses, the two art packs
 * and the `Rig` object every consumer draws with.
 *
 * Rules of this package:
 *  - It imports types from "@rankzero/core" and nothing else. No browser types, no clock.
 *  - Everything is authored facing right, in stage units (the stage is 360 x 240, a scrapper is
 *    84 units tall), with y growing downward. The host scales the canvas; the rig never does.
 *  - One timing source. The stage reads every clip length and contact time from `clipInfo()`.
 *    The swing clips are fixed by the timing table of the rules: punch, flick, swing and thrust
 *    are 280 ms with `contact` at 150; smash is 380 with `contact` at 240; throw has `release`
 *    at 180. An extra combo swing is the same clip played faster by the stage (220 ms, contact
 *    at 120); the rig holds no second clip.
 *  - The engine is not scrapper-shaped. `RigDef.bones` is free-form, so a four-legged companion
 *    needs no engine change.
 *  - Missing effect art draws nothing and warns once. `drawFx` never throws on an `FxKind`
 *    whose pack has not landed. A missing icon gives a plain ring.
 */
import type { CompanionId, HeldId, Look, PerkId, PropId, SkillId, StatKey } from "@rankzero/core";

export type RigId = "scrapper" | CompanionId;
export const SCRAPPER_BONES = ["root","pelvis","torso","head","armB.up","armB.lo","handB",
  "armF.up","armF.lo","handF","legB.up","legB.lo","footB","legF.up","legF.lo","footF"] as const;
export type BoneId = (typeof SCRAPPER_BONES)[number];

export const SCRAPPER_CLIPS = ["idle","enter","dash","backpedal","brace","punch","flick","swing",
  "smash","thrust","throw","draw","hit-light","hit-heavy","block","evade","snared","power-up",
  "drink","slam","slammed","ko-fall","win"] as const;                        // 23
export const GATE_CLIPS = ["idle","enter","dash","backpedal","brace","punch","flick","swing",
  "draw","hit-light","evade","ko-fall","win"] as const;                      // 13
export const COMPANION_CLIPS = ["idle","run","attack","hit","ko","flee"] as const;
export type ScrapperClip = (typeof SCRAPPER_CLIPS)[number];
export type GateClip = (typeof GATE_CLIPS)[number];
export type ContentClip = Exclude<ScrapperClip, GateClip>;
export type CompanionClip = (typeof COMPANION_CLIPS)[number];
/** Used only until the content pack lands. Never shipped. */
export const CLIP_FALLBACK: Record<ContentClip, GateClip> = { smash: "swing", thrust: "flick",
  throw: "flick", "hit-heavy": "hit-light", block: "brace", snared: "brace", "power-up": "win",
  drink: "draw", slam: "swing", slammed: "ko-fall" };

export const GATE_WEAPONS = ["fists","pipe","pocket-knife"] as const;
export type GateWeapon = (typeof GATE_WEAPONS)[number];
export type GateUi = "pause" | "play" | "speed1" | "speed2" | "skip" | "sound" | "mute" | "replay";
export type ContentUi = "gear" | "back" | "dice" | "plus" | "locker" | "kit" | "bouts" | "close";

export type FaceId = "neutral" | "grit" | "shout" | "dazed" | "grin";
export type ColourSlot = "ink" | "skin" | "hair" | "top" | "bottom" | "shoes" | "accent" | "metal" | "wood" | "white";
export type Ease = "linear" | "in" | "out" | "inOut" | "back" | "snap";

export interface BoneDef { id: string; parent: number /* index, -1 = root */; x: number; y: number }
export interface RigDef { id: RigId; height: number /* units */; bones: readonly BoneDef[] }
/** One flat shape. `shade` is the single darker cel shape allowed per part. The outline is always Night Ink. */
export interface Shape { bone: string; d: string; slot: ColourSlot; shade?: string; z: number }
export interface Key { t: number /* ms */; rot?: Readonly<Record<string, number>> /* degrees by bone id */;
  root?: readonly [number, number]; scale?: readonly [number, number] /* squash, 12% max */;
  face?: FaceId; ease?: Ease }
export interface Clip { duration: number; loop: boolean; keys: readonly Key[];
  events: readonly { t: number; name: "contact" | "release" | "land" | "step" }[];
  lag?: Readonly<Record<string, number>>;   // follow-through: ms this bone trails its keys
  plant?: readonly string[];                // foot bones pinned to the floor by two-bone IK
  stepped?: number }                        // 0 = smooth; 24 = hold poses at 24 fps (fallback lever)
export interface ClipInfo { durationMs: number; loop: boolean; events: Clip["events"] }
/** `rot` holds one angle per bone of that rig, in the order of its `RigDef.bones`. `root.x` and
 *  `root.y` are an offset from the actor's place in units (y is negative above the floor);
 *  `root.sx` and `root.sy` are the squash. `lift` is how far the feet are above the floor, for
 *  the ground shadow. A pose is plain data: equal inputs give equal poses. */
export interface Pose { rig: RigId; rot: readonly number[] /* degrees, in bone order */;
  root: { x: number; y: number; sx: number; sy: number }; face: FaceId; lift: number /* units above the floor */ }

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
/** `held: null` and "fists" both draw an empty hand. `scale` is 1 for a normal scrapper.
 *  `tint: "white"` redraws every part in white (the hit flash). */
export interface Dress { look?: Look; held: HeldId | null; door: boolean; scale: number; tint?: "white" }
/** Where the feet stand, in stage units, and which way the actor faces (1 = right, -1 = left). */
export interface Place { x: number; y: number; facing: 1 | -1 }
export interface WeaponArt { shapes: readonly Omit<Shape, "bone">[]; grip: { x: number; y: number; rot: number }; length: number }
export interface IconArt { shapes: readonly { d: string; slot: ColourSlot | "self"; shade?: string }[] }  // 24-unit box
export type FxKind = "burst" | "dust" | "spark" | "whoosh" | "tarp" | "tape" | "crackers"
  | "rings" /* Whistle, Air Horn */ | "plus" /* heal */ | "trail" /* Haymaker swing */;
/** `progress` runs from 0 to 1 over the life of the effect. `seed` picks its cosmetic variation. */
export type FxDraw = (env: DrawEnv, progress: number, at: Place, seed: number) => void;
/** `crowdBounce` runs from 0 to 1 (0 = the crowd stands still). */
export type YardDraw = (env: DrawEnv, layer: "back" | "floor", crowdBounce: number) => void;
export interface Palette { top: string; bottom: string; shoes: string; accent: string }
export interface AppearanceSet {            // list lengths may be under LOOK_SPACE in the gate pack; an index wraps
  builds: readonly { scale: number; limb: number; torso: number }[];
  heads: readonly Shape[][]; hair: readonly Shape[][]; faces: readonly Record<FaceId, Shape[]>[];
  tops: readonly Shape[][]; bottoms: readonly Shape[][]; shoes: readonly Shape[][];
  accessories: readonly Shape[][]; hands: readonly Shape[];
  skin: readonly string[]; hairColor: readonly string[]; palettes: readonly Palette[] }

export interface GatePack {                 // the rig lane: packages/rig/src/gate/pack.ts
  scrapper: RigDef;
  clips: Record<GateClip, Clip>;
  weapons: Record<GateWeapon, WeaponArt>;
  looks: AppearanceSet;                     // 2 full looks, 3 builds
  yard: YardDraw;
  fx: Record<"burst" | "dust" | "spark" | "whoosh", FxDraw>;
  icons: Record<`stat:${StatKey}` | `ui:${GateUi}`, IconArt>;
}
export interface ContentPack {              // the content-art lane: packages/rig/src/content/pack.ts
  clips: Record<ContentClip, Clip>;
  weapons: Record<Exclude<HeldId, GateWeapon>, WeaponArt>;
  door: WeaponArt;
  looks: AppearanceSet;                     // full LOOK_SPACE counts; re-uses the gate parts as its first entries
  companions: Record<CompanionId, { rig: RigDef; shapes: readonly Shape[]; clips: Record<CompanionClip, Clip> }>;
  fx: Record<"tarp" | "tape" | "crackers" | "rings" | "plus" | "trail", FxDraw>;
  icons: Record<SkillId | `ui:${ContentUi}`, IconArt>;
}
export type IconRef = PerkId | "fists" | `stat:${StatKey}` | `ui:${GateUi | ContentUi}`;
export interface SvgPart { d: string; fill: string; stroke?: string; strokeWidth?: number; transform?: string }
export interface SvgArt { viewBox: string; parts: SvgPart[] }

/** Everything a consumer may call. The stage and the app get a Rig by injection. */
export interface Rig {
  /** Length, loop flag and events of a clip. An unknown clip name falls back to "idle" and warns once. */
  clipInfo(rig: RigId, clip: string): ClipInfo;
  /** The pose of a clip at a time. Pure. A loop clip wraps; any other clip holds its last pose. */
  samplePose(rig: RigId, clip: string, tMs: number): Pose;
  drawActor(env: DrawEnv, pose: Pose, dress: Dress, at: Place): void;
  /** The front hand of a scrapper pose in stage units, for a weapon in flight or a Snatch. */
  handAnchor(pose: Pose, at: Place): { x: number; y: number; rot: number };
  /** An item lying on the floor or flying. `rot` is in degrees. */
  drawProp(env: DrawEnv, item: PropId, at: Place & { rot: number }): void;
  drawYard: YardDraw;
  drawFx(env: DrawEnv, fx: FxKind, progress: number, at: Place, seed: number): void;
  portrait(look: Look): SvgArt;                                             // React cards and portraits
  companionPortrait(id: CompanionId): SvgArt;
  icon(ref: IconRef): SvgArt;                                               // missing art gives a plain ring
}
export type CreateRig = (gate: GatePack, content?: ContentPack) => Rig;     // the rig lane: engine/createRig.ts
