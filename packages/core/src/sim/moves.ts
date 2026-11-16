/**
 * Moves (work package 1). At the start of a turn the owned Moves that have uses and whose condition
 * holds are listed; with W the sum of their weights, one fires with chance W / (W + 12), picked by
 * weight. A Move is the whole turn and sets its own time cost.
 */
import type { BagItem, Proc, Step } from "../contracts/log";
import type { MoveId, WeaponId } from "../contracts/ids";
import { SKILLS, sk } from "../content/skills";
import { hasTag } from "../content/weapons";
import type { Actor } from "./combatant";
import { valuesOf } from "./combatant";
import type { Bout } from "./bout";
import { armored, bagCopy, emit, opening, openingCut, enemiesUp, headStart, knockOut, land, pickEnemy, proc, scrapperOfSide,
  pickProc, tryDisarm, tryFree, tryShield, OPENING_TURNS } from "./bout";
import { turnBase, turnCost } from "./clock";
import { roll } from "./rng";
import { armorProcs } from "./melee";

/** Was 12 (round-2 review): with Moves held back until the opening is over, a slack of 6 still
 *  fires each owned Move in most bouts, mid-fight instead of on the owner's first turn. */
export const MOVE_SLACK = 6;
/** Taunt costs no time, so its owner acts again at once; the bonus lasts through that action and
 *  ends at the start of the owner's turn after it. */
export const TAUNT_TURNS = 2;

/** The Moves made with empty hands. */
export const UNARMED_MOVES: ReadonlySet<MoveId> = new Set<MoveId>(["body-slam", "grapple", "snatch"]);

/** Whether a Move's condition holds for `a` right now. */
export function moveReady(b: Bout, a: Actor, id: MoveId): boolean {
  // No Move in the opening (round-2 review): Moves fired on the owner's 1st-3rd turn, where the
  // opening cut their damage to a jab's size, and then nothing happened for the rest of the bout.
  // The unarmed Moves are the exception: empty hands are mostly a thing of the first turn, so they
  // may still come then, and their hits use the opening's larger "big" allowance.
  if (b.turn <= OPENING_TURNS && !UNARMED_MOVES.has(id)) return false;
  const enemies = enemiesUp(b, a);
  switch (id) {
    // A throw never uses the boost, so a Haymaker is not called while a Thrown weapon is in the hand.
    case "haymaker": return !a.haymaker && !(a.held !== "fists" && hasTag(a.held, "thrown"));
    case "energy-drink": return a.hp * 100 < a.maxHp * sk("energy-drink", "belowHpPct");
    case "tarp": return enemies.some((e) => !e.snared);
    case "whistle": return b.actors.some((c) => c.side === a.side && !c.scrapper && c.status === "up"
      && c.hp * 100 < c.maxHp * sk("whistle", "belowHpPct"));
    case "firecrackers": return true;
    case "snatch": {
      const foe = scrapperOfSide(b, a.side === "a" ? "b" : "a");
      return a.held === "fists" && foe.status === "up" && foe.held !== "fists";
    }
    // With no enemy companion it still startles the enemy scrapper (pet pass: it was often dead).
    case "air-horn": return enemies.length > 0;
    case "body-slam": return a.held === "fists";
    case "sand-in-the-eyes": {
      const foe = scrapperOfSide(b, a.side === "a" ? "b" : "a");
      return foe.status === "up" && foe.sand === 0;
    }
    case "taunt": return a.taunt === 0;
    case "second-wind": return a.hp * 100 < a.maxHp * sk("second-wind", "belowHpPct");
    case "grapple": {
      const foe = scrapperOfSide(b, a.side === "a" ? "b" : "a");
      return a.held === "fists" && foe.status === "up" && !foe.snared;
    }
    default: {
      const unknown: never = id;
      return unknown;
    }
  }
}

/** The Move roll. Returns the Move that fires, or null. One random number. */
export function rollMove(b: Bout, a: Actor): MoveId | null {
  const bag = b.bag[a.side];
  const ready: { id: MoveId; w: number }[] = [];
  for (const it of bag) {
    if (it.k !== "move" || it.uses < 1 || !moveReady(b, a, it.id)) continue;
    ready.push({ id: it.id, w: SKILLS[it.id].move!.weight });
  }
  if (ready.length === 0) return null;
  const W = ready.reduce((s, x) => s + x.w, 0);
  let r = b.r.move.int(W + MOVE_SLACK);
  if (r >= W) return null;
  for (const x of ready) {
    if (r < x.w) return x.id;
    r -= x.w;
  }
  return null;
}

