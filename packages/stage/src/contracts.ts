/**
 * FROZEN CONTRACT (work package 0). The fight player with no browser in it.
 *
 * THE RULE OF THIS CONTRACT: the timeline is built once from the log, and every frame is a
 * pure function of `t`. `t` is presentation time at 1x, in ms, with hit-stop and slow motion
 * already inside it. 2x means the fight clock adds 2 x dt. Nothing keeps state between frames.
 * Pause, speed, skip, seek, the debug route, Node video and browser recording are then the same
 * call with a different `t`.
 *
 * Sound is the only side effect, and the host makes it: it plays every cue whose `at` the
 * fight clock crossed this frame, and a seek plays none.
 *
 * Numbers: clip lengths and strike times are read from `rig.clipInfo()` only, the strike with
 * `strikeTime` (so a clip with a `release` and no `contact`, and a fallback clip with a `contact`
 * and no `release`, both work). An extra combo swing is the clip run through `comboClipTime`.
 * Every other number of the timing table lives in this package's tuning file and nowhere else.
 * What the stage may know about a weapon is `WEAPON_META` and `impactFamily` from the core.
 * Where an attacker stops comes from `rig.strikePoint` and `rig.hitPoint`, never from a constant.
 * The stage never applies a clip fallback: the rig does (see the rig contract).
 */
import type { ActorId, BagItem, BoutLog, BoutState, FighterSnapshot, MoveId, Side, SkillId, StageId } from "@rankzero/core";
import type { DrawEnv, Rig } from "@rankzero/rig";

export type SfxFamily = "fist" | "blunt" | "blade" | "block" | "whoosh" | "dash" | "landing" | "throw"
  | "drop" | "crowd" | "companion" | "move" | "win" | "loss";
/** How many variations each family has in the sound sprite. The stage picks `Cue.variant` below
 *  this number, and the fight-screen lane builds the sprite with exactly this many, in this
 *  order. The one table both read. */
export const SFX_VARIANTS: Readonly<Record<SfxFamily, number>> = {
  fist: 3, blunt: 4, blade: 4, block: 3, whoosh: 3, dash: 2, landing: 2, throw: 1,
  drop: 2, crowd: 2, companion: 3, move: 4, win: 1, loss: 1,
};
/** Every word the stage paints. The stage holds no player text of its own. */
export interface StageText { fight: string; wins(name: string): string; block: string; miss: string;
  crit: string; overtime: string; moveName(id: MoveId): string; skillName(id: SkillId): string }
/** `cosmeticSeed` picks flinch, particle and sound variations. It never changes a time.
 *  `stage` is the arena to draw. The host passes `stageFor(log.seed)`, so a replay of the same
 *  bout shows the same place; the player itself never derives it. */
export interface PlayerOpts { reducedMotion: boolean; cosmeticSeed: number; stage: StageId; text: StageText;
  fonts: { display: string; body: string } }
/** The nine things that start at the moment of contact. */
export type EffectKey = "flash" | "flinch" | "knockback" | "burst" | "number" | "hp" | "shake" | "crowd" | "sound";
/** One moment of contact. `step` is a step index, `at` is its time. `starts` is when each effect
 *  begins: equal to `at`, or `null` when that effect does not play for this contact (an evade
 *  has no flash; reduced motion has no shake). The stage's own test does not trust this field:
 *  it measures every start from sampled frames and compares it with `at`. */
export interface ContactMark { step: number; at: number; starts: Record<EffectKey, number | null> }
/** One sound. `variant` is the index inside the family, 0 to `SFX_VARIANTS[family] - 1`, already
 *  picked from the cosmetic seed. */
export interface Cue { at: number; step: number; family: SfxFamily; variant: number }
/** `stepAt[i]` and `stepEnd[i]` are the start and end time of step i. `busy` lists the spans in
 *  which an actor is doing more than idling, sorted by start. `killStep` is a step index, or -1.
 *  `firstActionAt` is the start of the first step after the intro. `resultAt` is when the result
 *  card may slide up. */
export interface Timeline { durationMs: number; stepAt: number[]; stepEnd: number[];
  contacts: ContactMark[]; busy: (readonly [from: number, to: number])[]; cues: Cue[];
  killStep: number; firstActionAt: number; resultAt: number }
/** What the DOM around the canvas shows at one time. */
export interface HudFrame { hp: Partial<Record<ActorId, { now: number; trail: number; max: number }>>;
  bag: Record<Side, BagItem[]>; stepsShown: number /* the text log shows steps below this index */;
  phase: "intro" | "bout" | "outro" | "result"; winner: Side | null;
  /** 0 to 1. The DOM name stickers "slap on" at 700 to 900 ms of the intro. The HUD may
   *  not use a CSS animation or its own timer, so the fight clock has to hand it this value. */
  namesIn: number;
  /** Fill of the result card's XP bar, 0 to 1, for the same reason. */
  resultIn: number }
export interface FightPlayer { readonly timeline: Timeline;
  state(tMs: number): BoutState; hud(tMs: number): HudFrame;
  draw(env: DrawEnv, tMs: number, view: { w: number; h: number; dpr: number }): void }
export type CreateFightPlayer = (log: BoutLog, a: FighterSnapshot, b: FighterSnapshot, rig: Rig,
  opts: PlayerOpts) => FightPlayer;
/** The one fight clock. `tick` adds `speed x realDtMs` unless paused and returns the new `t`.
 *  `seek` jumps without sound. `t` is held inside 0 to the bout's length. */
export interface FightClock { readonly t: number; speed: 1 | 2; paused: boolean;
  tick(realDtMs: number): number; seek(tMs: number): void }
/** Makes the clock for one bout: it starts at t = 0, at speed 1, not paused. The fight screen
 *  gets its clock from here and never writes a second one. */
export type CreateFightClock = (durationMs: number) => FightClock;
