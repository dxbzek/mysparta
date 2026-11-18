/**
 * The state of one bout while the sim runs it (work package 1), and the helpers every part of a
 * turn shares: writing steps, picking a target, landing damage, and the steps a hit causes.
 */
import type { ActorId, BagItem, Proc, Side, Step } from "../contracts/log";
import type { ProcId, ShieldId } from "../contracts/ids";
import { PERK_IDS, isShieldId } from "../contracts/ids";
import { RARITY_OF } from "../contracts/content";
import type { Rarity } from "../contracts/content";
import { sk } from "../content/skills";
import { shieldNumbers } from "../content/shields";
import { hasTag } from "../content/weapons";
import type { Actor } from "./combatant";
import { CAP, valuesOf } from "./combatant";
import type { Streams } from "./rng";

export interface Bout {
  r: Streams;
  actors: Actor[];
  bag: Record<Side, BagItem[]>;
  steps: Step[];
  turn: number;
  ended: boolean;
  /** Once-a-bout tags already shown, as "actor|skill" (see `pickProc`). */
  shown: Set<string>;
  /** The screen clock (`screenNow`) of the last tag or Move (see `pickProc`); far in the past at the
   *  start. */
  lastTag: number;
  /** Tags of the RARE group that lost their step to another tag, as "actor|skill" (see `due`). */
  owed: Set<string>;
  /** The screen clock (`screenNow`): ms so far, and the turn of the last step. Created on first use. */
  screen?: { ms: number; turn: number };
  /** The screen clock at which each once-a-bout tag was first offered, as "actor|skill" (see
   *  `pickProc`). Created on first use. */
  waiting?: Map<string, number>;
}

/** About how long the stage plays a step, in ms (measured on stage for 160 pool bouts at levels 10
 *  and 30, medians), and the extra time a new turn adds. Only the spacing of tags uses it. */
const SCREEN_MS: Readonly<Partial<Record<Step["t"], number>>> = {
  attack: 580, riposte: 450, intercept: 500, throw: 380, draw: 200, swap: 450, move: 550, disarm: 250, ko: 400,
  heal: 400, free: 220, snare: 200, shieldOff: 400, enter: 0,
};
const COMBO_MS = 420;
const TURN_MS = 280;

/** The screen clock of the step about to be emitted (see SCREEN_MS). */
export function screenNow(b: Bout): number {
  return (b.screen ??= { ms: 0, turn: 0 }).ms + (b.turn !== b.screen.turn ? TURN_MS : 0);
}

export function emit(b: Bout, step: Step): void {
  const sc = (b.screen ??= { ms: 0, turn: 0 });
  if (step.turn !== sc.turn) { sc.ms += TURN_MS; sc.turn = step.turn; }
  sc.ms += step.t === "attack" && (step as { n?: number }).n !== 0 ? COMBO_MS : SCREEN_MS[step.t] ?? 250;
  b.steps.push(step);
}

export function bagCopy(bag: readonly BagItem[]): BagItem[] {
  return bag.map((it) => ({ ...it }));
}

export function enemiesUp(b: Bout, a: Actor): Actor[] {
  return b.actors.filter((x) => x.side !== a.side && x.status === "up");
}

export function scrapperOfSide(b: Bout, side: Side): Actor {
  return b.actors.find((x) => x.side === side && x.scrapper)!;
}

/** The enemy scrapper counts this many times in the target pick; each companion once. */
export const SCRAPPER_TARGET_WEIGHT = 2;

/** One random standing enemy, scrapper or companion, the scrapper weighted 2 to each companion's 1.
 *  One random number. */
export function pickEnemy(b: Bout, a: Actor): Actor | null {
  const list = enemiesUp(b, a);
  if (list.length === 0) return null;
  let r = b.r.target.int(list.length - 1 + SCRAPPER_TARGET_WEIGHT);
  for (const x of list) {
    const w = x.scrapper ? SCRAPPER_TARGET_WEIGHT : 1;
    if (r < w) return x;
    r -= w;
  }
  return list[list.length - 1]!;
}

