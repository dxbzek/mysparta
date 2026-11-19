/**
 * Accurate weapon use by construction (owner amendment 13.3, fix round 2 wording). For every held
 * id, every attacker build, every target build and every attacker and target pair the stage can
 * stage (a scrapper on any rig at head or body, or at the legs when a pet bites, a companion on
 * any rig's body), at each contact
 * the striking end drawn on the sampled frame is within 3 units of the target's hit point. A
 * throw is measured where the item arrives; a rolled one (the Tyre) where it meets the target's
 * legs, standing on the floor. A planted 20-unit error in the stop turns it red.
 *
 * The striking end on the frame: `rig.strikePoint` of the frame's own clip, dress and aim, placed
 * at the frame's place. That is the drawn end only when the frame's clip time is the strike
 * time, so that is checked on the same frame.
 */
import { describe, expect, it } from "vitest";
import type { ActorId, ActorInit, BagItem, BoutLog, CompanionId, FighterSnapshot, HeldId, Step, WeaponId } from "@rankzero/core";
import { WEAPON_IDS, WEAPON_META } from "@rankzero/core";
import { l1Fists, l1Knife } from "@rankzero/core/fixtures";
import type { Rig } from "@rankzero/rig";
import { toStage } from "@rankzero/rig";
import { capsuleGateRig, capsuleRig } from "@rankzero/rig/testing";
import type { StagePlayer } from "../src/createFightPlayer";
import { propBox } from "../src/bounds";
import { anchorAt, pointAt } from "../src/flight";
import { hitOffset } from "../src/layout";
import type { Internal } from "../src/timeline";
import { playerFor } from "./lib/setup";

const HELD: readonly HeldId[] = ["fists", ...WEAPON_IDS];
const TOLERANCE = 3;

const snap = (base: FighterSnapshot, build: number, id: string): FighterSnapshot => ({ ...base, id, look: { ...base.look, build } });

/** Companions on side b by target build, so that across the three builds every kind is a target. */
const SIDE_B: Readonly<Record<number, readonly CompanionId[]>> = { 0: ["raccoon", "goose"], 1: ["boar", "raccoon"], 2: ["raccoon", "raccoon", "goose"] };

/** A synthetic duel: a0 holds `held` and swings (or throws) twice at every enemy; the companions
 *  swing at each other and at the scrappers. Not a legal bout, a stage test. */
function duel(held: HeldId, bComps: readonly CompanionId[]): BoutLog {
  const actors: ActorInit[] = [
    { id: "a0", kind: "scrapper", maxHp: 900 }, { id: "a1", kind: "goose", maxHp: 900 },
    { id: "b0", kind: "scrapper", maxHp: 900 },
    ...bComps.map((k, n) => ({ id: `b${n + 1}` as ActorId, kind: k, maxHp: 900 })),
  ];
  const hp = new Map<ActorId, number>(actors.map((a) => [a.id, a.maxHp]));
  const steps: Step[] = actors.map((a) => ({ t: "enter", turn: 0, actor: a.id }));
  let turn = 1;
  const bag: BagItem[] = held === "fists" ? [] : [{ k: "weapon", id: held as WeaponId }];
  if (held !== "fists") steps.push({ t: "draw", turn, actor: "a0", weapon: held as WeaponId, bagAfter: [] });
  const thrown = WEAPON_META[held].tags.includes("thrown");
  const hit = (actor: ActorId, target: ActorId, weapon: HeldId | null, n: number): Step => {
    const after = (hp.get(target) ?? 900) - 1;
    hp.set(target, after);
    const base = { turn, actor, target, weapon, outcome: "hit" as const, damage: 1, crit: false, hpAfter: after, n,
      ...(n > 0 ? { why: "combo" as const } : {}) };
    return thrown && actor === "a0"
      ? { ...base, t: "throw", after: "held", bagAfter: [] }
      : { ...base, t: "attack" };
  };
  const enemies: ActorId[] = ["b0", ...bComps.map((_, n) => `b${n + 1}` as ActorId)];
  for (const target of enemies) {
    steps.push(hit("a0", target, held, 0), hit("a0", target, held, 1));
    turn += 1;
  }
  for (const target of enemies) { steps.push(hit("a1", target, null, 0)); turn += 1; }
  for (const [n] of bComps.entries()) {
    steps.push(hit(`b${n + 1}` as ActorId, "a0", null, 0)); turn += 1;
    steps.push(hit(`b${n + 1}` as ActorId, "a1", null, 0)); turn += 1;
  }
  steps.push({ t: "end", turn, winner: "a", reason: "cap" });
  return { logVersion: 2, rulesVersion: 1, seed: 1400, init: { actors, bag: { a: bag, b: [] }, shield: { a: null, b: null } }, steps,
    result: { winner: "a", reason: "cap", turns: turn, hpPct: { a: 100, b: 100 } } };
}

interface Miss { what: string; gap: number }
/** The worst contact of a player: the largest distance between the drawn striking end (or the
 *  arriving item) and the target's hit point, over every hit contact. */
