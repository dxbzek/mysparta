/**
 * The words of a Move on the fight screen (skills pass, owner 15 Nov 2026: "proper use of skill is
 * not it"): the one short line its banner shows while the user winds up, and the result tag the
 * stage pins over the user or the target ("-25 AIM", "SNARED"). Every number is read from the
 * sim's content tables, like the card text in perks.ts, so the screen can only say what the rules do.
 */
import { api } from "@rankzero/core";
import type { ContentTables, MoveId } from "@rankzero/core";

type N = Readonly<Record<string, number>>;
const n = (id: MoveId, c: ContentTables): N => c.skills[id]!.tiers[0];
const times = (pct: number): string => (pct % 100 === 0 ? `${pct / 100}x` : `${pct}%`);

/** One short line: what the Move does, for the banner under its name. */
const LINES: Readonly<Record<MoveId, (v: N) => string>> = {
  "haymaker": (v) => `Next swing: ${times(v.damageMult!)} damage, Crit +${v.crit!}`,
  "energy-drink": (v) => `Heals ${v.healMin!} to ${v.healMax!}% of max HP`,
  "tarp": (v) => `Target skips turns until hit (up to ${v.skips!})`,
  "whistle": (v) => `Pet heals ${v.healPct!}% and acts next`,
  "firecrackers": (v) => `${v.damageMin!} to ${v.damageMax!} damage, cannot be dodged`,
  "snatch": () => "Takes the enemy's weapon",
  "air-horn": (v) => `Enemy pets ${v.fleeChance!}% to run off, enemy acts ${v.clockPush!} beats later (${v.clockPushNoPet!} with no pet)`,
  "body-slam": (v) => `${v.base!} + ${v.perStrength!} per Strength, knocks the weapon off`,
  "sand-in-the-eyes": (v) => `Enemy Aim -${Math.abs(v.aimLoss!)} for the rest of the bout`,
  "taunt": (v) => `Riposte +${v.riposte!} until its next turn`,
  "second-wind": (v) => `Heals ${v.healPct!}% of max HP, acts again`,
  "grapple": (v) => `${v.base!} + ${v.perStrength!} per Strength, enemy loses ${v.holds!} turn${v.holds === 1 ? "" : "s"}`,
};

/** The words of the visible result; "" when a number already shows it (a heal, damage). */
const RESULTS: Readonly<Record<MoveId, (v: N, part?: "pet") => string>> = {
  "haymaker": (v) => `${times(v.damageMult!)} next hit`,
  "energy-drink": () => "",
  "tarp": () => "Snared",
  "whistle": () => "",
  "firecrackers": () => "",
  "snatch": () => "Weapon stolen",
  "air-horn": (_v, part) => (part === "pet" ? "Runs off" : "Acts later"),
  "body-slam": () => "Knocked down",
  "sand-in-the-eyes": (v) => `-${Math.abs(v.aimLoss!)} Aim`,
  "taunt": (v) => `+${v.riposte!} Riposte`,
  "second-wind": () => "",
  "grapple": () => "Held",
};

export function moveLine(id: MoveId, c: ContentTables = api.content): string {
  return LINES[id](n(id, c));
}

export function moveResult(id: MoveId, part?: "pet", c: ContentTables = api.content): string {
  return RESULTS[id](n(id, c), part);
}
