#!/usr/bin/env node
/**
 * Build the sound sprite (fight-screen lane). Run: pnpm build-audio [--src <dir>]
 *
 * Writes apps/web/public/audio/sfx.mp3 (one mono MP3, 300 KB cap) and sfx.json (where each
 * sound starts and how long it is, in ms). Every sound is from a Kenney pack released as CC0;
 * the packs are fetched from the copies Kenney uploaded to OpenGameArt, pinned by SHA-256.
 *
 * Families and variant counts come from the stage contract (`SFX_VARIANTS`), in the same order,
 * plus the three app sounds of brief 3.13 (UI tap x2, card flip, level-up jingle).
 *
 * Offsets are measured AFTER encoding: the MP3 is decoded back and every sound's first loud
 * sample is found, because the encoder adds padding at the start. The JSON holds those
 * measured offsets, never the planned ones.
 *
 * Each slot lists candidates; the first file found under --src is used. Kenney's "Impact Sounds"
 * pack (punches, metal, wood) is the first choice for impacts, but its download page needs a
 * browser flow, so when it is not in --src the RPG Audio stand-ins are used and the tool says so.
 * To use it: download kenney_impact-sounds.zip by hand from kenney.nl, extract it into --src, run again.
 *
 * Needs ffmpeg and ffprobe on PATH.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const OUT = resolve(arg("out") ?? join(ROOT, "apps/web/public/audio"));
const SRC = resolve(arg("src") ?? join(tmpdir(), "rankzero-audio-src"));
const RATE = 44100;
const BITRATE = "48k";
const GAP_MS = 140;
const CAP = 300 * 1024;

/** The packs, as Kenney uploaded them to OpenGameArt (each page and its licence file say CC0). */
export const PACKS = [
  { name: "RPG Audio", page: "https://opengameart.org/content/50-rpg-sound-effects", url: "https://opengameart.org/sites/default/files/RPGsounds_Kenney.zip", sha256: "3ae398ad63e293f9c450bda22d5d81c3af69c74df66fc1400f33c012c0bbc231" },
  { name: "Interface Sounds", page: "https://opengameart.org/content/interface-sounds", url: "https://opengameart.org/sites/default/files/kenney_interfaceSounds.zip", sha256: "f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232" },
  { name: "Music Jingles", page: "https://opengameart.org/content/85-short-music-jingles", url: "https://opengameart.org/sites/default/files/jingleSounds_Kenney.zip", sha256: "be324b6cf26e35c95c2a344569a2470512819d0246cc81328bef3499de3682e5" },
];

// [family, max length ms, peak 0..1, [candidates per variant]]. Peaks leave room for two cues
// that overlap (an impact over a whoosh) without clipping.  A candidate is a file name, or
// several separated by "|": the first that exists wins.
const PUNCH = (i) => `impactPunch_medium_00${i}.ogg`;
const METAL = (i) => `impactMetal_heavy_00${i}.ogg`;
export const SLOTS = [
  ["fist", 380, 0.7, [`${PUNCH(0)}|bookPlace1.ogg`, `${PUNCH(1)}|bookPlace2.ogg`, `${PUNCH(2)}|bookClose.ogg`]],
  ["blunt", 480, 0.7, [`${METAL(0)}|metalPot1.ogg`, `${METAL(1)}|metalPot2.ogg`, `${METAL(2)}|metalPot3.ogg`, `${METAL(3)}|doorClose_1.ogg`]],
  ["blade", 450, 0.65, ["knifeSlice.ogg", "knifeSlice2.ogg", "chop.ogg", "drawKnife1.ogg"]],
  ["block", 380, 0.65, ["metalClick.ogg", "metalLatch.ogg", "beltHandle1.ogg"]],
  ["whoosh", 340, 0.45, ["cloth1.ogg", "cloth2.ogg", "cloth3.ogg"]],
  ["dash", 260, 0.4, ["footstep00.ogg", "footstep02.ogg"]],
  ["landing", 300, 0.5, ["footstep05.ogg", "bookPlace3.ogg"]],
  ["throw", 340, 0.5, ["cloth4.ogg"]],
  ["drop", 420, 0.55, ["dropLeather.ogg", "handleSmallLeather.ogg"]],
  ["crowd", 280, 0.35, ["footstep07.ogg", "footstep08.ogg"]],
  ["companion", 330, 0.5, ["pluck_001.ogg", "pluck_002.ogg", "question_002.ogg"]],
  ["move", 650, 0.6, ["jingles_HIT01.ogg", "jingles_HIT02.ogg", "jingles_HIT04.ogg", "jingles_HIT05.ogg"]],
  ["win", 1400, 0.65, ["jingles_STEEL00.ogg"]],
  ["loss", 900, 0.55, ["jingles_NES02.ogg"]],
  ["ui-tap", 120, 0.5, ["click_001.ogg", "select_001.ogg"]],
  ["card-flip", 300, 0.5, ["bookFlip3.ogg"]],
  ["level-up", 1400, 0.7, ["jingles_STEEL04.ogg"]],
];

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { maxBuffer: 1 << 28, ...opts });

function fetchPacks() {
  mkdirSync(SRC, { recursive: true });
  for (const p of PACKS) {
    const zip = join(SRC, basename(p.url));
    if (!existsSync(zip)) {
      if (arg("src")) continue;           // a hand-made --src folder may hold the packs extracted already
      run("curl", ["-sL", "-A", "audio-sprite-tool", "-o", zip, p.url]);
    }
    const sum = createHash("sha256").update(readFileSync(zip)).digest("hex");
    if (sum !== p.sha256) throw new Error(`${p.name}: sha256 ${sum}, expected ${p.sha256}`);
    const dir = zip.replace(/\.zip$/, "");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      try {
        run("unzip", ["-q", "-o", zip, "-d", dir]);
      } catch {
        run("C:/Windows/System32/tar.exe", ["-xf", zip, "-C", dir]);
      }
    }
  }
}

