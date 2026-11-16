#!/usr/bin/env node
/**
 * Build the sound sprite (fight-screen lane). Run: pnpm build-audio [--src <dir>] [--out <dir>] [--local <dir>]
 *
 * Writes apps/web/public/audio/sfx.mp3 (the core sprite: every set a stage family falls back to),
 * sfx-content.mp3 (the per-weapon, shield and pet sets), each a mono MP3 under a 300 KB cap, and
 * sfx.json (which file, where each sound starts and how long it is, in ms, plus where every
 * sound came from and its licence), and rewrites the sound table in CREDITS.md from the same rows.
 *
 * Sources: free sound packs with a clear licence (CC0 or CC BY), each fetched from its own page
 * on OpenGameArt and pinned by SHA-256. `PACKS` holds the page, author, licence and fetch date
 * of every pack; CREDITS.md has the same rows. No pack is ripped game audio or AI-generated sound.
 *
 * Envato Elements (owner's licence, owner OK 15 Nov 2026: "use free or envato"): a pack with
 * `local` has no URL. The owner downloads it; the build reads it from --local <dir>, else the
 * RANKZERO_LOCAL_AUDIO environment variable, else D:/Downloads, checks its SHA-256 and unpacks
 * it. Without those zips the build stops and names each missing file and where to get it. Only short cut clips go into the sprite; the
 * source files never enter the repo.
 *
 * The sprite holds named sound sets (`SETS`): one per weapon, shield or pet where an own sound
 * fits, else one per material group (owner, 15 Nov 2026: "it depends on the weapon too"). The web
 * app picks the set from the cue's `item` (apps/web/src/audio/soundMap.ts); `ALIASES` gives every
 * stage family and app sound the set it falls back to. sfx.json version 2: `sets` and `families`.
 *
 * Every sound was picked by measurement, not by its file name (length, peak, loudness, energy
 * per frequency band, decay; see the notes on each slot): a punch has a low thump under 150 Hz
 * and a crack over 2 kHz, a pipe rings in the 500 Hz to 6 kHz range for 150 ms or more, a body
 * fall is mostly under 150 Hz. A slot may layer two files (" + "), lined up on their onsets.
 *
 * Processing per sound: start at the onset (first sample at half the peak, minus 5 ms) so the
 * hit lands on the cue time, or at a fixed "@ms" for a window cut from a long recording; cut to
 * the family's length; trim the quiet tail; fade out; peak-normalise to -1 dBFS; then turn it
 * down to its family's loudness target, so variants of one family match and the families sit in
 * a fixed balance (impacts loudest, crowd quietest). A set marked `lift` may also be turned UP by
 * up to that many dB, through a soft limiter that keeps the peak under -1 dBFS (a thin, peaky
 * sound such as the knife stab would otherwise stay under its target).
 *
 * A window cut from a long recording ("@ms") starts at the first sample of that window that
 * reaches half the window's peak, minus 10 ms, so a pet's call lands on its cue, not after it.
 *
 * Offsets are measured AFTER encoding: the MP3 is decoded back and the encoder's shift is found
 * by cross-correlation, because the encoder adds padding at the start. The JSON holds those
 * measured offsets, never the planned ones.
 *
 * Two sounds are synthesised here, not recorded (pack "synth", CC0, no source file): the air horn
 * and the referee's pea whistle. No CC0 recording of either was on hand and the build has no web
 * access; each is a small physical recipe (`SYNTH`), deterministic, so the sprite is the same on
 * every build. Swap in a recording (Envato or CC0) by replacing the layer in its set.
 *
 * The build fails when a sound ends more than `LOUD_TOL` dB under its set's loudness target (the
 * balance cannot drift silently: the paint can sat 4 dB under a punch), or a swish is shorter than
 * `SWISH_MIN_MS` (two fist swishes of three were a 57-65 ms tick).
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
const LOCAL = resolve(arg("local") ?? process.env.RANKZERO_LOCAL_AUDIO ?? "D:/Downloads");
const RATE = 44100;
const BITRATE = "64k";
const GAP_MS = 50;
const CAP = 300 * 1024;
const PEAK = 10 ** (-1 / 20);            // -1 dBFS
const LOUD_TOL = 1.5;                     // dB a sound may end under its target
const SWISH_MIN_MS = 120;

const OGA = "https://opengameart.org/sites/default/files/";
const CC0 = { licence: "CC0 1.0", licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/" };
const BY3 = { licence: "CC BY 3.0", licenceUrl: "https://creativecommons.org/licenses/by/3.0/" };
const ENVATO = { licence: "Envato Elements licence", licenceUrl: "https://elements.envato.com/license-terms" };
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
  { id: "metalwood", name: "100 CC0 metal and wood SFX", page: "https://opengameart.org/content/100-cc0-metal-and-wood-sfx", url: `${OGA}100-CC0-wood-metal-SFX.zip`, sha256: "be6eba63b03409ac0c77787a956b1503a7c186403d04aef9725c52644a4b7878", author: "rubberduck", ...CC0 },
  { id: "sfx100", name: "100 CC0 SFX", page: "https://opengameart.org/content/100-cc0-sfx", url: `${OGA}100-CC0-SFX_0.zip`, sha256: "a5c135878c132f1c59cca54e60061c296cd0ac27ad031ca2c41b8cd5cab3c706", author: "rubberduck", ...CC0 },
  { id: "metalint", name: "Metal Interactions", page: "https://opengameart.org/content/metal-interactions", url: `${OGA}metal_interactions.7z`, sha256: "f9443ead6d1346d89c899e7916494ebc88f050073e1604f1e2f27851dba35a34", author: "qubodup", ...CC0 },
  { id: "thwack", name: "Thwack Sounds", page: "https://opengameart.org/content/thwack-sounds", url: `${OGA}thwack-1.0.zip`, sha256: "8edb002735a01369ef4d6259573be4885f9fe32c9a9efa89dfbbb14067c8c8e5", author: "Jordan Irwin (AntumDeluge)", ...CC0 },
  { id: "squeakyrat", name: "Squeaky Rat", page: "https://opengameart.org/content/squeaky-rat", url: `${OGA}qubodupSqueakyRat.7z`, sha256: "966649ba0e136ec2d473623e15d11710b7fcc8f73a30897758453e8d43bb75a7", author: "qubodup", ...CC0 },
  { id: "pop5", name: "Pop sounds (pop5)", page: "https://opengameart.org/content/pop-sounds", url: `${OGA}pop5.ogg`, sha256: "0433b2f016b2521df36a7e0dde006c0839af4fb97df7ca626f5fb7a4c4eb561e", author: "cogitollc", ...CC0 },
  { id: "pop7", name: "Pop sounds (pop7)", page: "https://opengameart.org/content/pop-sounds", url: `${OGA}pop7.ogg`, sha256: "ac3147642a0d078d6a380ece05ebae519ab64eeccdaab8f24bd7829304e990e6", author: "cogitollc", ...CC0 },
  { id: "spin", name: "Spin", page: "https://opengameart.org/content/spin", url: `${OGA}car_spinning.wav`, sha256: "0e611fd149ee0b1460853d88d3e6099b4158a1d077f9342b800e5e4ede615f19", author: "Rocha57", ...CC0 },
  { id: "dogsnarl", name: "Dog Snarl Grunt Grumble", page: "https://opengameart.org/content/dog-snarl-grunt-grumble", url: `${OGA}dog_0.7z`, sha256: "fbd39c35b8743651f48e423d61ca3cee4e67f33ae3a28b5ef4eef0dd46bb043e", author: "qubodup", ...CC0 },
  { id: "crow", name: "Crow", page: "https://opengameart.org/content/crow", url: `${OGA}crow.ogg`, sha256: "06bbdf748798ae303ed35be76f15feae95a0fba98f3e2c802bc6ed30e978cd11", author: "fvcalderan", ...CC0 },
  { id: "bikehorn", name: "Bicycle Horn", page: "https://opengameart.org/content/bicycle-horn", url: `${OGA}bicycle-horn-1.wav`, sha256: "14f39499ae93be9cc88d7db8e22297108599c902b03a1417fb8ca93e47bbdb1f", author: "Jordan Irwin (AntumDeluge)", ...CC0 },
  { id: "creature80", name: "80 CC0 creature SFX", page: "https://opengameart.org/content/80-cc0-creature-sfx", url: `${OGA}80-CC0-creature-SFX_0.zip`, sha256: "5d4002eea42f278e76543bb36e8ddd2cb978588a13271984191d8228f5d26768", author: "rubberduck", ...CC0 },
  { id: "pig", name: "Pig SFX Pack (pig_hit1)", page: "https://opengameart.org/content/pig-sfx-pack", url: `${OGA}pig_hit1.mp3`, sha256: "946d396a0cdfdd57448363d7d3053f9ae9270b6cac723743cefe4ad1e712f671", author: "Vinrax", ...BY3 },
  { id: "pig2", name: "Pig SFX Pack (pig_hit2)", page: "https://opengameart.org/content/pig-sfx-pack", url: `${OGA}pig_hit2.mp3`, sha256: "bf6eea8b67053fbe2a0a62ed75fff5e59d91c931eb881d5e4a90c806e5f55ca8", author: "Vinrax", ...BY3 },
  { id: "catsfx", name: "Cat SFX (Cat 7)", page: "https://opengameart.org/content/cat-sfx", url: `${OGA}Cat%207.wav`, sha256: "80dde593cd3ea081a89373e557d9990b240de85f08bb6f852aef66512ade30a9", author: "Dan Knoflicek (Macro)", ...BY3 },
  { id: "catsfx8", name: "Cat SFX (Cat 8)", page: "https://opengameart.org/content/cat-sfx", url: `${OGA}Cat%208.wav`, sha256: "89c8edaec94f6cfc7e0e8711772085ed45c3423eed6d9a8fbcaec36403f19712", author: "Dan Knoflicek (Macro)", ...BY3 },
  { id: "goose", name: "Goose Honks", page: "https://elements.envato.com/goose-honks-AS7EXLF", local: "goose-honks-2026-05-18-18-32-38-utc.zip", sha256: "6921519895e67f18a83f977b0b20446d8157ce386fa8740537d7770a98293a07", author: "HollywoodEdge", ...ENVATO },
  { id: "raccoon", name: "Raccoon Snorts and Growls", page: "https://elements.envato.com/raccoon-snorts-and-growls-9A624SH", local: "raccoon-snorts-and-growls-2026-05-18-04-25-01-utc.zip", sha256: "4a939c13c43f200f4a4e9ec07760fbb430e1e45a9e681d916540e6a672d0cd47", author: "prosoundfx", ...ENVATO },
  // made by this script (see `SYNTH`); no file is fetched
  { id: "synth", name: "Synthesised in tools/build-audio.mjs", page: "tools/build-audio.mjs", synth: true, author: "Rank Zero", ...CC0, fetched: "2026-11-16" },
].map((p) => ({ fetched: FETCHED, ...p }));

/** A small seeded random source, so a synthesised sound is the same on every build. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** One-pole filters and a fade envelope, in place. */
function lowpass(x, hz) {
  const k = 1 - Math.exp((-2 * Math.PI * hz) / RATE);
  let y = 0;
  for (let i = 0; i < x.length; i++) { y += k * (x[i] - y); x[i] = y; }
  return x;
}
function highpass(x, hz) {
  const lo = lowpass(Float32Array.from(x), hz);
  for (let i = 0; i < x.length; i++) x[i] -= lo[i];
  return x;
}
function envelope(x, attack, release) {
  const a = Math.round(attack * RATE);
  const r = Math.round(release * RATE);
  for (let i = 0; i < Math.min(a, x.length); i++) x[i] *= i / a;
  for (let i = 0; i < Math.min(r, x.length); i++) x[x.length - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / r);
  return x;
}
/**
 * The synthesised sounds. Each returns mono samples at RATE.
 *  air-horn: a handheld can air horn. Two brass reeds a few hertz apart (the beating of a real
 *    horn), each a band-limited sawtooth of 16 harmonics at 392 and 396.5 Hz, gliding up from 90%
 *    pitch in the first 40 ms (the reed catching), driven into a soft clip (the rasp), with a little
 *    air noise, high-passed at 180 Hz and low-passed at 5 kHz. 620 ms, 12 ms attack.
 *  pea-whistle: a referee's pea whistle. A tone near 2.9 kHz whose pitch and level the pea shakes
 *    27 times a second (+-150 Hz, 35% level), a little second harmonic, breath noise high-passed at
 *    1.8 kHz under it, rising from 2.6 kHz in the first 30 ms. 480 ms, 15 ms attack.
 */
