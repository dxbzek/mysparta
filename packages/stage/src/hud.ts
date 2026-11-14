/**
 * What the DOM around the canvas shows at time `t`: HP bars (the fill drops in 80 ms, the coral
 * trail waits 250 ms then shrinks over 300; a heal fills over 200), the bag strips, how many
 * steps the text log shows, the phase, the winner, and the two values the HUD may not animate
 * on its own clock (the name stickers and the result card's XP bar). A pure function of `t`.
 */
import type { ActorId, BagItem, Side } from "@rankzero/core";
import type { HudFrame } from "./contracts";
import type { HpEvent, Tracks } from "./model";
import { CONTACT, INTRO, OUTRO } from "./tuning";

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

function nowOf(events: readonly HpEvent[], k: number, t: number, max: number): number {
  if (k === 0) return max;
  const e = events[k - 1]!;
  const u = clamp01(e.ms > 0 ? (t - e.at) / e.ms : 1);
  return e.from + (e.to - e.from) * u;
}

/** The trail at `t`, counting the first `k` events. A loss leaves the trail where it was for
 *  250 ms, then shrinks it to the new value over 300 ms. It is never below the fill. */
function trailOf(events: readonly HpEvent[], k: number, t: number, max: number): number {
  const now = nowOf(events, k, t, max);
  if (k === 0) return max;
  const e = events[k - 1]!;
  if (e.kind === "gain") return now;
  const base = trailOf(events, k - 1, e.at, max);
  const w = e.at + CONTACT.hpTrailWaitMs;
  let v: number;
  if (t < w) v = base;
  else if (t < w + CONTACT.hpTrailShrinkMs) v = base + (e.to - base) * ((t - w) / CONTACT.hpTrailShrinkMs);
  else v = e.to;
  return v < now ? now : v;
}

export function hudAt(tr: Tracks, t: number): HudFrame {
  const hp: HudFrame["hp"] = {};
  for (const a of tr.actors) {
    const events = tr.hp.filter((h) => h.actor === a.id);
    let k = 0;
    while (k < events.length && events[k]!.at <= t) k += 1;
    hp[a.id as ActorId] = { now: nowOf(events, k, t, a.maxHp), trail: trailOf(events, k, t, a.maxHp), max: a.maxHp };
  }
  const bag: Record<Side, BagItem[]> = { a: tr.initialBag.a.map((x) => ({ ...x })), b: tr.initialBag.b.map((x) => ({ ...x })) };
  for (const e of tr.bags) if (e.at <= t) bag[e.side] = e.bag.map((x) => ({ ...x }));
  let stepsShown = 0;
  while (stepsShown < tr.applyAt.length && tr.applyAt[stepsShown]! <= t) stepsShown += 1;
  const tl = tr.timeline;
  const phase: HudFrame["phase"] = t < tl.firstActionAt ? "intro" : t < tr.outroAt ? "bout" : t < tl.resultAt ? "outro" : "result";
  return {
    hp, bag, stepsShown, phase,
    winner: t >= tr.outroAt ? tr.winner : null,
    namesIn: clamp01((t - INTRO.namesFrom) / (INTRO.namesTo - INTRO.namesFrom)),
    resultIn: clamp01((t - tl.resultAt) / OUTRO.resultFillMs),
  };
}
