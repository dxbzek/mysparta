/**
 * One swing and one melee attack (work package 1): intercept, evade, block, damage, crit, armor,
 * disarm, the door, combo, Stubborn and riposte, in the order of the rules.
 */
import type { Proc, Step } from "../contracts/log";
import { sk } from "../content/skills";
import { hasTag, reachOf, weaponNumbers } from "../content/weapons";
import type { Actor } from "./combatant";
import { CAP, clampPct, valuesOf } from "./combatant";
import type { Bout } from "./bout";
import { armored, emit, headStart, knockOut, land, proc, sortProcs, tryDisarm, tryFree, tryShield } from "./bout";
import { shieldNumbers } from "../content/shields";
import { roll } from "./rng";

/** Whole-percent damage multiplier: 100 plus skill bonuses, doubled by Haymaker. */
export function damageMult(att: Actor, thrown: boolean, boosted: boolean): number {
  let m = 100;
  if (att.scrapper) {
    if (thrown && att.skills.has("pitcher")) m += sk("pitcher", "thrownDamage");
    if (!thrown && att.held !== "fists" && hasTag(att.held, "blade") && att.skills.has("sharpening-stone")) {
      m += sk("sharpening-stone", "bladeDamage");
    }
    if (!thrown && att.held === "fists" && att.skills.has("bare-knuckle")) m += sk("bare-knuckle", "fistDamage");
    m += shieldNumbers(att.shield).damage;
  } else {
    m += att.dmgPct;
  }
  if (boosted) m = Math.floor((m * sk("haymaker", "damageMult")) / 100);
  return m < 0 ? 0 : m;
}

/** Base damage: the held weapon's, or the companion's own. */
export function baseDamage(att: Actor): number {
  return att.comp !== null ? att.dmg : weaponNumbers(att.held).dmg;
}

/** Melee: base + floor(Strength x (base + 4) / 12). Thrown: base + floor((Strength + 2 x Agility) x (base + 4) / 36). */
export function rawDamage(att: Actor, thrown: boolean): number {
  const base = baseDamage(att);
  return thrown
    ? base + Math.floor(((att.str + 2 * att.agi) * (base + 4)) / 36)
    : base + Math.floor((att.str * (base + 4)) / 12);
}

/**
 * The whole-number damage chain: floor(floor(raw x roll / 100) x mult / 100), then the crit
 * (x3/2, rounded down), then Armor (melee only), never below 1.
 */
export function damageOf(raw: number, variance: number, mult: number, crit: boolean, armor: number | null): number {
  let d = Math.floor((Math.floor((raw * variance) / 100) * mult) / 100);
  if (crit) d = Math.floor((d * 3) / 2);
  if (armor !== null) return armored(d, armor);
  return d < 1 ? 1 : d;
}

export interface SwingCalc { outcome: "hit" | "evade" | "block"; damage: number; crit: boolean; hpAfter: number;
  procs: Proc[]; blocked: boolean }

/** Evade and block chances, halved against a throw (a shield's thrownBlock is added after the
 *  halving). Companions never block. A snared actor neither evades nor blocks. */
export function evadeChance(att: Actor, def: Actor, aimLess: number, evadeLess: number, thrown: boolean): number {
  const av = valuesOf(att);
  const dv = valuesOf(def);
  const agi = 3 * (def.agi - att.agi);
  const lead = agi < -30 ? -30 : agi > 30 ? 30 : agi;
  const c = clampPct(dv.evade - evadeLess + lead - (av.aim - aimLess), CAP.evade);
  return thrown ? Math.floor(c / 2) : c;
}
export function blockChance(att: Actor, def: Actor, pierceLess: number, thrown: boolean): number {
  if (!def.scrapper) return 0;
  const c = clampPct(valuesOf(def).block - (valuesOf(att).pierce - pierceLess), CAP.block);
  if (!thrown) return c;
  return clampPct(Math.floor(c / 2) + shieldNumbers(def.shield).thrownBlock, CAP.block);
}

