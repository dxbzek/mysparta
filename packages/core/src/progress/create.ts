/**
 * Creating a scrapper (work package 1): name clean-up, the seed, the look, the starting perk, the
 * record. The name is the seed: the same cleaned name gives the same scrapper on any device.
 */
import type { DayKey, Look, LookRoll, ScrapperRecord, TimeMs } from "../contracts/fighter";
import { LOOK_ROLL, LOOK_SPACE, LOOK_SPACE_V1 } from "../contracts/fighter";
import type { PerkId } from "../contracts/ids";
import { combineSeed, hashString, makeRng } from "../prng";
import { FIRST_PARTS, SECOND_PARTS } from "../content/names";
import { rollPerk, startSkillable, startable } from "./perks";
import { ENERGY_MAX } from "./energy";

export const NAME_MIN = 3;
export const NAME_MAX = 14;
const NAME_CHARS = /^[A-Za-z0-9 -]*$/;

/** Trim, collapse inner spaces to one. */
export function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function checkName(raw: string): { ok: true; name: string } | { ok: false; why: "length" | "chars" } {
  const name = cleanName(raw);
  if (!NAME_CHARS.test(name)) return { ok: false, why: "chars" };
  if (name.length < NAME_MIN || name.length > NAME_MAX) return { ok: false, why: "length" };
  return { ok: true, name };
}

/** hash(realmSalt + ":" + the lowercased, cleaned name). */
export function fighterSeed(realmSalt: string, name: string): number {
  return hashString(`${realmSalt}:${cleanName(name).toLowerCase()}`);
}

const SHAPE_KEYS = ["build", "head", "hair", "face", "top", "bottom", "shoes", "accessory"] as const;
const COLOUR_KEYS = ["skin", "hairColor", "palette"] as const;

/** Shapes from (seed, lookSalt), colours from (seed, colourSalt). Roll 1 draws inside the counts
 *  before CONTRACT_REV 10 (LOOK_SPACE_V1) exactly as that build did, so a record from before the look
 *  editor is pinned to the look it was shown; roll 2 (today's) draws inside LOOK_SPACE. */
export function rollLook(seed: number, lookSalt: number, colourSalt: number, roll: LookRoll = LOOK_ROLL): Look {
  const space = roll === 1 ? LOOK_SPACE_V1 : LOOK_SPACE;
  const shapes = makeRng(combineSeed(seed, "look", lookSalt));
  const colours = makeRng(combineSeed(seed, "colour", colourSalt));
  const out: Record<string, number> = {};
  for (const k of SHAPE_KEYS) out[k] = shapes.int(space[k]);
  for (const k of COLOUR_KEYS) out[k] = colours.int(space[k]);
  return out as unknown as Look;
}

/** Each part a whole number inside LOOK_SPACE (an index past the end wraps, a bad one is 0). */
export function cleanLook(look: Look): Look {
  const out: Record<string, number> = {};
  for (const k of Object.keys(LOOK_SPACE) as (keyof typeof LOOK_SPACE)[]) {
    const v = Number(look[k]);
    const n = Number.isFinite(v) ? Math.trunc(v) : 0;
    out[k] = ((n % LOOK_SPACE[k]) + LOOK_SPACE[k]) % LOOK_SPACE[k];
  }
  return out as unknown as Look;
}

/** The look a record shows: the one it stores, or (a record from before the look editor) the
 *  version-1 roll of its seed and salts. */
export function lookOf(rec: ScrapperRecord): Look {
  return rec.look !== undefined ? cleanLook(rec.look) : rollLook(rec.seed, rec.lookSalt, rec.colourSalt, 1);
}

/** The record with this look stored. Stats, kit and everything else stay as they are. */
export function withLook(rec: ScrapperRecord, look: Look): ScrapperRecord {
  return { ...rec, look: cleanLook(look) };
}

/** The starting perk: rolled from the pool again until it is a weapon (see `startable`). */
export function startPerk(seed: number): PerkId {
  const rng = makeRng(combineSeed(seed, "start"));
  for (;;) {
    const id = rollPerk(rng);
    if (startable(id)) return id;
  }
}

/** The second starting perk: a skill rolled from its own stream ("start2", so every name keeps the
 *  weapon it had) until it fits the kit of the starting weapon and is not a booster or Snatch (see
 *  `startSkillable`). The skill category is always reachable, so the loop ends. */
export function startSkill(seed: number, first: PerkId): PerkId {
  const rng = makeRng(combineSeed(seed, "start2"));
  for (;;) {
    const id = rollPerk(rng);
    if (startSkillable(id, [first])) return id;
  }
}

/** A name from our own lists. Any whole number works; every result passes checkName. */
export function randomName(n: number): string {
  const h = combineSeed("name", Math.trunc(n));
  const first = FIRST_PARTS[h % FIRST_PARTS.length]!;
  const second = SECOND_PARTS[Math.floor(h / FIRST_PARTS.length) % SECOND_PARTS.length]!;
  return `${first} ${second}`;
}

export function createRecord(a: { id: string; name: string; realmSalt: string; lookSalt: number; colourSalt: number;
  today: DayKey; nowMs: TimeMs; look?: Look }): ScrapperRecord {
  const name = cleanName(a.name);
  const seed = fighterSeed(a.realmSalt, name);
  return {
    id: a.id, name, seed,
    lookSalt: a.lookSalt, colourSalt: a.colourSalt,
    picks: [], xp: 0,
    createdDay: a.today, lifetimeBouts: 0,
    // A new scrapper starts with a full bar.
    energy: ENERGY_MAX, energyAt: Number.isFinite(a.nowMs) ? Math.floor(a.nowMs) : 0,
    // the look it was made with (CONTRACT_REV 10): the editor's pick, else today's roll
    look: cleanLook(a.look ?? rollLook(seed, a.lookSalt, a.colourSalt)),
  };
}