const SYNTH = {
  "air-horn": () => {
    const n = Math.round(0.62 * RATE);
    const out = new Float32Array(n);
    const rand = rng(17);
    const reeds = [[392, 1], [396.5, 0.75]];
    const ph = reeds.map(() => 0);
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      const glide = 0.9 + 0.1 * Math.min(1, t / 0.04);
      let v = 0;
      reeds.forEach(([f, g], r) => {
        ph[r] += (2 * Math.PI * f * glide) / RATE;
        for (let k = 1; k <= 16; k++) v += (g * Math.sin(k * ph[r])) / k ** 0.85;
      });
      out[i] = Math.tanh(0.9 * v) + 0.06 * (rand() * 2 - 1);
    }
    return envelope(lowpass(highpass(out, 180), 5000), 0.012, 0.07);
  },
  "pea-whistle": () => {
    const n = Math.round(0.48 * RATE);
    const out = new Float32Array(n);
    const rand = rng(29);
    const noise = new Float32Array(n);
    for (let i = 0; i < n; i++) noise[i] = rand() * 2 - 1;
    highpass(noise, 1800);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      const pea = Math.sin(2 * Math.PI * 27 * t);
      const f = 2600 + 300 * Math.min(1, t / 0.03) + 150 * pea;
      ph += (2 * Math.PI * f) / RATE;
      const amp = 0.65 + 0.35 * Math.sin(2 * Math.PI * 27 * t + 0.6);
      out[i] = amp * (Math.sin(ph) + 0.12 * Math.sin(2 * ph)) + 0.12 * amp * noise[i];
    }
    return envelope(out, 0.015, 0.05);
  },
};

