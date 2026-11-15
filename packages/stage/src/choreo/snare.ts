/** Snared: the tarp lies over the target and wobbles until it is freed. A scrapper plays its
 *  snared clip under it; a companion holds its hit pose. A Grapple hold (content v2) snares
 *  with no tarp: the target just holds its snared clip, pinned, until it is freed. */
import type { StepOf } from "@rankzero/core";
import type { Builder } from "../timeline";
import type { Placed } from "./index";

export function snare(b: Builder, step: StepOf<"snare">, i: number): Placed {
  const tarped = b.tarpLanding !== null && b.tarpLanding.target === step.target;
  const landing = tarped ? b.tarpLanding!.at : b.cursor;
  b.tarpLanding = null;
  if (!b.has(step.target)) return { at: landing, apply: landing };
  const tr = b.track(step.target);
  const seg = tr.rig === "scrapper"
    ? b.play(step.target, "snared", landing, { until: Infinity })
    : b.play(step.target, "hit", landing, { c0: 60, rate: 0, until: Infinity });
  const p = b.place(step.target, landing);
  const cover = { fx: "tarp" as const, from: landing, to: tarped ? Infinity : landing, x: 0, y: 0, facing: p.facing,
    seed: b.opts.cosmeticSeed + i, contact: null, follow: step.target, loopMs: 900 };
  if (tarped) b.fx.push(cover);
  b.snared.set(step.target, { seg, cover });
  if (b.cursor < landing + 200) b.cursor = landing + 200;
  return { at: landing, apply: landing };
}
