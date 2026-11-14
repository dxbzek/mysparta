#!/usr/bin/env node
/**
 * Build the two web fonts (fight-screen lane). Run: pnpm subset-fonts
 *
 * Fetches the two SIL OFL 1.1 source fonts from the Google Fonts repository (pinned by git blob
 * hash, so a changed upstream file stops the build instead of slipping in), cuts each down to the
 * characters the game prints, and writes:
 *
 *   apps/web/public/fonts/display.woff2       Big Shoulders Display, weight 900 only (headings, numbers)
 *   apps/web/public/fonts/body.woff2          Inter, weights 400 to 700 kept as a variable axis
 *   apps/web/public/fonts/OFL-BigShouldersDisplay.txt, OFL-Inter.txt   the licence files, unchanged
 *
 * Budget: 60 KB for the two woff2 files together (brief 3.16). The tool fails above it.
 * Neither licence names a Reserved Font Name, so the cut files may keep the family names.
 *
 * Sources are cached outside the repo (system temp folder). Flags: --src <dir> to use local copies
 * named as in SOURCES (no network), --out <dir>.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const OUT = resolve(arg("out") ?? join(ROOT, "apps/web/public/fonts"));
const SRC = resolve(arg("src") ?? join(tmpdir(), "rankzero-font-src"));
const BUDGET = 60 * 1024;
const RAW = "https://raw.githubusercontent.com/google/fonts/main/ofl";

/** `blob` is the git blob hash of the file as fetched on 14 November 2026. */
const SOURCES = [
  { file: "BigShouldersDisplay.ttf", url: `${RAW}/bigshouldersdisplay/BigShouldersDisplay%5Bwght%5D.ttf`, blob: "abb8c8d40a9824c48e206dd293a2aa2e1dd692f7" },
  { file: "OFL-BigShouldersDisplay.txt", url: `${RAW}/bigshouldersdisplay/OFL.txt`, blob: "b5a4e0dff07361d6a5da5d7bb403796d3e08a8be" },
  { file: "Inter.ttf", url: `${RAW}/inter/Inter%5Bopsz%2Cwght%5D.ttf`, blob: "047c92f6e2212473dc436020afed689527076d44" },
  { file: "OFL-Inter.txt", url: `${RAW}/inter/OFL.txt`, blob: "21f6aff961064c2e429f570995e446bcdd555422" },
];

/** Printable ASCII plus the few marks the game's text uses. */
const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("");
const EXTRA = "–—‘’“”…×·−•";
const TEXT = ASCII + EXTRA;

const OUTPUTS = [
  { from: "BigShouldersDisplay.ttf", to: "display.woff2", axes: { wght: 900 } },
  { from: "Inter.ttf", to: "body.woff2", axes: { wght: { min: 400, max: 700, default: 400 }, opsz: 14 } },
];

const gitBlob = (bytes) => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");

async function fetchSource(s) {
  const path = join(SRC, s.file);
  if (!existsSync(path)) {
    if (arg("src")) throw new Error(`missing ${path}`);
    const res = await fetch(s.url, { headers: { "user-agent": "font-subset-tool" } });
    if (!res.ok) throw new Error(`${s.url}: HTTP ${res.status}`);
    mkdirSync(SRC, { recursive: true });
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  const bytes = readFileSync(path);
  const got = gitBlob(bytes);
  if (got !== s.blob) throw new Error(`${s.file}: blob ${got}, expected ${s.blob}. The upstream file changed; read its licence again before pinning it.`);
  return bytes;
}

const bytes = {};
for (const s of SOURCES) bytes[s.file] = await fetchSource(s);

mkdirSync(OUT, { recursive: true });
let total = 0;
for (const o of OUTPUTS) {
  const out = await subsetFont(bytes[o.from], TEXT, { targetFormat: "woff2", variationAxes: o.axes });
  writeFileSync(join(OUT, o.to), out);
  total += out.length;
  console.log(`${o.to.padEnd(14)} ${(out.length / 1024).toFixed(1).padStart(6)} KB  from ${o.from}`);
}
for (const s of SOURCES.filter((x) => x.file.endsWith(".txt"))) writeFileSync(join(OUT, s.file), bytes[s.file]);
console.log(`total          ${(total / 1024).toFixed(1).padStart(6)} KB  (budget ${BUDGET / 1024} KB)`);
if (total > BUDGET) {
  console.error("subset-fonts: over the 60 KB font budget");
  process.exit(1);
}
