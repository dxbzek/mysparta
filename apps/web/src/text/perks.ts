/**
 * Card text for all 92 perks (plan 13.4, content v2). Every number on a card is read from the content tables
 * of the sim (`CoreApi.content`), never typed here, so a card can only say what the rules do.
 * test/text/perks.test.ts checks every line against its table row.
 *
 * A card has: the kind ("Weapon", "Booster", "Passive", "Move", "Pet", "Shield"), the rarity word, ONE line
 * of effect in plain words, and cost lines (shown in the action colour). `needsLine` adds the one
 * line "No Blade weapon yet." when a perk waits on something the scrapper does not own.
 */
import { RARITY_OF, WEAPON_META, api, perkKind } from "@rankzero/core";
import type { CompanionId, ContentTables, GearId, GearKey, GearNumbers, GearSlot, PerkId, Rarity, ShieldId, ShieldNumbers, SkillId, WeaponId,
  WeaponNumbers } from "@rankzero/core";
import { NAMES } from "./names";

export const RARITY_WORD: Readonly<Record<Rarity, string>> = {
  common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", mythic: "Mythic",
};

export type PerkKindWord = "Weapon" | "Booster" | "Passive" | "Move" | "Pet" | "Shield" | "Gear";

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
  "bare-knuckle": (n) => ({ effect: `Opens every bout with fists and is slow to reach for a weapon: even one of Draw ${n.drawSlack} is only an even chance. Fists deal ${n.fistDamage}% more damage. Combo +${n.unarmedCombo} while unarmed.` }),
  "payback": (n) => ({ effect: `Riposte +${n.riposte}: hits back after being attacked.` }),
  "flurry": (n) => ({ effect: `Combo +${n.combo}: more extra swings in a row.` }),
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
  "quick-swap": (n) => ({ effect: `A turn with a weapon drawn or swapped takes ${abs(n.swapTime!)}% less time. Swaps a used weapon ${n.swapChance}% of the time, and empty hands draw far sooner: even a weapon of Draw ${n.drawSlack} is an even chance.` }),
  "pet-lover": (n) => ({ effect: `Its pets have ${n.petHp}% more HP and hit ${n.petDamage}% harder.` }),
  "junk-collector": (n) => ({ effect: `Throws a used weapon ${n.throwChance}% of the time while another waits in the bag. It comes back to the bag ${n.returnChance}% of the time.` }),
  "trick-shot": (n) => ({ effect: `A Thrown weapon that lands has ${n.ricochet}% to bounce on to another enemy, once a turn.` }),
  "haymaker": (n, m) => ({ effect: `Move: the next swing deals ${n.damageMult}% damage with Crit +${n.crit}. Fires ${uses(m?.uses ?? 1)}, plus once more per ${n.usesPerStrength} Strength.` }),
  "energy-drink": (n, m) => ({ effect: `Move, below ${n.belowHpPct}% HP: drinks up and heals ${n.healMin} to ${n.healMax}% of max HP. Fires ${uses(m?.uses ?? 1)}.` }),
  "tarp": (n, m) => ({ effect: `Move: throws a tarp over an enemy, who skips turns until hit (up to ${n.skips}). Fires ${uses(m?.uses ?? 1)}.` }),
  "whistle": (n, m) => ({ effect: `Move, when a pet drops below ${n.belowHpPct}% HP: heals it ${n.healPct}% and it acts next. Fires ${uses(m?.uses ?? 1)}.` }),
  "firecrackers": (n, m) => ({ effect: `Move: ${n.damageMin} to ${n.damageMax} damage to the enemy scrapper that cannot be dodged; enemy pets lose ${n.companionPct}% HP. Fires ${uses(m?.uses ?? 1)}.` }),
  "snatch": (_n, m) => ({ effect: `Move, when unarmed: grabs the enemy's weapon and uses it. Fires ${uses(m?.uses ?? 1)}.` }),
  "air-horn": (n, m) => ({ effect: `Move: each enemy pet has ${n.fleeChance}% to run off for good, and the enemy loses ${n.clockPush} beats (${n.clockPushNoPet} when it has no pet). Fires ${uses(m?.uses ?? 1)}.` }),
  "body-slam": (n, m) => ({ effect: `Move, when unarmed: slams an enemy for ${n.base} plus ${n.perStrength} per Strength, and knocks its weapon and shield away. Fires ${uses(m?.uses ?? 1)}.` }),
  "sand-in-the-eyes": (n, m) => ({ effect: `Move: throws sand in the enemy scrapper's eyes: its Aim is ${abs(n.aimLoss!)} lower for the rest of the bout. Fires ${uses(m?.uses ?? 1)}.` }),
  "taunt": (n, m) => ({ effect: `Move: goads the enemy and still acts at once: Riposte +${n.riposte} until its next turn. Fires ${uses(m?.uses ?? 1)}.` }),
  "second-wind": (n, m) => ({ effect: `Move, below ${n.belowHpPct}% HP: catches its breath, heals ${n.healPct}% of max HP and acts at once. Fires ${uses(m?.uses ?? 1)}.` }),
  "grapple": (n, m) => ({ effect: `Move, when unarmed: squeezes the enemy scrapper for ${n.base} plus ${n.perStrength} per Strength and holds it: it loses ${n.holds === 1 ? "1 turn" : `${n.holds} turns`}. Fires ${uses(m?.uses ?? 1)}.` }),
};

