#!/usr/bin/env node
/**
 * Build the sound sprite (fight-screen lane). Run: pnpm build-audio [--src <dir>] [--out <dir>]
 *
 * Writes apps/web/public/audio/sfx.mp3 (one mono MP3, 300 KB cap) and sfx.json (where each
 * sound starts and how long it is, in ms, plus where every sound came from and its licence).
 *
 * Sources: free sound packs with a clear licence (CC0 or CC BY), each fetched from its own page
 * on OpenGameArt and pinned by SHA-256. `PACKS` holds the page, author, licence and fetch date
 * of every pack; CREDITS.md has the same rows. No pack is ripped game audio, a paid pack or
 * AI-generated sound.
 *
 * Families and variant counts come from the stage contract (`SFX_VARIANTS`), in the same order,
 * plus the three app sounds of brief 3.13 (UI tap x2, card flip, level-up jingle).
 *
 * Every sound was picked by measurement, not by its file name (length, peak, loudness, energy
 * per frequency band, decay; see the notes on each slot): a punch has a low thump under 150 Hz
 * and a crack over 2 kHz, a pipe rings in the 500 Hz to 6 kHz range for 150 ms or more, a body
 * fall is mostly under 150 Hz. A slot may layer two files (" + "), lined up on their onsets.
 *
 * Processing per sound: start at the onset (first sample at half the peak, minus 5 ms) so the
 * hit lands on the cue time, or at a fixed "@ms" for a window cut from a long recording; cut to
 * the family's length; trim the quiet tail; fade out; peak-normalise to -1 dBFS; then turn it
 * down (never up) to its family's loudness target, so variants of one family match and the
 * families sit in a fixed balance (impacts loudest, crowd quietest).
 *
 * Offsets are measured AFTER encoding: the MP3 is decoded back and the encoder's shift is found
 * by cross-correlation, because the encoder adds padding at the start. The JSON holds those
 * measured offsets, never the planned ones.
 *
 * Needs ffmpeg on PATH, and tar (Windows bsdtar reads zip and 7z) or unzip / 7z to unpack.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const OUT = resolve(arg("out") ?? join(ROOT, "apps/web/public/audio"));
const SRC = resolve(arg("src") ?? join(tmpdir(), "rankzero-audio-src-v2"));
const RATE = 44100;
const BITRATE = "96k";
const GAP_MS = 120;
const CAP = 300 * 1024;
const PEAK = 10 ** (-1 / 20);            // -1 dBFS

const OGA = "https://opengameart.org/sites/default/files/";
const CC0 = { licence: "CC0 1.0", licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/" };
const BY3 = { licence: "CC BY 3.0", licenceUrl: "https://creativecommons.org/licenses/by/3.0/" };
const BY4 = { licence: "CC BY 4.0", licenceUrl: "https://creativecommons.org/licenses/by/4.0/" };
const FETCHED = "2026-11-15";

/** Every pack: its page (where the licence was read), the file, the author and the licence. */
export const PACKS = [
  { id: "hits37", name: "37 hits/punches", page: "https://opengameart.org/content/37-hitspunches", url: `${OGA}independent_nu_ljudbank-hits_and_punches.7z`, sha256: "641c65d2e1a00002171c23e2c6fa14e925ae4c12db09d3f79d130a4538916032", author: "Independent.nu (submitted by qubodup)", ...CC0 },
  { id: "qpunch", name: "Punch", page: "https://opengameart.org/content/punch", url: `${OGA}qubodupPunch.7z`, sha256: "757795e8778acc377abacea902052c2dc707583c69d00b8baa2e76b670a02398", author: "Iwan 'qubodup' Gabovitch", ...CC0 },
  { id: "battle", name: "Battle Sound Effects", page: "https://opengameart.org/content/battle-sound-effects", url: `${OGA}battle_sound_effects_0.zip`, sha256: "44e3d26b2378d2eb3a4f28b4c5cbc71908ad13c7389038348dbe9b8cde4f4c05", author: "artisticdude", ...CC0, note: "page offers CC BY 3.0, CC BY-SA 3.0, GPL 2/3 or CC0; used under CC0" },
  { id: "castiron", name: "33 metal clang sounds from cast iron pans", page: "https://opengameart.org/content/33-metal-clang-sounds-cast-iron-pans", url: `${OGA}cast_iron_clangs.7z`, sha256: "dcbf7d0873b580ba6fda03e9ab96188f4ceb8d8f40ce7abe30ce150932b979aa", author: "bart", ...CC0 },
  { id: "wood35", name: "35 wooden cracks/hits/destructions", page: "https://opengameart.org/content/35-wooden-crackshitsdestructions", url: `${OGA}independent_nu_ljudbank-wood_crack_hit_destruction.7z`, sha256: "2f9723be0147c32ea07db8ef7406229fb8f1a6ce8feabdf0dbf2dc5ee2aacd1a", author: "Independent.nu", ...CC0 },
  { id: "break75", name: "75 CC0 breaking / falling / hit sfx", page: "https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx", url: `${OGA}sfx_breaking_and_falling.zip`, sha256: "e6ee04d91c5f4d30cfda1260d2c9d1faf96fda36319287215fbd07bcb1a80451", author: "rubberduck", ...CC0 },
  { id: "rpg80", name: "80 CC0 RPG SFX", page: "https://opengameart.org/content/80-cc0-rpg-sfx", url: `${OGA}80-CC0-RPG-SFX_0.zip`, sha256: "1c2f06ff4e8563b5b8b745b23cf213c1474142a69bb82bd8f5e10d9b3f7a7bbd", author: "rubberduck", ...CC0 },
  { id: "shields", name: "10 Impact/Shield Blocks", page: "https://opengameart.org/content/10-impactshield-blocks", url: `${OGA}impact_-_starninjas.zip`, sha256: "4592764795344ae010561b0191b059a0e7ed8c2d2e6c0e96171debaa346cf311", author: "StarNinjas", ...CC0 },
  { id: "swishes", name: "Swishes Sound Pack", page: "https://opengameart.org/content/swishes-sound-pack", url: `${OGA}swishes.zip`, sha256: "7980215241b739a787dcf26f660ce510bb237900968789395a86911619795693", author: "artisticdude", ...CC0 },
  { id: "sword20", name: "20 Sword Sound Effects (Attacks and Clashes)", page: "https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes", url: `${OGA}sword_-_starninjas_1.zip`, sha256: "87a1fe1cfeee5f282fe06a7a9c25ab9ebf24b7674fe19171b7f2762dffb628c1", author: "StarNinjas", ...CC0 },
  { id: "crowdshout", name: "Crowd Shouting/Speaking Ambience", page: "https://opengameart.org/content/crowd-shoutingspeaking-ambience", url: `${OGA}crowd_shouting.ogg`, sha256: "a2c23a64c127c77717cbe4abb21f138bac9d9aa6cb3cc89d62bab5d0d96dd7ca", author: "StarNinjas", ...CC0 },
  { id: "cheer", name: "Free Crowd Cheering Sounds", page: "https://opengameart.org/content/free-crowd-cheering-sounds", url: `${OGA}gregor_quendel_-_free_crowd_cheering_sounds_-_mp3.zip`, sha256: "4438762aceadab7bf8c89acaa5009611eefbfcdb2adda78e9c1ee0b2eaffc874", author: "Gregor Quendel", ...BY4 },
  { id: "doggrunt", name: "Dog Grunt", page: "https://opengameart.org/content/dog-grunt", url: `${OGA}dog-frieda-grunt-96khz-01.flac`, sha256: "9bb77982583ab69a3417cbdfa6085e2cd95947d3d6199bb587cdc7220f1a0529", author: "qubodup", ...CC0 },
  { id: "dogsounds", name: "Dog sounds", page: "https://opengameart.org/content/dog-sounds", url: `${OGA}dog.7z`, sha256: "ecee65b849048790e963952dd15c74889c89d7c948a629e041caa631886d7662", author: "pauliuw", ...CC0 },
  { id: "crowcaw", name: "Crow caw", page: "https://opengameart.org/content/crow-caw", url: `${OGA}crow_caw.wav`, sha256: "bba22883209b435905471d057160f1badae59b89a62e9a8b3199d7e327b17339", author: "zeroisnotnull", ...CC0 },
  { id: "winjingle", name: "Win Jingle", page: "https://opengameart.org/content/win-jingle", url: `${OGA}winjingle.zip`, sha256: "fef26adc010e7e7d6f2ab586f400188831152530f8f3adcd179f26435d69ce6b", author: "Fupi", ...CC0 },
  { id: "rpgaudio", name: "RPG Audio (Kenney)", page: "https://opengameart.org/content/50-rpg-sound-effects", url: `${OGA}RPGsounds_Kenney.zip`, sha256: "3ae398ad63e293f9c450bda22d5d81c3af69c74df66fc1400f33c012c0bbc231", author: "Kenney", ...CC0 },
  { id: "interface", name: "Interface Sounds (Kenney)", page: "https://opengameart.org/content/interface-sounds", url: `${OGA}kenney_interfaceSounds.zip`, sha256: "f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232", author: "Kenney", ...CC0 },
  { id: "jingles", name: "Music Jingles (Kenney)", page: "https://opengameart.org/content/85-short-music-jingles", url: `${OGA}jingleSounds_Kenney.zip`, sha256: "be324b6cf26e35c95c2a344569a2470512819d0246cc81328bef3499de3682e5", author: "Kenney", ...CC0 },
].map((p) => ({ fetched: FETCHED, ...p }));

