/**
 * Colour reads (review round 2, 16 Nov 2026):
 *  - the Tarp's sheet stands out from every arena: 3:1 or more (WCAG contrast) against each
 *    arena's floor, the lamp-lit floor and the lit brick (the old wall teal was 1.2-1.4:1);
 *  - objects wear their real paint: the stop sign's face is sign red, the cone safety orange, the
 *    rubber ball red, the lawn flamingo pink, the paint tin's label blue;
 *  - the gym's floor is as dark as the alleys' (it was a bright maple court).
 */
import { describe, expect, it } from "vitest";
import { STAGE_IDS } from "@rankzero/core";
import { contentPack } from "../../src/content/pack";
import { ARENA_FLOOR } from "../../src/content/stages";
import { ALLEY, FIXED } from "../../src/gate/style";

/** WCAG relative luminance and contrast ratio. */
function lum(hex: string): number {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}
const contrast = (a: string, b: string): number => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

describe("colour reads", () => {
  it("names a floor for every arena", () => {
    expect(Object.keys(ARENA_FLOOR).sort()).toEqual([...STAGE_IDS].sort());
  });
  it("the tarp is 3:1 or more on every arena floor, the lit floor and the lit brick", () => {
    const backs = [...Object.values(ARENA_FLOOR), ALLEY.floorLit, ALLEY.brick, ALLEY.brickLit, ALLEY.shutter];
    for (const b of backs) expect(contrast(ALLEY.tarp, b), `tarp on ${b}`).toBeGreaterThanOrEqual(3);
    // planted fault: the old wall-teal tarp fails
    expect(contrast(ALLEY.shutter, ALLEY.floor)).toBeLessThan(3);
  });
  it("objects wear their real paint", () => {
    const slots = (id: keyof typeof contentPack.weapons): string[] => contentPack.weapons[id].shapes.map((s) => s.slot);
    expect(slots("stop-sign")).toContain("sign");
    expect(slots("traffic-cone")).toContain("cone");
    expect(slots("rubber-ball")).toContain("sign");
    expect(slots("lawn-flamingo")).toContain("pink");
    expect(slots("paint-can")).toContain("paint");
    // and those colours read as themselves: red is red, orange is orange, pink is pink
    const hue = (hex: string): number => {
      const n = parseInt(hex.slice(1, 7), 16);
      const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn || 1;
      const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    expect(hue(FIXED.sign)).toBeLessThan(12);
    expect(hue(FIXED.cone)).toBeGreaterThan(14);
    expect(hue(FIXED.cone)).toBeLessThan(30);
    expect(hue(FIXED.pink)).toBeGreaterThan(320);
    expect(hue(FIXED.paint)).toBeGreaterThan(195);
    expect(hue(FIXED.paint)).toBeLessThan(225);
  });
  it("the gym floor is as dark as the alleys'", () => {
    const others = Object.entries(ARENA_FLOOR).filter(([k]) => k !== "gym").map(([, c]) => lum(c));
    expect(lum(ARENA_FLOOR.gym)).toBeLessThanOrEqual(Math.max(...others) * 1.25);
  });
});
