/**
 * Throws (work package 1). A Thrown weapon is always thrown and never used up. Any other held
 * weapon is thrown 20% of the time while the bag holds another weapon to draw next (5% when it
 * does not; Pitcher: 35% either way). Thrown away, it is gone (Pitcher: back in the bag; Junk
 * Collector: back in the bag 60% of the time), and the next turn draws from the bag for sure,
 * so a bout shows weapons flying and being replaced (owner amendment 13.8).
 * No intercept and no riposte against a throw; evade and block are halved; Armor does not apply.
 * Trick Shot: a Thrown weapon that lands may ricochet once a turn to a random living enemy.
 */
import type { Proc, Step } from "../contracts/log";
import type { WeaponId } from "../contracts/ids";
import { sk } from "../content/skills";
import { hasTag } from "../content/weapons";
import type { Actor } from "./combatant";
import type { Bout } from "./bout";
import { bagCopy, emit, headStart, pickEnemy, proc, sortProcs } from "./bout";
import { MAX_COMBO, comboChance, consequences, resolve } from "./melee";

/** A held melee weapon is thrown this often while another weapon waits in the bag. */
export const THROW_PCT = 20;
/** ...and this often when it is the last weapon the scrapper has. */
export const THROW_LAST_PCT = 5;

/** The chance that a held weapon that is not Thrown is thrown this turn. */
export function throwChance(a: Actor, bagHasWeapon: boolean): number {
  if (a.skills.has("pitcher")) return sk("pitcher", "throwChance");
  return bagHasWeapon ? THROW_PCT : THROW_LAST_PCT;
}

/** What happens to a thrown weapon. Junk Collector rolls one number on the throw stream. */
export function afterThrow(b: Bout, a: Actor, weapon: WeaponId, procs: Proc[]): "held" | "bag" | "gone" {
  if (hasTag(weapon, "thrown")) return "held";
  if (a.skills.has("pitcher")) return "bag";
  if (a.skills.has("junk-collector") && b.r.throw.int(100) < sk("junk-collector", "returnChance")) {
    procs.push(proc(a, "junk-collector"));
    return "bag";
  }
  return "gone";
}

export function throwAttack(b: Bout, att: Actor, first: Actor): WeaponId {
  const weapon = att.held as WeaponId;
  const flurry = att.skills.has("flurry") ? sk("flurry", "combo") : 0;
  let combo = comboChance(att, 0);
  let comboNoFlurry = comboChance(att, flurry);
  let combos = 0;
  let whyProc: Proc | null = null;
  let ricocheted = false;
  let def = first;

  for (let n = 0; ; n++) {
    const procs: Proc[] = [];
    if (whyProc !== null) procs.push(whyProc);
    if (n === 0) headStart(att, procs);
    const c = resolve(b, att, def, true, false, procs);
    const after = afterThrow(b, att, weapon, procs);
    const bag = b.bag[att.side];
    if (after === "bag") bag.push({ k: "weapon", id: weapon });
    if (after !== "held") { att.held = "fists"; att.heldAttacked = false; att.reload = true; } else att.heldAttacked = true;
    const step = { t: "throw", turn: b.turn, actor: att.id, target: def.id, weapon, outcome: c.outcome,
      damage: c.damage, crit: c.crit, hpAfter: c.hpAfter, n, after, bagAfter: bagCopy(bag) } as Step & { why?: "combo"; procs?: Proc[] };
    if (n > 0) step.why = "combo";
    const p = sortProcs(c.procs);
    if (p !== undefined) step.procs = p;
    emit(b, step);
    consequences(b, att, def, c);
    if (b.ended || after !== "held") break;
    whyProc = null;
    // Trick Shot: a landed throw bounces on to a random living enemy, once a turn.
    if (c.outcome === "hit" && !ricocheted && att.skills.has("trick-shot")
      && b.r.throw.int(100) < sk("trick-shot", "ricochet")) {
      const next = pickEnemy(b, att);
      if (next !== null) {
        ricocheted = true;
        def = next;
        whyProc = proc(att, "trick-shot");
        continue;
      }
    }
    if (def.status !== "up") break;
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
