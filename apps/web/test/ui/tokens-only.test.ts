/**
 * Every DOM colour lives in tokens.css, so a change of look is one file. No colour literal in
 * any other stylesheet or component of the fight-screen lane.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));
const DIRS = ["ui", "fight", "debug"];
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const full = join(dir, n);
  return statSync(full).isDirectory() ? walk(full) : [full];
});
export const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;

export function colourLines(text: string): string[] {
  return text.split("\n").filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line) && COLOUR.test(line));
}

describe("colours only in tokens.css", () => {
  const files = DIRS.flatMap((d) => walk(join(SRC, d))).filter((f) => /\.(css|tsx?)$/.test(f));

  it("checks the lane's files", () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it.each(files.map((f) => [f.slice(SRC.length)]))("%s has no colour literal", (rel) => {
    expect(colourLines(readFileSync(join(SRC, rel), "utf8"))).toEqual([]);
  });

  it("would catch one (planted fault)", () => {
    expect(colourLines(".x {\n  color: #ff0000;\n}")).toHaveLength(1);
    expect(colourLines("<div style={{ background: \"rgba(0,0,0,.5)\" }} />")).toHaveLength(1);
  });
});
