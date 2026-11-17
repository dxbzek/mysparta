/**
 * Room between bodies (review finding 1, 15 Nov 2026): the attacker stopped inside the target (an
 * overhead anvil, a ball and chain, a folding chair) or inside the pet's owner (it walked through
 * him to reach a pet behind him). Measured on the real art, on every swing's contact frame and on
 * every frame of every swing:
 *  - two scrappers never stand nearer than `BODY_GAP.body` (times the larger drawn size);
 *  - a scrapper hitting a pet stops on its own side of the pet's owner, the body gap short of him,
 *    and no scrapper ever passes the other's place in the bout;
 *  - the strike still lands (accuracy.test.ts holds the 3-unit line for every weapon).
 * The control: a planted 20-unit error in every stop (the feet walking in) turns it red.
 */
import { describe, expect, it } from "vitest";
import type { ActorId, ActorInit, BagItem, BoutLog, CompanionId, FighterSnapshot, HeldId, Step, WeaponId } from "@rankzero/core";
import { REALM_SALT, combineSeed, rivalSnapshot, simulateFight } from "@rankzero/core";
import { BOUT_FIXTURES } from "@rankzero/core/fixtures";
import { l1Fists, l1Knife } from "@rankzero/core/fixtures";
import { contentPack, createRig, gatePack } from "@rankzero/rig";
import type { StagePlayer } from "../src/createFightPlayer";
import { BODY_GAP } from "../src/layout";
import type { Internal } from "../src/timeline";
import { playerFor } from "./lib/setup";

const FULL = createRig(gatePack, contentPack);
const FRAME_MS = 1000 / 60;

/** a0 holds `held` and swings twice at b0 and twice at each of b0's pets (behind him); then b0
 *  answers with fists, and the pets bite. Not a legal bout, a stage test. */
function duel(held: HeldId, pets: readonly CompanionId[]): BoutLog {
  const actors: ActorInit[] = [
    { id: "a0", kind: "scrapper", maxHp: 900 }, { id: "a1", kind: "raccoon", maxHp: 900 },
    { id: "b0", kind: "scrapper", maxHp: 900 }, ...pets.map((k, n) => ({ id: `b${n + 1}` as ActorId, kind: k, maxHp: 900 })),
  ];
  const hp = new Map<ActorId, number>(actors.map((a) => [a.id, a.maxHp]));
  const steps: Step[] = actors.map((a) => ({ t: "enter", turn: 0, actor: a.id }));
  let turn = 1;
  const bag: BagItem[] = held === "fists" ? [] : [{ k: "weapon", id: held as WeaponId }];
  if (held !== "fists") steps.push({ t: "draw", turn, actor: "a0", weapon: held as WeaponId, bagAfter: [] });
  const hit = (actor: ActorId, target: ActorId, weapon: HeldId | null, n: number): Step => {
    const after = (hp.get(target) ?? 900) - 1;
    hp.set(target, after);
    return { t: "attack", turn, actor, target, weapon, outcome: "hit", damage: 1, crit: false, hpAfter: after, n,
      ...(n > 0 ? { why: "combo" as const } : {}) };
  };
  for (const target of ["b0", ...pets.map((_, n) => `b${n + 1}`)] as ActorId[]) {
    steps.push(hit("a0", target, held, 0), hit("a0", target, held, 1));
    turn += 1;
  }
  steps.push(hit("b0", "a0", "fists", 0), hit("b0", "a1", "fists", 0));
  turn += 1;
  for (const [n] of pets.entries()) { steps.push(hit(`b${n + 1}` as ActorId, "a0", null, 0)); turn += 1; }
  steps.push({ t: "end", turn, winner: "a", reason: "cap" });
  return { logVersion: 2, rulesVersion: 1, seed: 1500, init: { actors, bag: { a: bag, b: [] }, shield: { a: null, b: null } }, steps,
    result: { winner: "a", reason: "cap", turns: turn, hpPct: { a: 100, b: 100 } } };
}

function found(level: number, n: number): { log: BoutLog; a: FighterSnapshot; b: FighterSnapshot } {
  const a = rivalSnapshot(REALM_SALT, level, 2 * n);
  const b = rivalSnapshot(REALM_SALT, level, 2 * n + 1);
  return { log: simulateFight(combineSeed("find-bout", n), a, b, 1), a, b };
}

const snap = (base: FighterSnapshot, build: number, id: string): FighterSnapshot => ({ ...base, id, look: { ...base.look, build } });
const SWINGS = new Set(["attack", "riposte", "intercept"]);