/** Rolls one swing and applies its HP loss. The caller writes the step, then calls `consequences`. */
export function resolve(b: Bout, att: Actor, def: Actor, thrown: boolean, boosted: boolean, procs: Proc[]): SwingCalc {
  const seBonus = att.skills.has("sharp-eye") ? sk("sharp-eye", "aim") : 0;
  const sePierce = att.skills.has("sharp-eye") ? sk("sharp-eye", "pierce") : 0;
  let wouldMiss = false;

  const ev = evadeChance(att, def, 0, 0, thrown);
  const r = b.r.hit.int(100);
  const evaded = !def.snared && r < ev;
  if (evaded) {
    if (def.skills.has("slippery") && r >= evadeChance(att, def, 0, sk("slippery", "evade"), thrown)) {
      procs.push(proc(def, "slippery"));
    }
    return { outcome: "evade", damage: 0, crit: false, hpAfter: def.hp, procs, blocked: false };
  }
  if (seBonus > 0 && !def.snared && r < evadeChance(att, def, seBonus, 0, thrown)) wouldMiss = true;

  const bl = blockChance(att, def, 0, thrown);
  const rb = b.r.hit.int(100);
  const blocked = !def.snared && rb < bl;
  if (blocked) {
    if (def.shield !== null) procs.push(proc(def, def.shield));
    return { outcome: "block", damage: 0, crit: false, hpAfter: def.hp, procs, blocked: true };
  }
  if (sePierce > 0 && !def.snared && rb < blockChance(att, def, sePierce, thrown)) wouldMiss = true;
  if (wouldMiss) procs.push(proc(att, "sharp-eye"));

  const variance = thrown ? roll(b.r.damage, 95, 125) : roll(b.r.damage, 85, 115);
  const critChance = Math.min(valuesOf(att).crit + (boosted ? sk("haymaker", "crit") : 0), CAP.crit);
  const crit = b.r.hit.int(100) < critChance;
  const damage = damageOf(rawDamage(att, thrown), variance, damageMult(att, thrown, boosted), crit,
    thrown ? null : valuesOf(def).armor);
  const hpAfter = land(def, damage, procs);
  return { outcome: "hit", damage, crit, hpAfter, procs, blocked: false };
}

/** The steps a swing causes, in order: disarm, doorOff, free, ko. */
export function consequences(b: Bout, att: Actor, def: Actor, c: SwingCalc): void {
  if (c.outcome === "hit" && def.hp > 0) tryDisarm(b, att, def, "hit");
  if (c.outcome !== "evade" && def.hp > 0) tryShield(b, att, def, "hit");
  if (c.outcome === "hit") tryFree(b, def);
  if (def.hp === 0) knockOut(b, def, att);
}

function swingStep(t: "attack" | "intercept" | "riposte", b: Bout, att: Actor, def: Actor, c: SwingCalc): Step {
  const step = { t, turn: b.turn, actor: att.id, target: def.id, weapon: att.scrapper ? att.held : null,
    outcome: c.outcome, damage: c.damage, crit: c.crit, hpAfter: c.hpAfter } as Step & { procs?: Proc[] };
  const p = sortProcs(c.procs);
  if (p !== undefined) step.procs = p;
  return step;
}

/** Intercept chance: defender Intercept + 8 x (defender Reach - attacker Reach), 0 to 75. */
export function interceptChance(att: Actor, def: Actor, less: number): number {
  const ra = att.scrapper ? reachOf(att.held) : 0;
  const rd = reachOf(def.held);
  return clampPct(valuesOf(def).intercept - less + 8 * (rd - ra), CAP.intercept);
}

/** First combo chance: Combo + Agility, capped at 80. */
export function comboChance(att: Actor, less: number): number {
  return clampPct(valuesOf(att).combo - less + att.agi, CAP.combo);
}

export const MAX_COMBO = 3;

