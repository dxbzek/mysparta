/**
 * FROZEN CONTRACT (work package 0). The bout log: what the sim writes and what the stage,
 * the HUD, the text log and the reducer read.
 *
 * LOG RULES (frozen with the types). `checkLog` in check.ts enforces what a log alone can
 * prove. What needs the rules or the snapshots is the sim lane's to test: rule 9, the `boosted`
 * swing of rule 7, the perks order of rule 15, and every chance and condition.
 *  1. Steps are semantic events, never animation orders. String literals only. A new step type
 *     needs a LOG_VERSION bump.
 *  2. Every step carries the values after it (HP after, bag after). Sim time never enters the log.
 *  3. Turn 0 is the intro. Every actor of `init.actors` has exactly one `enter` step, at turn 0,
 *     and no other step is at turn 0. Steps with the same turn number play as one group, in
 *     array order. Turn numbers never go down.
 *  4. Exactly one `end`, and it is last. Its turn is the turn counter when the bout stopped, and
 *     `result.turns` equals it. For a knockout that is the turn of the `ko` step before it. For a
 *     cap it is the last turn taken, which may be a skipped turn with no step of its own.
 *  5. The kill step is the first step that leaves a scrapper at 0 HP (`attack`, `intercept`,
 *     `riposte`, `throw`, a `move` hit or `overtime`). Every actor that reaches 0 HP gets a `ko`
 *     step before any other action (rule 16 gives its place). `ko.by` is the actor of the step
 *     that took the last HP, and null when overtime took it. A status only changes on `ko` and
 *     `flee`.
 *  6. `damage` is the damage dealt after armor. On a "hit" it is 1 or more and
 *     hpAfter = max(0, hp - damage), or 1 when Last Stand saves. On "evade" and "block" it is 0.
 *     The same holds for a `move` hit and for `overtime`. A heal's `amount` is the HP really
 *     gained: hpAfter = hp + amount, never above the max.
 *  7. How each Move is written. A Move is a turn of its own. Haymaker: `move`; then the owner's
 *     next melee `attack`, on a later turn, carries `boosted` (a throw in between does not).
 *     Energy Drink: `move`, then `heal`. Tarp: `move` with `target`, then `snare`.
 *     Whistle: `move`, then `heal` on the companion. Firecrackers: `move` with `hits`.
 *     Snatch: `move` with `target` and `taken`. Air Horn: `move`, then one `flee` per companion
 *     that runs. Body Slam: `move` with `target` and one entry in `hits`; then a `disarm` only
 *     when the target holds a weapon, and a `doorOff` only when it carries a door, each with
 *     `cause: "slam"`. A companion target has neither.
 *  8. `procs` is used for: Last Stand (on the swing it saves), Parry (on the riposte it forces),
 *     Stubborn (on the extra swing), Firm Grip (on the `disarm` it resists, which carries
 *     `resisted`, and on the `move` of a Snatch it stops, which then has no `taken`), Car Door
 *     (on a block made with the door).
 *  9. Decisive procs. A passive that only adds to a chance writes a proc on the step where
 *     the roll passed ONLY because of its bonus: Anticipation (on `intercept`), Payback (on
 *     `riposte`), Flurry (on the combo `attack`), Slippery (on an "evade" outcome), Knock Loose
 *     (on `disarm`), Sharp Eye (on a "hit" that would have been evaded or blocked without it).
 *     Head Start writes a proc on its owner's first action: the first step of its first turn
 *     that can carry procs (the `move`, the first `attack` or `throw`, or the `intercept` that
 *     stops that turn). `draw` and `swap` carry none. The sim lists the rarest skill first; the
 *     stage shows at most one tag per step.
 * 10. Reading an `intercept`: its `target` is the actor whose turn it is and who was dashing in;
 *     its `actor` is the defender who hit first. That target makes no `attack` and no `throw` in
 *     that turn.
 * 11. Skipped snared turns. The first and the second skipped turn of a snare write no step of
 *     their own, so turn numbers may jump. The third skipped turn ends the snare: it writes
 *     `free` with `cause: "timeout"` as the first step of that turn, and nothing else of its own.
 *     In overtime a skipped turn of a scrapper is still one of its turns: it writes that
 *     scrapper's `overtime` step (after the `free`, on the third).
 * 12. A cap ending (`reason: "cap"`) has no `ko` step. The stage plays the loser's fall from
 *     the `end` step.
 * 13. Overtime. An `overtime` step is the loss a scrapper takes after one of its own turns. It is
 *     the last step of that turn; only its own `ko` and the `end` may follow in the same turn.
 *     The first `overtime` step of a bout is where the stage shows the "OVERTIME" sticker.
 * 14. What lands on the floor: the old weapon of a `swap`, the weapon of a `disarm` that is not
 *     resisted, the door of a `doorOff`, and the weapon of a `throw` with `after: "gone"`.
 *     A Snatch moves the weapon from hand to hand and nothing lands.
 * 15. Actor ids. a0 and b0 are the scrappers. The companions of a side take 1, 2, 3 in the
 *     order they stand in the owner's `perks`, with no gap.
 * 16. What follows a hit. The steps one swing, one Move or one overtime loss causes come straight
 *     after it, in this order, each only when it happens: `disarm`, `doorOff`, `free` (cause
 *     "hit"), `ko`. With several targets (Firecrackers) every `free` comes before every `ko`.
 *     `disarm` and `doorOff` name the actor and the target of the step that caused them; their
 *     cause is "slam" after a Body Slam and "hit" after a swing. A snared actor that takes a hit
 *     always gets its `free`, also when the hit knocks it out. Overtime is not a hit: it frees
 *     nobody. A `doorOff` may follow a blocked swing; a `disarm` follows a landed hit only.
 * 17. Swings in a turn. `n` counts an actor's `attack` and `throw` steps inside one turn from 0.
 *     Swing 0 has no `why`; every later one has. Stubborn gives at most one extra swing a turn,
 *     straight after a swing of the same actor that was evaded or blocked, and never applies to
 *     a throw. `intercept` and `riposte` carry no `n`: each is a single swing.
 */
