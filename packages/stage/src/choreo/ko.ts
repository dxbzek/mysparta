/**
 * Knocked out: the fall clip, and the body stays down. The scrapper felled by the kill step
 * gets the knockout beat: the 220 ms hit-stop of its blow, then time scale 0.4 for 500 ms,
 * then the rest of the fall at full speed. A companion just falls and stays down.
 */
import type { StepOf } from "@rankzero/core";
import { isScrapper } from "@rankzero/core";
import type { Builder } from "../timeline";
import { fallFocus } from "./fall";
import { KNOCKOUT } from "../tuning";
import { tarpOff } from "./snare";
import type { Placed } from "./index";
import type { ActorId } from "@rankzero/core";
import { drawnBox } from "../bounds";
import { homeSpan } from "../camera";
import { FLOOR_Y, PET_MARKS, STAGE_W } from "../layout";

/** How far a knocked-out body stays from the stage's ends, and a pet's lying box from another's. */
const REST_EDGE = 3;
const REST_GAP = 2;

/**
 * Where a knocked-out body comes to rest (round-2 close, owner on the recorded fights: a downed
 * goose lay between the fighters for 19 s with their shoes on it, a raccoon under the winner's
 * front shoe, a dead goose half off the frame's left edge, the loser's body and hammer past the
 * right edge under "X WINS"). It slides there in its fall, eased out:
 *  - a companion is knocked back out of the fighters' way, onto a floor line behind theirs
 *    (`PET_MARKS.rows`, the back rows the pets stand on), clear of every fighter's feet whatever
 *    they do later, of the other downed pets, and inside the bout's frame;
 *  - a scrapper's lying body, what it held included, stays inside the stage.
 */
function restClear(b: Builder, id: ActorId, k: number, end: number, clip: string): void {
  const tr = b.track(id);
  const q = b.place(id, k);
  const d = b.info(tr.rig, clip).durationMs;
  const box = drawnBox(b.rig, b.rig.samplePose(tr.rig, clip, d), b.dress(id), { x: q.x, y: q.y, facing: q.facing });
  const l = q.x - box.x0;
  const r = box.x1 - q.x;
  let x = q.x;
  let y = q.y;
  if (tr.rig === "scrapper") {
    x = Math.min(STAGE_W - REST_EDGE - r, Math.max(REST_EDGE + l, x));
  } else {
    const span = homeSpan(b);
    const lo = Math.max(span.x0, 0) + REST_EDGE + l;
    const hi = Math.min(span.x1, STAGE_W) - REST_EDGE - r;
    const others = b.actors.filter((a) => a.id !== id && a.rig !== "scrapper" && b.status.get(a.id) === "ko").map((a) => {
      const p = b.place(a.id, end);
      const ad = b.info(a.rig, "ko").durationMs;
      const ob = drawnBox(b.rig, b.rig.samplePose(a.rig, "ko", ad), b.dress(a.id), p);
      return { x0: ob.x0, x1: ob.x1, y: p.y };
    });
    const free = (cx: number, cy: number): boolean => others.every((o) => Math.abs(o.y - cy) > 6 || cx + r + REST_GAP <= o.x0 || cx - l - REST_GAP >= o.x1);
    // the back rows, a little behind the fighters' floor line first; nearest spot on each
    // (and not on the floor line of a live pet's mark: a fighter walks to a pet's depth to hit it)
    const live = b.actors.filter((a) => a.id !== id && a.rig !== "scrapper" && b.status.get(a.id) === "up").map((a) => a.home.y);
    const back = PET_MARKS.rows.filter((row) => row <= FLOOR_Y - 20);
    const clearRows = back.filter((row) => live.every((y) => Math.abs(y - row) >= 10));
    const rows = clearRows.length > 0 ? clearRows : back;

    let best: { x: number; y: number; cost: number } | null = null;
    for (const row of rows) {
      const y0 = Math.min(q.y, row);
      for (let dx = 0; dx <= 120; dx += 2) {
        for (const s of [1, -1]) {
          const cx = Math.min(hi, Math.max(lo, q.x + s * dx));
          if (!free(cx, y0)) continue;
          const cost = Math.abs(cx - q.x) + Math.abs(y0 - q.y) * 0.5;
          if (best === null || cost < best.cost) best = { x: cx, y: y0, cost };
          break;
        }
        if (best !== null && best.y === y0) break;
      }
    }
    if (best !== null) { x = best.x; y = best.y; } else x = Math.min(hi, Math.max(lo, x));
  }
  if (Math.abs(x - q.x) < 0.5 && Math.abs(y - q.y) < 0.5) return;
  b.move(id, k, Math.max(120, end - k), x, y, 0, "out");
}

export function ko(
b: Builder, step: StepOf<"ko">, i: number): Placed {
  if (!b.has(step.actor)) return { at: b.cursor, apply: b.cursor };
  const tr = b.track(step.actor);
  const hitAt = b.lastHitAt.get(step.actor) ?? b.cursor;
  // (a hit frees a snared actor before it falls; should one still be pinned, its tarp comes off)
  tarpOff(b, step.actor, hitAt, b.opts.cosmeticSeed + i);
  const kill = isScrapper(step.actor) && b.killStep >= 0 && i > b.killStep && !b.koShown;
  const stop = b.cause !== null && b.cause.at === hitAt ? b.cause.hitStop : 0;
  const k = hitAt + stop;
  const clip = tr.rig === "scrapper" ? "ko-fall" : "ko";
  const info = b.info(tr.rig, clip);
  let fallEnd: number;
  if (kill && b.motion.slowMotion) {
    const slowClip = KNOCKOUT.slowMs * KNOCKOUT.slowScale;
    b.play(step.actor, clip, k, { rate: KNOCKOUT.slowScale, until: k + KNOCKOUT.slowMs });
    b.play(step.actor, clip, k + KNOCKOUT.slowMs, { c0: slowClip, rate: 1, hold: true });
    fallEnd = k + KNOCKOUT.slowMs + Math.max(0, info.durationMs - slowClip);
  } else {
    b.play(step.actor, clip, k, { hold: true });
    fallEnd = k + info.durationMs;
  }
  restClear(b, step.actor, k, fallEnd, clip);
  const landAt = info.events.find((e) => e.name === "land")?.t;
  if (landAt !== undefined) {
    const slowPart = kill && b.motion.slowMotion ? KNOCKOUT.slowMs * KNOCKOUT.slowScale : 0;
    const when = landAt <= slowPart ? k + landAt / KNOCKOUT.slowScale : k + (slowPart > 0 ? KNOCKOUT.slowMs : 0) + (landAt - slowPart);
    b.cue(when, i, "landing");
    const p = b.place(step.actor, when);
    b.fx.push({ fx: "dust", from: when, to: when + 360, x: p.x, y: p.y, facing: p.facing, seed: b.opts.cosmeticSeed + i, contact: null });
  }
  b.status.set(step.actor, "ko");
  b.out.delete(step.actor);
  if (kill) {
    b.koShown = true;
    // the reframe takes in the body as drawn, and no pet lies under it (choreo/fall.ts)
    const slowClip = b.motion.slowMotion ? KNOCKOUT.slowMs * KNOCKOUT.slowScale : 0;
    b.koFocus = fallFocus(b, step.actor, k, clip, (c) => (c <= slowClip ? k + c / KNOCKOUT.slowScale : k + (slowClip > 0 ? KNOCKOUT.slowMs : 0) + c - slowClip));
    if (b.cursor < fallEnd) b.cursor = fallEnd;
  } else if (b.cursor < k + 200) b.cursor = k + 200;
  return { at: k, apply: k };
}