// [family, max length ms, loudness target (dBFS, loudest 50 ms RMS), [variants]].
// A variant is one or more layers joined by " + ". A layer is "pack:path", optionally
// "@<ms>" (a fixed start inside a long recording, with a 40 ms fade-in) and "*<gain>".
// The numbers after each line are what was measured on the source (see the commit message):
// band shares in %, decay in ms to -20 dB.
const HIT = (n) => `hits37:hits/hit${n}.mp3.flac`;
const QP = (n) => `qpunch:qubodupPunch/qubodupPunch0${n}.flac`;
const IRON = (n) => `castiron:cast iron clangs - Marker #${n}.wav`;
const CHEER = "cheer:Gregor Quendel - Free Crowd Cheering Sounds - MP3/Gregor Quendel - Crowd Cheering Sounds - 03 - Strong cheering - I.mp3";
export const SLOTS = [
  // thump <150 Hz + crack >2 kHz: hit10 71/20, hit11 54/26, hit32 53/24, qubodup 05 65/11
  ["fist", 360, -12.5, [HIT(10), HIT(11), `${QP(5)} + break75:bfh1_hit_10.ogg*0.35`]],
  // pipe: cast-iron ring (#11 75% 500-2k, rings 2.4 s; #9 62% 500-2k + 22% 2-6k, rings 3.7 s) over a body thump;
  // bat/plank: wood35 crack10 34% <150 + 30% 500-2k; metal_hit_04 41% <150 + 33% over 500 Hz
  ["blunt", 600, -14, [`${IRON(11)} + ${QP(2)}*0.7`, `${IRON(9)} + ${QP(4)}*0.7`, `wood35:wood_impact/crack10.mp3.flac + ${QP(3)}*0.5`, `break75:bfh1_metal_hit_04.ogg + ${QP(2)}*0.5`]],
  // knife: slices 75-99% over 2 kHz, each over a soft body thud (no squelch, no gore)
  ["blade", 380, -16, [`rpg80:blade_01.ogg + ${QP(3)}*0.35`, `rpg80:blade_03.ogg + ${QP(3)}*0.35`, `rpgaudio:OGG/knifeSlice2.ogg + ${QP(2)}*0.15`, `rpgaudio:OGG/chop.ogg + ${QP(4)}*0.3`]],
  // shield block: metal (metal_hit_02, 41% 150-500 + 27% 500-2k), wood (rpg80 wood_03 58% 150-500, peak 10 ms in), board (impact.4 67% 500-2k)
  ["block", 360, -13.5, ["break75:bfh1_metal_hit_02.ogg", "rpg80:wood_03.ogg", "shields:impact.4.ogg"]],
  // swishes: 230-400 ms, centroid 640-1100 Hz
  ["whoosh", 340, -18, ["battle:battle_sound_effects/swish_3.wav", "battle:battle_sound_effects/swish_4.wav", "swishes:swishes/swish-7.wav"]],
  // quick footfall scuffs with a light swish
  ["dash", 240, -20, ["rpgaudio:OGG/footstep01.ogg + swishes:swishes/swish-9.wav*0.4", "rpgaudio:OGG/footstep08.ogg + swishes:swishes/swish-7.wav*0.4"]],
  // body fall: hit30 75% <150; bfh1_hit_02 82% <150; each over a low thud
  ["landing", 520, -11, [`${HIT(30)} + ${QP(3)}*0.6`, `break75:bfh1_hit_02.ogg + ${QP(3)}*0.5`]],
  // thrown object: fast high whoosh, peak 13 ms in
  ["throw", 380, -16, ["sword20:sword - StarNinjas/sword.5.ogg"]],
  // weapon hits the floor: metal clatter (metal_falling_02 576 ms), wood clatter
  ["drop", 480, -15, ["break75:bfh1_metal_falling_02.ogg", "break75:bfh1_wood_falling_02.ogg"]],
  // crowd surge: windows at the strongest onsets of each recording
  ["crowd", 650, -22, [`${CHEER}@2000`, "crowdshout:crowd_shouting.ogg@13250"]],
  // critters: dog grunt (76% <150), dog bark (bark 1, 212 ms), crow caw (88% 500-2k)
  ["companion", 420, -15, ["doggrunt:dog-frieda-grunt-96khz-01.flac", "dogsounds:Dog/Dog Bark 1.wav", "crowcaw:crow_caw.wav"]],
  // Move stingers: Kenney hit jingles whose peak is within 15 ms of the start
  ["move", 650, -13, ["jingles:OGG/jingles_HIT/jingles_HIT01.ogg", "jingles:OGG/jingles_HIT/jingles_HIT04.ogg", "jingles:OGG/jingles_HIT/jingles_HIT11.ogg", "jingles:OGG/jingles_HIT/jingles_HIT12.ogg"]],
  // win: brass fanfare (rising line); loss: sax line falling 925 -> 522 Hz
  ["win", 2200, -14, ["winjingle:WinBrass.wav"]],
  ["loss", 1100, -14, ["jingles:OGG/jingles_SAX/jingles_SAX01.ogg"]],
  ["ui-tap", 120, -23, ["interface:Audio/click_001.ogg", "interface:Audio/select_001.ogg"]],
  ["card-flip", 300, -23, ["rpgaudio:OGG/bookFlip3.ogg"]],
  ["level-up", 1400, -13, ["jingles:OGG/jingles_STEEL/jingles_STEEL04.ogg"]],
];

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { maxBuffer: 1 << 28, ...opts });

