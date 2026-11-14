/**
 * Throws (work package 1). A Thrown weapon is always thrown and never used up. Any other held
 * weapon is thrown 5% of the time (Pitcher: 35%) and is then gone (Pitcher: back in the bag).
 * No intercept and no riposte against a throw; evade and block are halved; Armor does not apply.
 */
import type { Proc, Step } from "../contracts/log";
import type { WeaponId } from "../contracts/ids";
import { sk } from "../content/skills";
import { hasTag } from "../content/weapons";
import type { Actor } from "./combatant";
import type { Bout } from "./bout";
import { bagCopy, emit, headStart, proc, sortProcs } from "./bout";
import { MAX_COMBO, comboChance, consequences, resolve } from "./melee";

export const THROW_PCT = 5;

/** The chance that a held weapon that is not Thrown is thrown this turn. */
export function throwChance(a: Actor): number {
  return a.skills.has("pitcher") ? sk("pitcher", "throwChance") : THROW_PCT;
}

/** What happens to a thrown weapon. */
export function afterThrow(a: Actor, weapon: WeaponId): "held" | "bag" | "gone" {
  if (hasTag(weapon, "thrown")) return "held";
  return a.skills.has("pitcher") ? "bag" : "gone";
}

export function throwAttack(b: Bout, att: Actor, def: Actor): WeaponId {
  const weapon = att.held as WeaponId;
  const after = afterThrow(att, weapon);
  const flurry = att.skills.has("flurry") ? sk("flurry", "combo") : 0;
  let combo = comboChance(att, 0);
  let comboNoFlurry = comboChance(att, flurry);
  let combos = 0;
  let whyProc: Proc | null = null;

  for (let n = 0; ; n++) {
    const procs: Proc[] = [];
    if (whyProc !== null) procs.push(whyProc);
    if (n === 0) headStart(att, procs);
    const c = resolve(b, att, def, true, false, procs);
    const bag = b.bag[att.side];
    if (after === "bag") bag.push({ k: "weapon", id: weapon });
    if (after !== "held") { att.held = "fists"; att.heldAttacked = false; } else att.heldAttacked = true;
    const step = { t: "throw", turn: b.turn, actor: att.id, target: def.id, weapon, outcome: c.outcome,
      damage: c.damage, crit: c.crit, hpAfter: c.hpAfter, n, after, bagAfter: bagCopy(bag) } as Step & { why?: "combo"; procs?: Proc[] };
    if (n > 0) step.why = "combo";
    const p = sortProcs(c.procs);
    if (p !== undefined) step.procs = p;
    emit(b, step);
    consequences(b, att, def, c);
    if (b.ended || def.status !== "up" || after !== "held") break;
    whyProc = null;
    if (combos >= MAX_COMBO) break;
    const r = b.r.hit.int(100);
    if (!(r < combo)) break;
    if (flurry > 0 && r >= comboNoFlurry) whyProc = proc(att, "flurry");
    combos += 1;
    combo = Math.floor(combo / 2);
    comboNoFlurry = Math.floor(comboNoFlurry / 2);
  }
  return weapon;
}
