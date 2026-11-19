/**
 * Thrown props fly by their flight kind (owner amendment 13.3): Darts straight and point first,
 * Bricks tumbling on an arc, the Boomerang on a curve and back to the hand when the log says
 * "held". Checked on the paths the stage really flies, sampled.
 */
import { describe, expect, it } from "vitest";
import type { ActorInit, BoutLog, Step, WeaponId } from "@rankzero/core";
import { WEAPON_META } from "@rankzero/core";
import { l1Fists, l1Knife } from "@rankzero/core/fixtures";
import type { FlightItem } from "../src/model";
import { anchorAt, pointAt } from "../src/flight";
import { capsuleRig } from "@rankzero/rig/testing";
import { contentPack, createRig, gatePack, toStage } from "@rankzero/rig";
import { propBox } from "../src/bounds";
import { hitOffset } from "../src/layout";

const FULL = createRig(gatePack, contentPack);
import { playerFor } from "./lib/setup";

function throwLog(weapon: WeaponId, after: "held" | "bag" | "gone"): BoutLog {
  const actors: ActorInit[] = [{ id: "a0", kind: "scrapper", maxHp: 90 }, { id: "b0", kind: "scrapper", maxHp: 90 }];
  const steps: Step[] = [
    { t: "enter", turn: 0, actor: "a0" }, { t: "enter", turn: 0, actor: "b0" },
    { t: "draw", turn: 1, actor: "a0", weapon, bagAfter: [] },
    { t: "throw", turn: 1, actor: "a0", target: "b0", weapon, outcome: "hit", damage: 9, crit: false, hpAfter: 81, n: 0, after, bagAfter: [] },
    { t: "end", turn: 2, winner: "a", reason: "cap" },
  ];
  return { logVersion: 2, rulesVersion: 1, seed: 1400, init: { actors, bag: { a: [{ k: "weapon", id: weapon }], b: [] }, shield: { a: null, b: null } },
    steps, result: { winner: "a", reason: "cap", turns: 2, hpPct: { a: 100, b: 90 } } };
}
function flightsOf(weapon: WeaponId, after: "held" | "bag" | "gone"): FlightItem[] {
  const p = playerFor(throwLog(weapon, after), l1Fists, l1Knife);
  return p.tracks.flights.filter((f) => f.item === weapon);
}
/** Largest distance off the straight line from start to end, signed: + below (toward the floor), - above. */
function bow(f: FlightItem): number {
  let most = 0;
  for (let u = 0; u <= 1; u += 0.02) {
    const q = pointAt(f.path, u);
    const lineY = f.path.y0 + (f.path.y1 - f.path.y0) * u;
    const d = q.y - lineY;
    if (Math.abs(d) > Math.abs(most)) most = d;
  }
  return most;
}
const spin = (f: FlightItem): number => Math.abs(pointAt(f.path, 1).rot - pointAt(f.path, 0).rot);

