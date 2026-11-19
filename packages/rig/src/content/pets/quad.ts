/**
 * A gait as a pose function, shared by the pets drawn from life (raccoon, alley cat, boar, crow;
 * the dog and the goose keep their own). Each leg touches down at a share of the cycle, stays down
 * for the duty factor sliding back at the body's one speed, then swings its joint forward in an arc
 * with the foot hanging at its profile angle. Flights (all feet off the floor) lift the whole
 * animal; the clip is sampled with `air` so the engine leaves it up there.
 */
import type { Hi, Leg, Rot } from "./anatomy";
import { gaitFootByJoint } from "./anatomy";

export type Prof = (s: number) => number;
export interface LegGait { stance: Prof; swing: Prof; lift: number; soft?: boolean }
export interface GaitSpec {
  duration: number;
  /** Share of the cycle at which each leg touches down. */
  phase: Readonly<Record<string, number>>;
  duty: number;
  /** Half the stance stroke, the same for every leg (one body speed). */
  half: number;
  /** Where each foot's stroke is centred (stage x of its contact). */
  home: Readonly<Record<string, number>>;
  leg: (name: string) => LegGait;
  /** The body over the cycle: root drop (down positive) and the angles of every bone not a leg. */
  body: (u: number) => { y: number; rot: Rot };
  /** Flights: [start, width, height] windows of the cycle with every foot off the floor. */
  fly?: readonly (readonly [number, number, number])[];
}
/** A half-sine bump over the cycle window [a, a + w] (wrapping past 1), 0 elsewhere. */
export function bump(u: number, a: number, w: number): number {
  let p = (u - a) % 1;
  if (p < 0) p += 1;
  return p <= w ? Math.sin((Math.PI * p) / w) : 0;
}
export function gaitOf(legs: readonly Leg[], g: GaitSpec): (t: number) => Hi {
  return (t) => {
    const u = t / g.duration;
    const fly = (g.fly ?? []).reduce((a, [s, w, h]) => a + h * bump(u, s, w), 0);
    const feet: Hi["feet"] = {};
    for (const l of legs) {
      const lg = g.leg(l.name);
      const f = gaitFootByJoint({ leg: l.name, down: g.phase[l.name]!, duty: g.duty, half: g.half, lift: lg.lift, angle: lg.swing, stance: lg.stance, soft: lg.soft },
        l, g.home[l.name]!, u);
      feet[l.name] = { x: f.x, y: f.y - fly, a: f.a };
    }
    const b = g.body(u);
    return { x: 0, y: b.y - fly, rot: b.rot, feet };
  };
}
/** The cycle share at which each leg touches down, for tests and sheets. */
export type Footfalls = Readonly<Record<string, number>>;
