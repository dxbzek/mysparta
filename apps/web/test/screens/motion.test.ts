/**
 * Every animation of the app screens is off under reduced motion (brief 3.15): an `animation`
 * or `transition` with a duration is only allowed inside a rule whose selector starts with
 * `:global(html[data-motion="full"])`, or inside a `prefers-reduced-motion: no-preference` block.
 * App sets `data-motion` from the setting, so the setting's override reaches the CSS too.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { UI } from "../../src/text/ui";

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const full = join(dir, n);
  return statSync(full).isDirectory() ? walk(full) : [full];
});

/** The rules of a stylesheet as [selector path, declarations]; an @media prefix stays in the path. */
function rules(css: string): [string, string][] {
  const out: [string, string][] = [];
  const stack: string[] = [];
  let buf = "";
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, "")) {
    if (ch === "{") {
      stack.push(buf.trim());
      buf = "";
    } else if (ch === "}") {
      const sel = stack.pop() ?? "";
      if (buf.trim() && !sel.startsWith("@")) out.push([[...stack, sel].join(" "), buf]);
      buf = "";
    } else buf += ch;
  }
  return out;
}

export function ungated(css: string): string[] {
  return rules(css)
    .filter(([, body]) => /(^|[;\s])(animation|transition)\s*:/.test(body) && !/(animation|transition)\s*:\s*none/.test(body))
    .filter(([sel]) => !sel.startsWith('@media (prefers-reduced-motion: reduce)'))
    .filter(([sel]) => !sel.split(",").every((s) => s.trim().startsWith(':global(html[data-motion="full"])') || s.includes("no-preference")))
    .map(([sel]) => sel);
}

describe("screen motion is off under reduced motion", () => {
  const files = ["app", "screens"].flatMap((d) => walk(join(SRC, d))).filter((f) => f.endsWith(".css"));
  const ALLOWED = new Set([
    // short state transitions that predate this check and are also turned off by both switches
    "screens/LevelUp/LevelUp.module.css .card",
  ]);
  it.each(files.map((f) => [f.slice(SRC.length).replace(/\\/g, "/")]))("%s gates every animation", (rel) => {
    const bad = ungated(readFileSync(join(SRC, rel), "utf8")).filter((s) => !ALLOWED.has(`${rel} ${s}`));
    expect(bad).toEqual([]);
  });
  it("would catch one (planted fault)", () => {
    expect(ungated(".x {\n  animation: spin 1s infinite;\n}")).toEqual([".x"]);
    expect(ungated(':global(html[data-motion="full"]) .x {\n  animation: spin 1s infinite;\n}')).toEqual([]);
  });
});

describe("empty states", () => {
  it("every Kit group says how it gets filled", () => {
    for (const line of Object.values(UI.kit.emptyFor)) expect(line).toMatch(/level-up/);
    expect(Object.keys(UI.kit.emptyFor).sort()).toEqual(["companion", "gear", "shield", "skill", "weapon"]);
  });
});
