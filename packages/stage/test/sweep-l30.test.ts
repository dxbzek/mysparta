/**
 * Every level-30 find-bout bout from n 0 to 399 (tools/find-bout.ts: rivals 2n and 2n + 1, bout
 * seed hash("find-bout", n)), on the full rig and the app's phone canvases, for two stage defects
 * the content v3 re-pin found (content v3, batch 2):
 *  - a blow at a snared pet behind its owner pushed a fighter out of the frame (18 of 400): the
 *    owner stepped back past his pet up to 90 units from his mark, past the tall phone's 200-unit
 *    view (timeline.ts ownerGives now keeps inside `viewBounds`);
 *  - a shield slung for a Move lost its weapon in the crossfade back to the guard (35 of 400): a
 *    swap, a Snatch or a disarm in that crossfade took the weapon off the back with no flight from
 *    there, a weapon drawn in it was put on the back, and a throw wound up with the item still on
 *    the back (choreo/props.ts slungAt, frame.ts).
 * Checked on every bout: no fighter out of the frame before the knockout (framing.test.ts's line),
 * no scrapper hitting a pet nearer its owner than the body gap (spacing.test.ts's line, which the
 * owner's shorter step must keep), and every item a sling put aside is still on the back, in the
 * hand, or leaves from where it was drawn.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { BoutLog } from "@rankzero/core";
import { REALM_SALT, combineSeed, rivalSnapshot, simulateFight } from "@rankzero/core";
import { contentPack, createRig, gatePack } from "@rankzero/rig";
import { CAMERA, cameraAt } from "../src/camera";
import { buildPlayer } from "../src/createFightPlayer";
import type { StagePlayer } from "../src/createFightPlayer";
import { BODY_GAP } from "../src/layout";
import { BLEND } from "../src/tuning";
import { optsFor } from "./lib/setup";

const rig = createRig(gatePack, contentPack);
const PHONE = { w: 390, h: 467 };
const PHONE_SHORT = { w: 390, h: 351 };
const BOUTS = 400;
const SWINGS = new Set(["attack", "riposte", "intercept"]);

/** The first frame (every 50 ms) in which a standing fighter's middle is outside the view. */
function outOfFrame(p: StagePlayer): string | null {
  const ko = p.tracks.koFocus?.at ?? p.timeline.durationMs;
  for (const canvas of [PHONE, PHONE_SHORT]) {
    for (let t = 1500; t < ko; t += 50) {
      const c = cameraAt(p.tracks, t, canvas, false);
      const v = { x0: c.x0, x1: c.x0 + canvas.w / c.k };
      for (const a of p.frame(t).actors) {
        if (a.rig !== "scrapper" || a.clip.startsWith("ko")) continue;
        const k = (CAMERA.excursion - (canvas === PHONE ? 4 : 0)) * (a.dress.scale > 0 ? a.dress.scale : 1) - 0.5;
        if (a.place.x < v.x0 + k || a.place.x > v.x1 - k) return `${canvas.h} px at ${t} ms: ${a.id} ${a.clip} at ${a.place.x.toFixed(0)}, view ${v.x0.toFixed(0)}-${v.x1.toFixed(0)}`;
      }
    }
  }
  return null;
}

/** Contacts on a pet where the scrapper striking stands nearer its owner than the body gap. */
function nearOwner(p: StagePlayer, log: BoutLog): string[] {
  const out: string[] = [];
  p.timeline.contacts.forEach((c) => {
    const st = log.steps[c.step]!;
    if (!SWINGS.has(st.t) || !("target" in st) || st.target === undefined) return;
    const f = p.frame(c.at);
    const atk = f.actors.find((q) => q.id === st.actor);
    const tg = f.actors.find((q) => q.id === st.target);
    if (atk === undefined || tg === undefined || atk.rig !== "scrapper" || tg.rig === "scrapper") return;
    const owner = f.actors.find((q) => q.id === `${String(st.target)[0]}0`);
    if (owner === undefined || owner.clip === "ko-fall") return;
    const toward = Math.sign(atk.place.x - owner.place.x) === Math.sign(p.tracks.byId.get(atk.id)!.home.x - p.tracks.byId.get(owner.id)!.home.x);
    const d = Math.abs(atk.place.x - owner.place.x);
    if (!toward || d < BODY_GAP.body * Math.max(atk.dress.scale, owner.dress.scale) - 0.5) out.push(`step ${c.step}: ${d.toFixed(1)} from the owner${toward ? "" : ", past him"}`);
  });
  return out;
}

