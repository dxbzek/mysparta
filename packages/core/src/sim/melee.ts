/**
 * One swing and one melee attack (work package 1): intercept, evade, block, damage, crit, armor,
 * disarm, the door, combo, Stubborn and riposte, in the order of the rules.
 */
import type { Proc, Step } from "../contracts/log";
import type { ProcId } from "../contracts/ids";
import { sk } from "../content/skills";
import { hasTag, reachOf, weaponNumbers } from "../content/weapons";
import type { Actor } from "./combatant";
import { CAP, clampPct, gearOf, soakOf, tv, valuesOf } from "./combatant";
import type { Bout } from "./bout";
import { allowance, armored, boosterProcs, due, emit, firstAction, knockOut, land, opening, pickProc, proc, scrapperOfSide, spent, tryDisarm,
  tryFree, tryShield } from "./bout";
import { shieldNumbers } from "../content/shields";
import { roll } from "./rng";

/** The one damage skill that raises this swing: Pitcher, Sharpening Stone, Bare Knuckle, or the
 *  owner's Pet Lover for a companion. Null when none applies. */
export function damageSkill(att: Actor, thrown: boolean): "pitcher" | "sharpening-stone" | "bare-knuckle" | "pet-lover" | null {
  if (!att.scrapper) return att.dmgPct > 0 ? "pet-lover" : null;
  if (thrown) return att.skills.has("pitcher") ? "pitcher" : null;
  if (att.held === "fists") return att.skills.has("bare-knuckle") ? "bare-knuckle" : null;
  return hasTag(att.held, "blade") && att.skills.has("sharpening-stone") ? "sharpening-stone" : null;
}

/** Whole-percent damage multiplier: 100 plus skill bonuses, doubled by Haymaker. `bare` leaves the
 *  damage skill out (to tell whether it changed the number). */
