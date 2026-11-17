/**
 * A scrapper knocked out falls on his back, away from the fight (review finding 22: the body
 * landed on his own pet, and the reframe cut a hand off at the frame's edge). Two things follow
 * from where the body will lie, measured on the rig's own drawing of the fall's last pose:
 *  - the knockout reframe (camera.ts) is told how far the body reaches behind its mark;
 *  - every pet standing where the body will lie runs out of the way, toward the fight, before the
 *    body lands, and stays there (it does not run home under him);
 *  - the winner's outro place (`stand`): over the body on the fight side, its front a small gap
 *    from the near end of the drawn body, and not on a pet. Once the falling body's legs are out
 *    of the way it shuffles there instead of to its home mark, so the outro frame holds the winner and the body together (review round 2, on a
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

type Focus = NonNullable<Builder["koFocus"]>;

/** The knockout focus of `id` falling from time `k` (its clip `clip` played from there; `real`
 *  gives the fight time of a clip time, for the knockout's slow motion), with the reach of the body
 *  on the floor; clears the fall zone of pets and sends the winner to its outro place. */
export function fallFocus(b: Builder, id: ActorId, k: number, clip: string, real: (clipMs: number) => number = (c) => k + c): Focus {
  const tr = b.track(id);
  const at = basePos(tr, k);
  const facing = facingAt(tr, k);
  const back: 1 | -1 = facing === 1 ? -1 : 1;
  const info = b.info(tr.rig, clip);
  const here = { x: at.x, y: at.floorY, facing };
  const box = drawnBox(b.rig, b.rig.samplePose(tr.rig, clip, info.durationMs), b.dress(id), here);
  const reach = Math.max(0, back === 1 ? box.x1 - at.x : at.x - box.x0);
  const focus: Focus = { at: k, x: at.x, y: at.floorY, back, reach };
  const zone = back === 1 ? { x0: at.x, x1: box.x1 } : { x0: box.x0, x1: at.x };
  // the winner stands over the body, on the fight side, facing it
  const winner: ActorId = sideOf(id) === "a" ? "b0" : "a0";
  let strip: { x0: number; x1: number } | null = null;
  if (b.has(winner) && b.status.get(winner) === "up") {
    const wtr = b.track(winner);
    // the near end of the drawn body (its feet), toward the fight
    const near = back === 1 ? Math.min(at.x, box.x0) : Math.max(at.x, box.x1);
    const s = drawnScale(b, winner);
    const lo = SCRAPPER_REACH.back * s + OUTRO.standEdge;
    const ideal = near - back * (SCRAPPER_REACH.front * s + OUTRO.standGap);
    // not on a pet: a knocked-out pet lies where it fell, a live one rests on its mark; the winner
    // stands on the first clear floor from the body toward the fight (review round 2, the checker:
    // in 44 of 90 bouts with pets the winner's outro place was inside a pet's drawn box)
    const pets = restingPets(b, k);
    const half = OUTRO.standFeet * s;
    const over = (x: number): number => pets.reduce((w, q) => w + Math.max(0, Math.min(q.x1, x + half) - Math.max(q.x0, x - half)), 0);
    // (a touch of `standTouch` is clear floor; it may also stand a little nearer the body)
    const cost = (d: number, c: number): number => { const w = over(c); return w <= OUTRO.standTouch ? Math.abs(d) : 1000 + w; };
    let x = Math.min(STAGE_W - lo, Math.max(lo, ideal));
    let least = cost(0, x);
    for (let d = -OUTRO.standNearer; d <= OUTRO.standSearch && least > 0; d += 2) {
      const c = Math.min(STAGE_W - lo, Math.max(lo, ideal - back * d));
      const w = cost(d, c);
      if (w < least) { least = w; x = c; }
    }
    focus.stand = x;
    strip = { x0: x - half, x1: x + half };
    // the win pose as the rig draws it (a raised broom reaches past the body's own width): the
    // outro frame keeps all of it
    const wb = { l: 0, r: 0 };
    const win = b.info(wtr.rig, "win").durationMs;
    for (let n = 0; n < 8; n++) {
      const q = drawnBox(b.rig, b.rig.samplePose(wtr.rig, "win", (n * win) / 8), b.dress(winner), { x: 0, y: 0, facing: wtr.homeFacing });
      wb.l = Math.max(wb.l, -q.x0); wb.r = Math.max(wb.r, q.x1);
    }
    focus.standBox = { l: wb.l + OUTRO.standRoom, r: wb.r + OUTRO.standRoom };
    b.standAt.set(winner, x);
    // it walks over only once the falling body's legs are out of its way (the checker: it walked in
    // at once, and the two bodies were drawn as one shape while the loser was still upright)
    walkOver(b, winner, Math.max(k, real(legsClear(b, id, clip, here, back, near))), x);
  }
  // the zone the body falls into: from its mark back to the far end of the drawn body
  clearFallZone(b, id, k, zone, box, strip);
  return focus;
}