// [set name, max length ms, loudness target (dBFS, loudest 50 ms RMS), [variants]].
// A set is the sound of one thing (a weapon's hit, a shield's block, a pet's voice, a swing's
// swish) or of one material group when no own sound fits; apps/web/src/audio/soundMap.ts says
// which set each held item, shield and pet uses. `ALIASES` gives each stage family and app sound
// the set it falls back to when a cue names no item.
// A variant is one or more layers joined by " + ". A layer is "pack:path", optionally
// "@<ms>" (a fixed start inside a long recording, with a 40 ms fade-in) and "*<gain>".
// The note above each line is what was measured on the source: band shares in %, decay in ms.
const HIT = (n) => `hits37:hits/hit${n}.mp3.flac`;
const QP = (n) => `qpunch:qubodupPunch/qubodupPunch0${n}.flac`;
const IRON = (n) => `castiron:cast iron clangs - Marker #${n}.wav`;
const MW = (f) => `metalwood:${f}.ogg`;
const S100 = (f) => `sfx100:${f}.ogg`;
const CHEER = "cheer:Gregor Quendel - Free Crowd Cheering Sounds - MP3/Gregor Quendel - Crowd Cheering Sounds - 03 - Strong cheering - I.mp3";
export const SETS = [
  // ---- hits on the body, by weapon
  // fists: thump <150 Hz + crack >2 kHz: hit10 71/20, hit11 54/26, qubodup 05 65/11
  ["hit-fist", 360, -12.5, [HIT(10), HIT(11), `${QP(5)} + break75:bfh1_hit_10.ogg*0.35`]],
  // knuckle dusters: the punch plus a short metal tick (metal_hit_01 113 ms, 61% over 2 kHz)
  ["hit-knuckle", 360, -12.5, [`${HIT(10)} + ${MW("metal_hit_01")}*0.5`, `${QP(5)} + ${MW("metal_hit_05")}*0.45`]],
  // small blade stab "shk": bright and short, cut to 110 ms, no low ring (75-99% over 2 kHz)
  // with a short body thud under it (a stab lands in a body), lifted up to its target: alone it
  // measured -16 to -20 dB, 5-8 dB under a punch
  ["hit-blade-small", 150, -13.5, [`rpgaudio:OGG/knifeSlice2.ogg + ${QP(4)}*0.45`, `rpg80:blade_01.ogg + ${QP(2)}*0.45`, `rpg80:blade_03.ogg + ${QP(4)}*0.45`], { lift: 9 }],
  // machete, hand axe: chop (64% 500-2k) or slice over a heavier thud
  ["hit-blade-big", 360, -13, [`rpgaudio:OGG/chop.ogg + ${QP(4)}*0.6`, `rpg80:blade_02.ogg + ${QP(2)}*0.7`], { lift: 4 }],
  // pipe group: cast-iron ring over a body thump (#11 75% 500-2k; #9 62% 500-2k; metal_07 59% 150-500)
  ["hit-pipe", 600, -14, [`${IRON(11)} + ${QP(2)}*0.7`, `${IRON(9)} + ${QP(4)}*0.7`, `${S100("metal_07")} + ${QP(2)}*0.6`]],
  // wood: hollow knocks (wood_hit_09 34% <150 + 60% 150-500; wood_hammer_02 71% 150-500; wood_hit_08)
  ["hit-wood", 420, -13, [`${MW("wood_hit_09")} + ${QP(3)}*0.5`, `${MW("wood_hammer_02")} + ${QP(4)}*0.5`, `${MW("wood_hit_08")} + ${QP(2)}*0.5`]],
  // sledgehammer, anvil, ball and chain: deep bong (gong_02 73% 150-500) or heavy metal slam over a thud
  ["hit-heavy", 650, -12, [`${QP(3)} + ${S100("gong_02")}*0.6`, `${S100("metal_08")} + ${QP(2)}*0.6`]],
  // frying pan, wok: a cast-iron pan struck (#18 centroid 1 kHz, rings 1.4 s; #10 63% 500-2k)
  ["hit-pan", 600, -13, [`${IRON(18)} + ${QP(4)}*0.4`, `${IRON(10)} + ${QP(2)}*0.4`]],
  // shovel, stop sign: flat sheet-metal whack (metal_sheet_02 3.4 kHz, decay 152, peak 12 ms in; _05 2.1 kHz)
  ["hit-shovel", 450, -13, [`${MW("metal_sheet_02")} + ${QP(2)}*0.5`, `${MW("metal_sheet_05")} + ${QP(4)}*0.5`]],
  // steel folding chair: a hollow steel-frame bang (metal_sheet_06 2.4 kHz centroid; slam + sheet ring)
  ["hit-chair", 480, -12.5, [`${MW("metal_sheet_06")} + ${QP(2)}*0.6`, `${MW("metal_slam_01")} + ${MW("metal_sheet_05")}*0.6 + ${QP(4)}*0.4`]],
  // pitchfork: tines stab in (a short blade stab over a thud)
  ["hit-stab", 320, -13, [`rpg80:blade_01.ogg + ${QP(4)}*0.7`, `rpgaudio:OGG/knifeSlice2.ogg + ${QP(2)}*0.7`], { lift: 6 }],
  // golf club: a lighter metal hit (metal_hit_03 56% 500-2k; _04 83% over 2 kHz)
  ["hit-light-metal", 380, -13, [`${MW("metal_hit_03")} + ${QP(2)}*0.6`, `${MW("metal_hit_04")} + ${QP(4)}*0.6`]],
  // rubber chicken: toy squeak (94% 2-6 kHz) over a soft thud
  ["hit-squeak", 300, -14, [`squeakyrat:qubodupSqueakyRat/qubodupSqueakyRatAttack.flac + ${QP(3)}*0.3`, `squeakyrat:qubodupSqueakyRat/qubodupSqueakyRatPain.flac + ${QP(4)}*0.3`]],
  // plunger: suction pop (mouth pops, 99% 500-2k, 77-100 ms) over a thud
  ["hit-plunger", 300, -14, [`pop5:pop5.ogg + ${QP(3)}*0.4`, `pop7:pop7.ogg + ${QP(4)}*0.4`]],
  // umbrella: cloth whump and a light rib tap
  ["hit-umbrella", 360, -15, [`rpgaudio:OGG/cloth1.ogg + ${MW("wood_hit_06")}*0.5`], { lift: 4 }],
  // bike chain: rattle (94% over 6 kHz) over a thud
  ["hit-chain", 450, -14, [`rpg80:chain_01.ogg + ${QP(3)}*0.5`, `rpg80:chain_02.ogg + ${QP(4)}*0.5`]],
  // darts: a short thunk (wood_hit_05 95 ms, 79% 150-500) with a point tick
  ["hit-darts", 200, -15, [`${MW("wood_hit_05")} + ${MW("metal_hit_01")}*0.25`, `${MW("wood_hit_06")} + ${MW("metal_hit_05")}*0.25`], { lift: 5 }],
  // bricks: heavy thud (bfh1_hit_02 82% <150; slam_04 55% <150)
  ["hit-brick", 450, -12, [`break75:bfh1_hit_02.ogg + ${QP(3)}`, `${S100("slam_04")} + ${QP(2)}*0.5`]],
  // paint can: a full can's heavy metal slam (metal_slam_01 48% <150 + 37% 150-500)
  ["hit-paint", 420, -12, [`${MW("metal_slam_01")} + ${QP(2)}*0.5`], { lift: 7 }],
  // plastic bottle, lawn flamingo: hollow plastic bonk (plop 87% 500-2k)
  ["hit-plastic", 250, -14, [`${S100("plop_02")} + ${QP(3)}*0.3`, `${S100("plop_01")} + ${QP(4)}*0.3`], { lift: 6 }],
  // rubber ball: a real ball smack, no cartoon boing (round 2: "nothing cute"): a rubber thwack
  // (thwack-07 48% <150, 14% 2-6k: a slap with snap) or a lighter one with a hollow plop
  ["hit-ball", 360, -14, [`thwack:PCM/thwack-07.wav + ${QP(3)}*0.4`, `thwack:PCM/thwack-02.wav + ${S100("plop_01")}*0.3 + ${QP(4)}*0.3`], { lift: 4 }],
  // hubcap: thin metal clang (metal_sheet_01, _04: 37-42% over 6 kHz)
  ["hit-hubcap", 420, -14, [`${MW("metal_sheet_01")} + ${QP(3)}*0.4`, `${MW("metal_sheet_04")} + ${QP(2)}*0.4`], { lift: 4 }],
  // traffic cone, tyre: rubber thwack (thwack-02 59% 150-500; thwack-05 78% <150)
  ["hit-rubber", 320, -13, [`thwack:PCM/thwack-02.wav + ${QP(3)}*0.5`, `thwack:PCM/thwack-05.wav + ${QP(4)}*0.5`], { lift: 4 }],
  // ---- pet contact
  // dog, raccoon: a jaw snap (eat_02 390 ms, eat_03 272 ms, centroid 4-6 kHz) over a light thud
  ["hit-bite", 320, -13.5, [`creature80:eat_02.ogg + ${QP(4)}*0.5`, `creature80:eat_03.ogg + ${QP(3)}*0.5`], { lift: 6 }],
  // crow, goose: a hard beak peck (short wood knock, 95 ms) over a soft thud
  ["hit-peck", 200, -14, [`${MW("wood_hit_05")} + ${QP(4)}*0.35`, `${MW("wood_hit_06")} + ${QP(3)}*0.35`], { lift: 4 }],
  // cat: claws rake (a fast swish and a thin scrape) over a light thud
  ["hit-claw", 280, -14, [`swishes:swishes/swish-11.wav*0.7 + rpg80:blade_03.ogg*0.6 + ${QP(4)}*0.5`, `swishes:swishes/swish-13.wav*0.7 + rpgaudio:OGG/knifeSlice2.ogg*0.5 + ${QP(2)}*0.5`], { lift: 6 }],
  // boar: a heavy tusk ram with its grunt under the blow
  ["hit-gore", 450, -12.5, [`${QP(3)} + pig:pig_hit1.mp3*0.35`, `break75:bfh1_hit_02.ogg + creature80:grunt_02.ogg*0.4 + ${QP(2)}*0.6`]],
  // ---- blocks
  ["block-arms", 300, -15, [`${QP(4)} + rpgaudio:OGG/cloth3.ogg*0.6`, `${QP(2)} + rpgaudio:OGG/cloth1.ogg*0.6`]],
  ["block-parry", 360, -14, ["break75:bfh1_metal_hit_02.ogg", MW("metal_hit_04")], { lift: 4 }],
  // car door: sheet-metal bang (metal_slam_01 low slam + metal_sheet_02 ring)
  ["block-sheet", 480, -12.5, [`${MW("metal_slam_01")} + ${MW("metal_sheet_02")}*0.7`, `${MW("metal_sheet_06")} + ${QP(2)}*0.5`], { lift: 4 }],
  // bin lid: tin crash (metal_sheet_01 42% over 6 kHz, metal_02 60% over 6 kHz)
  ["block-tin", 420, -13, [`${MW("metal_sheet_01")} + ${S100("metal_02")}*0.6`, MW("metal_sheet_04")], { lift: 5 }],
  // riot shield: hard thock (hit_03 62% 500-2k, hit_04 56% 500-2k); nearest to hard plastic found
  ["block-plastic", 300, -13.5, [S100("hit_03"), S100("hit_04")]],
  // wooden pallet, skateboard: wood slams and knocks
  ["block-wood", 360, -13.5, [MW("wood_slam_01"), MW("wood_slam_04"), "rpg80:wood_03.ogg"], { lift: 5 }],
  // ironing board: metal frame hit and rattle
  ["block-frame", 420, -13.5, [`${MW("metal_hit_03")} + break75:bfh1_metal_falling_02.ogg*0.5`]],
  // ---- swings
  // light: a fast air swoosh (swish_2 85% 500-2k, 297 ms from its onset), a thin blade swish
  // (sword.6), and two quick swishes run together; every one 120 ms or more (swish-11 and -13
  // alone shipped at 65 and 57 ms: two fist swings of three were a click, round 2 review)
  ["swish-light", 220, -20, ["battle:battle_sound_effects/swish_2.wav", "sword20:sword - StarNinjas/sword.6.ogg", "swishes:swishes/swish-9.wav + swishes:swishes/swish-11.wav~60*0.7"]],
  // (swish-7 alone trimmed to 110 ms; a second swish under its tail carries it on)
  ["swish-medium", 340, -19, ["battle:battle_sound_effects/swish_3.wav", "battle:battle_sound_effects/swish_4.wav", "swishes:swishes/swish-7.wav + swishes:swishes/swish-4.wav~60*0.6"]],
  // heavy whoomp: low swish (swish-3 centroid 206 Hz) + a metal swing (175 Hz, 857 ms)
  ["swish-heavy", 520, -17, ["swishes:swishes/swish-3.wav + metalint:metal_interactions/metal_swing1.wav*0.8", "swishes:swishes/swish-8.wav + metalint:metal_interactions/metal_swing1.wav*0.6"]],
  // chain whip: high whoosh with a rattle
  ["swish-whip", 380, -18, ["sword20:sword - StarNinjas/sword.5.ogg + rpg80:chain_03.ogg*0.5"]],
  // ---- throws (flight sound at the release)
  // the plain air whoosh of a thrown thing (and of a Move's throw): no blade in it
  ["throw", 380, -17, ["battle:battle_sound_effects/swish_3.wav", "swishes:swishes/swish-7.wav"]],
  // boomerang, hubcap, tyre: spinning whirr (car_spinning 55% <150, 673 ms)
  ["throw-spin", 650, -16, ["spin:car_spinning.wav"]],
  // ---- drops on the floor, by material
  ["drop-metal", 480, -15, ["break75:bfh1_metal_falling_02.ogg", MW("metal_falling_02")]],
  ["drop-wood", 420, -15, ["break75:bfh1_wood_falling_02.ogg", MW("wood_falling_01")]],
  ["drop-soft", 300, -15, ["thwack:PCM/thwack-05.wav", "thwack:PCM/thwack-07.wav"]],
  // a brick on concrete: a single stone knock (rock_hit_01 109 ms) over a dull thud
  ["drop-stone", 480, -14, ["break75:bfh1_rock_hit_01.ogg + break75:bfh1_hit_02.ogg*0.6", `rpg80:item_stone_01.ogg + ${QP(3)}*0.4`]],
  ["drop-sheet", 520, -14, [`${MW("metal_slam_01")} + ${MW("metal_sheet_03")}*0.5`]],
  // ---- pets
  ["voice-dog", 420, -15, ["dogsounds:Dog/Dog Bark 1.wav", "dogsounds:Dog/Dog Bark 3.wav", "dogsnarl:dog/dog-growl.flac"]],
  ["voice-crow", 450, -15, ["crowcaw:crow_caw.wav", "crow:crow.ogg"]],
  // goose: two real honks cut from one take (400-950 ms and 2200-2900 ms)
  ["voice-goose", 520, -16, ["goose:GooseHonksBizarre AT085701.wav@400", "goose:GooseHonksBizarre AT085701.wav@2220"]],
  // raccoon: a sharp snort (1600-2000 ms) and a low growl (3100-3400 ms)
  ["voice-raccoon", 420, -16, ["raccoon:Raccoon_Snorts_and_Growls_OCP-1199-05.wav@1600", "raccoon:Raccoon_Snorts_and_Growls_OCP-1199-05.wav@3080"]],
  // boar: grunts and squeals (toy pig resampled to pig pitch; a low creature grunt 99% 150-500)
  ["voice-boar", 400, -15, ["pig:pig_hit1.mp3", "pig2:pig_hit2.mp3", "creature80:grunt_02.ogg"]],
  // cat: upset yowl and hiss (59-77% 500-2k)
  ["voice-cat", 600, -16, ["catsfx:Cat 7.wav", "catsfx8:Cat 8.wav"]],
  // ---- the rest of the fight and the app (unchanged picks)
  ["dash", 240, -20, ["rpgaudio:OGG/footstep01.ogg + swishes:swishes/swish-9.wav*0.4", "rpgaudio:OGG/footstep08.ogg + swishes:swishes/swish-7.wav*0.4"]],
  ["landing", 520, -11, [`${HIT(30)} + ${QP(3)}*0.6`, `break75:bfh1_hit_02.ogg + ${QP(3)}*0.5`]],
  ["crowd", 650, -22, [`${CHEER}@2000`, "crowdshout:crowd_shouting.ogg@13250"]],
  // the family fallback of a Move cue: a quiet cloth rustle, never a music stinger (round 2: four
  // jingles at impact level were an audio banner on every skill). Every Move has its own sets
  // (below), so this plays only for a Move the table does not know.
  ["move", 300, -24, ["rpgaudio:OGG/cloth2.ogg"]],
  // ---- Moves: each its own sound (apps/web/src/audio/soundMap.ts MOVE_SET), act then effect
  // Haymaker: the charge crackles on the fist (spell_02 93% 2-6k, a bright zap; fire_06 a hissing
  // crackle under it); the boosted blow bursts with a pop-boom and the crackle (under the punch)
  ["move-charge", 600, -18, ["rpg80:spell_02.ogg + rpg80:spell_fire_06.ogg*0.5"]],
  ["move-haymaker-hit", 520, -15, [`${S100("explosion")} + rpg80:spell_02.ogg*0.6`]],
  // Energy Drink: the tab clicks (metalLatch 47% 2-6k, 80 ms) and the gas hisses out (noise_01,
  // 62% over 6 kHz) 25 ms later; then the gulps (burble_02, 91% 500-2k: liquid, throat)
  ["move-can-open", 320, -18, [`rpgaudio:OGG/metalLatch.ogg*0.8 + ${S100("noise_01")}~25*0.9`]],
  ["move-gulp", 480, -17, ["creature80:burble_02.ogg"]],
  // Tarp: shaken out (a cloth flap), then it slaps down and wraps the target (cloth whump, a
  // leather drop, a soft rubber thud under it)
  ["move-tarp-shake", 360, -22, ["rpgaudio:OGG/cloth4.ogg + rpgaudio:OGG/clothBelt2.ogg*0.4"]],
  ["move-tarp-land", 420, -15, ["rpgaudio:OGG/cloth1.ogg + rpgaudio:OGG/dropLeather.ogg*0.8 + thwack:PCM/thwack-05.wav*0.4"]],
  // Whistle: a referee's pea whistle, one blast (synthesised, see SYNTH)
  ["move-whistle", 500, -15, ["synth:pea-whistle"]],
  // Firecrackers: the fuse fizzes (fire_06 hiss crackle); a string of five pops round the feet
  // over 650 ms (MOVE.crackersMs): two sharp cracks (shot_01 61% 2-6k, shot_02) and two mouth
  // pops between them, over a low pop-boom, in place of the bare-fist punch
  ["move-fuse", 520, -21, ["rpg80:spell_fire_06.ogg"]],
  ["move-crackers", 650, -13, [`${S100("shot_01")} + pop5:pop5.ogg~95*0.8 + ${S100("shot_02")}~190 + pop7:pop7.ogg~300*0.8 + ${S100("shot_01")}~430*0.6 + ${S100("explosion")}*0.35`]],
  // Snatch: the hand grabs the weapon (a leather grab, a cloth snap, a light slap)
  ["move-grab", 280, -17, [`rpgaudio:OGG/handleSmallLeather.ogg + rpgaudio:OGG/cloth2.ogg*0.7 + ${QP(4)}*0.3`]],
  // Air Horn: a handheld can air horn blast (synthesised, see SYNTH)
  ["move-air-horn", 650, -14, ["synth:air-horn"]],
  // Body Slam: the heave (a low male grunt, grunt_03 126-160 Hz, voiced), then the body hitting
  // the floor (slam_02 50% <150 Hz) in place of the punch; the floor's "landing" plays under it
  ["move-heave", 450, -17, ["creature80:grunt_03.ogg + rpgaudio:OGG/cloth3.ogg*0.4"]],
  ["move-slam", 520, -12, [`${S100("slam_02")} + ${QP(3)}*0.6`]],
  // Sand in the Eyes: the handful scooped (a grit scatter, quiet), then the hiss and patter of sand
  // on the face (noise_01 hiss, stones_04 83% 2-6k grit)
  ["move-sand-scoop", 300, -23, ["rpg80:stones_04.ogg*0.6 + rpgaudio:OGG/cloth4.ogg*0.5"]],
  ["move-sand", 420, -16, [`${S100("noise_01")} + rpg80:stones_04.ogg*0.45 + rpgaudio:OGG/cloth2.ogg*0.4`]],
  // Taunt: his shout (misc_09, a voiced male call at 161 Hz, 86% 150-500), then the enemy's angry
  // snort (nose, 84 Hz)
  ["move-shout", 520, -15, ["creature80:misc_09.ogg"]],
  ["move-snort", 360, -17, ["creature80:nose.ogg"]],
  // Second Wind: the deep breath in (breath, 52% 500-2k + 32% 2-6k: air through the mouth)
  ["move-breath", 700, -17, ["creature80:breath.ogg"]],
  // Grapple: the grab (a short male grunt, hurt_05 122-129 Hz, and the cloth bunching), then the
  // squeeze: a long strain grunt (grunt_01) and cloth crushed, in place of the punch
  ["move-grab-grunt", 420, -17, ["creature80:hurt_05.ogg*0.8 + rpgaudio:OGG/cloth3.ogg*0.6"]],
  ["move-squeeze", 600, -14, [`creature80:grunt_01.ogg + rpgaudio:OGG/cloth1.ogg*0.6 + ${QP(4)}*0.4`]],
  // ---- the heavy layer under a crit or the knockout blow: a low body slam (slam_02) and a deep
  // thump, about 5 dB under the blow itself
  ["hit-accent", 520, -18, [`${S100("slam_02")} + ${HIT(30)}*0.5`]],
  ["win", 2200, -14, ["winjingle:WinBrass.wav"]],
  ["loss", 1100, -14, ["jingles:OGG/jingles_SAX/jingles_SAX01.ogg"]],
  ["ui-tap", 120, -23, ["interface:Audio/click_001.ogg", "interface:Audio/select_001.ogg"]],
  ["card-flip", 300, -23, ["rpgaudio:OGG/bookFlip3.ogg"]],
  ["level-up", 1400, -13, ["jingles:OGG/jingles_STEEL/jingles_STEEL04.ogg"]],
];
/** The set each stage family and app sound falls back to when a cue names no item. */
export const ALIASES = {
  fist: "hit-fist", blunt: "hit-pipe", blade: "hit-blade-small", block: "block-arms", whoosh: "swish-medium", dash: "dash",
  landing: "landing", throw: "throw", drop: "drop-metal", crowd: "crowd", companion: "voice-dog", move: "move",
  win: "win", loss: "loss", swing: "swish-medium", "ui-tap": "ui-tap", "card-flip": "card-flip", "level-up": "level-up",
};

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
  const missing = PACKS.filter((p) => p.local && !existsSync(join(LOCAL, p.local)));
  if (missing.length > 0) {
    console.error(`build-audio: ${missing.length} licensed pack(s) not found in ${LOCAL}:`);
    for (const p of missing) console.error(`  ${p.local}  (${p.name}, ${p.page})`);
    console.error("Download them with the owner's licence, then pass --local <dir> or set RANKZERO_LOCAL_AUDIO=<dir>.");
    process.exit(2);
  }
  for (const p of PACKS) {
    if (p.synth) { dirs.set(p.id, null); continue; }
    const home = join(SRC, p.id);
    mkdirSync(home, { recursive: true });
    const file = p.local ? join(LOCAL, p.local) : join(home, decodeURIComponent(basename(p.url)));
    if (p.local && !existsSync(file)) throw new Error(`${p.name}: download it from ${p.page} into ${LOCAL} (or pass --local <dir>)`);
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
  const m = /^([a-z0-9-]+):(.+?)(?:@(\d+))?(?:~(\d+))?(?:\*([\d.]+))?$/.exec(spec.trim());
  if (!m) throw new Error(`bad layer "${spec}"`);
  return { pack: m[1], path: m[2], at: m[3] === undefined ? null : Number(m[3]), delay: m[4] === undefined ? 0 : Number(m[4]),
    gain: m[5] === undefined ? 1 : Number(m[5]) };
}

