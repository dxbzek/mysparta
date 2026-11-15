/**
 * The words of a Move on the fight screen (skills pass, owner 15 Nov 2026: "proper use of skill is
 * not it"): the result tag the stage pins over the user or the target ("-25 AIM", "SNARED"). Every number is read from the
 * sim's content tables, like the card text in perks.ts, so the screen can only say what the rules do.
 */
import { api } from "@rankzero/core";
import type { ContentTables, MoveId } from "@rankzero/core";

type N = Readonly<Record<string, number>>;
const n = (id: MoveId, c: ContentTables): N => c.skills[id]!.tiers[0];
const times = (pct: number): string => (pct % 100 === 0 ? `${pct / 100}x` : `${pct}%`);

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

export function moveResult(id: MoveId, part?: "pet", c: ContentTables = api.content): string {
  return RESULTS[id](n(id, c), part);
}
