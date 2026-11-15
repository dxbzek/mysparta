/**
 * Things on the floor (review finding 21): a disarmed weapon or a knocked-off shield landed on a
 * pet's mark (the raccoon was drawn inside a Car Door standing on its edge). On the real art, for
 * every item that lands in real bouts with pets:
 *  - when it comes to rest, its drawn box does not meet the drawn box of any pet near its floor
 *    line, and it lies on the stage;
 *  - a shield lies flat: its bottom on the floor line and its drawn height a small share of its
 *    length (it fell over), not standing on its edge.
 */
import { describe, expect, it } from "vitest";
import type { BoutLog, FighterSnapshot, PerkId } from "@rankzero/core";
import { isShieldId, simulateFight } from "@rankzero/core";
import { BOUT_FIXTURES, l10Boar, l10Raccoon } from "@rankzero/core/fixtures";
import { contentPack, createRig, gatePack } from "@rankzero/rig";
import type { Box } from "../src/bounds";
import { drawnBox, propBox } from "../src/bounds";
import type { StagePlayer } from "../src/createFightPlayer";
import { STAGE_W } from "../src/layout";
import { FLOOR } from "../src/tuning";
import { playerFor } from "./lib/setup";

const FULL = createRig(gatePack, contentPack);
const kit = (base: FighterSnapshot, id: string, perks: PerkId[]): FighterSnapshot => ({ ...base, id, perks });

function bouts(): { name: string; log: BoutLog; a: FighterSnapshot; b: FighterSnapshot }[] {
  const out: { name: string; log: BoutLog; a: FighterSnapshot; b: FighterSnapshot }[] = [{ ...BOUT_FIXTURES["bout-all-steps"], name: "bout-all-steps" }];
  // kitted sim bouts with pets and shields, kept while they drop things
  for (let seed = 5100; seed < 5160 && out.length < 6; seed++) {
    const a = kit(l10Boar, `floor:a${seed}`, ["crowbar", "car-door", "raccoon", "goose"] as PerkId[]);
    const b = kit(l10Raccoon, `floor:b${seed}`, ["bat", "bin-lid", "stray-dog", "raccoon"] as PerkId[]);
    const log = simulateFight(seed, a, b, 1);
    if (log.steps.some((s) => s.t === "disarm" || s.t === "shieldOff")) out.push({ name: `seed ${seed}`, log, a, b });
  }
  return out;
}

const meet = (p: Box, q: Box): number => Math.max(0, Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0)) * (Math.min(p.y1, q.y1) > Math.max(p.y0, q.y0) ? 1 : 0);

/** Every breach for one bout. */
function problems(p: StagePlayer): { pets: string[]; flat: string[]; landed: number; shields: number } {
  const out = { pets: [] as string[], flat: [] as string[], landed: 0, shields: 0 };
  for (const item of p.tracks.floor) {
    const t = item.from + FLOOR.flopMs + 1;
    const f = p.frame(t);
    const fp = f.floor.find((x) => x.item === item.item && Math.abs(x.x - item.x) < 1e-6);
    if (fp === undefined) continue;
    out.landed += 1;
    const raw = propBox(FULL, fp.item, { x: fp.x, y: fp.y, facing: fp.facing, rot: fp.rot });
    const k = fp.squash ?? 1;
    const fy = fp.floorY ?? 0;
    const box: Box = fp.squash === undefined ? raw : { x0: raw.x0, x1: raw.x1, y0: fy + (raw.y0 - fy) * k, y1: fy + (raw.y1 - fy) * k };
    if (box.x0 < 0 || box.x1 > STAGE_W) out.pets.push(`${item.item} at ${Math.round(t)}: off the stage`);
    for (const a of f.actors) {
      if (a.rig === "scrapper" || Math.abs(a.floorY - (fp.floorY ?? item.y)) > FLOOR.petDepth + 2) continue;
      const pb = drawnBox(FULL, FULL.samplePose(a.rig, a.clip, a.clipT, a.aim), a.dress, a.place);
      const w = meet(box, pb);
      if (w > 1) out.pets.push(`${item.item} at ${Math.round(t)} ms meets ${a.id} (${a.rig}) by ${w.toFixed(1)} units`);
    }
    if (isShieldId(item.item)) {
      out.shields += 1;
      const h = box.y1 - box.y0;
      const w = box.x1 - box.x0;
      if (Math.abs(box.y1 - (fp.floorY ?? box.y1 + 99)) > 1) out.flat.push(`${item.item}: bottom ${box.y1.toFixed(1)} off the floor ${String(fp.floorY)}`);
      if (h > 0.45 * w) out.flat.push(`${item.item}: stands ${h.toFixed(1)} tall on ${w.toFixed(1)}`);
    }
  }
  return out;
}

describe("things on the floor (real art)", () => {
  const list = bouts();
  it("the bouts drop weapons and shields", () => {
    expect(list.length).toBeGreaterThanOrEqual(3);
  });
  for (const bout of list) {
    it(`${bout.name}: a dropped item comes to rest clear of the pets, and a shield lies flat`, () => {
      const p = playerFor(bout.log, bout.a, bout.b, FULL);
      const r = problems(p);
      expect(r.landed).toBeGreaterThan(0);
      expect(r.pets).toEqual([]);
      expect(r.flat).toEqual([]);
    });
  }
  it("shields fall in these bouts", () => {
    let n = 0;
    for (const bout of list) n += problems(playerFor(bout.log, bout.a, bout.b, FULL)).shields;
    expect(n).toBeGreaterThan(0);
  });
});
