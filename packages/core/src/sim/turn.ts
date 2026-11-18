/**
 * One turn on the timeline (work package 1). A scrapper's turn, in order: statuses, the Move roll,
 * the draw or swap, throw or melee, the target, the swing, the time cost. Then overtime.
 */
import type { HeldId, WeaponId } from "../contracts/ids";
import { sk } from "../content/skills";
import { hasTag, weaponNumbers } from "../content/weapons";
import type { Actor } from "./combatant";
import { gearOf, tv } from "./combatant";
import type { Bout } from "./bout";
import { bagCopy, emit, knockOut, pickEnemy } from "./bout";
import { turnCost } from "./clock";
import { companionTurn } from "./companions";
import { meleeAttack } from "./melee";
import { playMove, rollMove } from "./moves";
import { throwAttack, throwChance } from "./thrown";

export const SWAP_PCT = 30;
export const DRAW_SLACK = 6;
export const OVERTIME_FROM = 50;
export const OVERTIME_PCT = 8;

/** Swap chance while holding a weapon that has attacked: 30%, Quick Swap 50%, Firm Grip 15%
 *  (Quick Swap counts when both are owned). */
export function swapChance(a: Actor): number {
  // Quick Hands (talent) adds its points to any of them.
  const more = tv(a.tal, "quick-hands", "swap");
  if (a.skills.has("firm-grip")) return sk("firm-grip", "swapChance") + more;
  return (a.skills.has("quick-swap") ? sk("quick-swap", "swapChance") : SWAP_PCT) + more;
}

/** The slack of the empty-hand draw: 6, Quick Swap 2, Bare Knuckle 12 (Quick Swap counts when both
 *  are owned). */
export function drawSlack(a: Actor): number {
  if (a.skills.has("quick-swap")) return sk("quick-swap", "drawSlack");
  // Cargo Pants (gear): the next weapon is close to hand.
  // Quick Hands (talent) takes its points off the same slack.
  return a.skills.has("bare-knuckle") ? sk("bare-knuckle", "drawSlack")
    : Math.max(1, DRAW_SLACK - gearOf(a, "drawEase") - tv(a.tal, "quick-hands", "drawEase"));
}

/** Picks a weapon out of the bag by Draw weight with chance S / (S + slack). One random number. */
function drawRoll(b: Bout, a: Actor, always: boolean): WeaponId | null {
  const bag = b.bag[a.side];
  let S = 0;
  for (const it of bag) if (it.k === "weapon") S += weaponNumbers(it.id).draw;
  if (S <= 0) return null;
  let r = b.r.draw.int(always ? S : S + drawSlack(a));
  if (r >= S) return null;
  for (const it of bag) {
    if (it.k !== "weapon") continue;
    const w = weaponNumbers(it.id).draw;
    if (r < w) return it.id;
    r -= w;
  }
  return null;
}

function takeFromBag(b: Bout, a: Actor, id: WeaponId): void {
  const bag = b.bag[a.side];
  const at = bag.findIndex((it) => it.k === "weapon" && it.id === id);
  if (at >= 0) bag.splice(at, 1);
}

/** Step 3: draw with empty hands (for sure right after a throw), or swap a weapon that has
 *  already attacked. Quick Swap marks every draw and swap of its owner: that turn costs less time
 *  (`quickTurn`) and its first swing or throw can carry the tag. */
function drawOrSwap(b: Bout, a: Actor): void {
  const reload = a.reload || a.startDraw;
  a.reload = false;
  a.startDraw = false;
  // Bare Knuckle opens with fists: its owner's first turn that is not a Move draws nothing.
  if (a.fistsFirst) { a.fistsFirst = false; return; }
  const hasWeapons = b.bag[a.side].some((it) => it.k === "weapon");
  if (!hasWeapons) return;
  if (a.held === "fists") {
    const id = drawRoll(b, a, reload);
    if (id === null) return;
    takeFromBag(b, a, id);
    a.held = id;
    a.heldAttacked = false;
    a.drew = true;
    if (a.skills.has("quick-swap")) { a.quickSwapPending = true; a.quickSwapTag = !reload; }
    emit(b, { t: "draw", turn: b.turn, actor: a.id, weapon: id, bagAfter: bagCopy(b.bag[a.side]) });
    return;
  }
  if (!a.heldAttacked) return;
  const roll = b.r.draw.int(100);
  if (!(roll < swapChance(a))) {
    if (roll < SWAP_PCT && a.skills.has("firm-grip")) a.firmGripKept = true;
    return;
  }
  const id = drawRoll(b, a, true);
  if (id === null) return;
  const dropped = a.held as WeaponId;
  takeFromBag(b, a, id);
  a.held = id;
  a.heldAttacked = false;
  a.drew = true;
  if (a.skills.has("quick-swap")) { a.quickSwapPending = true; a.quickSwapTag = true; }
  emit(b, { t: "swap", turn: b.turn, actor: a.id, dropped, weapon: id, bagAfter: bagCopy(b.bag[a.side]) });
}