interface Report { gap: string[]; owner: string[]; crossed: string[]; contacts: number; petContacts: number }

/** Every breach of the spacing rules in a bout (see the header). */
function spacing(p: StagePlayer, log: BoutLog): Report {
  const r: Report = { gap: [], owner: [], crossed: [], contacts: 0, petContacts: 0 };
  const scale = (id: string): number => {
    const tr = p.tracks.byId.get(id as ActorId)!;
    if (tr.look === undefined) return 1;
    const y = (build: number): number => FULL.hitPoint("scrapper", { held: null, shield: null, scale: 1, look: { ...tr.look!, build } }, "head").y;
    return y(tr.look.build) / y(0);
  };
  const gap = BODY_GAP.body * Math.max(scale("a0"), scale("b0")) - 0.5;
  const side = Math.sign(p.tracks.byId.get("b0")!.home.x - p.tracks.byId.get("a0")!.home.x);
  for (let t = 0; t <= p.timeline.durationMs; t += FRAME_MS) {
    const f = p.frame(t);
    const a = f.actors.find((x) => x.id === "a0");
    const b = f.actors.find((x) => x.id === "b0");
    if (a === undefined || b === undefined) continue;
    if (Math.sign(b.place.x - a.place.x) !== side && a.clip !== "ko-fall" && b.clip !== "ko-fall") r.crossed.push(`${Math.round(t)} ms`);
    // every frame of a swing between the two of them
    const striker = [a, b].find((x) => x.seg?.strikes !== undefined);
    if (striker !== undefined) {
      const c = p.timeline.contacts[striker.seg!.strikes!]!;
      const step = log.steps[c.step]!;
      if (SWINGS.has(step.t) && "target" in step && (step.target === "a0" || step.target === "b0")) {
        const d = Math.abs(a.place.x - b.place.x);
        if (d < gap) r.gap.push(`${Math.round(t)} ms step ${c.step} ${striker.id} ${striker.clip}: ${d.toFixed(1)} apart`);
      }
    }
  }
  p.timeline.contacts.forEach((c) => {
    const step = log.steps[c.step]!;
    if (!SWINGS.has(step.t) || !("target" in step) || step.target === undefined) return;
    const f = p.frame(c.at);
    const atk = f.actors.find((x) => x.id === step.actor);
    const tg = f.actors.find((x) => x.id === step.target);
    if (atk === undefined || tg === undefined || atk.rig !== "scrapper") return;
    r.contacts += 1;
    if (tg.rig === "scrapper") return;
    r.petContacts += 1;
    // a pet's owner: the scrapper of its side
    const owner = f.actors.find((x) => x.id === `${String(step.target)[0]}0`);
    if (owner === undefined || owner.clip === "ko-fall") return;
    const toward = Math.sign(atk.place.x - owner.place.x) === Math.sign(p.tracks.byId.get(atk.id)!.home.x - p.tracks.byId.get(owner.id)!.home.x);
    const d = Math.abs(atk.place.x - owner.place.x);
    if (!toward || d < gap) r.owner.push(`step ${c.step} ${step.actor} -> ${step.target}: ${d.toFixed(1)} from the owner${toward ? "" : ", past him"}`);
  });
  return r;
}

const HEAVY: readonly HeldId[] = ["fists", "anvil", "ball-and-chain", "folding-chair", "sledgehammer", "bat", "knuckle-dusters", "rubber-chicken"];
const PETS: readonly (readonly CompanionId[])[] = [["boar", "raccoon"], ["goose", "crow"], ["stray-dog", "alley-cat"]];