const PET_WORD: Readonly<Record<CompanionId, string>> = { raccoon: "A raccoon", goose: "A goose", boar: "A boar",
  "stray-dog": "A stray dog", crow: "A crow", "alley-cat": "An alley cat" };

function petText(id: CompanionId, c: ContentTables): { effect: string; costs: string[] } {
  const d = c.companions[id];
  const limit = d.limit > 1 ? ` You can own up to ${d.limit}.` : "";
  const ways = [d.flies ? " It flies: nothing hits it first or hits back at it." : "",
    d.swings > 1 ? " Every attack is two scratches." : "",
    d.disarm >= 15 ? ` Grabs weapons: Disarm ${d.disarm}.` : ""].join("");
  return { effect: `${PET_WORD[id]} fights beside your scrapper: ${d.hp} HP, Strength ${d.strength}, Speed ${d.speed}.${limit}${ways}`,
    costs: [`-${d.hpCostPct}% max HP`] };
}

/** A shield's card: what it adds while it is on the back arm, how it comes off, and its costs. */
function shieldText(n: ShieldNumbers): { effect: string; costs: string[] } {
  const extra = [n.thrownBlock > 0 ? `, and Block +${n.thrownBlock} more against a throw` : "",
    n.riposte > 0 ? `, Riposte +${n.riposte}` : "", n.armor > 0 ? `, Armor +${n.armor}` : ""].join("");
  const effect = `Shield on the back arm, with any weapon in hand: Block +${n.block}${extra}. A slam knocks it off; a hit does ${n.knock}% as often as it disarms.`;
  const costs: string[] = [];
  if (n.damage < 0) costs.push(`Own damage ${n.damage}% while it is on.`);
  if (n.tempo > 0) costs.push(`Turns take ${n.tempo}% longer while it is on.`);
  return { effect, costs };
}

/** Where a piece of gear is worn, in words. */
export const SLOT_WORD: Readonly<Record<GearSlot, string>> = { head: "head", torso: "body", hands: "hands", legs: "legs", feet: "feet" };
const STAT_POINT: Readonly<Partial<Record<GearKey, string>>> = { health: "Health", strength: "Strength", agility: "Agility", speed: "Speed",
  toughness: "Toughness", precision: "Precision", evade: "Evade", block: "Block", aim: "Aim", pierce: "Pierce", intercept: "Intercept",
  riposte: "Riposte", combo: "Combo", disarm: "Disarm", crit: "Crit", armor: "Armor", grip: "Grip" };