import type { CompanionId, HeldId, MoveId, PropId, SkillId, WeaponId } from "./ids";

export type Side = "a" | "b";                             // a = challenger, left. b = challenged, right.
export type ActorId = `${Side}${0 | 1 | 2 | 3}`;          // a0 = the scrapper, a1..a3 = its companions
export type BagItem = { k: "weapon"; id: WeaponId } | { k: "move"; id: MoveId; uses: number };
export interface ActorInit { id: ActorId; kind: "scrapper" | CompanionId; maxHp: number }
export interface BoutInit { actors: ActorInit[]; bag: Record<Side, BagItem[]>; door: Record<Side, boolean> }

/** turn 0 = the intro. Steps with the same turn number play as one group, in array order. */
type S<T extends string, P> = { t: T; turn: number } & P;
/** A skill that fired a visible rule on this step. The stage shows its name as a tag. */
export interface Proc { by: ActorId; skill: SkillId }
/** The fields every swing carries. */
export interface Swing { actor: ActorId; target: ActorId; weapon: HeldId | null /* null = a companion */;
  outcome: "hit" | "evade" | "block"; damage: number; crit: boolean; hpAfter: number; procs?: Proc[] }

export type Step =
  | S<"enter",     { actor: ActorId }>
  | S<"draw",      { actor: ActorId; weapon: WeaponId; bagAfter: BagItem[] }>
  | S<"swap",      { actor: ActorId; dropped: WeaponId; weapon: WeaponId; bagAfter: BagItem[] }>
  | S<"move",      { actor: ActorId; move: MoveId; bagAfter: BagItem[]; target?: ActorId;
                     taken?: WeaponId; hits?: { target: ActorId; damage: number; hpAfter: number }[];
                     procs?: Proc[] }>
  | S<"attack",    Swing & { n: number /* 0 = first swing, carries the dash */;
                     why?: "combo" | "stubborn"; boosted?: true /* Haymaker */ }>
  | S<"intercept", Swing>                                 // actor = the defender who hits first
  | S<"riposte",   Swing>                                 // actor = the defender who hits back
  | S<"throw",     Swing & { n: number; why?: "combo"; after: "held" | "bag" | "gone"; bagAfter: BagItem[] }>
  | S<"disarm",    { actor: ActorId; target: ActorId; weapon: WeaponId; cause: "hit" | "slam";
                     resisted?: true /* Firm Grip: the weapon stays in the hand */;
                     procs?: Proc[] /* Knock Loose by the actor, Firm Grip by the target */ }>
  | S<"doorOff",   { actor: ActorId; target: ActorId; cause: "hit" | "slam" }>
  | S<"heal",      { actor: ActorId; target: ActorId; amount: number; hpAfter: number }>
  | S<"snare",     { actor: ActorId; target: ActorId }>
  | S<"free",      { actor: ActorId; cause: "hit" | "timeout" }>   // actor = the one set free
  | S<"flee",      { actor: ActorId }>                             // actor = the companion that runs
  | S<"ko",        { actor: ActorId; by: ActorId | null }>         // actor = the one that falls
  | S<"overtime",  { actor: ActorId; damage: number; hpAfter: number }>
  | S<"end",       { winner: Side; reason: "ko" | "cap" }>;

