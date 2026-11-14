/**
 * Card text for all 63 perks (plan 13.4). Every number on a card is read from the content tables
 * of the sim (`CoreApi.content`), never typed here, so a card can only say what the rules do.
 * test/text/perks.test.ts checks every line against its table row.
 *
 * A card has: the kind ("Weapon", "Booster", "Passive", "Move", "Pet"), the rarity word, ONE line
 * of effect in plain words, and cost lines (shown in the action colour). `needsLine` adds the one
 * line "No Blade weapon yet." when a perk waits on something the scrapper does not own.
 */
import { RARITY_OF, api, perkKind } from "@rankzero/core";
import type { CompanionId, ContentTables, PerkId, Rarity, SkillId, WeaponId, WeaponNumbers } from "@rankzero/core";
import { NAMES } from "./names";

export const RARITY_WORD: Readonly<Record<Rarity, string>> = {
  common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", mythic: "Mythic",
};

export type PerkKindWord = "Weapon" | "Booster" | "Passive" | "Move" | "Pet";

export interface PerkText { name: string; kind: PerkKindWord; rarity: Rarity; rarityWord: string; effect: string; costs: string[] }

const sign = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);
const abs = Math.abs;
const uses = (n: number): string => (n === 1 ? "once a bout" : `${n} times a bout`);

/** The weapon stats a card may name, in the order a card lists them. */
export const WEAPON_BONUS_KEYS = ["aim", "pierce", "block", "evade", "riposte", "combo", "disarm", "crit"] as const;
export const WEAPON_BONUS_LABEL: Readonly<Record<(typeof WEAPON_BONUS_KEYS)[number], string>> = {
  aim: "Aim", pierce: "Pierce", block: "Block", evade: "Evade", riposte: "Riposte", combo: "Combo", disarm: "Disarm", crit: "Crit",
};

function weaponText(n: WeaponNumbers, tags: readonly string[]): { effect: string; costs: string[] } {
  const thrown = n.reach === null;
  const bonuses = WEAPON_BONUS_KEYS.map((k) => ({ k, v: n[k] }));
  const plus = bonuses.filter((b) => b.v > 0).sort((p, q) => q.v - p.v).slice(0, 3);
  const minus = bonuses.filter((b) => b.v < 0).sort((p, q) => p.v - q.v);
  const pace = n.tempo <= 75 ? "Fast. " : n.tempo >= 150 ? "Slow. " : "";
  const head = thrown ? `${pace}Thrown for ${n.dmg}, and it keeps coming.` : n.reach === 0 ? `${pace}Hits for ${n.dmg} up close.` : `${pace}Hits for ${n.dmg} at reach ${n.reach}.`;
  const extras = plus.length ? ` ${plus.map((b) => `${WEAPON_BONUS_LABEL[b.k]} ${sign(b.v)}`).join(", ")}.` : "";
  const costs = minus.length ? [minus.map((b) => `${WEAPON_BONUS_LABEL[b.k]} ${b.v}`).join(", ")] : [];
  void tags;
  return { effect: head + extras, costs };
}

type SkillLine = (n: Readonly<Record<string, number>>, move: { weight: number; uses: number } | undefined) => { effect: string; costs?: string[] };

const STAT_WORD = { health: "Health", strength: "Strength", agility: "Agility", speed: "Speed" } as const;
const booster = (stat: keyof typeof STAT_WORD): SkillLine => (n) => ({
  effect: `+${n[stat]} ${STAT_WORD[stat]} now, and every ${STAT_WORD[stat]} point counts ${n[`${stat}Mult`]}% more.`,
});