export function damageMult(att: Actor, thrown: boolean, boosted: boolean, bare = false, fresh = 0): number {
  let m = 100;
  const skill = bare ? null : damageSkill(att, thrown);
  if (att.scrapper) {
    if (skill === "pitcher") m += sk("pitcher", "thrownDamage");
    if (skill === "sharpening-stone") m += sk("sharpening-stone", "bladeDamage");
    if (skill === "bare-knuckle") m += sk("bare-knuckle", "fistDamage");
    // Taped Fists (gear): more damage with fists.
    if (!thrown && att.held === "fists") m += gearOf(att, "fistDmg");
    m += shieldNumbers(att.shield).damage;
    // talents (content v3 batch 3): Iron Knuckles (fists), Weapon Care (a held weapon), Strong Arm
    // (a throw), and `fresh`, Fresh Steel's bonus on the first swing with a weapon drawn or swapped in
    if (thrown) m += tv(att.tal, "strong-arm", "thrownDmg");
    else if (att.held === "fists") m += tv(att.tal, "iron-knuckles", "fistDmg");
    else m += tv(att.tal, "weapon-care", "weaponDmg");
    m += fresh;
  } else {
    if (skill === "pet-lover") m += att.dmgPct;
    // Sharp Teeth (the owner's talent)
    m += att.petDmg;
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
 * (x3/2, rounded down), then Armor (melee only), then the defender's soak (Toughness), never
 * below 1.
 */
export function damageOf(raw: number, variance: number, mult: number, crit: boolean, armor: number | null, soak = 0,
  critPct = 150): number {
  let d = Math.floor((Math.floor((raw * variance) / 100) * mult) / 100);
  // (x150 / 100 is the old x3 / 2 for every whole number; the Welding Mask lowers it)
  if (crit) d = Math.floor((d * critPct) / 100);
  if (armor !== null) d = armored(d, armor);
  if (soak > 0) d -= soak;
  return d < 1 ? 1 : d;
}

export interface SwingCalc { outcome: "hit" | "evade" | "block"; damage: number; crit: boolean; hpAfter: number;
  procs: Proc[]; blocked: boolean }

/** The soak a hit takes off (content v3): the defender's, and from its gear: a crit is a clean blow
 *  to the head (Motorbike Helmet: Toughness counted higher for its soak), a companion's bite lands
 *  on the shins (Magazine Shin Guards). */
export function takenSoak(att: Actor, def: Actor, crit: boolean): number {
  const dv = valuesOf(def);
  return (crit && def.scrapper ? dv.soak - soakOf(def.tou) + soakOf(def.tou + gearOf(def, "headTough")) : dv.soak)
    + (att.comp !== null ? gearOf(def, "petSoak") : 0);
}
/** A crit taken by `def` multiplies by this percent: 150, less the Welding Mask's cut. A throw of an
 *  attacker with Bullseye (talent) crits x2 (its `critTo`), less the same cut. */
export function critPctOf(def: Actor, att?: Actor, thrown = false): number {
  const to = thrown && att !== undefined && att.scrapper ? tv(att.tal, "bullseye", "critTo") : 0;
  return (to > 0 ? to : 150) - gearOf(def, "critCut");
}

/** Evade and block chances, halved against a throw (a shield's thrownBlock is added after the
 *  halving). Companions never block. A snared actor neither evades nor blocks. */
export function evadeChance(att: Actor, def: Actor, aimLess: number, evadeLess: number, thrown: boolean): number {
  const av = valuesOf(att);
  const dv = valuesOf(def);
  const agi = 3 * (def.agi - att.agi);
  const lead = agi < -30 ? -30 : agi > 30 ? 30 : agi;
  // Hi-Vis Vest (gear): more Evade against a companion's swing.
  const pet = att.comp !== null ? gearOf(def, "petEvade") : 0;
  // Dead Eye (talent): more Aim on a throw.
  const eye = thrown && att.scrapper ? tv(att.tal, "dead-eye", "thrownAim") : 0;
  const c = clampPct(dv.evade + pet - evadeLess + lead - (av.aim + eye - aimLess), CAP.evade);
  return thrown ? Math.floor(c / 2) : c;
}
export function blockChance(att: Actor, def: Actor, pierceLess: number, thrown: boolean): number {
  if (!def.scrapper) return 0;
  const c = clampPct(valuesOf(def).block - (valuesOf(att).pierce - pierceLess), CAP.block);
  if (!thrown) return c;
  return clampPct(Math.floor(c / 2) + shieldNumbers(def.shield).thrownBlock + gearOf(def, "thrownBlock"), CAP.block);
}

/** What a capstone changes about one swing (content v3 batch 3). `sure`: it cannot be evaded or
 *  blocked (Unbreakable's riposte); `noBlock`: it cannot be blocked (Fresh Steel); `crit`: it crits
 *  when it lands (Knockdown); `fresh`: percent added to its damage multiplier (Fresh Steel); `tag`:
 *  the capstone named on the step when it lands. The rolls are made as usual either way. */
export interface SwingOpts { sure?: boolean; noBlock?: boolean; crit?: boolean; fresh?: number; tag?: ProcId }

/** Rolls one swing and applies its HP loss. The caller writes the step, then calls `consequences`. */
export function resolve(b: Bout, att: Actor, def: Actor, thrown: boolean, boosted: boolean, procs: Proc[], o: SwingOpts = {}): SwingCalc {
  const seBonus = att.skills.has("sharp-eye") ? sk("sharp-eye", "aim") : 0;
  const sePierce = att.skills.has("sharp-eye") ? sk("sharp-eye", "pierce") : 0;
  let wouldMiss = false;

  const ev = evadeChance(att, def, 0, 0, thrown);
  const r = b.r.hit.int(100);
  const evaded = !def.snared && !o.sure && r < ev;
  if (evaded) {
    if (def.skills.has("slippery") && due(b, def, "slippery", r >= evadeChance(att, def, 0, sk("slippery", "evade"), thrown))) {
      procs.push(proc(def, "slippery"));
    }
    // Sand in the Eyes: the swing missed only because the sand took the attacker's Aim.
    if (att.sand > 0 && r >= evadeChance(att, def, -att.sand, 0, thrown)) {
      procs.push(proc(scrapperOfSide(b, def.side), "sand-in-the-eyes"));
    }
    boosterProcs(b, att, def, "evade", procs);
    return { outcome: "evade", damage: 0, crit: false, hpAfter: def.hp, procs, blocked: false };
  }
  if (seBonus > 0 && !def.snared && r < evadeChance(att, def, seBonus, 0, thrown)) wouldMiss = true;

  const bl = blockChance(att, def, 0, thrown);
  const rb = b.r.hit.int(100);
  const blocked = !def.snared && !o.sure && !o.noBlock && rb < bl;
  if (blocked) {
    if (def.shield !== null) procs.push(proc(def, def.shield));
    // Parry's Block decided the roll.
    if (def.skills.has("parry") && rb >= blockChance(att, def, -sk("parry", "block"), thrown)) procs.push(proc(def, "parry"));
    return { outcome: "block", damage: 0, crit: false, hpAfter: def.hp, procs, blocked: true };
  }
  if (sePierce > 0 && !def.snared && rb < blockChance(att, def, sePierce, thrown)) wouldMiss = true;
  if (seBonus > 0 && due(b, att, "sharp-eye", wouldMiss)) procs.push(proc(att, "sharp-eye"));

  const variance = thrown ? roll(b.r.damage, 95, 125) : roll(b.r.damage, 85, 115);
  // Bullseye (talent): more Crit on a throw.
  const bull = thrown && att.scrapper ? tv(att.tal, "bullseye", "thrownCrit") : 0;
  const critChance = Math.min(valuesOf(att).crit + bull + (boosted ? sk("haymaker", "crit") : 0), CAP.crit);
  const crit = b.r.hit.int(100) < critChance || o.crit === true;
  const raw = rawDamage(att, thrown);
  const fresh = o.fresh ?? 0;
  const mult = damageMult(att, thrown, boosted, false, fresh);
  const dv = valuesOf(def);
  const armor = thrown ? null : dv.armor;
  const soak = takenSoak(att, def, crit);
  const critPct = critPctOf(def, att, thrown);
  const full = damageOf(raw, variance, mult, crit, armor, soak, critPct);
  // Number skills show where they changed the damage (no random number: the same hit, re-counted).
  const big = crit || boosted;
  const left = allowance(b, def, big);
  const cut = (d: number): number => (left === Infinity ? d : Math.max(1, Math.min(d, left)));
  const skill = damageSkill(att, thrown);
  if (o.tag !== undefined) procs.push(proc(att, o.tag));
  else if (bull > 0 && crit) procs.push(proc(att, "bullseye"));
  if (skill !== null && cut(damageOf(raw, variance, damageMult(att, thrown, boosted, true, fresh), crit, armor, soak, critPct)) !== cut(full)) {
    procs.push(proc(skill === "pet-lover" ? scrapperOfSide(b, att.side) : att, skill));
  }
  if (armor !== null) armorProcs(def, armor, (a) => cut(damageOf(raw, variance, mult, crit, a, soak, critPct)), cut(full), procs);
  boosterProcs(b, att, def, "hit", procs);
  // Light Feet's Agility also adds to Thrown damage: it may name itself on its owner's landed throw.
  if (thrown && att.scrapper && att.skills.has("light-feet")) procs.push(proc(att, "light-feet"));
  const damage = opening(b, def, full, big);
  const hpAfter = land(def, damage, procs, b);
  return { outcome: "hit", damage, crit, hpAfter, procs, blocked: false };
}

/** Padding and Plate Vest: a proc on a hit whose damage would have been higher without that
 *  skill's Armor. `dealt(armor)` is the damage the hit would deal with that Armor. */
export function armorProcs(def: Actor, armor: number, dealt: (armor: number) => number, done: number, procs: Proc[]): void {
  if (!def.scrapper) return;
  for (const id of ["plate-vest", "padding"] as const) {
    if (def.skills.has(id) && dealt(armor - sk(id, "armor")) !== done) procs.push(proc(def, id));
  }
}

/** The steps a swing causes, in order: disarm, doorOff, free, ko. Stagger (talent): a crit landed
 *  on a scrapper that still stands pushes its clock back. */
export function consequences(b: Bout, att: Actor, def: Actor, c: SwingCalc): void {
  if (c.outcome === "hit" && c.crit && def.scrapper && def.hp > 0 && att.scrapper) def.clock += tv(att.tal, "stagger", "stagger");
  if (c.outcome === "hit" && def.hp > 0) tryDisarm(b, att, def, "hit");
  if (c.outcome !== "evade" && def.hp > 0) tryShield(b, att, def, "hit");
  if (c.outcome === "hit") tryFree(b, def);
  if (def.hp === 0) knockOut(b, def, att);
}

function swingStep(t: "attack" | "intercept" | "riposte", b: Bout, att: Actor, def: Actor, c: SwingCalc): Step {
  const step = { t, turn: b.turn, actor: att.id, target: def.id, weapon: att.scrapper ? att.held : null,
    outcome: c.outcome, damage: c.damage, crit: c.crit, hpAfter: c.hpAfter } as Step & { procs?: Proc[] };
  const p = pickProc(b, c.procs);
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
  if (def.scrapper && def.status === "up" && !def.snared && !flying && !spent(b, att)) {
    const chance = interceptChance(att, def, 0);
    const r = b.r.hit.int(100);
    if (r < chance) {
      const procs: Proc[] = [];
      if (def.skills.has("anticipation") && due(b, def, "anticipation", r >= interceptChance(att, def, sk("anticipation", "intercept")))) {
        procs.push(proc(def, "anticipation"));
      }
      firstAction(b, att, procs);
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
  let blockedAny = false;
  // An Alley Cat's attack is two scratches: the second one is written as a combo swing.
  let scratches = att.comp !== null ? att.comp.swings - 1 : 0;

  for (let n = 0; ; n++) {
    const procs: Proc[] = [];
    if (whyProc !== null) procs.push(whyProc);
    if (n === 0) firstAction(b, att, procs);
    // Bare Knuckle: its owner swings with fists on purpose (it opens with them); once a bout.
    if (att.scrapper && att.held === "fists" && att.skills.has("bare-knuckle")) procs.push(proc(att, "bare-knuckle"));
    // Light Feet's Agility also drives the combo chance: it may name itself on a combo swing.
    if (why === "combo" && att.scrapper && att.skills.has("light-feet")) procs.push(proc(att, "light-feet"));
    const boosted = n === 0 && att.scrapper && att.haymaker;
    if (boosted) att.haymaker = false;
    // Fresh Steel (capstone): the first swing with a weapon drawn or swapped in hits harder and
    // cannot be blocked. Knockdown (capstone): the first combo swing of a turn that lands is a crit.
    const o: SwingOpts = {};
    if (n === 0 && att.scrapper && att.held !== "fists" && !att.heldAttacked && tv(att.tal, "fresh-steel", "freshDmg") > 0) {
      o.noBlock = true; o.fresh = tv(att.tal, "fresh-steel", "freshDmg"); o.tag = "fresh-steel";
    }
    const knock = why === "combo" && att.scrapper && att.knockTurn !== b.turn && tv(att.tal, "knockdown", "knockClock") > 0;
    if (knock) { o.crit = true; o.tag = "knockdown"; }
    const c = resolve(b, att, def, false, boosted, procs, o);
    if (knock && c.outcome === "hit") {
      att.knockTurn = b.turn;
      if (def.hp > 0) def.clock += tv(att.tal, "knockdown", "knockClock");
    }
    if (c.blocked) blockedAny = true;
    if (c.blocked && def.skills.has("parry")) parried = true;
    const step = swingStep("attack", b, att, def, c) as Step & { n: number; why?: string; boosted?: true };
    step.n = n;
    if (why !== undefined) step.why = why;
    if (boosted) step.boosted = true;
    emit(b, step);
    consequences(b, att, def, c);
    // The swings stop when the target falls, or has spent its opening allowance for this turn.
    if (b.ended || def.status !== "up" || att.hp < hpStart || spent(b, def)) break;

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
        if (flurry > 0 && due(b, att, "flurry", r >= comboNoFlurry)) whyProc = proc(att, "flurry");
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
  if (def.scrapper && def.status === "up" && !def.snared && att.status === "up" && !flying && !spent(b, att)) {
    const dv = valuesOf(def);
    const base = clampPct(dv.riposte, CAP.riposte);
    // Counter (talent): more Riposte after a block in this attack. Unbreakable (capstone): after a
    // block the riposte is sure and cannot be evaded or blocked.
    const afterBlock = blockedAny ? clampPct(dv.riposte + tv(def.tal, "counter", "blockRiposte"), CAP.riposte) : base;
    const sure = blockedAny && tv(def.tal, "unbreakable", "sureRiposte") > 0;
    const plain = parried ? Math.max(sk("parry", "riposteAfterBlock"), afterBlock) : afterBlock;
    const capped = plain > CAP.riposte ? CAP.riposte : plain;
    const r = b.r.hit.int(100);
    if (r < (sure ? 100 : capped)) {
      const procs: Proc[] = [];
      const taunt = def.taunt > 0 ? sk("taunt", "riposte") : 0;
      if (sure && r >= capped) { /* only the capstone made it: its own tag (resolve) */ }
      else if (parried && r >= afterBlock) procs.push(proc(def, "parry"));
      else if (taunt > 0 && r >= clampPct(dv.riposte - taunt, CAP.riposte)) procs.push(proc(def, "taunt"));
      else if (def.skills.has("payback") && due(b, def, "payback", r >= clampPct(dv.riposte - sk("payback", "riposte"), CAP.riposte))) {
        procs.push(proc(def, "payback"));
      }
      const c = resolve(b, def, att, false, false, procs, sure ? { sure: true, tag: "unbreakable" } : {});
      emit(b, swingStep("riposte", b, def, att, c));
      consequences(b, def, att, c);
    }
  }
}
