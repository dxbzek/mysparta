/**
 * Source scan (work package 1): the core stays pure and whole-number. No file under
 * packages/core/src uses Math.random, Date, Math.sin, Math.cos, Math.pow, the ** operator,
 * document or window. Comments are removed before the scan; strings are scanned too.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const BANNED: readonly [string, RegExp][] = [
  ["Math.random", /\bMath\s*\.\s*random\b/],
  ["Date", /\bDate\b/],
  ["Math.sin", /\bMath\s*\.\s*sin\b/],
  ["Math.cos", /\bMath\s*\.\s*cos\b/],
  ["Math.pow", /\bMath\s*\.\s*pow\b/],
  ["**", /\*\*/],
  ["document", /\bdocument\b/],
  ["window", /\bwindow\b/],
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
  });
}

/** Removes block and line comments, keeping string contents. */
export function stripComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    const n = src[i + 1];
    if (c === "/" && n === "*") { const end = src.indexOf("*/", i + 2); i = end < 0 ? src.length : end + 2; continue; }
    if (c === "/" && n === "/") { const end = src.indexOf("\n", i); i = end < 0 ? src.length : end; continue; }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

export function scan(src: string): string[] {
  const code = stripComments(src);
  return BANNED.filter(([, re]) => re.test(code)).map(([name]) => name);
}

describe("source scan of packages/core/src", () => {
  it("finds the banned calls when they are there (the scan itself works)", () => {
    expect(scan("const x = Math.random();")).toEqual(["Math.random"]);
    expect(scan("const y = 2 ** 3; // fine")).toEqual(["**"]);
    expect(scan("/** a doc comment with ** and Date */ const z = 1;")).toEqual([]);
    expect(scan("new Date()")).toEqual(["Date"]);
  });

  it("finds none of Math.random, Date, Math.sin, Math.cos, Math.pow, **, document, window", () => {
    const hits: string[] = [];
    const all = files(SRC);
    expect(all.length).toBeGreaterThan(20);
    for (const f of all) for (const name of scan(readFileSync(f, "utf8"))) hits.push(`${relative(SRC, f)}: ${name}`);
    expect(hits).toEqual([]);
  });
});