function indexFiles(dir, out = new Map()) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) indexFiles(full, out);
    else if (/\.(ogg|wav)$/i.test(name) && !out.has(name)) out.set(name, full);
  }
  return out;
}

/** Mono float samples at RATE from any file ffmpeg reads. */
function decode(file) {
  const raw = run("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(RATE), "-f", "f32le", "-"]);
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4).slice();
}

const ms = (n) => Math.round((n / RATE) * 1000 * 10) / 10;
const firstLoud = (pcm, from, to, threshold) => {
  for (let i = Math.max(0, from); i < Math.min(pcm.length, to); i++) if (Math.abs(pcm[i]) >= threshold) return i;
  return -1;
};

function prepare(pcm, maxMs, peakTarget) {
  let start = firstLoud(pcm, 0, pcm.length, 0.01);
  if (start < 0) start = 0;
  let end = Math.min(pcm.length, start + Math.round((maxMs / 1000) * RATE));
  // drop the quiet tail
  while (end > start + 10 && Math.abs(pcm[end - 1]) < 0.003) end--;
  const out = pcm.slice(start, end);
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? peakTarget / peak : 1;
  const fade = Math.min(out.length, Math.round(0.03 * RATE));
  for (let i = 0; i < out.length; i++) {
    const tail = out.length - i;
    out[i] = out[i] * gain * (tail < fade ? tail / fade : 1);
  }
  // a 2 ms fade-in keeps the first sample from clicking
  const fin = Math.min(out.length, Math.round(0.002 * RATE));
  for (let i = 0; i < fin; i++) out[i] *= i / fin;
  return out;
}

function wav(pcm) {
  const data = Buffer.alloc(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm[i] * 32767))), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

fetchPacks();
const files = indexFiles(SRC);
const gap = Math.round((GAP_MS / 1000) * RATE);
const parts = [];
const planned = [];
const used = [];
let cursor = gap;
let standIns = 0;
for (const [family, maxMs, peak, slots] of SLOTS) {
  const list = [];
  slots.forEach((cand, v) => {
    const names = cand.split("|");
    const name = names.find((n) => files.has(n));
    if (!name) throw new Error(`${family}[${v}]: none of ${names.join(", ")} under ${SRC}`);
    if (names.length > 1 && name !== names[0]) standIns++;
    const clip = prepare(decode(files.get(name)), maxMs, peak);
    parts.push({ at: cursor, clip });
    list.push({ at: cursor, len: clip.length });
    used.push({ family, variant: v, file: name, from: files.get(name).slice(SRC.length + 1).replaceAll("\\", "/") });
    cursor += clip.length + gap;
  });
  planned.push([family, list]);
}
const total = new Float32Array(cursor + gap);
for (const p of parts) total.set(p.clip, p.at);

const work = join(tmpdir(), "rankzero-audio-build");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(work, "sprite.wav"), wav(total));
const mp3 = join(OUT, "sfx.mp3");
run("ffmpeg", ["-v", "error", "-y", "-i", join(work, "sprite.wav"), "-ac", "1", "-ar", String(RATE), "-c:a", "libmp3lame", "-b:a", BITRATE, mp3]);

// Measure where the sounds really start in the encoded file. The encoder (and the decoder's
// handling of its padding) shifts the whole file by one constant amount: it is found as the lag
// (-10 to +80 ms) at which the decoded file best matches the file that went in, by
// cross-correlation over every sound, then checked per sound (each must agree within 1 ms).
const back = decode(mp3);
const corr = (lag, from, n) => {
  let score = 0;
  for (let i = from; i < from + n; i++) score += total[i] * (back[i + lag] ?? 0);
  return score;
};
const lags = [];
for (let lag = -Math.round(0.01 * RATE); lag <= Math.round(0.08 * RATE); lag++) lags.push(lag);
const best = (from, n) => lags.reduce((b, lag) => { const sc = corr(lag, from, n); return sc > b.sc ? { lag, sc } : b; }, { lag: 0, sc: -Infinity }).lag;
const shift = best(0, total.length - Math.round(0.08 * RATE));
const map = {};
let k = 0;
let disagree = 0;
for (const [family, list] of planned) {
  map[family] = list.map(({ at, len }) => {
    const own = best(at, Math.min(len, Math.round(0.1 * RATE)));
    if (Math.abs(own - shift) > RATE / 1000) disagree++;
    k++;
    return { start: ms(at + shift), dur: ms(len) };
  });
}
const size = statSync(mp3).size;
const json = {
  version: 1,
  file: "sfx.mp3",
  note: "Offsets in ms, measured on the decoded MP3 (not planned). Built by tools/build-audio.mjs.",
  families: map,
  sources: used.map((u) => ({ family: u.family, variant: u.variant, file: u.file, pack: u.from.split("/")[0] })),
};
writeFileSync(join(OUT, "sfx.json"), `${JSON.stringify(json, null, 1)}\n`);
console.log(`sfx.mp3  ${(size / 1024).toFixed(1)} KB (cap ${CAP / 1024} KB), ${(total.length / RATE).toFixed(2)} s, ${used.length} sounds`);
console.log(`encoder shift: ${ms(shift)} ms for the whole file, already in sfx.json; ${k - disagree} of ${k} sounds agree on their own within 1 ms`);
if (standIns > 0) console.log(`note: ${standIns} impact sounds use RPG Audio stand-ins (Impact Sounds pack not in --src)`);
if (size > CAP) {
  console.error("build-audio: over the 300 KB cap");
  process.exit(1);
}