/** One layer from its onset (or fixed start), scaled to peak 1 times its gain. */
function layer(dirs, l, maxMs) {
  if (!dirs.has(l.pack)) throw new Error(`unknown pack ${l.pack}`);
  let pcm;
  if (l.pack === "synth") {
    if (!SYNTH[l.path]) throw new Error(`synth: no recipe ${l.path}`);
    pcm = SYNTH[l.path]();
  } else {
    const file = join(dirs.get(l.pack), l.path);
    if (!existsSync(file)) throw new Error(`${l.pack}: no file ${l.path}`);
    pcm = decode(file);
  }
  const peak = peakOf(pcm);
  let start;
  if (l.at !== null) {
    // align the window to the sound's onset inside it (half the window's peak, minus 10 ms)
    const from = Math.round((l.at / 1000) * RATE);
    const win = pcm.subarray(from, from + Math.round((maxMs / 1000) * RATE));
    const wp = peakOf(win);
    let i = 0;
    while (i < win.length && Math.abs(win[i]) < 0.5 * wp) i++;
    start = from + Math.max(0, i - Math.round(0.01 * RATE));
  } else {
    let i = 0;
    while (i < pcm.length && Math.abs(pcm[i]) < 0.5 * peak) i++;
    start = Math.max(0, i - Math.round(0.005 * RATE));
  }
  const out = pcm.slice(start);
  const g = l.gain / (l.at !== null ? peakOf(out) || 1 : peak || 1);
  for (let i = 0; i < out.length; i++) out[i] *= g;
  return out;
}

