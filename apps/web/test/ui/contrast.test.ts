/**
 * Contrast of every text token against its own background (brief 3.2, 3.15): 4.5:1 or better.
 * The pairs come from the naming rule of tokens.css: `--t-on-<bg>[-variant]` sits on `--c-<bg>`.
 * A text token with no matching background, or a pair below 4.5, fails.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(new URL("../../src/tokens.css", import.meta.url), "utf8");

export function tokens(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) out.set(m[1]!, m[2]!.toLowerCase());
  return out;
}

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Every `t-on-*` token with the background it belongs to: the longest `c-*` name it starts with. */
export function pairs(map: Map<string, string>): { text: string; bg: string; ratio: number }[] {
  const bgs = [...map.keys()].filter((k) => k.startsWith("c-")).map((k) => k.slice(2)).sort((p, q) => q.length - p.length);
  const out: { text: string; bg: string; ratio: number }[] = [];
  for (const key of map.keys()) {
    if (!key.startsWith("t-on-")) continue;
    const rest = key.slice(5);
    const bg = bgs.find((b) => rest === b || rest.startsWith(`${b}-`));
    if (bg === undefined) throw new Error(`--${key} has no --c-<background> it belongs to`);
    out.push({ text: key, bg: `c-${bg}`, ratio: contrast(map.get(key)!, map.get(`c-${bg}`)!) });
  }
  return out;
}

describe("tokens.css contrast", () => {
  const map = tokens(CSS);
  const all = pairs(map);

  it("finds the token pairs", () => {
    expect(all.length).toBeGreaterThanOrEqual(20);
  });

  it.each(all.map((p) => [p.text, p.bg, p.ratio] as const))("--%s on --%s is 4.5:1 or better (%f)", (_t, _b, ratio) => {
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("would catch a bad pair (planted fault on a copy)", () => {
    const bad = tokens(CSS.replace("--t-on-panel-dim: #4f4a43", "--t-on-panel-dim: #a8a39b"));
    const low = pairs(bad).filter((p) => p.ratio < 4.5).map((p) => p.text);
    expect(low).toEqual(["t-on-panel-dim"]);
  });
});