/** Items a shield's sling put aside for a Move that are not on the back, not in the hand, and did
 *  not leave from where they were drawn, half a crossfade after it ends. */
function slingLosses(p: StagePlayer): string[] {
  const out: string[] = [];
  for (const g of p.tracks.slings) {
    if (!g.shield || g.to === Infinity) continue;
    const t = g.to + BLEND.maxMs / 2;
    const a = p.frame(t).actors.find((q) => q.id === g.actor);
    if (a === undefined || a.clip.startsWith("ko")) continue;
    const had = p.frame(g.from + 1).actors.find((q) => q.id === g.actor)?.slung ?? [];
    if (had.length === 0) continue;
    // (a shield knocked off meanwhile is on the floor)
    if (p.tracks.byId.get(g.actor)!.shields.some((c) => c.from > g.from && c.from <= t)) continue;
    const slung = a.slung ?? [];
    const tag = `${g.actor} sling ${Math.round(g.from)}-${Math.round(g.to)}`;
    if (a.dress.shield !== null) out.push(`${tag}: the shield is back on the arm`);
    for (const it of slung) if (!had.includes(it)) out.push(`${tag}: ${it} is on the back, not put aside`);
    for (const it of had) {
      if (slung.includes(it) || a.dress.held === it) continue;
      const f = p.tracks.flights.find((q) => q.item === it && q.from >= g.from && q.from <= t);
      if (f === undefined) { out.push(`${tag}: ${it} vanished`); continue; }
      const before = p.frame(f.from - 1).actors.find((q) => q.id === g.actor)!;
      const k = (before.slung ?? []).indexOf(it);
      if (k < 0) {
        if (before.dress.held !== it) out.push(`${tag}: ${it} left from neither the back nor the hand`);
        continue;
      }
      // draw.ts drawSlung's spot for the k-th slung item
      const sc = before.dress.scale > 0 ? before.dress.scale : 1;
      const sx = before.place.x - before.place.facing * (6 + 3 * k) * sc;
      const sy = before.place.y - (58 - 6 * k) * sc;
      if (Math.hypot(f.path.x0 - sx, f.path.y0 - sy) > 2) out.push(`${tag}: ${it} left from ${f.path.x0.toFixed(0)},${f.path.y0.toFixed(0)}, not the back`);
    }
  }
  return out;
}

const found = { frame: [] as string[], owner: [] as string[], sling: [] as string[], slings: 0 };
beforeAll(() => {
  for (let n = 0; n < BOUTS; n++) {
    const a = rivalSnapshot(REALM_SALT, 30, 2 * n);
    const b = rivalSnapshot(REALM_SALT, 30, 2 * n + 1);
    const log = simulateFight(combineSeed("find-bout", n), a, b, 1);
    const p = buildPlayer(log, a, b, rig, optsFor(log, false, log.seed));
    const o = outOfFrame(p);
    if (o !== null) found.frame.push(`n ${n}, ${o}`);
    for (const x of nearOwner(p, log)) found.owner.push(`n ${n}, ${x}`);
    for (const x of slingLosses(p)) found.sling.push(`n ${n}, ${x}`);
    found.slings += p.tracks.slings.filter((g) => g.shield).length;
  }
}, 600_000);

describe(`level-30 sweep, ${BOUTS} bouts (content v3 batch 2 stage defects)`, () => {
  it("no fighter leaves the frame before the knockout (a blow at a snared pet pushed one out in 18)", () => {
    expect(found.frame).toEqual([]);
  });
  it("no scrapper hitting a pet stands nearer its owner than the body gap", () => {
    expect(found.owner).toEqual([]);
  });
  it("a weapon slung with a shield for a Move is never lost in the crossfade (35 before)", () => {
    expect(found.slings).toBeGreaterThan(100);
    expect(found.sling).toEqual([]);
  });
});