/** One gear number in words, from the table (content v3 batch 2). A minus is a cost. */
export function gearLine(key: GearKey, v: number): string {
  const label = STAT_POINT[key];
  if (label !== undefined) return `${label} ${sign(v)}`;
  switch (key) {
    case "soak": return `every swing or throw taken loses ${v} HP`;
    case "headTough": return `Toughness ${sign(v)} against crits (clean blows to the head)`;
    case "critCut": return `crits taken hit x${((150 - v) / 100).toFixed(2).replace(/0$/, "")}, not x1.5`;
    case "sandProof": return "Sand in the Eyes takes no Aim";
    case "petEvade": return `Evade ${sign(v)} against pets`;
    case "fistDmg": return `fists hit ${v}% harder`;
    case "snatchResist": return `${v}% to keep the weapon when it is snatched`;
    case "thrownBlock": return `Block ${sign(v)} against a throw`;
    case "moveSoak": return `Body Slam and Grapple hits taken lose ${v} HP`;
    case "drawEase": return `empty hands draw sooner (Draw S out of S + ${6 - v}, not S + 6)`;
    case "petSoak": return `pet bites taken lose ${v} HP`;
    case "snareCut": return `a tarp holds ${v === 1 ? "1 turn" : `${v} turns`} less`;
    case "startClock": return v < 0 ? `starts ${-v} beats early` : `starts ${v} beats late`;
    default: return `${key} ${sign(v)}`;
  }
}
/** A gear card: where it is worn, its bonus, and its cost (any minus). */
export function gearText(n: GearNumbers, slot: GearSlot): { effect: string; costs: string[] } {
  const rows = (Object.entries(n) as [GearKey, number][]).filter(([, v]) => v !== 0);
  const plus = rows.filter(([k, v]) => v > 0 || k === "startClock");
  const minus = rows.filter(([k, v]) => v < 0 && k !== "startClock");
  const words = plus.map(([k, v]) => gearLine(k, v));
  const effect = `Worn on the ${SLOT_WORD[slot]}: ${words.join(", ")}.`;
  return { effect: effect.charAt(0).toUpperCase() + effect.slice(1), costs: minus.map(([k, v]) => gearLine(k, v)) };
}

export function perkKindWord(id: PerkId, c: ContentTables = api.content): PerkKindWord {
  const k = perkKind(id);
  if (k === "gear") return "Gear";
  if (k === "weapon") return "Weapon";
  if (k === "companion") return "Pet";
  if (k === "shield") return "Shield";
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
  if (k === "shield") {
    const sh = c.shields[id as ShieldId];
    if (!sh) return { ...base, effect: "Unknown shield.", costs: [] };
    return { ...base, ...shieldText(sh.tiers[0]) };
  }
  if (k === "gear") {
    const g = c.gear[id as GearId];
    if (!g) return { ...base, effect: "Unknown gear.", costs: [] };
    return { ...base, ...gearText(g.tiers[0], g.slot) };
  }
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
  if (id === "pet-lover" && !owned.some((p) => perkKind(p) === "companion")) return "No pet yet.";
  if (id === "trick-shot" && !weaponTags.includes("thrown")) return "No Thrown weapon yet.";
  if (id === "junk-collector" && owned.filter((p) => perkKind(p) === "weapon").length < 2) return "Needs two weapons.";
  if (perkKind(id) === "shield" && owned.some((p) => p !== id && perkKind(p) === "shield")) return "Already carries a shield.";
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
  if (k === "shield") {
    const sh = c.shields[id as ShieldId];
    if (!sh) return [];
    const n = sh.tiers[0];
    const rows = [{ label: "Block", value: sign(n.block) }];
    if (n.thrownBlock !== 0) rows.push({ label: "Block against a throw", value: sign(n.thrownBlock) });
    if (n.riposte !== 0) rows.push({ label: "Riposte", value: sign(n.riposte) });
    if (n.armor !== 0) rows.push({ label: "Armor", value: sign(n.armor) });
    if (n.damage !== 0) rows.push({ label: "Own damage", value: `${n.damage}%` });
    if (n.tempo !== 0) rows.push({ label: "Turn time", value: `+${n.tempo}%` });
    rows.push({ label: "Knocked off", value: `${n.knock}% of Disarm` });
    return rows;
  }
  if (k === "gear") {
    const g = c.gear[id as GearId];
    if (!g) return [];
    return [{ label: "Worn on", value: SLOT_WORD[g.slot] },
      ...(Object.entries(g.tiers[0]) as [GearKey, number][]).filter(([, v]) => v !== 0).map(([k, v]) => ({ label: v < 0 && k !== "startClock" ? "Cost" : "Bonus", value: gearLine(k, v) }))];
  }
  const s = c.skills[id as SkillId];
  if (!s?.move) return [];
  return [{ label: "Uses a bout", value: String(s.move.uses) }, { label: "Pick weight", value: String(s.move.weight) }];
}