function unpack(file, dir) {
  mkdirSync(dir, { recursive: true });
  const tries = process.platform === "win32"
    ? [["C:/Windows/System32/tar.exe", ["-xf", file, "-C", dir]]]
    : [["bsdtar", ["-xf", file, "-C", dir]], file.endsWith(".zip") ? ["unzip", ["-q", "-o", file, "-d", dir]] : ["7z", ["x", "-y", `-o${dir}`, file]]];
  for (const [cmd, args] of tries) {
    try { run(cmd, args, { stdio: "ignore" }); return; } catch { /* next */ }
  }
  throw new Error(`could not unpack ${file}`);
}

/** Downloads (once) and checks every pack. Returns pack id -> folder holding its files. */
function fetchPacks() {
  const dirs = new Map();
  for (const p of PACKS) {
    const home = join(SRC, p.id);
    mkdirSync(home, { recursive: true });
    const file = join(home, decodeURIComponent(basename(p.url)));
    if (!existsSync(file)) run("curl", ["-sfL", "-A", "audio-sprite-tool", "-o", file, p.url]);
    const sum = createHash("sha256").update(readFileSync(file)).digest("hex");
    if (sum !== p.sha256) throw new Error(`${p.name}: sha256 ${sum}, expected ${p.sha256}`);
    if (/\.(zip|7z)$/.test(file)) {
      const dir = join(home, "x");
      if (!existsSync(dir)) unpack(file, dir);
      dirs.set(p.id, dir);
    } else {
      dirs.set(p.id, home);
    }
  }
  return dirs;
}