function useUp(bag: BagItem[], id: MoveId): void {
  const at = bag.findIndex((it) => it.k === "move" && it.id === id);
  const it = bag[at];
  if (it === undefined || it.k !== "move") return;
  if (it.uses > 1) bag.splice(at, 1, { k: "move", id, uses: it.uses - 1 });
  else bag.splice(at, 1);
}

function moveStep(b: Bout, a: Actor, id: MoveId, procs: Proc[], extra: Partial<Extract<Step, { t: "move" }>>): Step {
  const step = { t: "move", turn: b.turn, actor: a.id, move: id, bagAfter: bagCopy(b.bag[a.side]), ...extra } as Step & { procs?: Proc[] };
  const p = pickProc(b, procs);
  if (p !== undefined) step.procs = p;
  b.lastTag = b.turn;
  return step;
}

/** Plays a Move and returns its time cost in beats. */
export function playMove(b: Bout, a: Actor, id: MoveId): number {
  const bag = b.bag[a.side];
  useUp(bag, id);
  const procs: Proc[] = [];
  headStart(a, procs);
  const now = a.clock;

  switch (id) {
    case "haymaker": {
      a.haymaker = true;
      emit(b, moveStep(b, a, id, procs, {}));
      return sk("haymaker", "cost");
    }
    case "energy-drink": {
      const pct = roll(b.r.move, sk("energy-drink", "healMin"), sk("energy-drink", "healMax"));
      const want = Math.floor((a.maxHp * pct) / 100);
      const amount = Math.max(1, Math.min(want, a.maxHp - a.hp));
      emit(b, moveStep(b, a, id, procs, {}));
      a.hp += amount;
      emit(b, { t: "heal", turn: b.turn, actor: a.id, target: a.id, amount, hpAfter: a.hp });
      return sk("energy-drink", "cost");
    }
    case "tarp": {
      const free = enemiesUp(b, a).filter((e) => !e.snared);
      const pets = free.filter((e) => !e.scrapper);
      const pool = pets.length > 0 ? pets : free;
      const target = pool[b.r.move.int(pool.length)]!;
      emit(b, moveStep(b, a, id, procs, { target: target.id }));
      target.snared = true;
      target.snareSkips = 0;
      target.snareLimit = sk("tarp", "skips");
      emit(b, { t: "snare", turn: b.turn, actor: a.id, target: target.id });
      return Math.floor((turnBase(a, a.held) * sk("tarp", "costPct")) / 100);
    }
    case "whistle": {
      const hurt = b.actors.filter((c) => c.side === a.side && !c.scrapper && c.status === "up"
        && c.hp * 100 < c.maxHp * sk("whistle", "belowHpPct"));
      const pet = hurt[b.r.move.int(hurt.length)]!;
      emit(b, moveStep(b, a, id, procs, { target: pet.id }));
      const amount = Math.max(1, Math.min(Math.floor((pet.maxHp * sk("whistle", "healPct")) / 100), pet.maxHp - pet.hp));
      pet.hp += amount;
      emit(b, { t: "heal", turn: b.turn, actor: a.id, target: pet.id, amount, hpAfter: pet.hp });
      pet.clock = now;
      pet.priority = true;
      return sk("whistle", "cost");
    }
    case "firecrackers": {
      const targets = enemiesUp(b, a);
      const hits: { target: Actor["id"]; damage: number; hpAfter: number }[] = [];
      for (const t of targets) {
        const damage = t.scrapper
          ? opening(b, t, roll(b.r.damage, sk("firecrackers", "damageMin"), sk("firecrackers", "damageMax")))
          : Math.max(1, Math.floor((t.maxHp * sk("firecrackers", "companionPct")) / 100));
        const hpAfter = land(t, damage, procs);
        hits.push({ target: t.id, damage, hpAfter });
      }
      emit(b, moveStep(b, a, id, procs, { hits }));
      for (const t of targets) tryFree(b, t);
      // Companions fall first: a scrapper's knockout ends the bout, and every actor at 0 HP gets its ko.
      for (const t of targets) if (t.hp === 0 && !t.scrapper) knockOut(b, t, a);
      for (const t of targets) if (t.hp === 0 && t.scrapper) knockOut(b, t, a);
      return Math.floor((turnBase(a, a.held) * sk("firecrackers", "costPct")) / 100);
    }
    case "snatch": {
      const foe = scrapperOfSide(b, a.side === "a" ? "b" : "a");
      const weapon = foe.held as WeaponId;
      if (foe.skills.has("firm-grip") && b.r.disarm.int(100) < sk("firm-grip", "resist")) {
        procs.push(proc(foe, "firm-grip"));
        emit(b, moveStep(b, a, id, procs, { target: foe.id }));
        return sk("snatch", "cost");
      }
      foe.held = "fists";
      foe.heldAttacked = false;
      a.held = weapon;
      a.heldAttacked = false;
      emit(b, moveStep(b, a, id, procs, { target: foe.id, taken: weapon }));
      return sk("snatch", "cost");
    }
    case "air-horn": {
      emit(b, moveStep(b, a, id, procs, {}));
      const pets = enemiesUp(b, a).some((e) => !e.scrapper);
      for (const e of enemiesUp(b, a)) {
        if (e.scrapper) continue;
        if (b.r.move.int(100) < sk("air-horn", "fleeChance")) {
          e.status = "fled";
          emit(b, { t: "flee", turn: b.turn, actor: e.id });
        }
      }
      const foe = scrapperOfSide(b, a.side === "a" ? "b" : "a");
      foe.clock += sk("air-horn", pets ? "clockPush" : "clockPushNoPet");
      return sk("air-horn", "cost");
    }
    case "body-slam": {
      const target = pickEnemy(b, a)!;
      const variance = roll(b.r.damage, 85, 115);
      const raw = Math.floor(((sk("body-slam", "base") + sk("body-slam", "perStrength") * a.str) * variance) / 100);
      const armor = valuesOf(target).armor;
      armorProcs(target, armor, (x) => openingCut(b, target, armored(raw, x), true), openingCut(b, target, armored(raw, armor), true),
        procs);
      const damage = opening(b, target, armored(raw, armor), true);
      const hpAfter = land(target, damage, procs);
      emit(b, moveStep(b, a, id, procs, { target: target.id, hits: [{ target: target.id, damage, hpAfter }] }));
      if (target.hp > 0) tryDisarm(b, a, target, "slam");
      if (target.hp > 0) tryShield(b, a, target, "slam");
      tryFree(b, target);
      if (target.hp === 0) knockOut(b, target, a);
      return turnCost(a, a.held, b.r.clock) + sk("body-slam", "extraCost");
    }
    case "sand-in-the-eyes": {
      const foe = scrapperOfSide(b, a.side === "a" ? "b" : "a");
      foe.sand = sk("sand-in-the-eyes", "aimLoss");
      emit(b, moveStep(b, a, id, procs, { target: foe.id }));
      return Math.floor((turnBase(a, a.held) * sk("sand-in-the-eyes", "costPct")) / 100);
    }
    case "taunt": {
      a.taunt = TAUNT_TURNS;
      emit(b, moveStep(b, a, id, procs, {}));
      return sk("taunt", "cost");
    }
    case "second-wind": {
      const want = Math.floor((a.maxHp * sk("second-wind", "healPct")) / 100);
      const amount = Math.max(1, Math.min(want, a.maxHp - a.hp));
      emit(b, moveStep(b, a, id, procs, {}));
      a.hp += amount;
      emit(b, { t: "heal", turn: b.turn, actor: a.id, target: a.id, amount, hpAfter: a.hp });
      return sk("second-wind", "cost");
    }
    case "grapple": {
      const foe = scrapperOfSide(b, a.side === "a" ? "b" : "a");
      const variance = roll(b.r.damage, 85, 115);
      const raw = Math.floor(((sk("grapple", "base") + sk("grapple", "perStrength") * a.str) * variance) / 100);
      const armor = valuesOf(foe).armor;
      armorProcs(foe, armor, (x) => openingCut(b, foe, armored(raw, x), true), openingCut(b, foe, armored(raw, armor), true), procs);
      const damage = opening(b, foe, armored(raw, armor), true);
      const hpAfter = land(foe, damage, procs);
      emit(b, moveStep(b, a, id, procs, { target: foe.id, hits: [{ target: foe.id, damage, hpAfter }] }));
      if (foe.hp === 0) {
        knockOut(b, foe, a);
      } else {
        foe.snared = true;
        foe.snareSkips = 0;
        foe.snareLimit = sk("grapple", "holds");
        emit(b, { t: "snare", turn: b.turn, actor: a.id, target: foe.id });
      }
      return turnCost(a, a.held, b.r.clock);
    }
    default: {
      const unknown: never = id;
      return unknown;
    }
  }
}