/** Quick Swap: a turn in which its owner drew or swapped a weapon costs 30% less time. Fast Swap
 *  (talent): such a turn costs its share less again, after Quick Swap. */
export function quickTurn(a: Actor, cost: number): number {
  const q = a.quickSwapPending ? Math.floor((cost * (100 + sk("quick-swap", "swapTime"))) / 100) : cost;
  const f = a.drew ? tv(a.tal, "fast-swap", "swapTime") : 0;
  return f === 0 ? q : Math.floor((q * (100 + f)) / 100);
}

/** A scrapper's turn. Returns its time cost. */
function scrapperTurn(b: Bout, a: Actor): number {
  if (a.taunt > 0) a.taunt -= 1;                           // Taunt ends at the start of its second own turn
  // Right after a throw the turn is the sure redraw: no Move roll while a weapon waits in the bag.
  const reloading = a.reload && b.bag[a.side].some((it) => it.k === "weapon");
  // No Move on the own turn right after a Move (round 2): a level-30 kit with many Moves chained
  // them turn after turn, each one buried under the next, and bouts ran past 20 turns.
  const rested = !a.movedLast;
  a.movedLast = false;
  const move = reloading || !rested ? null : rollMove(b, a);
  if (move !== null) { a.movedLast = true; return playMove(b, a, move); }
  drawOrSwap(b, a);
  const target = pickEnemy(b, a);
  if (target === null) return quickTurn(a, turnCost(a, a.held, b.r.clock));
  let used: HeldId = a.held;
  if (a.held !== "fists") {
    const thrownTag = hasTag(a.held, "thrown");
    // A melee weapon is thrown only after it has swung once, so a fresh draw always gets its swing.
    if (thrownTag || (a.heldAttacked && b.r.throw.int(100) < throwChance(a, b.bag[a.side].some((it) => it.k === "weapon")))) {
      used = throwAttack(b, a, target);
      return quickTurn(a, turnCost(a, used, b.r.clock));
    }
  }
  meleeAttack(b, a, target);
  if (used !== "fists") a.heldAttacked = a.held === used ? true : a.heldAttacked;
  return quickTurn(a, turnCost(a, used, b.r.clock));
}

/** Overtime: from turn 50 a scrapper loses 8% of max HP after each of its own turns. */
function overtime(b: Bout, a: Actor): void {
  if (b.ended || !a.scrapper || a.status !== "up" || b.turn < OVERTIME_FROM) return;
  const loss = Math.max(1, Math.floor((a.maxHp * OVERTIME_PCT) / 100));
  a.hp = a.hp - loss > 0 ? a.hp - loss : 0;
  emit(b, { t: "overtime", turn: b.turn, actor: a.id, damage: loss, hpAfter: a.hp });
  if (a.hp === 0) knockOut(b, a, null);
}

/** One actor's turn, from its statuses to its time cost and overtime. */
export function takeTurn(b: Bout, a: Actor): void {
  a.priority = false;
  let cost: number;
  if (a.snared) {
    a.snareSkips += 1;
    if (a.snareSkips >= (a.snareLimit > 0 ? a.snareLimit : sk("tarp", "skips"))) {
      a.snared = false;
      a.snareSkips = 0;
      emit(b, { t: "free", turn: b.turn, actor: a.id, cause: "timeout" });
    }
    cost = turnCost(a, a.held, b.r.clock);
  } else if (a.scrapper) {
    cost = scrapperTurn(b, a);
  } else {
    cost = companionTurn(b, a);
  }
  a.quickSwapPending = false;
  a.firmGripKept = false;
  a.drew = false;
  a.clock += cost;
  if (cost === 0) a.priority = true;
  overtime(b, a);
}