/** Mono float samples at RATE from any file ffmpeg reads. */
function decode(file) {
  const raw = run("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(RATE), "-f", "f32le", "-"]);
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4).slice();
}

const ms = (n) => Math.round((n / RATE) * 1000 * 10) / 10;
const dB = (v) => 20 * Math.log10(Math.max(v, 1e-9));
const peakOf = (pcm) => { let p = 0; for (const v of pcm) p = Math.max(p, Math.abs(v)); return p; };
/** Loudness: the loudest 50 ms RMS window (10 ms hop), in dBFS. */
function loudness(pcm) {
  const n = Math.round(0.05 * RATE);
  const hop = Math.round(0.01 * RATE);
  let best = 0;
  for (let i = 0; i + n <= Math.max(pcm.length, n); i += hop) {
    let s = 0;
    for (let j = i; j < Math.min(pcm.length, i + n); j++) s += pcm[j] * pcm[j];
    best = Math.max(best, Math.sqrt(s / n));
  }
  return dB(best);
}

function parseLayer(spec) {
  const m = /^([a-z0-9-]+):(.+?)(?:@(\d+))?(?:\*([\d.]+))?$/.exec(spec.trim());
  if (!m) throw new Error(`bad layer "${spec}"`);
  return { pack: m[1], path: m[2], at: m[3] === undefined ? null : Number(m[3]), gain: m[4] === undefined ? 1 : Number(m[4]) };
}

