/**
 * The AGOGE deterministic fight simulator.
 * Implements 02-gdd-core.md §4 (combat) + §5 (arsenal) on a single seeded
 * mulberry32 stream: seed + simVersion + snapshots → identical fight, always.
 *
 * Prototype deviations from the GDD, kept deliberately small:
 * - While enemy beasts live, 25% of champion melee/thrown attacks are
 *   intercepted by a beast (the GDD specifies only the Nemean Cub's 30%
 *   guardian redirect; interception makes beasts attackable, giving the
 *   Boar Spear and Whirl of Bronze their intended counterplay).
 * - Beasts evade but do not block; they cannot be disarmed or countered.
 */

import { clamp, makeRng, type Rng } from "./prng.js";
import { FISTS, weapon } from "./content/weapons.js";
import { skill } from "./content/skills.js";
import { beast } from "./content/beasts.js";
import type {
  BattlePlan,
  ChampionSnapshot,
  FightEvent,
  FightResult,
  Mods,
  Side,
  Stance,
  TrumpTrigger,
  WeaponDef,
} from "./types.js";

export const SIM_VERSION = 1;
export const TICK_CAP = 3000;

/* ------------------------------------------------------------------ */

interface StanceRow {
  dmgPct: number;
  intervalPct: number;
  acc: number;
  crit: number;
  eva: number;
  block: number;
  counter: number;
  riposte: number;
  armour: number;
}

const STANCES: Record<Stance, StanceRow> = {
  aggressive: { dmgPct: 15, intervalPct: -10, acc: 0, crit: 3, eva: -8, block: -10, counter: -5, riposte: 0, armour: 0 },
  measured: { dmgPct: 0, intervalPct: 0, acc: 6, crit: 0, eva: 3, block: 0, counter: 0, riposte: 0, armour: 0 },
  guarded: { dmgPct: -10, intervalPct: 8, acc: 0, crit: 0, eva: 0, block: 12, counter: 10, riposte: 10, armour: 2 },
};

interface Status {
  kind:
    | "slow" // interval +15% (Hamstring)
    | "accDown" // −amount Accuracy (War Cry)
    | "guardDown" // −15 Block & Evasion (Feint)
    | "entangled" // no evading/blocking (Rope and Net)
    | "wrath" // +100% dmg, unblockable, 3 attacks
    | "aegis" // auto-block melee
    | "hermes" // interval −40%, +15 Evasion
    | "weaponless"; // Cast Down draw delay
  until: number;
  amount?: number;
  count?: number;
}

interface BeastState {
  id: string;
  hp: number;
  hpMax: number;
  nextAt: number;
  usedCharge: boolean;
  down: boolean;
}

interface Fighter {
  side: Side;
  snap: ChampionSnapshot;
  plan: BattlePlan;
  hp: number;
  hpMax: number;
  /** Draw-order queue of non-shield weapon ids; index = current. */
  queue: string[];
  qIndex: number;
  ammo: number;
  shieldId?: string;
  shieldLost: boolean;
  init: number;
  nextAt: number;
  nextHealAt: number;
  statuses: Status[];
  beasts: BeastState[];
  /** Permanent damage bonus (Beast's Fury +20, Moira's Thread +25). */
  dmgUpPct: number;
  // once-per-fight / trigger flags
  trumpFired: boolean;
  firstBloodTaken: boolean;
  firstBloodDrawn: boolean;
  wasDisarmed: boolean;
  beastFell: boolean;
  critLanded: boolean;
  hitsTaken: number;
  ripostesDone: number;
  countersOrRipostesDone: number;
  landedHits: number;
  usedSecondBreath: boolean;
  usedSkyfall: boolean;
  usedRopeNet: boolean;
  usedWhirl: boolean;
  usedHamstring: boolean;
  usedTwinFangs: boolean;
  moiraSaved: boolean;
  shieldSlamReadyAt: number;
  counterCancelled: boolean; // Close the Gap: foe's first counter cancelled
  attacksMade: number;
}

interface Derived {
  interval: number;
  acc: number;
  eva: number;
  block: number;
  riposte: number;
  combo: number;
  crit: number;
  armour: number;
  disarm: number;
  disarmResist: number;
  reach: number;
  counter: number;
  riposteDmgPct: number;
}

/* ------------------------------------------------------------------ */

function mods(m: Mods | undefined, key: keyof Mods): number {
  return (m && m[key]) || 0;
}

function has(f: Fighter, id: string): boolean {
  return f.snap.skills.includes(id);
}

function heldWeapon(f: Fighter, t: number): WeaponDef {
  if (f.statuses.some((s) => s.kind === "weaponless" && s.until > t)) return fistsFor(f);
  const id = f.queue[f.qIndex];
  return id ? weapon(id) : fistsFor(f);
}

function fistsFor(f: Fighter): WeaponDef {
  if (has(f, "pankration")) {
    return { ...FISTS, dmg: 10, scalePct: 100, interval: 220, mods: { combo: 10 } };
  }
  return FISTS;
}