describe("flights", () => {
  it("the three Thrown weapons carry their flight kind", () => {
    expect(WEAPON_META.darts.flight).toBe("straight");
    expect(WEAPON_META.bricks.flight).toBe("tumble");
    expect(WEAPON_META.boomerang.flight).toBe("return");
  });

  it("Darts fly straight and point first, with no spin", () => {
    const [f] = flightsOf("darts", "held");
    expect(f).toBeDefined();
    expect(Math.abs(bow(f!))).toBeLessThan(1e-9);
    expect(spin(f!)).toBe(0);
    const dir = (Math.atan2(f!.path.y1 - f!.path.y0, (f!.path.x1 - f!.path.x0) * f!.path.facing) * 180) / Math.PI;
    for (let u = 0; u <= 1; u += 0.1) expect(pointAt(f!.path, u).rot).toBeCloseTo(dir, 9);
  });

  it("Bricks tumble on an arc that rises above the line", () => {
    const [f] = flightsOf("bricks", "gone");
    expect(bow(f!)).toBeLessThan(-8);
    expect(spin(f!)).toBeGreaterThan(90);
  });

  it("the Boomerang flies a curve, spinning, and comes back to the hand when the log says held", () => {
    const fl = flightsOf("boomerang", "held");
    expect(fl.length).toBe(2);
    const [out, back] = fl as [FlightItem, FlightItem];
    expect(bow(out)).toBeGreaterThan(8);
    expect(spin(out)).toBeGreaterThan(180);
    expect(back.from).toBe(out.to);
    expect(back.path.x0).toBe(out.path.x1);
    expect(back.after).toBe("held");
    // and lands in the hand: where the frame draws the thrower's hand when it arrives
    const p = playerFor(throwLog("boomerang", "held"), l1Fists, l1Knife);
    const me = p.frame(back.to).actors.find((a) => a.id === "a0")!;
    const hand = capsuleRig.handAnchor(capsuleRig.samplePose(me.rig, me.clip, me.clipT, me.aim), me.dress, me.place);
    expect(Math.hypot(hand.x - back.path.x1, hand.y - back.path.y1)).toBeLessThan(2);
    expect(me.dress.held).toBe("boomerang");
    expect(p.frame(out.from + 10).actors.find((a) => a.id === "a0")!.dress.held).toBe("fists");
    // gone: no way back
    expect(flightsOf("boomerang", "gone").length).toBe(2);       // the throw, then the drop to the floor
    expect(flightsOf("boomerang", "gone")[1]!.after).toBe("floor");
  });

  it("content v2: every new Thrown weapon flies its own way and arrives on the target's hit point", () => {
    expect([WEAPON_META["plastic-bottle"].flight, WEAPON_META["paint-can"].flight, WEAPON_META["traffic-cone"].flight]).toEqual(["tumble", "tumble", "tumble"]);
    // the Hubcap spins flat on a low arc
    const [hub] = flightsOf("hubcap", "held");
    expect(hub!.path.kind).toBe("spin");
    expect(spin(hub!)).toBeGreaterThan(90);
    // the Tyre is bowled: it runs below the line (on the floor) and turns fast
    const [tyre] = flightsOf("tyre", "held");
    expect(tyre!.path.kind).toBe("roll");
    expect(bow(tyre!)).toBeGreaterThan(20);
    expect(spin(tyre!)).toBeGreaterThan(90);
    // the Rubber Ball goes down to the floor, bounces once and comes up into the target
    const [ball] = flightsOf("rubber-ball", "held");
    expect(ball!.path.kind).toBe("bounce");
    expect(bow(ball!)).toBeGreaterThan(25);
    const low = pointAt(ball!.path, 0.6).y;
    expect(low).toBeGreaterThan(pointAt(ball!.path, 0.3).y);
    expect(low).toBeGreaterThan(pointAt(ball!.path, 0.9).y);
    for (const id of ["plastic-bottle", "rubber-ball", "paint-can", "traffic-cone", "hubcap", "tyre"] as const) {
      const [f] = flightsOf(id, "held");
      const end = pointAt(f!.path, 1);
      expect(Math.hypot(end.x - f!.path.x1, end.y - f!.path.y1), id).toBeLessThan(1e-9);
    }
  });

  it("the Tyre rolls on the floor from a quarter of its flight on and meets the shins, turning about its hub (finding 25)", () => {
    for (const [name, rig] of [["capsule", capsuleRig], ["real art", FULL]] as const) {
      const p = playerFor(throwLog("tyre", "held"), l1Fists, l1Knife, rig);
      const f = p.tracks.flights.find((x) => x.item === "tyre")!;
      const target = p.frame(f.to).actors.find((a) => a.id === "b0")!;
      const knee = toStage(target.place, hitOffset(rig, "scrapper", target.dress, "legs")).y;
      // from a quarter of the way its hub runs level, at its arrival height
      for (let u = 0.25; u <= 1.0001; u += 0.05) expect(pointAt(f.path, u).y, `${name} u ${u.toFixed(2)}`).toBeCloseTo(f.path.y1, 9);
      // and there (it arrives upright) its drawn rim stands on the floor, no higher than the knee
      const box = propBox(rig, "tyre", { ...anchorAt(f.path, pointAt(f.path, 1)), facing: f.path.facing });
      expect(Math.abs(box.y1 - target.floorY), name).toBeLessThan(1.2);
      expect(box.y0, `${name}: no higher than the knee`).toBeGreaterThan(knee - 3);
      // turning as a wheel: the hub stays put on the item as it spins (the grip goes round it)
      const a = anchorAt(f.path, pointAt(f.path, 0.5));
      const c = anchorAt(f.path, pointAt(f.path, 0.6));
      expect(Math.hypot(a.x - pointAt(f.path, 0.5).x, a.y - pointAt(f.path, 0.5).y)).toBeCloseTo(Math.hypot(c.x - pointAt(f.path, 0.6).x, c.y - pointAt(f.path, 0.6).y), 6);
    }
  });

  it("a weapon that goes back to the bag fades at the target; a gone one lies on the floor", () => {
    expect(flightsOf("darts", "bag")[0]!.after).toBe("vanish");
    const p = playerFor(throwLog("bricks", "gone"), l1Fists, l1Knife);
    expect(p.frame(p.timeline.durationMs).floor.map((x) => x.item)).toEqual(["bricks"]);
  });
});
