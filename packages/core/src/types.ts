/** Shared types for the AGOGE deterministic sim core. */

export type StatName = "might" | "grace" | "tempo" | "grit";

export interface Stats {
  might: number;
  grace: number;
  tempo: number;
  grit: number;
}

export type Discipline =
  | "doru"
  | "xiphos"
  | "cestus"
  | "labrys"
  | "akontia"
  | "aspis";

/** Modifier bundle — every value defaults to 0 when absent. */
export interface Mods {
  init?: number;
  counter?: number;
  acc?: number;
  eva?: number;
  block?: number;
  combo?: number;
  crit?: number;
  disarm?: number;
  disarmResist?: number;
  armour?: number;
  riposte?: number;
  /** Extra riposte damage, percent (Makhaira +25, Spiked Aspis +30). */
  riposteDmgPct?: number;
  /** Interval multiplier delta, percent (+10 = 10% slower). */
  intervalPct?: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  discipline: Discipline;
  /** Base damage (shields: 0). */
  dmg: number;
  scaleStat: "might" | "grace";
  /** Stat scaling, percent. */
  scalePct: number;
  /** Base attack interval in ticks (shields: 0 = not a held weapon). */
  interval: number;
  /** Reach 0-3 (§4.6). Shields/thrown use 0. */
  reach: number;
  twoHanded?: boolean;
  /** Thrown weapons only: shots before switching to the next weapon. */
  ammo?: number;
  mods?: Mods;
  /** Free-text rule hook understood by the sim (see fight.ts). */
  special?: "vsBeasts25" | "critDelay80";
  flavour: string;
}

export type SkillKind = "boon" | "technique" | "trump";

export interface SkillDef {
  id: string;
  name: string;
  kind: SkillKind;
  text: string;
  /** Boons only: passive modifier bundle applied at derive time. */
  mods?: Mods;
}

export interface BeastDef {
  id: string;
  name: string;
  gritTax: number;
  /** HP = base + level. */
  hpBase: number;
  dmgMin: number;
  dmgMax: number;
  interval: number;
  evasion: number;
  armour: number;
  init: number;
  flavour: string;
}

export interface OmenDef {
  id: string;
  name: string;
  epithet: string;
  startingWeapons: string[];
  bonus: Stats;
}

export type Stance = "aggressive" | "measured" | "guarded";

export type GambitId =
  | "hurl_first"
  | "close_the_gap"
  | "hold_ground"
  | "feint"
  | "loose_the_beast"
  | "test_the_shield"
  | "war_cry";

export type TrumpTrigger =
  | "first_clash"
  | "first_blood_taken"
  | "first_blood_drawn"
  | "when_bloodied"
  | "deaths_door"
  | "foe_bloodied"
  | "when_disarmed"
  | "beast_falls"
  | "first_crit"
  | "tenth_exchange";

export interface BattlePlan {
  stance: Stance;
  gambit: GambitId;
  /** Must be an owned trump skill id; undefined = no trump armed. */
  trumpSkill?: string;
  trumpTrigger?: TrumpTrigger;
}

/** Immutable combatant snapshot stored on the fight record (04 §3.5). */
export interface ChampionSnapshot {
  name: string;
  epithet: string;
  level: number;
  stats: Stats;
  /** Carried weapons in player-authored draw order (§7.1). */
  weapons: string[];
  skills: string[];
  beasts: string[];
  plan: BattlePlan;
}

/* ------------------------------------------------------------------ */
/* Fight events — the deterministic log the client replays.            */
/* ------------------------------------------------------------------ */

export type Side = 0 | 1;

export type FightEvent =
  | { t: number; type: "start"; init: [number, number] }
  | { t: number; type: "gambit"; side: Side; gambit: GambitId }
  | { t: number; type: "draw"; side: Side; weapon: string }
  | {
      t: number;
      type: "attack";
      side: Side;
      weapon: string;
      thrown?: boolean;
      /** Target: champion or a beast index on the defending side. */
      target: { kind: "champion" } | { kind: "beast"; index: number };
    }
  | { t: number; type: "miss"; side: Side }
  | { t: number; type: "evade"; side: Side }
  | { t: number; type: "block"; side: Side; chip: number }
  | {
      t: number;
      type: "hit";
      side: Side; // side DEALING the damage
      amount: number;
      crit: boolean;
      combo: number; // 0 = first hit, 1..n = chain position
      targetHp: number;
      target: { kind: "champion" } | { kind: "beast"; index: number };
    }
  | { t: number; type: "counter"; side: Side; amount: number; targetHp: number }
  | { t: number; type: "riposte"; side: Side; amount: number; targetHp: number }
  | { t: number; type: "disarm"; side: Side; weapon: string }
  | { t: number; type: "trump"; side: Side; skill: string; trigger: TrumpTrigger }
  | { t: number; type: "technique"; side: Side; skill: string; amount?: number }
  | { t: number; type: "heal"; side: Side; amount: number; source: string; hp: number }
  | { t: number; type: "beastAttack"; side: Side; beast: string; amount: number; targetHp: number }
  | { t: number; type: "beastDown"; side: Side; beast: string }
  | { t: number; type: "status"; side: Side; what: string }
  | { t: number; type: "end"; winner: Side; reason: "ko" | "cap" };

export interface FightResult {
  simVersion: number;
  seed: number;
  winner: Side;
  reason: "ko" | "cap";
  ticks: number;
  hp: [number, number];
  hpMax: [number, number];
  events: FightEvent[];
  snapshots: [ChampionSnapshot, ChampionSnapshot];
}

/* ------------------------------------------------------------------ */
/* Progression                                                         */
/* ------------------------------------------------------------------ */

export type FateOffer =
  | { kind: "stat3"; stat: StatName }
  | { kind: "stat21"; main: StatName; minor: StatName }
  | { kind: "weapon"; weapon: string }
  | { kind: "skill"; skill: string }
  | { kind: "beast"; beast: string };

export interface DraftRecord {
  level: number;
  offers: FateOffer[];
  picked: number;
  rerolled: boolean;
}

export interface Champion {
  name: string;
  displayName: string;
  seed: number;
  omen: string;
  epithet: string;
  level: number;
  xp: number;
  stats: Stats;
  weapons: string[];
  skills: string[];
  beasts: string[];
  favour: number;
  tapestry: DraftRecord[];
  /** "Lachesis remembers": declined offers excluded for the next 3 drafts. */
  declined: Array<{ id: string; untilDraft: number }>;
  /** Pity counters (§6.3): drafts since a weapon/skill offer appeared. */
  sinceWeaponOffer: number;
  sinceSkillOffer: number;
  appearance: Appearance;
}

/** Seeded defaults, player-tweakable at the Forge (02-gdd §3.2). */
export interface Appearance {
  /** Shield colour hue. */
  hue: number;
  /** Crest colour hue. */
  hue2: number;
  pose: number;
  /** Skin tone index (0-5). */
  skin: number;
  /** Shield sigil variant (0-3). */
  sigil: number;
  /** Helmet style (0 Corinthian, 1 open cap, 2 bare + laurel band). */
  helm: number;
  /** Armour tint (0 bronze, 1 iron, 2 gold, 3 nightbronze). */
  tint: number;
}