/* ------------------------------------------------------------------ short lines (Inventory) */

type ShortLine = (n: Readonly<Record<string, number>>) => string;
const boost = (stat: keyof typeof STAT_WORD): ShortLine => (n) => `${STAT_WORD[stat]} +${n[stat]}, every point +${n[`${stat}Mult`]}%`;
const times = (n: number): string => (n === 1 ? "once" : `${n} times`);
const asHard = (pct: number): string => (pct === 200 ? "twice as hard" : pct === 300 ? "three times as hard" : `at ${pct}%`);

/**
 * The short effect line of a skill, for an Inventory tile (two lines at most on a 390 px phone).
 * Every number is read from the same table row as the card line. A total Record, like SKILL_LINES.
 */
export const SKILL_SHORT: Readonly<Record<SkillId, ShortLine>> = {
  "big-heart": boost("health"),
  "heavy-hands": boost("strength"),
  "light-feet": boost("agility"),
  "fast-twitch": boost("speed"),
  "glass-cannon": (n) => `Strength points +${n.strengthMult}%, Health points ${sign(n.healthMult!)}%`,
  "mountain": (n) => `Health points +${n.healthMult}%, but starts slow`,
  "padding": (n) => `Armor +${n.armor}: melee hits land softer`,
  "anticipation": (n) => `Intercept +${n.intercept}: hits first as they run in`,
  "sharpening-stone": (n) => `Blade weapons hit ${n.bladeDamage}% harder`,
  "bare-knuckle": (n) => `Opens with fists: they hit ${n.fistDamage}% harder`,
  "payback": (n) => `Riposte +${n.riposte}: hits back after an attack`,
  "flurry": (n) => `Combo +${n.combo}: more swings in a row`,
  "firm-grip": (n) => `${n.resist}% to keep its weapon in a disarm`,
  "head-start": (n) => `Starts ${abs(n.startClock!)} beats early`,
  "sharp-eye": (n) => `Aim +${n.aim}, Pierce +${n.pierce}: harder to dodge`,
  "parry": (n) => `Block +${n.block}, ${n.riposteAfterBlock}% to hit straight back`,
  "heavy-lifter": (n) => `Heavy weapons ${abs(n.heavyTime!)}% quicker, Aim +${n.heavyAim}`,
  "pitcher": (n) => `Throws hit ${n.thrownDamage}% harder, any weapon flies`,
  "plate-vest": (n) => `Armor +${n.armor}, Speed points ${sign(n.speedMult!)}%`,
  "knock-loose": (n) => `Disarm +${n.disarm}: knocks weapons loose`,
  "last-stand": (n) => `Survives a finishing hit ${times(n.saves!)} a bout`,
  "stubborn": (n) => `${n.chance}% to swing again after a miss`,
  "slippery": (n) => `Evade +${n.evade}: slips out of swings`,
  "quick-swap": (n) => `Draw or swap turns ${abs(n.swapTime!)}% quicker`,
  "pet-lover": (n) => `Pets get +${n.petHp}% HP and hit ${n.petDamage}% harder`,
  "junk-collector": (n) => `A thrown-away weapon comes back ${n.returnChance}%`,
  "trick-shot": (n) => `A landed throw bounces on ${n.ricochet}%`,
  "haymaker": (n) => `Next swing hits ${asHard(n.damageMult!)}, Crit +${n.crit}`,
  "energy-drink": (n) => `Below ${n.belowHpPct}% HP: heals ${n.healMin} to ${n.healMax}%`,
  "tarp": (n) => `Tarps an enemy: it skips up to ${n.skips} turns`,
  "whistle": (n) => `Heals a hurt pet ${n.healPct}% and it acts next`,
  "firecrackers": (n) => `${n.damageMin} to ${n.damageMax} damage that cannot be dodged`,
  "snatch": () => "Unarmed: grabs the enemy's weapon",
  "air-horn": (n) => `Enemy pets ${n.fleeChance}% run off; no pet: acts later`,
  "body-slam": (n) => `Slams for ${n.base} plus Strength, knocks gear away`,
  "sand-in-the-eyes": (n) => `Enemy Aim -${abs(n.aimLoss!)} for the rest of the bout`,
  "taunt": (n) => `Goads the enemy: Riposte +${n.riposte} for a turn`,
  "second-wind": (n) => `Below ${n.belowHpPct}% HP: heals ${n.healPct}% and acts`,
  "grapple": (n) => `Unarmed: squeezes and holds for ${n.holds === 1 ? "1 turn" : `${n.holds} turns`}`,
};

