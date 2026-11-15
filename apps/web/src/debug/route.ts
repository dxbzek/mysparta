/**
 * Debug route parsing (fight-screen lane). Hash routes:
 *   #/debug/bout?fixture=<name>&t=<ms>&paused=1&speed=2&reduced=1&sound=0&replay=1
 *   #/debug/bout?seed=<n>&a=<snapshot>&b=<snapshot>&t=<ms>&paused=1     (needs the sim)
 *   #/debug/bout?find=<n>&level=<L>   candidate n of `pnpm find-bout --level L` (no --kit): a real sim bout
 *   #/debug/locker            the Locker view with fixture props
 *   #/debug/ui                every UI part on one page (screenshots, overflow checks)
 */
import type { BoutFixtureName } from "@rankzero/core/fixtures";

export type DebugRoute =
  | { page: "bout"; fixture: BoutFixtureName | null; seed: number | null; a: string | null; b: string | null;
      find: number | null; level: number;
      t: number; paused: boolean; speed: 1 | 2; reduced: "on" | "off" | "system"; sound: boolean; replay: boolean }
  | { page: "locker"; levelUp: boolean; done: boolean }
  | { page: "ui" }
  | { page: "unknown"; hash: string };

const FIXTURES: readonly BoutFixtureName[] = ["bout-gate", "bout-all-steps", "bout-cap"];

export function parseDebugRoute(hash: string): DebugRoute {
  const clean = hash.replace(/^#/, "");
  const [path = "", query = ""] = clean.split("?");
  const q = new URLSearchParams(query);
  const num = (k: string): number | null => {
    const v = q.get(k);
    if (v === null || v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  if (path === "/debug/bout") {
    const f = q.get("fixture");
    const fixture = f !== null && (FIXTURES as readonly string[]).includes(f) ? (f as BoutFixtureName) : null;
    const seed = num("seed");
    const find = num("find");
    const reduced = q.get("reduced");
    return {
      page: "bout",
      fixture: fixture ?? (seed === null && find === null ? "bout-gate" : null),
      seed,
      a: q.get("a"),
      b: q.get("b"),
      find,
      level: Math.max(1, Math.min(30, Math.round(num("level") ?? 1))),
      t: Math.max(0, num("t") ?? 0),
      paused: q.get("paused") === "1",
      speed: q.get("speed") === "2" ? 2 : 1,
      reduced: reduced === "1" ? "on" : reduced === "0" ? "off" : "system",
      sound: q.get("sound") !== "0",
      replay: q.get("replay") === "1",
    };
  }
  if (path === "/debug/locker") return { page: "locker", levelUp: q.get("levelup") === "1", done: q.get("done") === "1" };
  if (path === "/debug/ui") return { page: "ui" };
  return { page: "unknown", hash };
}