/** A whole melee attack by `att` on `def`, in the turn of `att`. */
export function meleeAttack(b: Bout, att: Actor, def: Actor): void {
  // A Crow flies: nobody hits it first and nobody hits back at it.
  const flying = att.comp !== null && att.comp.flies;
  // a. Intercept: a standing, free scrapper may hit first.
  if (def.scrapper && def.status === "up" && !def.snared && !flying) {
    const chance = interceptChance(att, def, 0);
    const r = b.r.hit.int(100);
    if (r < chance) {
      const procs: Proc[] = [];
      if (def.skills.has("anticipation") && r >= interceptChance(att, def, sk("anticipation", "intercept"))) {
        procs.push(proc(def, "anticipation"));
      }
      headStart(att, procs);
      const c = resolve(b, def, att, false, false, procs);
      emit(b, swingStep("intercept", b, def, att, c));
      consequences(b, def, att, c);
      return;
    }
  }

  const hpStart = att.hp;
  const flurry = att.skills.has("flurry") ? sk("flurry", "combo") : 0;
  let combo = comboChance(att, 0);
  let comboNoFlurry = comboChance(att, flurry);
  let combos = 0;
  let stubbornUsed = false;
  let why: "combo" | "stubborn" | undefined;
  let whyProc: Proc | null = null;
  let parried = false;
  // An Alley Cat's attack is two scratches: the second one is written as a combo swing.
  let scratches = att.comp !== null ? att.comp.swings - 1 : 0;

  for (let n = 0; ; n++) {
    const procs: Proc[] = [];
    if (whyProc !== null) procs.push(whyProc);
    if (n === 0) headStart(att, procs);
    const boosted = n === 0 && att.scrapper && att.haymaker;
    if (boosted) att.haymaker = false;
    const c = resolve(b, att, def, false, boosted, procs);
    if (c.blocked && def.skills.has("parry")) parried = true;
    const step = swingStep("attack", b, att, def, c) as Step & { n: number; why?: string; boosted?: true };
    step.n = n;
    if (why !== undefined) step.why = why;
    if (boosted) step.boosted = true;
    emit(b, step);
    consequences(b, att, def, c);
    if (b.ended || def.status !== "up" || att.hp < hpStart) break;

    whyProc = null;
    if (scratches > 0) {
      scratches -= 1;
      why = "combo";
      continue;
    }
    // Stubborn: after an evaded or blocked swing, 50% to swing again at once. Once per turn.
    if (c.outcome !== "hit" && att.skills.has("stubborn") && !stubbornUsed) {
      if (b.r.hit.int(100) < sk("stubborn", "chance")) {
        stubbornUsed = true;
        why = "stubborn";
        whyProc = proc(att, "stubborn");
        continue;
      }
    }
    // Combo: each success halves the capped chance. At most three extra swings.
    if (combos < MAX_COMBO) {
      const r = b.r.hit.int(100);
      if (r < combo) {
        if (flurry > 0 && r >= comboNoFlurry) whyProc = proc(att, "flurry");
        combos += 1;
        combo = Math.floor(combo / 2);
        comboNoFlurry = Math.floor(comboNoFlurry / 2);
        why = "combo";
        continue;
      }
    }
    break;
  }
  if (b.ended) return;

  // f. Riposte: after the last swing, a standing, free scrapper may hit back once.
  if (def.scrapper && def.status === "up" && !def.snared && att.status === "up" && !flying) {
    const dv = valuesOf(def);
    const base = clampPct(dv.riposte, CAP.riposte);
    const chance = parried ? sk("parry", "riposteAfterBlock") : base;
    const r = b.r.hit.int(100);
    if (r < (chance > CAP.riposte ? CAP.riposte : chance)) {
      const procs: Proc[] = [];
      const taunt = def.taunt ? sk("taunt", "riposte") : 0;
      if (parried && r >= base) procs.push(proc(def, "parry"));
      else if (taunt > 0 && r >= clampPct(dv.riposte - taunt, CAP.riposte)) procs.push(proc(def, "taunt"));
      else if (def.skills.has("payback") && r >= clampPct(dv.riposte - sk("payback", "riposte"), CAP.riposte)) {
        procs.push(proc(def, "payback"));
      }
      const c = resolve(b, def, att, false, false, procs);
      emit(b, swingStep("riposte", b, def, att, c));
      consequences(b, def, att, c);
    }
  }
}
