/**
 * Stable JSON of a bout log (work package 1): object keys sorted, arrays in order, no spaces,
 * fields that are undefined left out. The same log gives the same text on every engine, so its
 * SHA-256 is the golden digest.
 */
import type { BoutLog } from "./contracts/log";

function write(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? "null" : write(x))).join(",")}]`;
  switch (typeof v) {
    case "number":
      if (!Number.isFinite(v)) throw new Error("canonical: a number that is not finite");
      return JSON.stringify(v);
    case "string":
    case "boolean":
      return JSON.stringify(v);
    case "object": {
      const o = v as Record<string, unknown>;
      const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${write(o[k])}`).join(",")}}`;
    }
    default:
      throw new Error(`canonical: cannot write a ${typeof v}`);
  }
}

export function canonical(log: BoutLog): string {
  return write(log);
}
