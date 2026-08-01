/**
 * Arenas — 14 fight locations built from the hand-drawn stage via palette
 * grading, light overlays and weather particles. The arena for each fight
 * is rolled from the fight seed, so replays always happen where they
 * happened.
 */

import { makeRng } from "@agoge/core";
import type { ParticleKind } from "./gear.js";

export interface Arena {
  name: string;
  /** CSS filter applied to the backdrop */
  filter: string;
  /** light/atmosphere wash over the backdrop, under the fighters */
  overlay: string;
  weather?: ParticleKind;
}

export const ARENAS: Arena[] = [
  {
    name: "Oakwood Dusk",
    filter: "",
    overlay: "linear-gradient(180deg, rgba(20,16,40,0.18), transparent 60%)",
    weather: "fireflies",
  },
  {
    name: "Blood Moon Clearing",
    filter: "hue-rotate(-40deg) saturate(1.35) brightness(0.9)",
    overlay: "radial-gradient(60% 50% at 70% 12%, rgba(255,64,64,0.28), transparent 60%), linear-gradient(180deg, rgba(60,4,10,0.35), transparent 65%)",
    weather: "embers",
  },
  {
    name: "Frozen Grove",
    filter: "hue-rotate(160deg) saturate(0.7) brightness(1.12)",
    overlay: "linear-gradient(180deg, rgba(190,220,255,0.16), transparent 55%)",
    weather: "snow",
  },
  {
    name: "Ember Hollow",
    filter: "sepia(0.45) saturate(1.7) hue-rotate(-18deg) brightness(0.95)",
    overlay: "radial-gradient(70% 60% at 50% 100%, rgba(255,120,30,0.25), transparent 65%)",
    weather: "embers",
  },
  {
    name: "Storm Reach",
    filter: "saturate(0.55) brightness(0.8) contrast(1.1)",
    overlay: "linear-gradient(180deg, rgba(30,40,70,0.45), rgba(20,26,46,0.15) 70%)",
    weather: "storm",
  },
  {
    name: "Verdant Shrine",
    filter: "hue-rotate(55deg) saturate(1.2) brightness(1.02)",
    overlay: "linear-gradient(180deg, rgba(40,90,40,0.2), transparent 60%)",
    weather: "petals",
  },
  {
    name: "Golden Hour",
    filter: "sepia(0.35) saturate(1.4) brightness(1.15) hue-rotate(-8deg)",
    overlay: "linear-gradient(200deg, rgba(255,200,90,0.22), transparent 55%)",
    weather: "fireflies",
  },
  {
    name: "Midnight Hollow",
    filter: "brightness(0.62) saturate(0.85) hue-rotate(12deg)",
    overlay: "linear-gradient(180deg, rgba(6,8,24,0.5), rgba(6,8,24,0.15) 70%)",
    weather: "fireflies",
  },
  {
    name: "Ashfall Ridge",
    filter: "saturate(0.25) brightness(0.92) contrast(1.05)",
    overlay: "linear-gradient(180deg, rgba(120,120,130,0.2), transparent 60%)",
    weather: "snow",
  },
  {
    name: "Violet Rift",
    filter: "hue-rotate(250deg) saturate(1.3) brightness(0.9)",
    overlay: "radial-gradient(55% 45% at 50% 10%, rgba(167,139,250,0.3), transparent 65%)",
    weather: "fireflies",
  },
  {
    name: "Rose Glade",
    filter: "hue-rotate(-70deg) saturate(1.15) brightness(1.06)",
    overlay: "linear-gradient(180deg, rgba(255,150,190,0.16), transparent 55%)",
    weather: "petals",
  },
  {
    name: "Sunken Mist",
    filter: "hue-rotate(120deg) saturate(0.6) brightness(0.95)",
    overlay: "linear-gradient(0deg, rgba(180,220,220,0.28), transparent 55%), linear-gradient(180deg, rgba(20,40,44,0.3), transparent 50%)",
  },
  {
    name: "Iron Sky",
    filter: "hue-rotate(190deg) saturate(0.5) brightness(0.85)",
    overlay: "linear-gradient(180deg, rgba(60,80,110,0.35), transparent 65%)",
    weather: "storm",
  },
  {
    name: "Dawn Break",
    filter: "brightness(1.2) saturate(1.05) hue-rotate(-20deg)",
    overlay: "linear-gradient(210deg, rgba(255,220,180,0.25), transparent 60%)",
    weather: "petals",
  },
];

/** The arena a given fight happens in — rolled from the fight seed. */
export function arenaForFight(seed: number): Arena {
  const rng = makeRng(seed ^ 0x9e3779b9);
  return ARENAS[rng.int(ARENAS.length)]!;
}
