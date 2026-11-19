#!/usr/bin/env node
/**
 * Size budgets (work package 0). Run: pnpm build && pnpm budgets
 *
 * Measures the built site in apps/web/dist against the size budgets of the brief and exits
 * with code 1 when one is broken. 1 KB is 1024 bytes.
 *
 *   Initial JS             180 KB gzip   the entry script and everything it preloads
 *   CSS                     25 KB gzip   every stylesheet linked from index.html
 *   Fonts                   60 KB        every woff2 file, as shipped
 *   Images                   none        all art is vector data in code (an SVG icon is allowed)
 *   First load, transfer   300 KB        index.html + initial JS + CSS (gzip) + fonts + icon
 *   Audio core sprite      300 KB        audio/sfx.mp3, loaded after the first tap
 *   Audio content sprite   300 KB        audio/sfx-content.mp3, loaded after the core. Split in two
 *                                        (15 Nov 2026) because a sound per weapon, shield and pet
 *                                        (owner: "it depends on the weapon too") does not fit one
 *                                        300 KB file at 64 kbps; the core alone covers every cue.
 *   Music loop             1024 KB each   audio/music/{menu,fight-calm,fight-intense}.mp3 (plan 13.17).
 *                                        Not in the first load: each loads after the first tap,
 *                                        only when its screen needs it, and never with music off.
 *   Music sting             160 KB each   audio/music/{ko,win,lose,level-up}.mp3, same rule.
 *
 * Not measured here: Lighthouse, frame rate, draw time, memory. Those need a browser or a person.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(ROOT, "apps/web/dist");
const KB = 1024;

if (!existsSync(join(DIST, "index.html"))) {
  console.error("budgets: apps/web/dist/index.html is missing. Run `pnpm build` first.");
  process.exit(2);
}

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : [full];
});
const all = walk(DIST);
const raw = (file) => statSync(file).size;
const gz = (file) => gzipSync(readFileSync(file), { level: 9 }).length;
const local = (ref) => {
  if (/^([a-z]+:)?\/\//i.test(ref) || ref.startsWith("data:")) return null;
  const file = resolve(DIST, ref.replace(/^\.?\//, "").split(/[?#]/)[0]);
  return existsSync(file) ? file : null;
};

const html = readFileSync(join(DIST, "index.html"), "utf8");
const tags = [...html.matchAll(/<(script|link)\b[^>]*>/gi)].map((m) => m[0]);
const attr = (tag, name) => (new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag) ?? [])[1];
const initialJs = new Set();
const css = new Set();
const icons = new Set();
for (const tag of tags) {
  const rel = (attr(tag, "rel") ?? "").toLowerCase();
  if (/^<script/i.test(tag) && attr(tag, "src")) { const f = local(attr(tag, "src")); if (f) initialJs.add(f); }
  if (/^<link/i.test(tag) && attr(tag, "href")) {
    const f = local(attr(tag, "href"));
    if (!f) continue;
    if (rel === "modulepreload") initialJs.add(f);
    else if (rel === "stylesheet") css.add(f);
    else if (rel.includes("icon")) icons.add(f);
  }
}
// Static imports of the entry chunks are part of the first load too.
for (const file of [...initialJs]) {
  const source = readFileSync(file, "utf8");
  for (const m of source.matchAll(/\bfrom\s*["'](\.\.?\/[^"']+\.js)["']|\bimport\s*["'](\.\.?\/[^"']+\.js)["']/g)) {
    const f = resolve(dirname(file), m[1] ?? m[2]);
    if (existsSync(f)) initialJs.add(f);
  }
}

const sum = (files, size) => [...files].reduce((n, f) => n + size(f), 0);
const fonts = all.filter((f) => extname(f).toLowerCase() === ".woff2");
const otherFonts = all.filter((f) => [".woff", ".ttf", ".otf", ".eot"].includes(extname(f).toLowerCase()));
const images = all.filter((f) => [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".bmp"].includes(extname(f).toLowerCase()));
const sprite = join(DIST, "audio", "sfx.mp3");
const content = join(DIST, "audio", "sfx-content.mp3");
const audio = all.filter((f) => [".mp3", ".ogg", ".wav", ".m4a", ".webm"].includes(extname(f).toLowerCase()));
const LOOPS = ["menu", "fight-calm", "fight-intense"];
const STINGS = ["ko", "win", "lose", "level-up"];
const musicFile = (slot) => join(DIST, "audio", "music", `${slot}.mp3`);

const jsGz = sum(initialJs, gz);
const cssGz = sum(css, gz);
const fontBytes = sum(fonts, raw);
const firstLoad = gz(join(DIST, "index.html")) + jsGz + cssGz + fontBytes + sum(icons, raw);

const rows = [
  ["Initial JS (gzip)", jsGz, 180 * KB, `${initialJs.size} file(s)`],
  ["CSS (gzip)", cssGz, 25 * KB, `${css.size} file(s)`],
  ["Fonts (woff2)", fontBytes, 60 * KB, `${fonts.length} file(s)`],
  ["First load, total transfer", firstLoad, 300 * KB, "html + JS + CSS + fonts + icon"],
  ["Audio core sprite", existsSync(sprite) ? raw(sprite) : 0, 300 * KB, existsSync(sprite) ? "audio/sfx.mp3" : "no sprite in the build yet"],
  ["Audio content sprite", existsSync(content) ? raw(content) : 0, 300 * KB, existsSync(content) ? "audio/sfx-content.mp3, after the core" : "no content sprite in the build"],
  ...LOOPS.map((s) => [`Music loop ${s}`, existsSync(musicFile(s)) ? raw(musicFile(s)) : 0, 1024 * KB, existsSync(musicFile(s)) ? "lazy, after the first tap" : "not in the build"]),
  ...STINGS.map((s) => [`Music sting ${s}`, existsSync(musicFile(s)) ? raw(musicFile(s)) : 0, 160 * KB, existsSync(musicFile(s)) ? "lazy, after the first tap" : "not in the build"]),
];
const broken = [];
console.log("budgets: apps/web/dist");
for (const [name, value, limit, note] of rows) {
  const ok = value <= limit;
  if (!ok) broken.push(name);
  console.log(`  ${ok ? "ok  " : "OVER"}  ${name.padEnd(28)} ${(value / KB).toFixed(1).padStart(7)} KB of ${(limit / KB).toFixed(0).padStart(3)} KB   ${note}`);
}
const rel = (f) => relative(DIST, f).replaceAll("\\", "/");
if (images.length > 0) { broken.push("Images"); console.log(`  OVER  Images: none are allowed, found ${images.map(rel).join(", ")}`); }
else console.log("  ok    Images: none");
if (otherFonts.length > 0) { broken.push("Font format"); console.log(`  OVER  Fonts must be woff2 only, found ${otherFonts.map(rel).join(", ")}`); }
const known = new Set([sprite, content, ...[...LOOPS, ...STINGS].map(musicFile)]);
const strayAudio = audio.filter((f) => !known.has(f));
if (strayAudio.length > 0) { broken.push("Audio files"); console.log(`  OVER  The two audio sprites and the music files only, found ${strayAudio.map(rel).join(", ")}`); }

if (broken.length > 0) {
  console.error(`budgets FAILED: ${broken.join(", ")}`);
  process.exit(1);
}
console.log("budgets ok");
