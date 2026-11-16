/**
 * A scrapper knocked out falls on his back, away from the fight (review finding 22: the body
 * landed on his own pet, and the reframe cut a hand off at the frame's edge). Two things follow
 * from where the body will lie, measured on the rig's own drawing of the fall's last pose:
 *  - the knockout reframe (camera.ts) is told how far the body reaches behind its mark;
 *  - every pet standing where the body will lie runs out of the way, toward the fight, before the
 *    body lands, and stays there (it does not run home under him);
 *  - the winner's outro place (`stand`): over the body on the fight side, its front a small gap
 *    from the near end of the drawn body. At the next way home it shuffles there instead of to its
 *    home mark, so the outro frame holds the winner and the body together (review round 2, on a
 *    390 x 467 phone canvas: the winner's home mark and the body did not fit in one frame, and the
 *    camera kept the body and cut the winner while "X WINS" showed).
 */
import type { ActorId } from "@rankzero/core";
import { sideOf } from "@rankzero/core";
import { drawnBox } from "../bounds";
import { drawnScale, layWay, planWay, readyAt } from "../footwork";
import { SCRAPPER_REACH, STAGE_W } from "../layout";
import type { Builder } from "../timeline";
import { basePos, facingAt } from "../track";
import { MOVE, OUTCOME, OUTRO } from "../tuning";

/** The knockout focus of `id` falling from time `k` (its clip `clip` played from there), with the
 *  reach of the body on the floor; clears the fall zone of pets. Returns the focus. */
export function fallFocus(b: Builder, id: ActorId, k: number, clip: string): { at: number; x: number; y: number; back: 1 | -1; reach: number; stand?: number } {
  const tr = b.track(id);
  const at = basePos(tr, k);
  const facing = facingAt(tr, k);
  const back: 1 | -1 = facing === 1 ? -1 : 1;
  const info = b.info(tr.rig, clip);
  const box = drawnBox(b.rig, b.rig.samplePose(tr.rig, clip, info.durationMs), b.dress(id), { x: at.x, y: at.floorY, facing });
  const reach = Math.max(0, back === 1 ? box.x1 - at.x : at.x - box.x0);
  // the zone the body falls into: from its mark back to the far end of the drawn body
  clearFallZone(b, id, k, back === 1 ? { x0: at.x, x1: box.x1 } : { x0: box.x0, x1: at.x }, box);
  const focus: { at: number; x: number; y: number; back: 1 | -1; reach: number; stand?: number } = { at: k, x: at.x, y: at.floorY, back, reach };
  // the winner stands over the body, on the fight side, facing it
  const winner: ActorId = sideOf(id) === "a" ? "b0" : "a0";
  if (b.has(winner) && b.status.get(winner) === "up") {
    // the near end of the drawn body (its feet), toward the fight
    const near = back === 1 ? Math.min(at.x, box.x0) : Math.max(at.x, box.x1);
    const s = drawnScale(b, winner);
    const lo = SCRAPPER_REACH.back * s + OUTRO.standEdge;
    const x = Math.min(STAGE_W - lo, Math.max(lo, near - back * (SCRAPPER_REACH.front * s + OUTRO.standGap)));
    focus.stand = x;
    b.standAt.set(winner, x);
    walkOver(b, winner, k, x);
  }
  return focus;
}

/** The winner shuffles over to its outro place as soon as its own blow is done, while the body
 *  falls, so the reframe ends on it already standing there. */
function walkOver(b: Builder, id: ActorId, k: number, x: number): void {
  const tr = b.track(id);
  if (tr.rig !== "scrapper" || b.internal.easedDash === true) { b.out.add(id); return; }
  let start = Math.max(k, readyAt(b, id));
  for (const g of tr.segs) if (g.busy && g.from <= k && g.to !== Infinity && g.to > start) start = g.to;
  const p = basePos(tr, start);
  const way = planWay(b, id, x - p.x, tr.home.y - p.floorY, false, start);
  b.out.delete(id);
  if (way.kind === "still") return;
  b.face(id, start, tr.homeFacing);
  layWay(b, id, start, x, tr.home.y, way);
}