/** One line per skill. A total Record: a new skill id fails the compiler until it has text. */
export const SKILL_LINES: Readonly<Record<SkillId, SkillLine>> = {
  "big-heart": booster("health"),
  "heavy-hands": booster("strength"),
  "light-feet": booster("agility"),
  "fast-twitch": booster("speed"),
  "glass-cannon": (n) => ({ effect: `Every Strength point counts ${n.strengthMult}% more.`,
    costs: [`Every Health point counts ${abs(n.healthMult!)}% less.`] }),
  "mountain": (n) => ({ effect: `Every Health point counts ${n.healthMult}% more. Stands bigger.`,
    costs: n.agilityMult === n.speedMult
      ? [`Agility and Speed points count ${abs(n.agilityMult!)}% less.`, `Starts slow: ${n.startClock} beats later.`]
      : [`Agility points count ${abs(n.agilityMult!)}% less.`, `Speed points count ${abs(n.speedMult!)}% less.`, `Starts slow: ${n.startClock} beats later.`] }),
  "padding": (n) => ({ effect: `Armor +${n.armor}: every melee hit lands ${n.armor}% softer.` }),
  "anticipation": (n) => ({ effect: `Intercept +${n.intercept}: hits first as an attacker runs in.` }),
  "sharpening-stone": (n) => ({ effect: `Blade weapons deal ${n.bladeDamage}% more melee damage.` }),
  "bare-knuckle": (n) => ({ effect: `Fists deal ${n.fistDamage}% more damage. Combo +${n.unarmedCombo} while unarmed.` }),
  "payback": (n) => ({ effect: `Riposte +${n.riposte}: hits back after being attacked.` }),
  "flurry": (n) => ({ effect: `Combo +${n.combo}: more extra swings in a row.` }),
  "car-door": (n) => ({ effect: `Carries a car door as a shield: Block +${n.block}.`,
    costs: [`Own damage ${n.damage}%. Both end if the door is knocked off.`] }),
  "firm-grip": (n) => ({ effect: `${n.resist}% to keep the weapon against a disarm or a Snatch. Swaps weapons only ${n.swapChance}% of the time.` }),
  "head-start": (n) => ({ effect: `Starts ${abs(n.startClock!)} beats early: often acts first, sometimes twice.` }),
  "sharp-eye": (n) => ({ effect: `Aim +${n.aim} and Pierce +${n.pierce}: harder to dodge and to block.` }),
  "parry": (n) => ({ effect: `Block +${n.block}. After a block, ${n.riposteAfterBlock}% to hit straight back.` }),
  "heavy-lifter": (n) => ({ effect: `Heavy weapons take ${abs(n.heavyTime!)}% less time per turn, with Aim +${n.heavyAim}.` }),
  "pitcher": (n) => ({ effect: `Thrown damage +${n.thrownDamage}%. Throws any weapon ${n.throwChance}% of the time, and it goes back in the bag.` }),
  "plate-vest": (n) => ({ effect: `Armor +${n.armor}: every melee hit lands ${n.armor}% softer.`, costs: [`Speed points count ${abs(n.speedMult!)}% less.`] }),
  "knock-loose": (n) => ({ effect: `Disarm +${n.disarm}: knocks weapons out of hands more often.` }),
  "last-stand": (n) => ({ effect: `${n.saves === 1 ? "Once" : `${n.saves} times`} a bout, a hit that would end it leaves it standing on its last HP.` }),
  "stubborn": (n) => ({ effect: `After a swing is dodged or blocked, ${n.chance}% to swing again at once.` }),
  "slippery": (n) => ({ effect: `Evade +${n.evade}: slips out of more swings.` }),
  "haymaker": (n, m) => ({ effect: `Move: the next swing deals ${n.damageMult}% damage with Crit +${n.crit}. Fires ${uses(m?.uses ?? 1)}, plus once more per ${n.usesPerStrength} Strength.` }),
  "energy-drink": (n, m) => ({ effect: `Move, below ${n.belowHpPct}% HP: drinks up and heals ${n.healMin} to ${n.healMax}% of max HP. Fires ${uses(m?.uses ?? 1)}.` }),
  "tarp": (n, m) => ({ effect: `Move: throws a tarp over an enemy, who skips turns until hit (up to ${n.skips}). Fires ${uses(m?.uses ?? 1)}.` }),
  "whistle": (n, m) => ({ effect: `Move, when a pet drops below ${n.belowHpPct}% HP: heals it ${n.healPct}% and it acts next. Fires ${uses(m?.uses ?? 1)}.` }),
  "firecrackers": (n, m) => ({ effect: `Move: ${n.damageMin} to ${n.damageMax} damage to the enemy scrapper that cannot be dodged; enemy pets lose ${n.companionPct}% HP. Fires ${uses(m?.uses ?? 1)}.` }),
  "snatch": (_n, m) => ({ effect: `Move, when unarmed: grabs the enemy's weapon and uses it. Fires ${uses(m?.uses ?? 1)}.` }),
  "air-horn": (n, m) => ({ effect: `Move: each enemy pet has ${n.fleeChance}% to run off for good, and the enemy loses ${n.clockPush} beats. Fires ${uses(m?.uses ?? 1)}.` }),
  "body-slam": (n, m) => ({ effect: `Move, when unarmed: slams an enemy for ${n.base} plus ${n.perStrength} per Strength, and knocks its weapon away. Fires ${uses(m?.uses ?? 1)}.` }),
};

const PET_WORD: Readonly<Record<CompanionId, string>> = { raccoon: "A raccoon", goose: "A goose", boar: "A boar" };