/** The short effect line of any perk (Inventory tiles). Never throws. */
export function shortEffect(id: PerkId, c: ContentTables = api.content): string {
  const k = perkKind(id);
  if (k === "weapon") {
    const w = c.weapons[id as WeaponId];
    if (!w) return "Unknown weapon";
    const n = w.tiers[0];
    const head = n.reach === null ? `Thrown for ${n.dmg}` : n.reach === 0 ? `Hits for ${n.dmg} up close` : `Hits for ${n.dmg} at reach ${n.reach}`;
    const top = WEAPON_BONUS_KEYS.map((b) => ({ b, v: n[b] })).filter((x) => x.v > 0).sort((p, q) => q.v - p.v)[0];
    return top ? `${head}, ${WEAPON_BONUS_LABEL[top.b]} ${sign(top.v)}` : head;
  }
  if (k === "companion") {
    const d = c.companions[id as CompanionId];
    if (!d) return "Unknown pet";
    return `Fights beside you: ${d.hp} HP, Strength ${d.strength}`;
  }
  if (k === "shield") {
    const sh = c.shields[id as ShieldId];
    if (!sh) return "Unknown shield";
    const n = sh.tiers[0];
    const tail = n.damage < 0 ? `, own damage ${n.damage}%` : n.tempo > 0 ? `, turns +${n.tempo}% longer` : n.riposte > 0 ? `, Riposte +${n.riposte}` : n.armor > 0 ? `, Armor +${n.armor}` : "";
    return `Block +${n.block}${tail}`;
  }
  if (k === "gear") {
    const g = c.gear[id as GearId];
    if (!g) return "Unknown gear";
    const t = gearText(g.tiers[0], g.slot);
    const bonus = t.effect.replace(/^Worn on the [a-z]+: /, "").replace(/\.$/, "");
    return t.costs.length > 0 ? `${bonus}; ${t.costs[0]}` : bonus;
  }
  const s = c.skills[id as SkillId];
  const line = SKILL_SHORT[id as SkillId];
  if (!s || !line) return "Unknown skill";
  return line(s.tiers[0]);
}

/** How a weapon is held and used, for the Inventory sheet: hands, and thrown or not. */
export function weaponHandling(id: WeaponId, c: ContentTables = api.content): { label: string; value: string }[] {
  const w = c.weapons[id];
  if (!w) return [];
  const meta = WEAPON_META[id];
  return [
    { label: "Hands", value: meta.pair ? "One in each hand" : meta.hands === 2 ? "Two hands" : "One hand" },
    { label: "Thrown", value: w.tiers[0].reach === null ? "Yes, it flies" : "No, held" },
  ];
}