/** Pets that would lie under the falling body run out of its zone, toward the fight. A pet in its
 *  own attack (the one that felled him) is left to finish it. */
function clearFallZone(b: Builder, fallen: ActorId, k: number, body: { x0: number; x1: number }, whole: { x0: number; x1: number }): void {
  const back: 1 | -1 = facingAt(b.track(fallen), k) === 1 ? -1 : 1;
  // the next free edge toward the fight (past his feet too), moved on by each pet that takes a place there
  let edge = back === 1 ? whole.x0 - OUTCOME.fallClear : whole.x1 + OUTCOME.fallClear;
  const pets = b.actors.filter((tr) => tr.rig !== "scrapper" && b.status.get(tr.id) === "up" && k >= tr.showFrom && k < tr.goneAt
    && !tr.attacks.some((w) => k >= w.from && k < w.to))
    // nearest the body first
    .sort((p, q) => Math.abs(b.place(p.id, k).x - (body.x0 + body.x1) / 2) - Math.abs(b.place(q.id, k).x - (body.x0 + body.x1) / 2));
  for (const tr of pets) {
    const q = b.place(tr.id, k);
    const [l, r] = q.facing === 1 ? [tr.reach.back, tr.reach.front] : [tr.reach.front, tr.reach.back];
    if (q.x + r <= body.x0 || q.x - l >= body.x1) continue;
    const x = back === 1 ? edge - r : edge + l;
    edge = back === 1 ? x - l - OUTCOME.fallClear : x + r + OUTCOME.fallClear;
    const ms = Math.max(120, Math.round((Math.abs(x - q.x) / MOVE.fleeSpeed) * 1000));
    b.face(tr.id, k, x < q.x ? -1 : 1);
    b.move(tr.id, k, ms, x, q.y, 0, "inOut");
    b.play(tr.id, "run", k, { until: k + ms });
    b.face(tr.id, k + ms, tr.homeFacing);
    // it stays there: not walked home under the body
    b.out.delete(tr.id);
  }
}

/**
 * Pets standing where a slammed body will land run clear of it before it lands (review round 2: a
 * Body Slam threw its target onto its own boar, and the boar was drawn over his legs on the floor).
 * Each runs to the nearer free side of the landing strip on the stage, and runs home at the next
 * way home like any pet that has moved.
 */
export function clearLanding(b: Builder, by: number, body: { x0: number; x1: number }, keep: ActorId): void {
  const pets = b.actors.filter((tr) => tr.rig !== "scrapper" && b.status.get(tr.id) === "up" && by >= tr.showFrom && by < tr.goneAt
    && tr.id !== keep && !b.snared.has(tr.id) && !tr.attacks.some((w) => by >= w.from && by < w.to));
  let lo = body.x0 - OUTCOME.fallClear;
  let hi = body.x1 + OUTCOME.fallClear;
  for (const tr of pets) {
    const from = Math.max(b.cursor, by - MOVE.slamClearMs);
    const q = b.place(tr.id, from);
    const [l, r] = q.facing === 1 ? [tr.reach.back, tr.reach.front] : [tr.reach.front, tr.reach.back];
    if (q.x + r <= body.x0 || q.x - l >= body.x1) continue;
    const edge = 4 + Math.max(l, r);
    const left = lo - r;
    const right = hi + l;
    const toLeft = left >= edge && (right > STAGE_W - edge || Math.abs(left - q.x) <= Math.abs(right - q.x));
    const x = toLeft ? left : Math.min(STAGE_W - edge, right);
    if (toLeft) lo = x - l - OUTCOME.fallClear; else hi = x + r + OUTCOME.fallClear;
    const ms = Math.min(by - from, Math.max(120, Math.round((Math.abs(x - q.x) / MOVE.fleeSpeed) * 1000)));
    b.face(tr.id, from, x < q.x ? -1 : 1);
    b.move(tr.id, from, Math.max(1, ms), x, q.y, 0, "inOut");
    b.play(tr.id, "run", from, { until: from + Math.max(1, ms) });
    b.face(tr.id, from + Math.max(1, ms), tr.homeFacing);
    b.out.add(tr.id);
  }
}