function petText(id: CompanionId, c: ContentTables): { effect: string; costs: string[] } {
  const d = c.companions[id];
  const limit = d.limit > 1 ? ` Up to ${d.limit}.` : "";
  return { effect: `${PET_WORD[id]} fights beside it: ${d.hp} HP, Strength ${d.strength}, Speed ${d.speed}.${limit}`,
    costs: [`-${d.hpCostPct}% max HP`] };
}

export function perkKindWord(id: PerkId, c: ContentTables = api.content): PerkKindWord {
  const k = perkKind(id);
  if (k === "weapon") return "Weapon";
  if (k === "companion") return "Pet";
  const kind = c.skills[id as SkillId]?.kind;
  return kind === "booster" ? "Booster" : kind === "move" ? "Move" : "Passive";
}

/** The full card text of a perk, from the tables. Never throws: an unknown id gets a plain card. */
export function perkText(id: PerkId, c: ContentTables = api.content): PerkText {
  const rarity: Rarity = RARITY_OF[id] ?? "common";
  const base = { name: NAMES[id] ?? "Something", kind: perkKindWord(id, c), rarity, rarityWord: RARITY_WORD[rarity] };
  const k = perkKind(id);
  if (k === "weapon") {
    const w = c.weapons[id as WeaponId];
    if (!w) return { ...base, effect: "Unknown weapon.", costs: [] };
    return { ...base, ...weaponText(w.tiers[0], w.tags) };
  }
  if (k === "companion") return { ...base, ...petText(id as CompanionId, c) };
  const s = c.skills[id as SkillId];
  const line = SKILL_LINES[id as SkillId];
  if (!s || !line) return { ...base, effect: "Unknown skill.", costs: [] };
  const out = line(s.tiers[0], s.move);
  return { ...base, effect: out.effect, costs: out.costs ?? [] };
}

/** "No Blade weapon yet." when a perk waits on a kind of weapon the kit does not hold. */
export function needsLine(id: PerkId, owned: readonly PerkId[], c: ContentTables = api.content): string | null {
  const weaponTags = owned.filter((p) => perkKind(p) === "weapon").flatMap((p) => c.weapons[p as WeaponId]?.tags ?? []);
  if (id === "sharpening-stone" && !weaponTags.includes("blade")) return "No Blade weapon yet.";
  if (id === "heavy-lifter" && !weaponTags.includes("heavy")) return "No Heavy weapon yet.";
  if (id === "pitcher" && !owned.some((p) => perkKind(p) === "weapon")) return "No weapon yet.";
  if (id === "whistle" && !owned.some((p) => perkKind(p) === "companion")) return "No pet yet.";
  return null;
}

/** Tag words a weapon card prints ("Heavy, Blade"). */
export const TAG_WORD = { light: "Light", heavy: "Heavy", pole: "Pole", thrown: "Thrown", blade: "Blade" } as const;

/** Exact numbers for a perk's detail sheet, label and value, all from the tables. */
export function perkNumbers(id: PerkId, c: ContentTables = api.content): { label: string; value: string }[] {
  const k = perkKind(id);
  if (k === "weapon") {
    const w = c.weapons[id as WeaponId];
    if (!w) return [];
    const n = w.tiers[0];
    const rows = [
      { label: "Damage", value: String(n.dmg) },
      { label: "Reach", value: n.reach === null ? "Thrown" : String(n.reach) },
      { label: "Turn time", value: `${n.tempo}%` },
      ...WEAPON_BONUS_KEYS.filter((b) => n[b] !== 0).map((b) => ({ label: WEAPON_BONUS_LABEL[b], value: sign(n[b]) })),
    ];
    if (w.tags.length) rows.push({ label: "Tags", value: w.tags.map((t) => TAG_WORD[t]).join(", ") });
    return rows;
  }
  if (k === "companion") {
    const d = c.companions[id as CompanionId];
    return [
      { label: "HP", value: String(d.hp) }, { label: "Strength", value: String(d.strength) },
      { label: "Agility", value: String(d.agility) }, { label: "Speed", value: String(d.speed) },
      { label: "Damage", value: String(d.dmg) }, { label: "Combo", value: `${d.combo}` }, { label: "Evade", value: `${d.evade}` },
      { label: "Max HP cost", value: `-${d.hpCostPct}%` },
    ];
  }
  const s = c.skills[id as SkillId];
  if (!s?.move) return [];
  return [{ label: "Uses a bout", value: String(s.move.uses) }, { label: "Pick weight", value: String(s.move.weight) }];
}
