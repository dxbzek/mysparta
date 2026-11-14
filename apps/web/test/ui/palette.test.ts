/**
 * One colour, one value. The canvas colours belong to the rig (gate/style.ts, exported through
 * the rig seam as `palette` from I1) and the DOM colours to tokens.css. When a colour NAME is in
 * both, its value must be the same. Skipped only while the rig seam exports no palette (plan 4).
 * Name matching: the rig name in kebab case equals the token name after `--c-` (for example
 * `ink` = `--c-ink`, `hpTrail` = `--c-hp-trail`).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as rigSeam from "../../src/seams/rig";

const CSS = readFileSync(new URL("../../src/tokens.css", import.meta.url), "utf8");
const palette = (rigSeam as unknown as { palette?: Readonly<Record<string, string>> }).palette;

const kebab = (s: string): string => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

function domColours(): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of CSS.matchAll(/--c-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) out.set(m[1]!, m[2]!.toLowerCase());
  return out;
}

describe.skipIf(palette === undefined)("rig palette and tokens.css agree", () => {
  it("every shared colour name has one value", () => {
    const dom = domColours();
    const clashes: string[] = [];
    let shared = 0;
    for (const [name, value] of Object.entries(palette ?? {})) {
      const token = dom.get(kebab(name));
      if (token === undefined || typeof value !== "string") continue;
      shared += 1;
      if (token !== value.toLowerCase()) clashes.push(`${name}: rig ${value}, tokens.css ${token}`);
    }
    expect(shared).toBeGreaterThan(0);
    expect(clashes).toEqual([]);
  });
});

describe("palette test plumbing", () => {
  it("reads the tokens it would compare", () => {
    expect(domColours().get("ink")).toMatch(/^#[0-9a-f]{6}$/);
  });
});