/** One layer from its onset (or fixed start), scaled to peak 1 times its gain. */
function layer(dirs, l) {
  const dir = dirs.get(l.pack);
  if (!dir) throw new Error(`unknown pack ${l.pack}`);
  const file = join(dir, l.path);
  if (!existsSync(file)) throw new Error(`${l.pack}: no file ${l.path}`);
  const pcm = decode(file);
  const peak = peakOf(pcm);
  let start;
  if (l.at !== null) start = Math.round((l.at / 1000) * RATE);
  else {
    let i = 0;
    while (i < pcm.length && Math.abs(pcm[i]) < 0.5 * peak) i++;
    start = Math.max(0, i - Math.round(0.005 * RATE));
  }
  const out = pcm.slice(start);
  const g = l.gain / (l.at !== null ? peakOf(out) || 1 : peak || 1);
  for (let i = 0; i < out.length; i++) out[i] *= g;
  return out;
}

function prepare(dirs, spec, maxMs, target) {
  const layers = spec.split(" + ").map(parseLayer);
  const parts = layers.map((l) => layer(dirs, l));
  const max = Math.round((maxMs / 1000) * RATE);
  let len = Math.min(max, Math.max(...parts.map((p) => p.length)));
  const out = new Float32Array(len);
  for (const p of parts) for (let i = 0; i < Math.min(len, p.length); i++) out[i] += p[i];
  // trim the quiet tail (-50 dB of the peak)
  const pk = peakOf(out);
  while (len > 10 && Math.abs(out[len - 1]) < pk * 0.003) len--;
  const clip = out.slice(0, len);
  // fades: in 2 ms (40 ms for a window cut from a long recording), out up to 60 ms
  const fin = Math.min(len, Math.round((layers[0].at !== null ? 0.04 : 0.002) * RATE));
  for (let i = 0; i < fin; i++) clip[i] *= i / fin;
  const fout = Math.min(Math.round(0.06 * RATE), Math.round(len * 0.3));
  for (let i = 0; i < fout; i++) clip[len - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fout);
  // -1 dBFS peak, then down (never up) to the family's loudness
  const g1 = PEAK / (peakOf(clip) || 1);
  for (let i = 0; i < len; i++) clip[i] *= g1;
  const g2 = 10 ** (Math.min(0, target - loudness(clip)) / 20);
  for (let i = 0; i < len; i++) clip[i] *= g2;
  let at = 0;
  for (let i = 0; i < len; i++) if (Math.abs(clip[i]) > Math.abs(clip[at])) at = i;
  return { clip, layers, peakDb: dB(peakOf(clip)), loudDb: loudness(clip), peakAtMs: ms(at) };
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

const dirs = fetchPacks();
const gap = Math.round((GAP_MS / 1000) * RATE);
const parts = [];
const planned = [];
const used = [];
let cursor = gap;
for (const [family, maxMs, target, slots] of SLOTS) {
  const list = [];
  slots.forEach((spec, v) => {
    const p = prepare(dirs, spec, maxMs, target);
    parts.push({ at: cursor, clip: p.clip });
    list.push({ at: cursor, len: p.clip.length });
    used.push({ family, variant: v, files: p.layers.map((l) => `${l.pack}:${l.path}`), lenMs: ms(p.clip.length), peakDb: Number(p.peakDb.toFixed(1)), loudDb: Number(p.loudDb.toFixed(1)), peakAtMs: p.peakAtMs });
    cursor += p.clip.length + gap;
  });
  planned.push([family, list]);
}
const total = new Float32Array(cursor + gap);
for (const p of parts) total.set(p.clip, p.at);

const work = join(tmpdir(), "rankzero-audio-build");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
mkdirSync(OUT, { recursive: true });
const mp3 = join(OUT, "sfx.mp3");
// MP3 encoding overshoots a -1 dBFS peak by up to about 2 dB. When the decoded file peaks over
// -0.5 dBFS, the whole sprite is turned down by the overshoot (all sounds alike, so the balance
// between families stays) and encoded again.
let trim = 1;
for (let pass = 0; pass < 4; pass++) {
  writeFileSync(join(work, "sprite.wav"), wav(total));
  run("ffmpeg", ["-v", "error", "-y", "-i", join(work, "sprite.wav"), "-ac", "1", "-ar", String(RATE), "-c:a", "libmp3lame", "-b:a", BITRATE, mp3]);
  const over = dB(peakOf(decode(mp3))) - -0.5;
  if (over <= 0) break;
  const g = 10 ** (-(over + 0.05) / 20);
  for (let i = 0; i < total.length; i++) total[i] *= g;
  trim *= g;
}

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
const backPeak = peakOf(back);
const size = statSync(mp3).size;
const packsUsed = PACKS.filter((p) => used.some((u) => u.files.some((f) => f.startsWith(`${p.id}:`))));
const json = {
  version: 1,
  file: "sfx.mp3",
  note: "Offsets in ms, measured on the decoded MP3 (not planned). Built by tools/build-audio.mjs. Credits: see `credits` and CREDITS.md.",
  families: map,
  sources: used.map((u) => ({ family: u.family, variant: u.variant, files: u.files })),
  credits: packsUsed.map((p) => ({ pack: p.id, name: p.name, author: p.author, licence: p.licence, licenceUrl: p.licenceUrl, page: p.page, fetched: p.fetched })),
};
writeFileSync(join(OUT, "sfx.json"), `${JSON.stringify(json, null, 1)}\n`);
for (const u of used) console.log(`${`${u.family}[${u.variant}]`.padEnd(13)} ${String(u.lenMs).padStart(6)} ms  peak ${String(u.peakDb).padStart(5)} dB  loud ${String(u.loudDb).padStart(6)} dB  peak at ${String(u.peakAtMs).padStart(5)} ms  ${u.files.join(" + ")}`);
console.log(`sfx.mp3  ${(size / 1024).toFixed(1)} KB (cap ${CAP / 1024} KB) at ${BITRATE}, ${(total.length / RATE).toFixed(2)} s, ${used.length} sounds, decoded peak ${dB(backPeak).toFixed(2)} dBFS, whole-sprite trim ${dB(trim).toFixed(2)} dB`);
console.log(`encoder shift: ${ms(shift)} ms for the whole file, already in sfx.json; ${k - disagree} of ${k} sounds agree on their own within 1 ms`);
if (size > CAP) {
  console.error("build-audio: over the 300 KB cap");
  process.exit(1);
}
if (backPeak >= 1) {
  console.error("build-audio: the encoded sprite clips");
  process.exit(1);
}
