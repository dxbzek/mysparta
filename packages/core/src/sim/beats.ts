/**
 * Beat types of a bout (work package 1): the kinds of moment a viewer can tell apart. Used by the
 * variety test, the balance report and the bout finder. Not part of the log.
 */
import type { BoutLog } from "../contracts/log";
import { isScrapper } from "../contracts/log";

export const BEAT_TYPES = ["hit", "miss", "block", "crit", "combo", "draw", "swap", "throw", "disarm",
  "intercept", "riposte", "move", "companion-ko"] as const;
export type Beat = (typeof BEAT_TYPES)[number];

export function beatsOf(log: BoutLog): Set<Beat> {
  const out = new Set<Beat>();
  for (const s of log.steps) {
    switch (s.t) {
      case "attack": case "intercept": case "riposte": case "throw":
        out.add(s.outcome === "hit" ? "hit" : s.outcome === "evade" ? "miss" : "block");
        if (s.crit) out.add("crit");
        if (s.t === "attack" && s.why === "combo") out.add("combo");
        if (s.t === "throw") out.add("throw");
        if (s.t === "intercept") out.add("intercept");
        if (s.t === "riposte") out.add("riposte");
        break;
      case "draw": out.add("draw"); break;
      case "swap": out.add("swap"); break;
      case "disarm": if (s.resisted !== true) out.add("disarm"); break;
      case "move": out.add("move"); break;
      case "ko": if (!isScrapper(s.actor)) out.add("companion-ko"); break;
      default: break;
    }
  }
  return out;
}