describe("room between bodies, measured on every frame (real art)", () => {
  for (const held of HEAVY) {
    it(`${held}: never inside the target, never through the pet's owner, every build`, () => {
      let contacts = 0;
      let petContacts = 0;
      for (let build = 0; build < 3; build++) {
        const log = duel(held, PETS[build]!);
        const p = playerFor(log, snap(l1Fists, build, "gap-a"), snap(l1Knife, (build + 1) % 3, "gap-b"), FULL);
        const r = spacing(p, log);
        contacts += r.contacts;
        petContacts += r.petContacts;
        expect(r.gap.slice(0, 4), `build ${build}`).toEqual([]);
        expect(r.owner, `build ${build}`).toEqual([]);
        expect(r.crossed.slice(0, 4), `build ${build}`).toEqual([]);
      }
      expect(petContacts).toBeGreaterThanOrEqual(12);
      expect(contacts).toBeGreaterThanOrEqual(24);
    });
  }

  for (const [name, bout] of [["bout-all-steps", BOUT_FIXTURES["bout-all-steps"]], ["find-bout level 10 n 29", found(10, 29)],
    // Level 30 n 2 is back (round 2, third pass): under sim version 4 a0 Body Slammed the pet b1
    // behind its owner b0 and ran past b0 to reach it; a Move at a pet now has the swing's
    // step-out (choreo/move.ts closeIn). The built-log case for every pet is in open-defects.test.ts.
    ["find-bout level 30 n 2", found(30, 2)],
    // Body Slams at a pet under sim version 6: b0 at a1 on step 4 (n 52), a0 at b2 on step 6 (n 136),
    // a0 at b1 on step 8 (n 332).
    ["find-bout level 30 n 52 (Body Slam at a pet)", found(30, 52)],
    ["find-bout level 30 n 136 (Body Slam at a pet)", found(30, 136)],
    ["find-bout level 30 n 332 (Body Slam at a pet)", found(30, 332)],
    ["find-bout level 30 n 3", found(30, 3)],
    // a0 hits a pet while it is snared behind its owner: it cannot come out, so he gives room.
    // n 58 since sim version 6 (round 2, third pass); it was n 4, then n 53, then n 96.
    ["find-bout level 30 n 58 (snared pet)", found(30, 58)]] as const) {
    it(`${name}: the same, in a real bout`, () => {
      const p = playerFor(bout.log, bout.a, bout.b, FULL);
      const r = spacing(p, bout.log);
      expect(r.contacts).toBeGreaterThan(0);
      expect(r.gap.slice(0, 4)).toEqual([]);
      expect(r.owner).toEqual([]);
      expect(r.crossed.slice(0, 4)).toEqual([]);
    });
  }
});

// The verifier's case (level 30 n 4, step 57) changed with the sim start pass; level 30 n 31,
// step 21 was the same scene under it, level 30 n 68, step 21 under sim version 4 (round 2), and
// level 30 n 96, step 17 under sim version 5 (round 2, second pass), and level 30 n 58, step 28 under
// sim version 6 (round 2, third pass): a0 swings at the snared pet b1 standing behind b0.
describe("a snared pet behind its owner (verifier, 15 Nov 2026: level 30 n 4, step 57; now n 58, step 28)", () => {
  it("the owner steps back past it, and its tarp is drawn with the pet, under him", () => {
    const { log, a, b } = found(30, 58);
    const p = playerFor(log, a, b, FULL);
    const c = p.timeline.contacts.find((x) => x.step === 28)!;
    expect(c).toBeDefined();
    const f = p.frame(c.at);
    const atk = f.actors.find((x) => x.id === "a0")!;
    const owner = f.actors.find((x) => x.id === "b0")!;
    expect(owner.place.x - atk.place.x).toBeGreaterThanOrEqual(BODY_GAP.body - 0.5);
    // just before the blow (it knocks the tarp off), the owner in front of it
    const tarp = p.frame(c.at - 150).fx.find((e) => e.fx === "tarp");
    expect(tarp?.under).toBe("b1");
  });
});

describe("control: the feet walking in turns it red", () => {
  it("a planted 20-unit error in every stop breaks the gap", () => {
    const internal: Internal = { stopError: 20 };
    const log = duel("anvil", PETS[0]!);
    const p = playerFor(log, snap(l1Fists, 0, "gap-a"), snap(l1Knife, 1, "gap-b"), FULL, false, internal);
    const r = spacing(p, log);
    expect(r.gap.length + r.owner.length).toBeGreaterThan(0);
  });
});

describe("a stop behind the attacker is stepped back to, never run (merge of the sim and stage fixes: level 30 n 24, step 8)", () => {
  it("every run of a scrapper goes the way he faces", async () => {
    const { facingAt } = await import("../src/track");
    const { log, a, b } = found(30, 24);
    const p = playerFor(log, a, b, FULL);
    const bad: string[] = [];
    for (const tr of p.tracks.actors) {
      if (tr.rig !== "scrapper") continue;
      for (const g of tr.segs) {
        if (g.clip !== "dash-push" && g.clip !== "brake") continue;
        const m = tr.moves.find((mv) => mv.from <= g.from + 0.5 && mv.to > g.from + 0.5);
        if (m === undefined || Math.abs(m.x1 - m.x0) < 0.5) continue;
        if (Math.sign(m.x1 - m.x0) !== facingAt(tr, g.from + 0.5)) bad.push(`${tr.id} ${g.clip} at ${Math.round(g.from)} ms: ${m.x0.toFixed(1)} to ${m.x1.toFixed(1)}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
