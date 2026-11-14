/**
 * One clock (brief 3.12): nothing in src/fight/ uses a CSS animation, a CSS transition or a
 * timer of its own. The frame loop is requestAnimationFrame driving the fight clock.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIR = fileURLToPath(new URL("../../src/fight/", import.meta.url));
const BANNED = /\bsetTimeout\b|\bsetInterval\b|@keyframes|\banimation(-[a-z]+)?\s*:|\btransition(-[a-z]+)?\s*:|\.animate\(/;

export function offending(text: string): string[] {
  return text.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && BANNED.test(l));
}

describe("src/fight has no CSS animation and no timer", () => {
  const files = readdirSync(DIR).filter((f) => /\.(tsx?|css)$/.test(f));
  it("checks every file", () => {
    expect(files.length).toBeGreaterThanOrEqual(9);
  });
  it.each(files)("%s", (f) => {
    expect(offending(readFileSync(join(DIR, f), "utf8"))).toEqual([]);
  });
  it("would catch one (planted fault)", () => {
    expect(offending("const id = setTimeout(go, 300);")).toHaveLength(1);
    expect(offending(".x { transition: transform 200ms; }")).toHaveLength(1);
    expect(offending("@keyframes slide { }")).toHaveLength(1);
  });
});
