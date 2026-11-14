/**
 * The look of the rig lane, style 13 "gritty comic, sodium streetlight" (owner pick, 15 Nov 2026).
 * A night alley lit orange by street lamps; everything in shadow falls to teal. Every colour the
 * canvas draws with is in this file, so a theme change is a change here (plus parts and yard).
 *
 * Rules (docs/ART.md has the long form):
 *  - One outline colour, `INK`. Every stroke the rig makes is `INK`.
 *  - A part has its lit colour and ONE shadow colour (teal), cut by a fixed world light that
 *    comes from the upper left (the lamp). Halftone dots sit only inside that shadow.
 *  - No gradients, no patterns, no canvas filter. Glow is stepped flat shapes with alpha.
 */
import type { ColourSlot, Palette } from "../contracts";

/** The one outline colour. */
export const INK = "#14152B";

/** Teal shadow, two depths: `TEAL` under light colours, `TEAL_DEEP` under dark ones. */
export const TEAL = "#0F3C45";
export const TEAL_DEEP = "#082A31";
/** Halftone dot colour inside a shadow. */
export const DOT = "#04181C";
/** Lamp light. */
export const LAMP = "#FFE2A8";
export const GLOW = "#E8923E";
export const GLOW_HOT = "#FFB45A";

/** Line weights in stage units (a scrapper is 84 units, about 91 px on a phone). */
export const LINE = {
  /** The rough ink outline around a body part: about 1.1 px on a phone, 2.2 device px. */
  figure: 1.9,
  /** Weapons and props in the hand. */
  item: 1.3,
  /** Icons, in their own 24-unit box. */
  icon: 1.6,
  /** Stage line work (floor line, shutter edges). */
  stage: 1.6,
} as const;

/** How far the lit fill is pushed toward the light, as a share of the part's thickness. What is
 *  left uncovered on the far side is the teal shadow. Light comes from the upper left. */
export const LIGHT = { dx: -0.72, dy: -0.62, share: 0.34 } as const;
/** Halftone grid: spacing and dot radius in units, turned 30 degrees. */
export const HALFTONE = { step: 1.25, r: 0.4, angle: 30 } as const;
/** Rough line: how far the outline wanders from the true edge, in units. */
export const ROUGH = { amp: 0.16, seg: 1.1 } as const;
/** Back limbs are pushed into the dark by a teal veil of this alpha. */
export const BACK_VEIL = 0.2;

/** Skin tones under sodium light (index wraps). */
export const SKIN = ["#F0A462", "#C47A3E", "#E2B282", "#9A5A32"] as const;
export const HAIR_COLOUR = ["#2A160A", "#1A0E06", "#5A3418", "#8C5E30"] as const;
/** Clothing palettes. `accent` is the under-shirt, trims and a belt. */
export const PALETTES: readonly Palette[] = [
  { top: "#C35E26", bottom: "#6A5240", shoes: "#3E2A1C", accent: "#3A2A20" },
  { top: "#EBA868", bottom: "#6E5632", shoes: "#2A1A0E", accent: "#7A5A36" },
  { top: "#8E3A2A", bottom: "#3E4A4A", shoes: "#C88A50", accent: "#E0C080" },
  { top: "#D2B46A", bottom: "#4A3A2C", shoes: "#1E1A16", accent: "#B0582A" },
];
/** Fixed colours of the other slots. */
export const FIXED: Readonly<Record<"metal" | "wood" | "white" | "ink", string>> = {
  metal: "#E8B07A",       // steel under a sodium lamp
  wood: "#9A5A2A",
  white: "#F2D4A8",       // cream, never pure white on a figure
  ink: INK,
};

/** The flash: the target's parts redrawn in this for 60 ms. */
export const FLASH = "#FFF6E4";

/** Ground shadow under an actor. */
export const GROUND_SHADOW = "#03100F";

/** Placeholder companions (a gate-only rig): fur, beak and eye colours. */
export const COMPANION_COLOURS = {
  raccoon: { body: "#8A8478", dark: "#3A3530", light: "#D8C8A8" },
  goose: { body: "#E8D2AE", dark: "#5A4A3A", light: "#F2C070" },
  boar: { body: "#8A5A3A", dark: "#3A2418", light: "#C89A6A" },
} as const;

/** Effects. */
export const FX = { burst: "#FFF1C2", burstCore: "#FFFFFF", spark: "#FFC060", dust: "#C89A6A", whoosh: "#FFF6E4" } as const;

/** Icon colours (canvas-side; the DOM tokens live in the web app). */
export const ICON = {
  health: "#5BD66F", strength: "#FF5A4E", agility: "#A78BFA", speed: "#4CC9F0", ui: "#F4F2EC",
} as const;

/** The alley (gate arena "yard", drawn as the style-13 street). */
export const ALLEY = {
  brick: "#0D3138", brickLit: "#1B5560", mortar: "#051A1E", floor: "#0A262C", floorLit: "#3A4A40",
  crack: "#041416", shutter: "#123F48", shutterLine: "#06191D", windowLit: "#E8923E",
  pole: "#06191D", fence: "#041416", crowd: "#020C0E", paint: "#B9A27A", puddle: "#164A52",
  grime: "#020A0C", trash: "#2A3A30", sign: "#B8352A",
} as const;

/** Every colour this file defines, for the "every fill is a palette slot" test. */
export function allColours(): Set<string> {
  const out = new Set<string>([INK, TEAL, TEAL_DEEP, DOT, LAMP, GLOW, GLOW_HOT, FLASH, GROUND_SHADOW,
    ...SKIN, ...HAIR_COLOUR, ...Object.values(FIXED), ...Object.values(FX), ...Object.values(ICON), ...Object.values(ALLEY)]);
  for (const p of PALETTES) for (const c of Object.values(p)) out.add(c);
  for (const c of Object.values(COMPANION_COLOURS)) for (const v of Object.values(c)) out.add(v);
  return new Set([...out].map((c) => c.toUpperCase()));
}

/** Relative brightness 0 to 1 of a "#RRGGBB" colour. */
export function luma(hex: string): number {
  const n = parseInt(hex.slice(1, 7), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
/** The one shadow colour of a lit colour: teal under light colours, deep teal under dark ones. */
export function shadeOf(hex: string): string {
  return luma(hex) > 0.42 ? TEAL : TEAL_DEEP;
}

/** What a colour slot is for one look. */
export interface SlotColours { skin: string; hair: string; palette: Palette }
export function slotColour(slot: ColourSlot, c: SlotColours): string {
  switch (slot) {
    case "skin": return c.skin;
    case "hair": return c.hair;
    case "top": return c.palette.top;
    case "bottom": return c.palette.bottom;
    case "shoes": return c.palette.shoes;
    case "accent": return c.palette.accent;
    default: return FIXED[slot];
  }
}

/** The palette the web app may compare with its own tokens (same names, same values). */
export const palette = {
  ink: INK, teal: TEAL, tealDeep: TEAL_DEEP, lamp: LAMP, glow: GLOW,
  health: ICON.health, strength: ICON.strength, agility: ICON.agility, speed: ICON.speed,
} as const;
