/**
 * The internal shape of a built bout: everything the timeline scheduled, as plain data with
 * times. `frame.ts` reads it at any `t` (a pure function) and `draw.ts` paints a frame.
 * Nothing in here is mutated after `buildTimeline` returns.
 */
import type { ActorId, BagItem, CompanionId, HeldId, Look, PerkId, PropId, ShieldId, Side } from "@rankzero/core";
import type { Aim, FxKind, MoveProp, RigId } from "@rankzero/rig";
import type { Cue, EffectKey, Timeline } from "./contracts";
import type { FlightPath } from "./flight";
import type { Reach } from "./layout";

/** A stretch of one clip on one actor. Clip time is `c0 + (t - from) x rate`. The segment that
 *  started last wins; when none covers `t` the actor idles. */
export interface Seg {
  from: number; to: number; clip: string; c0: number; rate: number;
  aim?: Aim; lead?: "F" | "B"; prop?: MoveProp;
  /** The contact this segment is the flinch of (an index into `Timeline.contacts`). */
  flinchOf?: number;
  /** The contact this segment strikes at, for the swing that makes it. */
  strikes?: number;
  /** Counted in `Timeline.busy`. Idle-like holds are not. */
  busy: boolean;
}

/** A walk, dash or jump of the actor's base place. `arc` lifts the middle of the path. */
export interface Move { from: number; to: number; x0: number; y0: number; x1: number; y1: number;
  arc: number; ease: "linear" | "out" | "inOut" }

/** An offset on top of the base place that goes out and comes back: knockback, a block slide,
 *  a recoil, an evade hop, a heal hop. `dx` is in the actor's own frame (+ = forward). */
export interface Nudge { actor: ActorId; key: "knockback" | "slide" | "recoil" | "hop" | "lift";
  from: number; outMs: number; holdMs: number; backMs: number; dx: number; arc: number; contact: number | null }

export interface FacingChange { from: number; facing: 1 | -1 }
export interface HeldChange { from: number; held: HeldId }
export interface ShieldChange { from: number; shield: ShieldId | null }

export interface ActorTrack {
  id: ActorId; side: Side; rig: RigId; kind: "scrapper" | CompanionId; maxHp: number;
  look?: Look; scale: number; home: { x: number; y: number }; homeFacing: 1 | -1;
  /** Idle loop phase, so no two actors breathe together. */
  phase: number;
  segs: Seg[]; moves: Move[]; facings: FacingChange[]; helds: HeldChange[]; shields: ShieldChange[];
  /** The shield a scrapper starts the bout with, or null. */
  initialShield: ShieldId | null;
  start: { x: number; y: number };
  /** Drawn from this time. */
  showFrom: number;
  /** Not drawn from this time (ran off stage). */
  goneAt: number;
  /** How far its idle pose is drawn from its place (facing the fight), at its scale and in its
   *  starting dress: what the home marks and the camera frame are made from. */
  reach: Reach;
  /** A pet's own attacks, from the start of its run in to the end of its swing: the only times it
   *  may be drawn in front of a fighter at the same depth. */
  attacks: { from: number; to: number }[];
}

/** A drawn effect from the rig's list. `follow` pins it to an actor's place. `loopMs` repeats
 *  its progress (the tarp wobbling over a snared actor). */
export interface FxItem { fx: FxKind; from: number; to: number; x: number; y: number; facing: 1 | -1; seed: number;
  contact: number | null; key?: EffectKey; follow?: ActorId; dy?: number; loopMs?: number;
  /** For an effect that flies (the tarp, the crackers): from this point to (x, y) over `flyMs`. */
  fly?: { x0: number; y0: number; ms: number; arc: number };
  /** The progress range drawn over the life of the effect (default 0 to 1): the lit crackers in the
   *  hand draw only the start of the crackers effect, their pops the rest. */
  p0?: number; p1?: number;
  /** For an effect carried in a hand: where it is at sampled times (it is drawn at the point
   *  interpolated between them). Read instead of x, y. */
  track?: readonly { t: number; x: number; y: number }[] }

/** A glow of one colour standing round an actor while its Move plays (Second Wind's breath). It
 *  never dims the arena: a Move simply happens (owner, 15 Nov 2026: "It should just show"). */
export interface Aura { from: number; to: number; actor: ActorId; colour: string }

export interface NumberItem { from: number; x: number; y: number; text: string; colour: string; scale: number;
  contact: number | null }

/** A sticker over an actor (BLOCK, MISS, CRIT, a skill name) or across the stage (FIGHT, the Move
 *  banner, OVERTIME, the winner's banner). */
export interface TagItem { from: number; to: number; text: string; colour: string; ink: string;
  actor: ActorId | null; x: number; y: number; size: number; kind: "tag" | "banner" | "sticker";
  /** A skill's icon drawn at the left of the words (a skill tag, a Move's result). */
  icon?: PerkId }

/** A thing in the air: thrown, knocked off, dropped, snatched. */
export interface FlightItem { item: PropId; from: number; to: number; path: FlightPath;
  /** What happens at the end: it lies on the floor, it fades away (back to the bag), it is held. */
  after: "floor" | "vanish" | "held" }

export interface FloorItem { item: PropId; x: number; y: number; rot: number; facing: 1 | -1;
  /** Lands at this time. */
  from: number;
  /** Starts to fade at this time, gone at `fadeTo` (the oldest, when a seventh lands). */
  fadeFrom: number; fadeTo: number }

export interface HpEvent { actor: ActorId; at: number; from: number; to: number; ms: number;
  kind: "loss" | "gain"; contact: number | null }

export interface BagEvent { at: number; side: Side; bag: BagItem[] }

export interface Shake { from: number; ms: number; amp: number; contact: number | null; seed: number }
export interface Flash { actor: ActorId; from: number; ms: number; contact: number | null }
export interface Crowd { from: number; ms: number; contact: number | null }

/** Everything a built bout holds. */
export interface Tracks {
  timeline: Timeline;
  actors: ActorTrack[];
  byId: Map<ActorId, ActorTrack>;
  nudges: Nudge[];
  fx: FxItem[];
  numbers: NumberItem[];
  tags: TagItem[];
  flights: FlightItem[];
  floor: FloorItem[];
  hp: HpEvent[];
  bags: BagEvent[];
  initialBag: Record<Side, BagItem[]>;
  shakes: Shake[];
  flashes: Flash[];
  crowds: Crowd[];
  auras: Aura[];
  /** Where and when the knockout falls, and which way the body falls (+1 toward +x): the camera's
   *  one reframe starts here (null: nobody falls). */
  koFocus: { at: number; x: number; y: number; back: 1 | -1 } | null;
  /** Ticket tape: from, to (null with reduced motion). */
  tape: { from: number; to: number } | null;
  /** Steps applied at a time: `stepEnd`, kept separately so `state` is a lookup. */
  applyAt: number[];
  outroAt: number;
  winner: Side;
  cues: Cue[];
}