function shieldDef(f: Fighter, held: WeaponDef): WeaponDef | undefined {
  if (!f.shieldId || f.shieldLost || held.twoHanded) return undefined;
  return weapon(f.shieldId);
}

function derive(f: Fighter, foe: Fighter, t: number): Derived {
  const w = heldWeapon(f, t);
  const sh = shieldDef(f, w);
  const st = STANCES[f.plan.stance];
  const g = f.snap.stats.grace;

  const boonMods: Mods = {};
  for (const id of f.snap.skills) {
    const s = skill(id);
    if (s.kind === "boon" && s.mods) {
      for (const k of Object.keys(s.mods) as (keyof Mods)[]) {
        (boonMods as Record<string, number>)[k] = mods(boonMods, k) + (s.mods[k] ?? 0);
      }
    }
  }

  const sum = (k: keyof Mods) => mods(w.mods, k) + mods(sh?.mods, k) + mods(boonMods, k);

  // Hoplite Drill: +10 Block with an Aspis equipped; +5 without.
  const hoplite = has(f, "hoplite_drill") ? (sh ? 10 : 5) : 0;

  let intervalPct = 100 + st.intervalPct + sum("intervalPct");
  if (has(f, "titan_grip") && w.discipline === "labrys") intervalPct -= 15;
  for (const s of f.statuses) {
    if (s.until <= t) continue;
    if (s.kind === "slow") intervalPct += 15;
    if (s.kind === "hermes") intervalPct -= 40;
  }
  let interval = Math.floor((w.interval * 100) / (100 + 4 * f.snap.stats.tempo));
  interval = Math.max(60, Math.floor((interval * intervalPct) / 100));

  let acc = 80 + 2 * g + st.acc + sum("acc");
  if (foe.beasts.some((b) => b.id === "stymphal_shrike" && !b.down)) acc -= 5;
  let eva = 5 + 2 * g + st.eva + sum("eva");
  let block = st.block + sum("block") + hoplite;
  for (const s of f.statuses) {
    if (s.until <= t) continue;
    if (s.kind === "accDown") acc -= s.amount ?? 0;
    if (s.kind === "guardDown") {
      block -= 15;
      eva -= 15;
    }
    if (s.kind === "hermes") eva += 15;
    if (s.kind === "entangled") {
      block = -999;
      eva = -999;
    }
  }

  return {
    interval,
    acc,
    eva: clamp(eva, 0, 60),
    block: clamp(block, 0, 60),
    riposte: clamp(20 + st.riposte + sum("riposte"), 0, 75),
    combo: clamp(4 + Math.floor((3 * g) / 2) + sum("combo"), 0, 60),
    crit: clamp(5 + st.crit + sum("crit"), 0, 40),
    armour: clamp(st.armour + sum("armour"), 0, 12),
    disarm: sum("disarm"),
    disarmResist: sum("disarmResist"),
    reach: w.reach,
    counter: st.counter + sum("counter"),
    riposteDmgPct: sum("riposteDmgPct"),
  };
}

/* ------------------------------------------------------------------ */

export interface FightInput {
  seed: number;
  attacker: ChampionSnapshot;
  defender: ChampionSnapshot;
}

