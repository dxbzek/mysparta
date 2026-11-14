/**
 * One turn on the timeline (work package 1). A scrapper's turn, in order: statuses, the Move roll,
 * the draw or swap, throw or melee, the target, the swing, the time cost. Then overtime.
 */
import type { HeldId, WeaponId } from "../contracts/ids";
import { sk } from "../content/skills";
import { hasTag, weaponNumbers } from "../content/weapons";
import type { Actor } from "./combatant";
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

/** Swap chance while holding a weapon that has attacked: 30%, Firm Grip 15%. */
export function swapChance(a: Actor): number {
  return a.skills.has("firm-grip") ? sk("firm-grip", "swapChance") : SWAP_PCT;
}

/** Picks a weapon out of the bag by Draw weight with chance S / (S + 6). One random number. */
function drawRoll(b: Bout, a: Actor, always: boolean): WeaponId | null {
  const bag = b.bag[a.side];
  let S = 0;
  for (const it of bag) if (it.k === "weapon") S += weaponNumbers(it.id).draw;
  if (S <= 0) return null;
  let r = b.r.draw.int(always ? S : S + DRAW_SLACK);
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

/** Step 3: draw with empty hands, or swap a weapon that has already attacked. */
function drawOrSwap(b: Bout, a: Actor): void {
  const hasWeapons = b.bag[a.side].some((it) => it.k === "weapon");
  if (!hasWeapons) return;
  if (a.held === "fists") {
    const id = drawRoll(b, a, false);
    if (id === null) return;
    takeFromBag(b, a, id);
    a.held = id;
    a.heldAttacked = false;
    emit(b, { t: "draw", turn: b.turn, actor: a.id, weapon: id, bagAfter: bagCopy(b.bag[a.side]) });
    return;
  }
  if (!a.heldAttacked) return;
  if (!(b.r.draw.int(100) < swapChance(a))) return;
  const id = drawRoll(b, a, true);
  if (id === null) return;
  const dropped = a.held as WeaponId;
  takeFromBag(b, a, id);
  a.held = id;
  a.heldAttacked = false;
  emit(b, { t: "swap", turn: b.turn, actor: a.id, dropped, weapon: id, bagAfter: bagCopy(b.bag[a.side]) });
}

/** A scrapper's turn. Returns its time cost. */
function scrapperTurn(b: Bout, a: Actor): number {
  const move = rollMove(b, a);
  if (move !== null) return playMove(b, a, move);
  drawOrSwap(b, a);
  const target = pickEnemy(b, a);
  if (target === null) return turnCost(a, a.held, b.r.clock);
  let used: HeldId = a.held;
  if (a.held !== "fists") {
    const thrownTag = hasTag(a.held, "thrown");
    if (thrownTag || b.r.throw.int(100) < throwChance(a)) {
      used = throwAttack(b, a, target);
      return turnCost(a, used, b.r.clock);
    }
  }
  meleeAttack(b, a, target);
  if (used !== "fists") a.heldAttacked = a.held === used ? true : a.heldAttacked;
  return turnCost(a, used, b.r.clock);
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
    if (a.snareSkips >= sk("tarp", "skips")) {
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
  a.clock += cost;
  if (cost === 0) a.priority = true;
  overtime(b, a);
}