/** The clip time from which the falling body (without what it holds) stays behind `near`, the
 *  near end of the body as it lies: before it the legs still stand, or kick out toward the fight. */
function legsClear(b: Builder, id: ActorId, clip: string, here: { x: number; y: number; facing: 1 | -1 }, back: 1 | -1, near: number): number {
  const tr = b.track(id);
  const d = b.info(tr.rig, clip).durationMs;
  const bare = { ...b.dress(id), held: null, shield: null };
  let last = 0;
  for (let t = 0; t <= d; t += 20) {
    const q = drawnBox(b.rig, b.rig.samplePose(tr.rig, clip, t), bare, here);
    const fore = back === 1 ? near - q.x0 : q.x1 - near;
    if (fore > OUTRO.legsSlack) last = t + 20;
  }
  return Math.min(d, last);
}

/** The drawn spans of the pets as they will be in the last shot: a knocked-out one where it lies,
 *  one on its way home on its mark. A live pet standing about is left out: it runs clear of the
 *  body and of the winner (`clearFallZone`). */
function restingPets(b: Builder, k: number): { x0: number; x1: number }[] {
  const out: { x0: number; x1: number }[] = [];
  for (const tr of b.actors) {
    if (tr.rig === "scrapper" || k < tr.showFrom || k >= tr.goneAt) continue;
    const st = b.status.get(tr.id);
    if (st === "fled") continue;
    const q = b.place(tr.id, k);
    if (st === "ko") {
      const d = b.info(tr.rig, "ko").durationMs;
      const bx = drawnBox(b.rig, b.rig.samplePose(tr.rig, "ko", d), b.dress(tr.id), q);
      out.push({ x0: bx.x0, x1: bx.x1 });
      continue;
    }
    // a live pet standing there steps aside for him (`clearFallZone`); one on its way home rests on its mark
    const busy = tr.attacks.some((w) => k >= w.from && k < w.to);
    if (!b.out.has(tr.id) && !busy) continue;
    const [l, r] = tr.homeFacing === 1 ? [tr.reach.back, tr.reach.front] : [tr.reach.front, tr.reach.back];
    out.push({ x0: tr.home.x - l, x1: tr.home.x + r });
  }
  return out;
}

/** The winner shuffles over to its outro place from `from` on (once its own blow is done), so the
 *  reframe ends on it already standing there. */
function walkOver(b: Builder, id: ActorId, from: number, x: number): void {
  const tr = b.track(id);
  if (tr.rig !== "scrapper" || b.internal.easedDash === true) { b.out.add(id); return; }
  let start = Math.max(from, readyAt(b, id));
  for (const g of tr.segs) if (g.busy && g.from <= start && g.to !== Infinity && g.to > start) start = g.to;
  const p = basePos(tr, start);
  const way = planWay(b, id, x - p.x, tr.home.y - p.floorY, false, start);
  b.out.delete(id);
  if (way.kind === "still") return;
  b.face(id, start, tr.homeFacing);
  layWay(b, id, start, x, tr.home.y, way);
}

/** Pets that would lie under the falling body run out of its zone, toward the fight. A pet in its
 *  own attack (the one that felled him) is left to finish it. */