function prepare(dirs, spec, maxMs, target, opts = {}) {
  const layers = spec.split(" + ").map(parseLayer);
  const parts = layers.map((l) => layer(dirs, l, maxMs));
  // "~ms": a layer that starts that long after the first (a string of pops, a second swish)
  const delays = layers.map((l) => Math.round((l.delay / 1000) * RATE));
  const max = Math.round((maxMs / 1000) * RATE);
  let len = Math.min(max, Math.max(...parts.map((p, k) => p.length + delays[k])));
  const out = new Float32Array(len);
  parts.forEach((p, k) => { for (let i = 0; i + delays[k] < len && i < p.length; i++) out[i + delays[k]] += p[i]; });
  // trim the quiet tail (-50 dB of the peak)
  const pk = peakOf(out);
  while (len > 10 && Math.abs(out[len - 1]) < pk * 0.003) len--;
  const clip = out.slice(0, len);
  // fades: in 2 ms (8 ms for a window cut from a long recording, which starts 10 ms before its
  // onset), out up to 60 ms
  const fin = Math.min(len, Math.round((layers[0].at !== null ? 0.008 : 0.002) * RATE));
  for (let i = 0; i < fin; i++) clip[i] *= i / fin;
  const fout = Math.min(Math.round(0.06 * RATE), Math.round(len * 0.3));
  for (let i = 0; i < fout; i++) clip[len - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fout);
  // -1 dBFS peak, then down to the family's loudness, or up by at most `lift` dB through a soft
  // limiter (above 60% of the ceiling, peaks bend toward the ceiling and never reach it)
  const g1 = PEAK / (peakOf(clip) || 1);
  for (let i = 0; i < len; i++) clip[i] *= g1;
  const want = target - loudness(clip);
  if (want < 0) {
    const g2 = 10 ** (want / 20);
    for (let i = 0; i < len; i++) clip[i] *= g2;
  } else {
    let left = opts.lift ?? 0;
    const knee = PEAK * 0.6;
    const room = PEAK - knee;
    for (let pass = 0; pass < 4 && left > 0.1; pass++) {
      const db = Math.min(target - loudness(clip), left);
      if (db < 0.2) break;
      left -= db;
      const g2 = 10 ** (db / 20);
      for (let i = 0; i < len; i++) {
        const a = Math.abs(clip[i] * g2);
        clip[i] = a > knee ? Math.sign(clip[i]) * (knee + room * Math.tanh((a - knee) / room)) : clip[i] * g2;
      }
    }
  }
  let at = 0;
  for (let i = 0; i < len; i++) if (Math.abs(clip[i]) > Math.abs(clip[at])) at = i;
  // onset: the first sample at half the final peak (where the sound is plainly heard)
  let on = 0;
  while (on < len && Math.abs(clip[on]) < 0.5 * Math.abs(clip[at])) on++;
  return { clip, layers, peakDb: dB(peakOf(clip)), loudDb: loudness(clip), peakAtMs: ms(at), onsetMs: ms(on) };
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
const used = [];
const problems = [];
/** Two sprites: the core holds every set a stage family falls back to (so every cue has a sound
 *  as soon as the core is in); the content sprite holds the per-weapon, shield and pet sets and
 *  loads right after it. Both load only after the first tap. */
// every pet's voice is in the core too, so a pet never borrows another animal's call while the
// content sprite loads
// every Move's own sounds and the crit layer too (round 2 review), so a skill never plays a
// fallback while the content loads
const CORE = new Set([...Object.values(ALIASES), ...SETS.map(([name]) => name).filter((n) => /^(voice|move)-/.test(n) || n === "hit-accent")]);
const SPRITES = [
  { file: "sfx.mp3", sets: SETS.filter(([name]) => CORE.has(name)) },
  { file: "sfx-content.mp3", sets: SETS.filter(([name]) => !CORE.has(name)) },
];
for (const sp of SPRITES) {
  const parts = [];
  sp.planned = [];
  let cursor = gap;
  for (const [family, maxMs, target, slots, opts] of sp.sets) {
    const list = [];
    slots.forEach((spec, v) => {
      const p = prepare(dirs, spec, maxMs, target, opts);
      if (p.loudDb < target - LOUD_TOL) problems.push(`${family}[${v}] ends at ${p.loudDb.toFixed(1)} dB, more than ${LOUD_TOL} dB under its ${target} dB target (give the set a lift or a louder source)`);
      if (family.startsWith("swish-") && ms(p.clip.length) < SWISH_MIN_MS) problems.push(`${family}[${v}] is ${ms(p.clip.length)} ms, a tick, not a swish (at least ${SWISH_MIN_MS} ms)`);
      parts.push({ at: cursor, clip: p.clip });
      list.push({ at: cursor, len: p.clip.length });
      used.push({ family, variant: v, sprite: sp.file, files: p.layers.map((l) => `${l.pack}:${l.path}`), lenMs: ms(p.clip.length), peakDb: Number(p.peakDb.toFixed(1)), loudDb: Number(p.loudDb.toFixed(1)), peakAtMs: p.peakAtMs, onsetMs: p.onsetMs });
      cursor += p.clip.length + gap;
    });
    sp.planned.push([family, list]);
  }
  sp.total = new Float32Array(cursor + gap);
  for (const p of parts) sp.total.set(p.clip, p.at);
}

const work = join(tmpdir(), "rankzero-audio-build");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
mkdirSync(OUT, { recursive: true });
// MP3 encoding overshoots a -1 dBFS peak by up to about 2 dB. When a decoded file peaks over
// -0.5 dBFS, both sprites are turned down by the overshoot (every sound alike, so the balance
// between sets stays) and encoded again.
let trim = 1;
for (let pass = 0; pass < 4; pass++) {
  let over = -Infinity;
  for (const sp of SPRITES) {
    sp.mp3 = join(OUT, sp.file);
    writeFileSync(join(work, "sprite.wav"), wav(sp.total));
    run("ffmpeg", ["-v", "error", "-y", "-i", join(work, "sprite.wav"), "-ac", "1", "-ar", String(RATE), "-c:a", "libmp3lame", "-b:a", BITRATE, sp.mp3]);
    over = Math.max(over, dB(peakOf(decode(sp.mp3))) - -0.5);
  }
  if (over <= 0) break;
  const g = 10 ** (-(over + 0.05) / 20);
  for (const sp of SPRITES) for (let i = 0; i < sp.total.length; i++) sp.total[i] *= g;
  trim *= g;
}

// Measure where the sounds really start in each encoded file. The encoder (and the decoder's
// handling of its padding) shifts a whole file by one constant amount: it is found as the lag
// (-10 to +80 ms) at which the decoded file best matches the file that went in, by
// cross-correlation over every sound, then checked per sound (each must agree within 1 ms).
const map = {};
let k = 0;
let disagree = 0;
let failed = false;
SPRITES.forEach((sp, f) => {
  const total = sp.total;
  const back = decode(sp.mp3);
  const corr = (lag, from, n) => {
    let score = 0;
    for (let i = from; i < from + n; i++) score += total[i] * (back[i + lag] ?? 0);
    return score;
  };
  const lags = [];
  for (let lag = -Math.round(0.01 * RATE); lag <= Math.round(0.08 * RATE); lag++) lags.push(lag);
  const best = (from, n) => lags.reduce((b, lag) => { const sc = corr(lag, from, n); return sc > b.sc ? { lag, sc } : b; }, { lag: 0, sc: -Infinity }).lag;
  const shift = best(0, total.length - Math.round(0.08 * RATE));
  for (const [family, list] of sp.planned) {
    map[family] = list.map(({ at, len }) => {
      const own = best(at, Math.min(len, Math.round(0.1 * RATE)));
      if (Math.abs(own - shift) > RATE / 1000) disagree++;
      k++;
      return { f, start: ms(at + shift), dur: ms(len) };
    });
  }
  const size = statSync(sp.mp3).size;
  const peak = peakOf(back);
  console.log(`${sp.file.padEnd(16)} ${(size / 1024).toFixed(1)} KB (cap ${CAP / 1024} KB) at ${BITRATE}, ${(total.length / RATE).toFixed(2)} s, ${sp.sets.reduce((n, s) => n + s[3].length, 0)} sounds, decoded peak ${dB(peak).toFixed(2)} dBFS, encoder shift ${ms(shift)} ms`);
  if (size > CAP) { console.error(`build-audio: ${sp.file} is over the 300 KB cap`); failed = true; }
  if (peak >= 1) { console.error(`build-audio: ${sp.file} clips`); failed = true; }
});
const packsUsed = PACKS.filter((p) => used.some((u) => u.files.some((f) => f.startsWith(`${p.id}:`))));
const json = {
  version: 2,
  files: SPRITES.map((s) => s.file),
  note: "Offsets in ms, measured on the decoded MP3 (not planned); `f` is the index in `files`. Built by tools/build-audio.mjs. Credits: see `credits` and CREDITS.md.",
  sets: map,
  families: ALIASES,
  sources: used.map((u) => ({ set: u.family, variant: u.variant, files: u.files, loud: u.loudDb, onset: u.onsetMs, peakAt: u.peakAtMs })),
  credits: packsUsed.map((p) => ({ pack: p.id, name: p.name, author: p.author, licence: p.licence, licenceUrl: p.licenceUrl, page: p.page, fetched: p.fetched })),
};
writeFileSync(join(OUT, "sfx.json"), `${JSON.stringify(json, null, 1)}\n`);
writeCredits();
for (const u of used) console.log(`${`${u.family}[${u.variant}]`.padEnd(20)} ${String(u.lenMs).padStart(6)} ms  peak ${String(u.peakDb).padStart(5)} dB  loud ${String(u.loudDb).padStart(6)} dB  onset ${String(u.onsetMs).padStart(5)} ms  peak at ${String(u.peakAtMs).padStart(5)} ms  ${u.files.join(" + ")}`);
console.log(`whole-sprite trim ${dB(trim).toFixed(2)} dB; ${k - disagree} of ${k} sounds agree on their file's encoder shift within 1 ms`);
for (const pr of problems) console.error(`build-audio: ${pr}`);
if (failed || problems.length > 0) process.exit(1);

/** Rewrites the sound table in CREDITS.md: one row per source file, in order of first use. */
function writeCredits() {
  const path = join(ROOT, "CREDITS.md");
  if (!existsSync(path) || OUT !== resolve(join(ROOT, "apps/web/public/audio"))) return;
  const rows = new Map();
  for (const u of used) {
    for (const f of u.files) {
      const row = rows.get(f) ?? { sets: [] };
      if (!row.sets.includes(u.family)) row.sets.push(u.family);
      rows.set(f, row);
    }
  }
  const lines = [...rows].map(([f, row]) => {
    const [id, ...rest] = f.split(":");
    const p = PACKS.find((q) => q.id === id);
    return `| ${basename(rest.join(":"))} (${p.name}) | ${row.sets.join(", ")} | ${p.page} | ${p.author} | ${p.licence} | ${p.fetched} |`;
  });
  const md = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  const head = "| File | Used for | Source URL | Author | Licence | Fetched |\n|---|---|---|---|---|---|\n";
  const at = md.indexOf(head, md.indexOf("## Sounds"));
  const end = md.indexOf("\n## ", at);
  if (at < 0 || end < 0) throw new Error("CREDITS.md: no sound table under ## Sounds");
  writeFileSync(path, `${md.slice(0, at)}${head}${lines.join("\n")}\n${md.slice(end)}`);
}