export function simulateFight(input: FightInput): FightResult {
  const rng = makeRng(input.seed);
  const events: FightEvent[] = [];
  let tick = 0;
  let ended = false;
  let winner: Side = 0;
  let reason: "ko" | "cap" = "ko";
  let attackEvents = 0;

  const make = (snap: ChampionSnapshot, side: Side): Fighter => {
    const hasBond = snap.skills.includes("beast_bond");
    const tax = snap.beasts.reduce(
      (s, id) => s + Math.max(0, beast(id).gritTax - (hasBond ? 1 : 0)),
      0,
    );
    const effGrit = Math.max(1, snap.stats.grit - tax);
    const hpMax = 50 + 6 * effGrit + 2 * snap.level;
    const shieldId = snap.weapons.find((id) => weapon(id).discipline === "aspis");
    const queue = snap.weapons.filter((id) => weapon(id).discipline !== "aspis");
    const f: Fighter = {
      side,
      snap,
      plan: snap.plan,
      hp: hpMax,
      hpMax,
      queue,
      qIndex: 0,
      ammo: 0,
      shieldId,
      shieldLost: false,
      init: 0,
      nextAt: 0,
      nextHealAt: snap.skills.includes("marathon_lungs") ? 500 : Infinity,
      statuses: [],
      beasts: snap.beasts.map((id) => {
        const b = beast(id);
        const hpMaxB = Math.floor((b.hpBase + snap.level) * (hasBond ? 115 : 100) / 100);
        return { id, hp: hpMaxB, hpMax: hpMaxB, nextAt: 0, usedCharge: false, down: false };
      }),
      dmgUpPct: 0,
      trumpFired: false,
      firstBloodTaken: false,
      firstBloodDrawn: false,
      wasDisarmed: false,
      beastFell: false,
      critLanded: false,
      hitsTaken: 0,
      ripostesDone: 0,
      countersOrRipostesDone: 0,
      landedHits: 0,
      usedSecondBreath: false,
      usedSkyfall: false,
      usedRopeNet: false,
      usedWhirl: false,
      usedHamstring: false,
      usedTwinFangs: false,
      moiraSaved: false,
      shieldSlamReadyAt: 0,
      counterCancelled: false,
      attacksMade: 0,
    };
    const w0 = heldWeapon(f, 0);
    f.ammo = w0.ammo ?? 0;
    return f;
  };

  const A = make(input.attacker, 0);
  const B = make(input.defender, 1);
  const both: [Fighter, Fighter] = [A, B];
  const foeOf = (f: Fighter) => (f.side === 0 ? B : A);

  // --- Initiative (§4.2), gambit modifiers included -----------------
  for (const f of both) {
    const w = heldWeapon(f, 0);
    const sh = shieldDef(f, w);
    let gInit = 0;
    if (f.plan.gambit === "close_the_gap") gInit += 20;
    if (f.plan.gambit === "hold_ground") gInit -= 20;
    if (f.plan.gambit === "loose_the_beast") gInit -= 30;
    f.init =
      10 * f.snap.stats.tempo + mods(w.mods, "init") + mods(sh?.mods, "init") + gInit + rng.roll(0, 49);
  }
  events.push({ t: 0, type: "start", init: [A.init, B.init] });
  for (const f of both) {
    events.push({ t: 0, type: "gambit", side: f.side, gambit: f.plan.gambit });
  }

  // First actions (§4.2): max(0, Interval − Initiative); War Cry +60.
  for (const f of both) {
    const d = derive(f, foeOf(f), 0);
    f.nextAt = Math.max(0, d.interval - f.init);
    if (f.plan.gambit === "war_cry") {
      f.nextAt += 60;
      foeOf(f).statuses.push({ kind: "accDown", amount: 8, until: 500 });
      events.push({ t: 0, type: "status", side: foeOf(f).side, what: "War Cry: Accuracy −8" });
    }
    if (f.plan.gambit === "feint") {
      // handled on first attack
    }
    for (const bs of f.beasts) {
      const bd = beast(bs.id);
      let first =
        bs.id === "stymphal_shrike" ? 40 : Math.max(0, bd.interval - (bd.init + rng.roll(0, 49)));
      if (f.plan.gambit === "loose_the_beast") first = Math.max(0, first - 100);
      bs.nextAt = first;
    }
  }

  /* ---------------- helper: damage & death ------------------------- */

  const hurt = (target: Fighter, amount: number, srcSide: Side): number => {
    // Stone Wall: first three hits at −50%.
    if (has(target, "stone_wall") && target.hitsTaken < 3) {
      amount = Math.max(1, Math.floor(amount / 2));
      events.push({ t: tick, type: "technique", side: target.side, skill: "stone_wall" });
    }
    target.hitsTaken++;
    target.hp -= amount;
    if (!target.firstBloodTaken && amount > 0) target.firstBloodTaken = true;
    const dealer = both[srcSide];
    if (dealer && !dealer.firstBloodDrawn && amount > 0) dealer.firstBloodDrawn = true;

    // Moira's Thread death save.
    if (target.hp <= 0 && !target.moiraSaved) {
      const armed = target.plan.trumpSkill === "moiras_thread" && target.trumpFired;
      if (armed) {
        target.hp = 1;
        target.moiraSaved = true;
        target.dmgUpPct += 25;
        events.push({ t: tick, type: "status", side: target.side, what: "Moira's Thread: spared at 1 HP" });
      }
    }
    // Second Breath.
    if (
      !ended &&
      target.hp > 0 &&
      has(target, "second_breath") &&
      !target.usedSecondBreath &&
      target.hp < Math.floor(target.hpMax * 30 / 100)
    ) {
      target.usedSecondBreath = true;
      const healed = Math.floor((target.hpMax - target.hp) * 25 / 100);
      target.hp = Math.min(target.hpMax, target.hp + healed);
      events.push({ t: tick, type: "heal", side: target.side, amount: healed, source: "Second Breath", hp: target.hp });
    }
    if (target.hp <= 0 && !ended) {
      ended = true;
      winner = target.side === 0 ? 1 : 0;
      reason = "ko";
    }
    return amount;
  };

  const hurtBeast = (owner: Fighter, bs: BeastState, amount: number) => {
    const bd = beast(bs.id);
    amount = Math.max(1, amount - bd.armour);
    bs.hp -= amount;
    if (bs.hp <= 0 && !bs.down) {
      bs.down = true;
      owner.beastFell = true;
      events.push({ t: tick, type: "beastDown", side: owner.side, beast: bd.name });
      if (has(owner, "beasts_fury")) {
        owner.dmgUpPct += 20;
        events.push({ t: tick, type: "technique", side: owner.side, skill: "beasts_fury" });
      }
    }
    return amount;
  };

  const wrathActive = (f: Fighter): Status | undefined =>
    f.statuses.find((s) => s.kind === "wrath" && s.until > tick && (s.count ?? 0) > 0);

  /** Damage formula (§4.4): floor((base + floor(stat×scale/100)) × stance% / 100 × roll(85–115) / 100). */
  const rollDamage = (
    f: Fighter,
    w: WeaponDef,
    opts: { crit: boolean; thrown?: boolean; bonusPct?: number },
  ): number => {
    const statVal = w.scaleStat === "grace" ? f.snap.stats.grace : f.snap.stats.might;
    const base = w.dmg + Math.floor((statVal * w.scalePct) / 100);
    let dmg = Math.floor((base * (100 + STANCES[f.plan.stance].dmgPct)) / 100);
    let pct = 100 + f.dmgUpPct + (opts.bonusPct ?? 0);
    if (opts.thrown && has(f, "endless_quiver")) pct += 10;
    const wr = wrathActive(f);
    if (wr) pct += 100;
    dmg = Math.floor((dmg * pct) / 100);
    if (opts.crit) dmg = Math.floor((dmg * 3) / 2);
    dmg = Math.floor((dmg * rng.roll(85, 115)) / 100);
    return Math.max(1, dmg);
  };

  /* ---------------- trump machinery -------------------------------- */

  const trumpCondition = (f: Fighter, trigger: TrumpTrigger): boolean => {
    const foe = foeOf(f);
    switch (trigger) {
      case "first_clash": return true;
      case "first_blood_taken": return f.firstBloodTaken;
      case "first_blood_drawn": return f.firstBloodDrawn;
      case "when_bloodied": return f.hp > 0 && f.hp * 2 < f.hpMax;
      case "deaths_door": return f.hp > 0 && f.hp * 5 < f.hpMax;
      case "foe_bloodied": return foe.hp > 0 && foe.hp * 2 < foe.hpMax;
      case "when_disarmed": return f.wasDisarmed;
      case "beast_falls": return f.beastFell;
      case "first_crit": return f.critLanded;
      case "tenth_exchange": return attackEvents >= 10;
    }
  };

  const fireTrump = (f: Fighter) => {
    const foe = foeOf(f);
    const id = f.plan.trumpSkill!;
    events.push({ t: tick, type: "trump", side: f.side, skill: id, trigger: f.plan.trumpTrigger! });
    switch (id) {
      case "wrath_of_herakles":
        f.statuses.push({ kind: "wrath", until: tick + 400, count: 3 });
        break;
      case "aegis_of_dawn":
        f.statuses.push({ kind: "aegis", until: tick + 600 });
        break;
      case "gorgons_glare":
        foe.nextAt = Math.max(foe.nextAt, tick + 250);
        events.push({ t: tick, type: "status", side: foe.side, what: "Frozen for 250 ticks" });
        break;
      case "chirons_mending": {
        const healed = Math.floor((f.hpMax - f.hp) * 40 / 100);
        f.hp = Math.min(f.hpMax, f.hp + healed);
        f.statuses = f.statuses.filter((s) => s.kind !== "slow" && s.kind !== "entangled");
        events.push({ t: tick, type: "heal", side: f.side, amount: healed, source: "Chiron's Mending", hp: f.hp });
        break;
      }
      case "hermes_rush":
        f.statuses.push({ kind: "hermes", until: tick + 500 });
        break;
      case "brontes_bolt": {
        const dmg = 20 + Math.floor(f.snap.stats.grace / 2);
        const dealt = hurt(foe, dmg, f.side); // ignores armour by construction
        events.push({ t: tick, type: "hit", side: f.side, amount: dealt, crit: false, combo: 0, targetHp: foe.hp, target: { kind: "champion" } });
        foe.beasts.forEach((bs, i) => {
          if (!bs.down) {
            hurtBeast(foe, bs, dmg + beast(bs.id).armour); // net = full dmg (ignores armour)
            events.push({ t: tick, type: "hit", side: f.side, amount: dmg, crit: false, combo: 0, targetHp: Math.max(0, bs.hp), target: { kind: "beast", index: i } });
          }
        });
        break;
      }
      case "cast_down": {
        const held = heldWeapon(foe, tick);
        if (held.id !== "fists" && !(has(foe, "titan_grip") && held.discipline === "labrys")) {
          events.push({ t: tick, type: "disarm", side: foe.side, weapon: held.name });
          foe.qIndex++;
          foe.wasDisarmed = true;
          foe.statuses.push({ kind: "weaponless", until: tick + 300 });
          const next = heldWeapon(foe, tick + 300);
          foe.ammo = next.ammo ?? 0;
        }
        break;
      }
      case "moiras_thread":
        // Passive arm: the save is checked in hurt(). Nothing visible now.
        events.push({ t: tick, type: "status", side: f.side, what: "A thread glimmers — Moira watches" });
        break;
    }
  };

  const checkTrumps = () => {
    // Checked after every resolved event, both sides, initiative order (§4.7.3).
    const order = A.init >= B.init ? [A, B] : [B, A];
    for (const f of order) {
      if (ended && f.plan.trumpSkill !== "moiras_thread") continue;
      if (f.trumpFired || !f.plan.trumpSkill || !f.plan.trumpTrigger) continue;
      if (f.hp <= 0) continue;
      if (trumpCondition(f, f.plan.trumpTrigger)) {
        f.trumpFired = true;
        fireTrump(f);
      }
    }
  };
  checkTrumps(); // "At the First Clash" fires immediately after initiative.

  /* ---------------- attack resolution (§4.5) ------------------------ */

  const drawNext = (f: Fighter) => {
    f.qIndex++;
    const w = heldWeapon(f, tick);
    f.ammo = w.ammo ?? 0;
    events.push({ t: tick, type: "draw", side: f.side, weapon: w.name });
  };

  /** One swing (or throw) against the enemy champion or an intercepting beast. */
  const resolveAttack = (att: Fighter, forced?: { weapon: WeaponDef; thrown: boolean; oneShot?: boolean }) => {
    const def = foeOf(att);
    let w = forced?.weapon ?? heldWeapon(att, tick);
    let thrown = forced?.thrown ?? (w.discipline === "akontia");
    att.attacksMade++;
    attackEvents++;

    // Rope and Net (§5.3): first attack after tick 300, once per fight.
    if (has(att, "rope_and_net") && !att.usedRopeNet && tick >= 300) {
      att.usedRopeNet = true;
      def.statuses.push({ kind: "entangled", until: tick + 200 });
      def.nextAt = Math.max(def.nextAt, tick + 200);
      events.push({ t: tick, type: "technique", side: att.side, skill: "rope_and_net" });
    }

    // Whirl of Bronze: replaces the swing when facing 2+ enemies.
    if (has(att, "whirl_of_bronze") && !att.usedWhirl && def.beasts.some((b) => !b.down)) {
      att.usedWhirl = true;
      const dmg = 8 + Math.floor(att.snap.stats.might / 2);
      events.push({ t: tick, type: "technique", side: att.side, skill: "whirl_of_bronze", amount: dmg });
      const dealt = hurt(def, Math.max(1, dmg - derive(def, att, tick).armour), att.side);
      events.push({ t: tick, type: "hit", side: att.side, amount: dealt, crit: false, combo: 0, targetHp: def.hp, target: { kind: "champion" } });
      def.beasts.forEach((bs, i) => {
        if (!bs.down) {
          const net = hurtBeast(def, bs, dmg);
          events.push({ t: tick, type: "hit", side: att.side, amount: net, crit: false, combo: 0, targetHp: Math.max(0, bs.hp), target: { kind: "beast", index: i } });
        }
      });
      checkTrumps();
      return;
    }

    // Interception by beasts (prototype rule; Nemean guardian is canon 30%).
    let beastTarget: { bs: BeastState; index: number } | undefined;
    const living = def.beasts.map((bs, index) => ({ bs, index })).filter((x) => !x.bs.down);
    if (living.length > 0) {
      const cub = living.find((x) => x.bs.id === "nemean_cub");
      if (cub && rng.pct(30)) beastTarget = cub;
      else if (rng.pct(25)) beastTarget = living[rng.int(living.length)];
    }

    events.push({
      t: tick,
      type: "attack",
      side: att.side,
      weapon: w.name,
      thrown: thrown || undefined,
      target: beastTarget ? { kind: "beast", index: beastTarget.index } : { kind: "champion" },
    });

    const dAtt = derive(att, def, tick);

    // Counter (§4.6): melee only, champion target only, strictly longer defender reach.
    if (!thrown && !beastTarget) {
      const dDef = derive(def, att, tick);
      const diff = dDef.reach - dAtt.reach;
      if (diff > 0 && def.hp > 0 && !def.statuses.some((s) => s.kind === "entangled" && s.until > tick)) {
        if (att.plan.gambit === "close_the_gap" && !def.counterCancelled) {
          def.counterCancelled = true;
          events.push({ t: tick, type: "status", side: def.side, what: "Counter denied — the gap is closed" });
        } else {
          const chance = clamp(8 * diff + dDef.counter, 0, 50);
          if (rng.pct(chance)) {
            const dw = heldWeapon(def, tick);
            let bonus = 0;
            if (def.plan.gambit === "hold_ground" && def.countersOrRipostesDone === 0 && tick <= 600) bonus += 30;
            const crit = rng.pct(dDef.crit);
            let dmg = rollDamage(def, dw, { crit, bonusPct: bonus });
            dmg = Math.max(1, dmg - dAtt.armour);
            def.countersOrRipostesDone++;
            const wr = wrathActive(def);
            if (wr) wr.count = (wr.count ?? 1) - 1;
            const dealt = hurt(att, dmg, def.side);
            events.push({ t: tick, type: "counter", side: def.side, amount: dealt, targetHp: att.hp });
            checkTrumps();
            if (ended || att.hp <= 0) return;
          }
        }
      }
    }

    // Ammo bookkeeping for real thrown weapons.
    if (!forced && thrown) {
      att.ammo--;
    }

    // --- Hit roll --------------------------------------------------
    let chain = 0;
    let prevDmg = 0;
    let firstComboExtended = false;
    let guaranteedChain = 0;

    const target = beastTarget;
    const doOneHit = (comboPos: number): "stop" | "chained" => {
      const dDefNow = target ? undefined : derive(def, att, tick);

      // Evade / miss.
      if (target) {
        const bd = beast(target.bs.id);
        const hitChance = clamp(dAtt.acc - bd.evasion, 5, 95);
        if (!rng.pct(hitChance)) {
          events.push({ t: tick, type: "evade", side: def.side });
          return "stop";
        }
      } else {
        const hitChance = clamp(dAtt.acc - dDefNow!.eva, 5, 95);
        if (!rng.pct(hitChance)) {
          events.push({ t: tick, type: "miss", side: att.side });
          return "stop";
        }
      }

      // Block (champion target only; beasts do not block).
      if (!target) {
        const wr = wrathActive(att);
        const unblockable = !!wr;
        const aegis = def.statuses.some((s) => s.kind === "aegis" && s.until > tick) && !thrown;
        const blocked = !unblockable && (aegis || rng.pct(dDefNow!.block));
        if (blocked) {
          const crit = false;
          let raw = rollDamage(att, w, { crit, thrown });
          raw = Math.max(1, raw - (thrown ? 0 : dDefNow!.armour));
          const chip = att.plan.stance === "measured" ? Math.max(1, Math.floor(raw / 4)) : 0;
          if (chip > 0) hurt(def, chip, att.side);
          events.push({ t: tick, type: "block", side: def.side, chip });
          checkTrumps();
          if (ended) return "stop";

          // Shield Slam (defender technique).
          if (
            has(def, "shield_slam") &&
            shieldDef(def, heldWeapon(def, tick)) &&
            tick >= def.shieldSlamReadyAt &&
            rng.pct(40)
          ) {
            def.shieldSlamReadyAt = tick + 400;
            const dw = heldWeapon(def, tick);
            const slam = Math.max(1, Math.floor(rollDamage(def, dw, { crit: false }) * 60 / 100) - dAtt.armour);
            att.nextAt += 80;
            const dealt = hurt(att, slam, def.side);
            events.push({ t: tick, type: "technique", side: def.side, skill: "shield_slam", amount: dealt });
            checkTrumps();
            if (ended) return "stop";
          }

          // Riposte roll.
          if (def.hp > 0 && rng.pct(dDefNow!.riposte)) {
            const dw = heldWeapon(def, tick);
            let bonus = dDefNow!.riposteDmgPct;
            if (def.plan.gambit === "hold_ground" && def.countersOrRipostesDone === 0 && tick <= 600) bonus += 30;
            let dmg = rollDamage(def, dw, { crit: false, bonusPct: bonus });
            if (has(def, "perfect_riposte") && def.ripostesDone === 0) dmg *= 2;
            dmg = Math.max(1, dmg - dAtt.armour);
            def.ripostesDone++;
            def.countersOrRipostesDone++;
            const wrD = wrathActive(def);
            if (wrD) wrD.count = (wrD.count ?? 1) - 1;
            const dealt = hurt(att, dmg, def.side);
            events.push({ t: tick, type: "riposte", side: def.side, amount: dealt, targetHp: att.hp });
            checkTrumps();
            if (ended || att.hp <= 0) return "stop";
          }
          return "stop";
        }
      }

      // Damage.
      const crit = rng.pct(dAtt.crit);
      let bonusPct = comboPos > 0 ? -Math.round(100 - Math.pow(0.85, comboPos) * 100) : 0;
      // vsBeasts25: Boar Spear +25% against beasts.
      if (target && w.special === "vsBeasts25") bonusPct += 25;
      let dmg = rollDamage(att, w, { crit, thrown, bonusPct });
      if (comboPos > 0 && prevDmg > 0) dmg = Math.min(dmg, Math.max(1, Math.floor(prevDmg * 85 / 100)));
      prevDmg = dmg;

      const wr = wrathActive(att);
      if (wr) wr.count = (wr.count ?? 1) - 1;

      if (target) {
        const net = hurtBeast(def, target.bs, dmg);
        events.push({ t: tick, type: "hit", side: att.side, amount: net, crit, combo: comboPos, targetHp: Math.max(0, target.bs.hp), target: { kind: "beast", index: target.index } });
      } else {
        const net = Math.max(1, dmg - (thrown ? 0 : derive(def, att, tick).armour));
        const dealt = hurt(def, net, att.side);
        events.push({ t: tick, type: "hit", side: att.side, amount: dealt, crit, combo: comboPos, targetHp: def.hp, target: { kind: "champion" } });
      }
      att.landedHits++;

      if (crit && !att.critLanded) att.critLanded = true;
      if (crit && has(att, "hamstring") && !att.usedHamstring) {
        att.usedHamstring = true;
        def.statuses.push({ kind: "slow", until: tick + 400 });
        events.push({ t: tick, type: "technique", side: att.side, skill: "hamstring" });
      }
      if (crit && w.special === "critDelay80") {
        def.nextAt += 80;
        events.push({ t: tick, type: "status", side: def.side, what: "Staggered — next action delayed" });
      }

      // Disarm rider (champion target only).
      if (!target && !thrown && def.hp > 0) {
        let dis = dAtt.disarm;
        if (att.plan.gambit === "test_the_shield" && att.landedHits <= 3) dis *= 2;
        const dDefNow2 = derive(def, att, tick);
        const chance = clamp(dis - dDefNow2.disarmResist, 0, 70);
        if (chance > 0 && rng.pct(chance)) {
          const held = heldWeapon(def, tick);
          if (held.id !== "fists" && !(has(def, "titan_grip") && held.discipline === "labrys")) {
            events.push({ t: tick, type: "disarm", side: def.side, weapon: held.name });
            def.wasDisarmed = true;
            drawNext(def);
          } else if (shieldDef(def, held)) {
            def.shieldLost = true;
            events.push({ t: tick, type: "disarm", side: def.side, weapon: weapon(def.shieldId!).name });
          }
        }
      }

      checkTrumps();
      if (ended) return "stop";

      // Combo roll (chain cap 3 chained hits; Twin Fangs +2 guaranteed).
      if (chain < 3) {
        let chained = rng.pct(dAtt.combo);
        if (!chained && guaranteedChain > 0) {
          chained = true;
          guaranteedChain--;
        }
        if (chained && !firstComboExtended && has(att, "twin_fangs") && !att.usedTwinFangs) {
          att.usedTwinFangs = true;
          firstComboExtended = true;
          guaranteedChain += 2;
        }
        if (chained) {
          chain++;
          return "chained";
        }
      }
      return "stop";
    };

    // Feint: first attack deals 0 damage, foe guard drops.
    if (att.plan.gambit === "feint" && att.attacksMade === 1) {
      def.statuses.push({ kind: "guardDown", until: tick + 300 });
      events.push({ t: tick, type: "technique", side: att.side, skill: "feint" as never });
      events.push({ t: tick, type: "status", side: def.side, what: "Feinted — guard down 300 ticks" });
      checkTrumps();
    } else {
      let step = doOneHit(0);
      while (step === "chained" && !ended) step = doOneHit(chain);
    }

    // One-shot melee throw (Hurl First without an Akontion): weapon is lost.
    if (forced?.oneShot) {
      const idx = att.queue.indexOf(w.id);
      if (idx >= 0) {
        att.queue.splice(idx, 1);
        if (att.qIndex >= att.queue.length) att.qIndex = Math.max(0, att.queue.length - 1);
      }
      const now = heldWeapon(att, tick);
      att.ammo = now.ammo ?? 0;
      events.push({ t: tick, type: "draw", side: att.side, weapon: now.name });
    } else if (thrown && att.ammo <= 0 && heldWeapon(att, tick).discipline === "akontia") {
      drawNext(att);
    }

    // Skyfall: after your action, if the foe fell below 35%.
    if (
      !ended &&
      has(att, "skyfall") &&
      !att.usedSkyfall &&
      def.hp > 0 &&
      def.hp * 100 < def.hpMax * 35
    ) {
      att.usedSkyfall = true;
      const dw = heldWeapon(att, tick);
      const dmg = Math.max(1, Math.floor(rollDamage(att, dw, { crit: false }) * 150 / 100) - derive(def, att, tick).armour);
      const dealt = hurt(def, dmg, att.side);
      events.push({ t: tick, type: "technique", side: att.side, skill: "skyfall", amount: dealt });
      events.push({ t: tick, type: "hit", side: att.side, amount: dealt, crit: false, combo: 0, targetHp: def.hp, target: { kind: "champion" } });
      checkTrumps();
    }
  };

  /* ---------------- beast actions ---------------------------------- */

  const beastAct = (owner: Fighter, bs: BeastState) => {
    const bd = beast(bs.id);
    const def = foeOf(owner);
    const dDef = derive(def, owner, tick);
    const hitChance = clamp(85 - dDef.eva, 5, 95);
    if (rng.pct(hitChance)) {
      let dmg = rng.roll(bd.dmgMin, bd.dmgMax);
      if (bs.id === "kalydon_boar" && !bs.usedCharge) {
        bs.usedCharge = true;
        dmg = Math.floor(dmg * 150 / 100);
      }
      if (bs.id === "lykos") {
        const packmates = owner.beasts.filter((x) => x.id === "lykos" && !x.down).length - 1;
        if (packmates > 0) dmg = Math.floor(dmg * (100 + 5 * packmates) / 100);
      }
      dmg = Math.max(1, dmg - dDef.armour);
      const dealt = hurt(def, dmg, owner.side);
      events.push({ t: tick, type: "beastAttack", side: owner.side, beast: bd.name, amount: dealt, targetHp: def.hp });
      checkTrumps();
    } else {
      events.push({ t: tick, type: "beastAttack", side: owner.side, beast: bd.name, amount: 0, targetHp: def.hp });
    }
    bs.nextAt = tick + bd.interval;
  };

  /* ---------------- Hurl First openings ---------------------------- */

  const openingThrow = (f: Fighter) => {
    if (f.plan.gambit !== "hurl_first" || ended) return;
    const akIdx = f.queue.findIndex((id) => weapon(id).discipline === "akontia");
    if (akIdx >= 0) {
      const ak = weapon(f.queue[akIdx]!);
      // Consume one shot from that akontia without changing draw order.
      resolveAttack(f, { weapon: ak, thrown: true });
    } else {
      const held = heldWeapon(f, tick);
      if (held.id !== "fists") {
        resolveAttack(f, { weapon: held, thrown: true, oneShot: true });
      } else {
        resolveAttack(f);
      }
    }
  };

  /* ---------------- main loop -------------------------------------- */

  const firstActed: [boolean, boolean] = [false, false];

  while (!ended && tick <= TICK_CAP) {
    // Next scheduled thing: champion actions, beast actions, heal pulses.
    let next = Infinity;
    for (const f of both) {
      next = Math.min(next, f.nextAt, f.nextHealAt);
      for (const bs of f.beasts) if (!bs.down) next = Math.min(next, bs.nextAt);
    }
    if (next === Infinity || next > TICK_CAP) break;
    tick = next;

    // Heal pulses first (deterministic order: side 0 then 1).
    for (const f of both) {
      if (f.nextHealAt === tick && !ended) {
        const healed = Math.min(f.hpMax - f.hp, 3 + Math.floor(f.snap.stats.grit / 2));
        if (healed > 0) {
          f.hp += healed;
          events.push({ t: tick, type: "heal", side: f.side, amount: healed, source: "Marathon Lungs", hp: f.hp });
        }
        f.nextHealAt = tick + 500;
      }
    }
    if (ended) break;

    // Actors due this tick, initiative order (§4.2 simultaneity).
    const due: Array<{ init: number; act: () => void }> = [];
    for (const f of both) {
      if (f.nextAt === tick) {
        due.push({
          init: f.init,
          act: () => {
            if (ended || f.hp <= 0) return;
            if (!firstActed[f.side]) {
              firstActed[f.side] = true;
              openingThrow(f);
              if (f.plan.gambit !== "hurl_first") resolveAttack(f);
            } else {
              resolveAttack(f);
            }
            f.nextAt = tick + derive(f, foeOf(f), tick).interval;
          },
        });
      }
      for (const bs of f.beasts) {
        if (!bs.down && bs.nextAt === tick) {
          due.push({
            init: beast(bs.id).init,
            act: () => {
              if (!ended && !bs.down && f.hp > 0) beastAct(f, bs);
              else bs.nextAt = tick + beast(bs.id).interval;
            },
          });
        }
      }
    }
    due.sort((a, b) => b.init - a.init || rng.int(2) - 0.5);
    for (const d of due) {
      if (ended) break;
      d.act();
    }
  }

  if (!ended) {
    // Tick cap (§4.1): higher remaining HP percentage wins; ties → initiative.
    reason = "cap";
    const pa = A.hp * B.hpMax;
    const pb = B.hp * A.hpMax;
    winner = pa > pb ? 0 : pb > pa ? 1 : A.init >= B.init ? 0 : 1;
    tick = TICK_CAP;
  }

  events.push({ t: tick, type: "end", winner, reason });

  return {
    simVersion: SIM_VERSION,
    seed: input.seed,
    winner,
    reason,
    ticks: tick,
    hp: [Math.max(0, A.hp), Math.max(0, B.hp)],
    hpMax: [A.hpMax, B.hpMax],
    events,
    snapshots: [input.attacker, input.defender],
  };
}

/** HP formula (00-vision.md §5): 50 + 6 × effective Grit + 2 × level. */
export function maxHp(level: number, grit: number, beastIds: string[], hasBond: boolean): number {
  const tax = beastIds.reduce((s, id) => s + Math.max(0, beast(id).gritTax - (hasBond ? 1 : 0)), 0);
  return 50 + 6 * Math.max(1, grit - tax) + 2 * level;
}
