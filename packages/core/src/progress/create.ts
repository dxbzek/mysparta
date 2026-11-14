/**
 * Creating a scrapper (work package 1): name clean-up, the seed, the look, the starting perk, the
 * record. The name is the seed: the same cleaned name gives the same scrapper on any device.
 */
import type { DayKey, Look, ScrapperRecord } from "../contracts/fighter";
import { LOOK_SPACE } from "../contracts/fighter";
import type { PerkId } from "../contracts/ids";
import { combineSeed, hashString, makeRng } from "../prng";
import { FIRST_PARTS, SECOND_PARTS } from "../content/names";
import { allowed, rollPerk } from "./perks";

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

/** Shapes from (seed, lookSalt), colours from (seed, colourSalt). */
export function rollLook(seed: number, lookSalt: number, colourSalt: number): Look {
  const shapes = makeRng(combineSeed(seed, "look", lookSalt));
  const colours = makeRng(combineSeed(seed, "colour", colourSalt));
  const out: Record<string, number> = {};
  for (const k of SHAPE_KEYS) out[k] = shapes.int(LOOK_SPACE[k]);
  for (const k of COLOUR_KEYS) out[k] = colours.int(LOOK_SPACE[k]);
  return out as unknown as Look;
}

/** The starting perk: rolled from the pool again until it is allowed on an empty kit. */
export function startPerk(seed: number): PerkId {
  const rng = makeRng(combineSeed(seed, "start"));
  for (;;) {
    const id = rollPerk(rng);
    if (allowed(id, [], rng)) return id;
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
  today: DayKey }): ScrapperRecord {
  const name = cleanName(a.name);
  return {
    id: a.id, name, seed: fighterSeed(a.realmSalt, name),
    lookSalt: a.lookSalt, colourSalt: a.colourSalt,
    picks: [], xp: 0,
    createdDay: a.today, day: a.today, boutsUsed: 0, lifetimeBouts: 0,
  };
}