function clearFallZone(b: Builder, fallen: ActorId, k: number, body: { x0: number; x1: number }, whole: { x0: number; x1: number },
  winner: { x0: number; x1: number } | null): void {
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
    const inBody = !(q.x + r <= body.x0 || q.x - l >= body.x1);
    const inWinner = winner !== null && !(q.x + r <= winner.x0 || q.x - l >= winner.x1);
    if (!inBody && !inWinner) continue;
    let x = back === 1 ? edge - r : edge + l;
    // not where the winner comes to stand over the body: past him
    if (winner !== null && x + r > winner.x0 - OUTCOME.fallClear && x - l < winner.x1 + OUTCOME.fallClear) {
      x = back === 1 ? winner.x0 - OUTCOME.fallClear - r : winner.x1 + OUTCOME.fallClear + l;
    }
    x = Math.min(STAGE_W - r - 4, Math.max(l + 4, x));
    // never past a fighter, standing or falling, to get there: a pet on the far side of both clears
    // to its own side of the body instead, off the stage's end if it must (level 30 n 268 under sim
    // version 7: a boar waiting off the right end ran across the fallen body and the winner)
    const fighters = b.actors.filter((f) => f.rig === "scrapper" && k >= f.showFrom && k < f.goneAt).map((f) => b.place(f.id, k).x);
    const crosses = (to: number): boolean => fighters.some((fx) => (fx - q.x) * (fx - to) < 0);
    const off = Math.min(l, r);
    const own = q.x > (whole.x0 + whole.x1) / 2
      ? Math.min(STAGE_W + off, Math.max(q.x, whole.x1 + OUTCOME.fallClear + l))
      : Math.max(-off, Math.min(q.x, whole.x0 - OUTCOME.fallClear - r));
    // (only when that spot is clear of the body: near the stage's end a pet the body falls on has
    // no room there and takes the way toward the fight, as before)
    const ownClear = own - l >= whole.x1 || own + r <= whole.x0;
    if (crosses(x) && !crosses(own) && ownClear) {
      if (Math.abs(own - q.x) < 0.5) continue;
      x = own;
    } else {
      edge = back === 1 ? x - l - OUTCOME.fallClear : x + r + OUTCOME.fallClear;
    }
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
    // to the side its mark is on, when the stage has the floor there: from the other side its way
    // home ran through both fighters' legs (the checker, level 30 n 25, the boar)
    const mid = (body.x0 + body.x1) / 2;
    const homeLeft = tr.home.x < mid;
    // (on its own side it may wait just off the stage's end, out of sight, for the body to get up:
    // level 30 n 25, the slammed body lay over the boar's mark to 30 units from the stage's end)
    const off = Math.min(l, r);
    const canL = homeLeft ? left >= -off : left >= edge;
    const canR = homeLeft ? right <= STAGE_W - edge : right <= STAGE_W + off;
    // A side it can reach only by running past a fighter, standing or on the floor, is never taken
    // (the merge of the stage and sim lanes: with its own side full, a raccoon ran from 278 to 147
    // through both fighters, level 30 n 70, and back again after the get-up; 17 of 19 level-30 Body
    // Slams with pets on stage under sim version 7). With no room on a side it can reach, it waits
    // just off the stage's end there, out of sight, beside any pet already waiting.
    const fighters = b.actors.filter((f) => f.rig === "scrapper" && from >= f.showFrom && from < f.goneAt)
      .map((f) => b.place(f.id, from).x);
    const crosses = (x: number): boolean => fighters.some((fx) => (fx - q.x) * (fx - x) < 0);
    const reachL = !crosses(Math.min(left, q.x - 1));
    const reachR = !crosses(Math.max(right, q.x + 1));
    let toLeft = canL && canR ? homeLeft : canL || (!canR && Math.abs(left - q.x) <= Math.abs(right - q.x));
    if (toLeft && !reachL && reachR) toLeft = false;
    else if (!toLeft && !reachR && reachL) toLeft = true;
    const x = toLeft ? Math.max(-off, left) : Math.min(STAGE_W + off, right);
    if (toLeft) lo = x - l - OUTCOME.fallClear; else hi = x + r + OUTCOME.fallClear;
    const ms = Math.min(by - from, Math.max(120, Math.round((Math.abs(x - q.x) / MOVE.fleeSpeed) * 1000)));
    b.face(tr.id, from, x < q.x ? -1 : 1);
    b.move(tr.id, from, Math.max(1, ms), x, q.y, 0, "inOut");
    b.play(tr.id, "run", from, { until: from + Math.max(1, ms) });
    b.face(tr.id, from + Math.max(1, ms), tr.homeFacing);
    b.out.add(tr.id);
  }
}