function gaps(player: StagePlayer, rig: Rig, log: BoutLog): Miss[] {
  const out: Miss[] = [];
  player.timeline.contacts.forEach((c, ci) => {
    const step = log.steps[c.step]!;
    if (!("target" in step) || step.target === undefined || !("outcome" in step) || step.outcome !== "hit") return;
    const f = player.frame(c.at);
    const tg = f.actors.find((a) => a.id === step.target)!;
    // a pet goes for a fighter's legs (layout.aimZone)
    const zones = tg.rig === "scrapper" ? (["head", "body", "legs"] as const) : (["body"] as const);
    const hits = zones.map((z) => toStage(tg.place, hitOffset(rig, tg.rig, tg.dress, z)));
    const what = `step ${c.step} ${step.t} ${step.actor}(${String(step.weapon)})->${step.target}(${tg.rig})`;
    if (step.t === "throw") {
      // measured where the item arrives: the flight's point at the contact frame
      const fl = player.tracks.flights.find((x) => x.to === c.at);
      if (fl === undefined) { out.push({ what: `${what}: no flight arrives at the contact`, gap: Infinity }); return; }
      const end = { x: fl.path.x1, y: fl.path.y1 };
      if (fl.path.kind === "roll") {
        // a rolled item (review finding 25) arrives on the floor at the target's shins: its drawn
        // box stands on the target's floor line and reaches its legs
        const box = propBox(rig, fl.item, { ...anchorAt(fl.path, pointAt(fl.path, 1)), facing: fl.path.facing });
        const legs = toStage(tg.place, hitOffset(rig, tg.rig, tg.dress, "legs"));
        const floorGap = Math.abs(box.y1 - tg.floorY);
        const reach = legs.x < box.x0 ? box.x0 - legs.x : legs.x > box.x1 ? legs.x - box.x1 : 0;
        out.push({ what: `${what}: rolled, ${floorGap.toFixed(1)} off the floor, ${reach.toFixed(1)} short of the legs`, gap: Math.max(floorGap, reach) });
        return;
      }
      out.push({ what, gap: Math.min(...hits.map((h) => Math.hypot(end.x - h.x, end.y - h.y))) });
      return;
    }
    const a = f.actors.find((x) => x.seg?.strikes === ci);
    if (a === undefined) { out.push({ what: `${what}: no striker on the contact frame`, gap: Infinity }); return; }
    const strike = rig.clipInfo(a.rig, a.clip).events.find((e) => e.name === "contact")?.t;
    if (strike === undefined || Math.abs(a.clipT - strike) > 1e-6) { out.push({ what: `${what}: clip ${a.clip} at ${a.clipT}, strike at ${String(strike)}`, gap: Infinity }); return; }
    const end = toStage(a.place, rig.strikePoint(a.rig, a.clip, a.dress, a.aim?.y));
    // the striker must face its target
    if (Math.sign(tg.place.x - a.place.x) !== a.place.facing) out.push({ what: `${what}: the striker faces away`, gap: Infinity });
    out.push({ what, gap: Math.min(...hits.map((h) => Math.hypot(end.x - h.x, end.y - h.y))) });
  });
  return out;
}

function worst(rig: Rig, held: HeldId, aBuild: number, tBuild: number, internal?: Internal): { max: Miss; count: number } {
  const log = duel(held, SIDE_B[tBuild]!);
  const p = playerFor(log, snap(l1Fists, aBuild, "acc-a"), snap(l1Knife, tBuild, "acc-b"), rig, false, internal);
  const list = gaps(p, rig, log);
  return { max: list.reduce((m, x) => (x.gap > m.gap ? x : m), { what: "none", gap: 0 }), count: list.length };
}

describe("stop marks: the striking end meets the hit point at every contact", () => {
  for (const held of HELD) {
    it(`${held}: every build, every target rig, head and body, within ${TOLERANCE} units`, () => {
      let contacts = 0;
      for (let aBuild = 0; aBuild < 3; aBuild++) {
        for (let tBuild = 0; tBuild < 3; tBuild++) {
          const r = worst(capsuleRig, held, aBuild, tBuild);
          contacts += r.count;
          expect(r.max.gap, `${r.max.what} (builds ${aBuild} -> ${tBuild})`).toBeLessThanOrEqual(TOLERANCE);
        }
      }
      // two swings at each of 3 or 4 enemies, the goose at each, and the side-b companions back
      expect(contacts).toBeGreaterThanOrEqual(9 * 12);
    });
  }

  it("the gate-only rig (fallback clips, straight stand-ins) holds the same line", () => {
    for (const held of ["fists", "pipe", "pocket-knife", "bat", "bike-chain", "sledgehammer", "darts", "screwdrivers"] as const) {
      for (let b = 0; b < 3; b++) {
        const r = worst(capsuleGateRig, held, b, (b + 1) % 3);
        expect(r.max.gap, `${held}: ${r.max.what}`).toBeLessThanOrEqual(TOLERANCE);
      }
    }
  });
});

describe("control: a planted 20-unit error in the stop turns it red", () => {
  it("every held id fails with the planted error", () => {
    for (const held of ["fists", "pipe", "pocket-knife", "lawn-flamingo"] as const) {
      const r = worst(capsuleRig, held, 0, 0, { stopError: 20 });
      expect(r.max.gap, held).toBeGreaterThan(TOLERANCE);
      expect(r.max.gap).toBeGreaterThan(15);
    }
  });
});