export type StepType = Step["t"];
/** The step with the given `t`, for handlers: `(step: StepOf<"attack">) => ...`. */
export type StepOf<T extends StepType> = Extract<Step, { t: T }>;
/** All 17 step types, in the order of the union. The line under it fails to compile when one is missing. */
export const STEP_TYPES = ["enter","draw","swap","move","attack","intercept","riposte","throw",
  "disarm","doorOff","heal","snare","free","flee","ko","overtime","end"] as const satisfies readonly StepType[];
const STEP_TYPES_COMPLETE: Exclude<StepType, (typeof STEP_TYPES)[number]> extends never ? true : false = true;
void STEP_TYPES_COMPLETE;

/** `turns` is the turn number of the `end` step. `hpPct` is each scrapper's HP as a whole percent
 *  of its max, rounded up, so it is 0 only at 0 HP. `resultOf` in reduce.ts is the one definition. */
export interface BoutResult { winner: Side; reason: "ko" | "cap"; turns: number; hpPct: Record<Side, number> }
export interface BoutLog { logVersion: 1; rulesVersion: 1; seed: number; init: BoutInit;
  steps: Step[]; result: BoutResult }

/** `held` is "fists" for an empty hand and always "fists" for a companion. `door` is always false
 *  for a companion. */
export interface ActorState { id: ActorId; kind: "scrapper" | CompanionId; hp: number; maxHp: number;
  status: "up" | "ko" | "fled"; held: HeldId; snared: boolean; door: boolean }
/** `floor` keeps every dropped item in landing order; the stage shows the newest six. `from` is the
 *  actor that held the item, and `i` is the index of the step that put it there. */
export interface BoutState { i: number /* steps applied */; turn: number;
  actors: Partial<Record<ActorId, ActorState>>; bag: Record<Side, BagItem[]>;
  floor: { item: PropId; from: ActorId; i: number }[];
  ended: { winner: Side; reason: "ko" | "cap" } | null }

/** The side an actor fights on. */
export function sideOf(id: ActorId): Side { return id.charAt(0) === "a" ? "a" : "b"; }
/** The scrapper of a side. */
export function scrapperOf(side: Side): ActorId { return side === "a" ? "a0" : "b0"; }
/** True for a0 and b0. */
export function isScrapper(id: ActorId): boolean { return id === "a0" || id === "b0"; }