const RANK: Readonly<Record<Rarity, number>> = { mythic: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
/** Which proc a step keeps when several skills mattered on it. 0: Last Stand (the log's HP reading
 *  depends on it). 1: rule skills, which made something happen that would not have happened at all.
 *  2: chance skills, whose bonus decided a roll. 3: number skills, which changed a number. */
const TIER: Readonly<Partial<Record<ProcId, number>>> = {
  "last-stand": 0,
  "firm-grip": 1, "parry": 1, "stubborn": 1, "trick-shot": 1, "junk-collector": 1, "head-start": 1,
  "anticipation": 2, "payback": 2, "flurry": 2, "slippery": 2, "knock-loose": 2, "sharp-eye": 2, "taunt": 2,
  "sand-in-the-eyes": 2, "bare-knuckle": 2, "sharpening-stone": 2, "heavy-lifter": 2,
  "padding": 3, "plate-vest": 3, "pitcher": 3, "pet-lover": 3, "quick-swap": 3,
  "light-feet": 3, "big-heart": 4, "heavy-hands": 4, "fast-twitch": 4, "glass-cannon": 4, "mountain": 4,
};
/** A shield's proc (a block made with it) is a rule proc. */
const tierOf = (id: ProcId): number => TIER[id] ?? 1;

/** At most one proc per step: the lowest tier, then the rarest skill, then the order of the perk list. */
export function sortProcs(list: Proc[]): Proc[] | undefined {
  if (list.length === 0) return undefined;
  const best = [...list].sort((x, y) => tierOf(x.skill) - tierOf(y.skill)
    || RANK[RARITY_OF[x.skill]] - RANK[RARITY_OF[y.skill]]
    || PERK_IDS.indexOf(x.skill) - PERK_IDS.indexOf(y.skill))[0]!;
  return [best];
}

/** Skills whose tag shows at most once per bout per owner (round-2 review: at level 30 they made a
 *  tag every 1.0 s and buried the Moves). Two groups (round 2, second pass).
 *  RARE: the chance passives, Head Start, Bare Knuckle, Light Feet, and the number skills of a
 *  weapon kind or a throw (Sharpening Stone, Heavy Lifter, Pitcher). Their moment comes seldom, so
 *  their tag never waits; one that loses its step to another tag is owed (`due`).
 *  OFTEN: Padding, Plate Vest, Pet Lover, Quick Swap, the other boosters and shields (by the shield
 *  id, see `onceOnly`). Their moment comes again on most hits, so their tag waits (TAG_GAP_MS). */
const RARE: ReadonlySet<string> = new Set<string>(["anticipation", "payback", "flurry", "slippery", "knock-loose",
  "sharp-eye", "head-start", "bare-knuckle", "light-feet", "sharpening-stone", "heavy-lifter", "pitcher", "quick-swap"]);
const OFTEN: ReadonlySet<string> = new Set<string>(["padding", "plate-vest",
  "pet-lover", "big-heart", "heavy-hands", "fast-twitch", "glass-cannon", "mountain"]);
/** Whether a proc's tag shows only once per bout per owner. */
export function onceOnly(id: ProcId): boolean {
  return RARE.has(id) || OFTEN.has(id) || isShieldId(id);
}
/** Rule skills (and the Moves' own effect tags): each tag marks something that would not have
 *  happened at all, so every one can show. The first of a bout never waits; a repeat waits. Last
 *  Stand never waits (the log's HP reading depends on it). */
const RULE: ReadonlySet<string> = new Set<string>(["parry", "stubborn", "firm-grip", "trick-shot", "junk-collector",
  "taunt", "sand-in-the-eyes"]);
const RULE_FIRST: ReadonlySet<string> = new Set<string>(["stubborn", "trick-shot", "junk-collector", "firm-grip", "parry", "taunt", "sand-in-the-eyes"]);

/** A tag that waits needs this much screen time (`screenNow`) since the last tag or Move. With
 *  2 turns (the first version), at level 30 nearly every turn was inside the wait and Flurry,
 *  Payback and Knock Loose showed in 6 to 8% of their owner's bouts; with no wait for the rare tags
 *  (the first refix) the median gap between skill moments fell to 1.37 s. Measured on stage over
 *  300 level-30 pool bouts: median gap 1.52 s between skill moments (tags and Moves), 1.89 s
 *  between tags. */
export const TAG_GAP_MS = 1600;

const key = (p: Proc): string => `${p.by}|${p.skill}`;

/** Whether a RARE skill writes its tag on this step: its bonus decided the roll (`decided`), or it
 *  decided an earlier roll of the same kind and that step went to another tag (owed). A site calls
 *  this on the step kind the skill belongs to (a combo swing for Flurry, a riposte for Payback),
 *  so an owed tag still names what the skill does. */
export function due(b: Bout, who: Actor, id: ProcId, decided: boolean): boolean {
  return decided || b.owed.has(`${who.id}|${id}`);
}

/** Whether a proc may show while the last tag or Move is under TAG_GAP_MS old. */
function passesWait(b: Bout, p: Proc): boolean {
  if (p.skill === "last-stand" || RARE.has(p.skill)) return true;
  if (RULE_FIRST.has(p.skill)) return !b.shown.has(key(p));
  if (RULE.has(p.skill)) return !b.shown.has(key(p)) && b.owed.has(key(p));
  return false;
}

/** The order of the tiers in `pickProc`: Last Stand, rule skills, then chance and number skills
 *  together, then the boosters and Quick Swap. */
const group = (p: Proc): number => { const t = tierOf(p.skill); return t <= 1 ? t : t === 4 ? 3 : 2; };

/** The proc a step keeps, after dropping the once-a-bout tags their owner has already shown in this
 *  bout and, while the last tag or Move is under TAG_GAP_MS old, the tags that wait (`passesWait`).
 *  Of those left: the first group (`group`), then the tag first offered longest ago in this bout (so
 *  a skill offered from the first hit cannot keep a later one out every time), then `sortProcs`.
 *  The kept one is booked as shown; a RARE one left out is owed and shows on the next step of its
 *  kind. */
export function pickProc(b: Bout, list: Proc[]): Proc[] | undefined {
  const now = screenNow(b);
  const fresh = list.filter((p) => !(onceOnly(p.skill) && b.shown.has(key(p))));
  const waiting = (b.waiting ??= new Map());
  for (const p of fresh) if (onceOnly(p.skill) && !waiting.has(key(p))) waiting.set(key(p), now);
  const open = now - b.lastTag < TAG_GAP_MS ? fresh.filter((p) => passesWait(b, p)) : fresh;
  let best: Proc[] | undefined;
  if (open.length > 0) {
    const g = Math.min(...open.map(group));
    const inGroup = open.filter((p) => group(p) === g);
    const since = (p: Proc): number => waiting.get(key(p)) ?? now;
    const first = Math.min(...inGroup.map(since));
    best = sortProcs(inGroup.filter((p) => since(p) === first));
  }
  if (best !== undefined) {
    b.shown.add(key(best[0]!));
    b.owed.delete(key(best[0]!));
    b.lastTag = now;
  }
  for (const p of fresh) {
    if (best !== undefined && key(p) === key(best[0]!)) continue;
    if (RARE.has(p.skill) || (RULE.has(p.skill) && !b.shown.has(key(p)))) b.owed.add(key(p));
  }
  return best;
}

export function proc(by: Actor, skill: ProcId): Proc {
  return { by: by.id as ActorId, skill };
}

/** Head Start: a proc on the first step of its owner's first turn that can carry one. */
export function headStart(b: Bout, owner: Actor, procs: Proc[]): void {
  if (due(b, owner, "head-start", owner.headStartPending)) {
    owner.headStartPending = false;
    procs.push(proc(owner, "head-start"));
  }
}

/** Boosters change stats for good and had no fight moment (round-2 review: Light Feet was the
 *  strongest Common perk and never showed). Each now names itself once a bout, on the first step
 *  its stat is felt: Heavy Hands and Glass Cannon on their owner's first hit, Big Heart and Mountain
 *  on the first hit their owner takes, Light Feet on its owner's first evade. Fast Twitch shows on
 *  its owner's first action (`firstAction`). */
export function boosterProcs(b: Bout, att: Actor, def: Actor, outcome: "hit" | "evade", procs: Proc[]): void {
  const add = (who: Actor, id: ProcId): void => {
    if (who.scrapper && who.skills.has(id) && !b.shown.has(`${who.id}|${id}`)) procs.push(proc(who, id));
  };
  if (outcome === "evade") { add(def, "light-feet"); return; }
  add(att, "heavy-hands");
  add(att, "glass-cannon");
  add(def, "big-heart");
  add(def, "mountain");
  // Glass Cannon's lost Health is felt on the first hit its owner takes as well.
  add(def, "glass-cannon");
}

/** The first step of a turn that can carry procs: Head Start (its owner's first action of the
 *  bout), Quick Swap (the draw it made this turn), Heavy Lifter (a turn made with a Heavy weapon,
 *  which costs 30% less time). */
export function firstAction(b: Bout, a: Actor, procs: Proc[]): void {
  headStart(b, a, procs);
  // Fast Twitch: offered on every first action until its tag has shown once (pickProc).
  if (a.scrapper && a.skills.has("fast-twitch")) procs.push(proc(a, "fast-twitch"));
  if (a.quickSwapPending && a.quickSwapTag) procs.push(proc(a, "quick-swap"));
  if (a.firmGripKept && !b.shown.has(`${a.id}|firm-grip`)) procs.push(proc(a, "firm-grip"));
  if (a.scrapper && a.held !== "fists" && hasTag(a.held, "heavy") && a.skills.has("heavy-lifter")) {
    procs.push(proc(a, "heavy-lifter"));
  }
}

/** The opening: in turns 1 to OPENING_TURNS one turn takes at most OPENING_PCT of a scrapper's max
 *  HP (OPENING_PET_PCT of a companion's), so no bout can end before turn OPENING_TURNS + 1 and a
 *  companion survives the first turn it is hit in. A crit or a Haymaker swing ("big") may take up to
 *  OPENING_BIG_PCT in its turn instead, so a CRIT reads as a crit (round-2 review: a level-1 crit of
 *  20 was cut to 7, a plain hit's size), but the opening never takes a scrapper below
 *  OPENING_FLOOR_PCT of its max HP, so the bout still cannot end in it. Moves are not ready in the
 *  opening (moves.ts), so Move hits are never cut. */
export const OPENING_TURNS = 5;
export const OPENING_PCT = 10;
export const OPENING_BIG_PCT = 25;
export const OPENING_FLOOR_PCT = 40;
export const OPENING_PET_PCT = 50;

/** What an actor can still lose in this turn of the opening (Infinity after the opening). `big`:
 *  the hit is a crit or a Haymaker swing. */
export function allowance(b: Bout, def: Actor, big = false): number {
  if (b.turn > OPENING_TURNS) return Infinity;
  const pct = def.scrapper ? (big ? OPENING_BIG_PCT : OPENING_PCT) : OPENING_PET_PCT;
  const most = Math.max(1, Math.floor((def.maxHp * pct) / 100));
  const left = most - (def.lossTurn === b.turn ? def.loss : 0);
  if (!def.scrapper) return left;
  const floor = Math.ceil((def.maxHp * OPENING_FLOOR_PCT) / 100);
  return Math.min(left, def.hp - floor);
}

/** True when an actor has nothing left to lose in this turn of the opening: the swings stop. */
export function spent(b: Bout, def: Actor): boolean {
  return allowance(b, def) <= 0;
}

/** What a hit of `damage` would deal after the opening cut, without booking it. */
export function openingCut(b: Bout, def: Actor, damage: number, big = false): number {
  const left = allowance(b, def, big);
  return left === Infinity ? damage : Math.max(1, damage > left ? left : damage);
}

/** Cuts a hit to the opening allowance and books it. Never below 1 (a spent target is never swung at). */
export function opening(b: Bout, def: Actor, damage: number, big = false): number {
  const left = allowance(b, def, big);
  if (left === Infinity) return damage;
  const d = Math.max(1, damage > left ? left : damage);
  if (def.lossTurn !== b.turn) { def.lossTurn = b.turn; def.loss = 0; }
  def.loss += d;
  return d;
}

/** Takes `damage` from `def`. Last Stand leaves 1 HP once a bout. Returns hpAfter. */
export function land(def: Actor, damage: number, procs: Proc[]): number {
  const left = def.hp - damage;
  if (left > 0) { def.hp = left; return left; }
  if (def.scrapper && def.skills.has("last-stand") && !def.lastStandUsed && sk("last-stand", "saves") > 0) {
    def.lastStandUsed = true;
    def.hp = 1;
    procs.push(proc(def, "last-stand"));
    return 1;
  }
  def.hp = 0;
  return 0;
}

/** Armor takes its share: damage - floor(damage x Armor / 100), never below 1. */
export function armored(damage: number, armor: number): number {
  const a = armor < 0 ? 0 : armor > CAP.armor ? CAP.armor : armor;
  const d = damage - Math.floor((damage * a) / 100);
  return d < 1 ? 1 : d;
}

/** A knockout. A scrapper's knockout ends the bout in the same turn. */
export function knockOut(b: Bout, who: Actor, by: Actor | null): void {
  who.status = "ko";
  emit(b, { t: "ko", turn: b.turn, actor: who.id, by: by === null ? null : by.id });
  if (who.scrapper) {
    emit(b, { t: "end", turn: b.turn, winner: who.side === "a" ? "b" : "a", reason: "ko" });
    b.ended = true;
  }
}

/** A hit's disarm chance against a scrapper with no weapon left in its bag is this percent of the
 *  usual one (round 2, second pass). A disarm of the only weapon leaves fists for the rest of the
 *  bout, so at level 1 the disarm weapons decided the bout by the name: Monkey Wrench won 67.8% as a
 *  starting weapon and Screwdrivers 62.7%, while both sat at the 47% floor of the gate at level 30. */
export const LAST_WEAPON_DISARM_PCT = 40;

/**
 * The disarm roll on a landed hit or a slam. Firm Grip resists 60% of the time and writes the
 * disarm with `resisted`. Knock Loose writes a proc when the roll passed only because of it.
 * `forced` is a Body Slam: it always knocks the weapon off unless Firm Grip holds on.
 */
export function tryDisarm(b: Bout, att: Actor, def: Actor, cause: "hit" | "slam"): void {
  if (def.held === "fists" || !def.scrapper) return;
  const procs: Proc[] = [];
  if (cause === "hit") {
    // The last weapon is held harder: with no weapon left in the bag the chance is cut.
    const last = !b.bag[def.side].some((it) => it.k === "weapon");
    const cut = (c: number): number => (last ? Math.floor((c * LAST_WEAPON_DISARM_PCT) / 100) : c);
    // Toughness: the defender's grip takes points off the chance (content v3).
    const grip = valuesOf(def).grip;
    const chance = cut(Math.min(valuesOf(att).disarm, CAP.disarm)) - grip;
    const r = b.r.disarm.int(100);
    if (!(r < chance)) return;
    if (att.skills.has("knock-loose")) {
      const without = cut(Math.min(valuesOf(att).disarm - sk("knock-loose", "disarm"), CAP.disarm)) - grip;
      if (due(b, att, "knock-loose", r >= (without < 0 ? 0 : without))) procs.push(proc(att, "knock-loose"));
    }
  }
  const weapon = def.held as Exclude<typeof def.held, "fists">;
  if (def.skills.has("firm-grip") && b.r.disarm.int(100) < sk("firm-grip", "resist")) {
    procs.push(proc(def, "firm-grip"));
    emit(b, { t: "disarm", turn: b.turn, actor: att.id, target: def.id, weapon, cause, resisted: true,
      procs: pickProc(b, procs) } as Step);
    return;
  }
  def.held = "fists";
  def.heldAttacked = false;
  const step: Step = { t: "disarm", turn: b.turn, actor: att.id, target: def.id, weapon, cause };
  const sorted = pickProc(b, procs);
  if (sorted !== undefined) (step as { procs?: Proc[] }).procs = sorted;
  emit(b, step);
}

/** The chance a swing that was not evaded knocks this shield off: its `knock` percent of the
 *  attacker's capped Disarm, rounded down, minus the defender's grip (Toughness, content v3). */
export function knockChance(att: Actor, shield: ShieldId, def?: Actor): number {
  const c = Math.floor((Math.min(valuesOf(att).disarm, CAP.disarm) * shieldNumbers(shield).knock) / 100)
    - (def === undefined ? 0 : valuesOf(def).grip);
  return c < 0 ? 0 : c;
}

/** The shield roll on a swing that was not evaded. A slam always knocks it off. */
export function tryShield(b: Bout, att: Actor, def: Actor, cause: "hit" | "slam"): void {
  const shield = def.shield;
  if (shield === null) return;
  if (cause === "hit" && !(b.r.disarm.int(100) < knockChance(att, shield, def))) return;
  def.shield = null;
  emit(b, { t: "shieldOff", turn: b.turn, actor: att.id, target: def.id, shield, cause });
}

/** A hit frees a snared target. */
export function tryFree(b: Bout, def: Actor): void {
  if (!def.snared) return;
  def.snared = false;
  def.snareSkips = 0;
  emit(b, { t: "free", turn: b.turn, actor: def.id, cause: "hit" });
}
