#!/usr/bin/env node
/**
 * Build the sound sprite (fight-screen lane). Run: pnpm build-audio [--src <dir>] [--out <dir>]
 *
 * Writes apps/web/public/audio/sfx.mp3 (the core sprite: every set a stage family falls back to),
 * sfx-content.mp3 (the per-weapon, shield and pet sets), each a mono MP3 under a 300 KB cap, and
 * sfx.json (which file, where each sound starts and how long it is, in ms, plus where every
 * sound came from and its licence).
 *
 * Sources: free sound packs with a clear licence (CC0 or CC BY), each fetched from its own page
 * on OpenGameArt and pinned by SHA-256. `PACKS` holds the page, author, licence and fetch date
 * of every pack; CREDITS.md has the same rows. No pack is ripped game audio or AI-generated sound.
 *
 * Envato Elements (owner's licence, owner OK 15 Nov 2026: "use free or envato"): a pack with
 * `local` has no URL. The owner downloads it; the build reads it from --local <dir> (default
 * D:/Downloads), checks its SHA-256 and unpacks it. Only short cut clips go into the sprite; the
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
const LOCAL = resolve(arg("local") ?? "D:/Downloads");
const RATE = 44100;
const BITRATE = "64k";
const GAP_MS = 50;
const CAP = 300 * 1024;
const PEAK = 10 ** (-1 / 20);            // -1 dBFS

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
  { id: "boings", name: "Boings", page: "https://opengameart.org/content/boings", url: `${OGA}bung_01.mp3`, sha256: "a2ed9251698dfa9d7ec9952117095da7c0bfd13b3b0ef456382581f711b2ee7f", author: "EZduzziteh", ...CC0 },
  { id: "boing", name: "BOING!", page: "https://opengameart.org/content/boing", url: `${OGA}boing.flac`, sha256: "9c6af38ca79332ad3fa66ad1229179d2a91655c1157d3620e21ef676f54d9fdd", author: "Aeva", ...CC0 },
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
].map((p) => ({ fetched: FETCHED, ...p }));

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
  ["hit-blade-small", 110, -15, ["rpgaudio:OGG/knifeSlice2.ogg", "rpg80:blade_01.ogg", "rpg80:blade_03.ogg"]],
  // machete, hand axe: chop (64% 500-2k) or slice over a heavier thud
  ["hit-blade-big", 360, -13, [`rpgaudio:OGG/chop.ogg + ${QP(4)}*0.6`, `rpg80:blade_02.ogg + ${QP(2)}*0.7`]],
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
  // golf club, pitchfork, pickaxe: a lighter metal hit (metal_hit_03 56% 500-2k; _04 83% over 2 kHz)
  ["hit-light-metal", 380, -13, [`${MW("metal_hit_03")} + ${QP(2)}*0.6`, `${MW("metal_hit_04")} + ${QP(4)}*0.6`]],
  // rubber chicken: toy squeak (94% 2-6 kHz) over a soft thud
  ["hit-squeak", 300, -14, [`squeakyrat:qubodupSqueakyRat/qubodupSqueakyRatAttack.flac + ${QP(3)}*0.3`, `squeakyrat:qubodupSqueakyRat/qubodupSqueakyRatPain.flac + ${QP(4)}*0.3`]],
  // plunger: suction pop (mouth pops, 99% 500-2k, 77-100 ms) over a thud
  ["hit-plunger", 300, -14, [`pop5:pop5.ogg + ${QP(3)}*0.4`, `pop7:pop7.ogg + ${QP(4)}*0.4`]],
  // umbrella: cloth whump and a light rib tap
  ["hit-umbrella", 360, -15, [`rpgaudio:OGG/cloth1.ogg + ${MW("wood_hit_06")}*0.5`]],
  // bike chain: rattle (94% over 6 kHz) over a thud
  ["hit-chain", 450, -14, [`rpg80:chain_01.ogg + ${QP(3)}*0.5`, `rpg80:chain_02.ogg + ${QP(4)}*0.5`]],
  // darts: a short thunk (wood_hit_05 95 ms, 79% 150-500) with a point tick
  ["hit-darts", 200, -15, [`${MW("wood_hit_05")} + ${MW("metal_hit_01")}*0.25`, `${MW("wood_hit_06")} + ${MW("metal_hit_05")}*0.25`]],
  // bricks: heavy thud (bfh1_hit_02 82% <150; slam_04 55% <150)
  ["hit-brick", 450, -12, [`break75:bfh1_hit_02.ogg + ${QP(3)}`, `${S100("slam_04")} + ${QP(2)}*0.5`]],
  // paint can: a full can's heavy metal slam (metal_slam_01 48% <150 + 37% 150-500)
  ["hit-paint", 420, -12, [`${MW("metal_slam_01")} + ${QP(2)}*0.5`]],
  // plastic bottle, lawn flamingo: hollow plastic bonk (plop 87% 500-2k)
  ["hit-plastic", 250, -14, [`${S100("plop_02")} + ${QP(3)}*0.3`, `${S100("plop_01")} + ${QP(4)}*0.3`]],
  // rubber ball: boing (bung_01 54% 500-2k; boing 93% 150-500)
  ["hit-ball", 450, -14, ["boings:bung_01.mp3", "boing:boing.flac"]],
  // hubcap: thin metal clang (metal_sheet_01, _04: 37-42% over 6 kHz)
  ["hit-hubcap", 420, -14, [`${MW("metal_sheet_01")} + ${QP(3)}*0.4`, `${MW("metal_sheet_04")} + ${QP(2)}*0.4`]],
  // traffic cone, tyre: rubber thwack (thwack-02 59% 150-500; thwack-05 78% <150)
  ["hit-rubber", 320, -13, [`thwack:PCM/thwack-02.wav + ${QP(3)}*0.5`, `thwack:PCM/thwack-05.wav + ${QP(4)}*0.5`]],
  // ---- blocks
  ["block-arms", 300, -15, [`${QP(4)} + rpgaudio:OGG/cloth3.ogg*0.6`, `${QP(2)} + rpgaudio:OGG/cloth1.ogg*0.6`]],
  ["block-parry", 360, -14, ["break75:bfh1_metal_hit_02.ogg", MW("metal_hit_04")]],
  // car door: sheet-metal bang (metal_slam_01 low slam + metal_sheet_02 ring)
  ["block-sheet", 480, -12.5, [`${MW("metal_slam_01")} + ${MW("metal_sheet_02")}*0.7`, `${MW("metal_sheet_06")} + ${QP(2)}*0.5`]],
  // bin lid: tin crash (metal_sheet_01 42% over 6 kHz, metal_02 60% over 6 kHz)
  ["block-tin", 420, -13, [`${MW("metal_sheet_01")} + ${S100("metal_02")}*0.6`, MW("metal_sheet_04")]],
  // riot shield: hard thock (hit_03 62% 500-2k, hit_04 56% 500-2k); nearest to hard plastic found
  ["block-plastic", 300, -13.5, [S100("hit_03"), S100("hit_04")]],
  // wooden pallet, skateboard: wood slams and knocks
  ["block-wood", 360, -13.5, [MW("wood_slam_01"), MW("wood_slam_04"), "rpg80:wood_03.ogg"]],
  // ironing board: metal frame hit and rattle
  ["block-frame", 420, -13.5, [`${MW("metal_hit_03")} + break75:bfh1_metal_falling_02.ogg*0.5`]],
  // ---- swings
  // light: short swishes (swish-11/13 91% 500-2k) and a thin blade swish (sword.6)
  ["swish-light", 220, -20, ["swishes:swishes/swish-11.wav", "swishes:swishes/swish-13.wav", "sword20:sword - StarNinjas/sword.6.ogg"]],
  ["swish-medium", 340, -19, ["battle:battle_sound_effects/swish_3.wav", "battle:battle_sound_effects/swish_4.wav", "swishes:swishes/swish-7.wav"]],
  // heavy whoomp: low swish (swish-3 centroid 206 Hz) + a metal swing (175 Hz, 857 ms)
  ["swish-heavy", 520, -17, ["swishes:swishes/swish-3.wav + metalint:metal_interactions/metal_swing1.wav*0.8", "swishes:swishes/swish-8.wav + metalint:metal_interactions/metal_swing1.wav*0.6"]],
  // chain whip: high whoosh with a rattle
  ["swish-whip", 380, -18, ["sword20:sword - StarNinjas/sword.5.ogg + rpg80:chain_03.ogg*0.5"]],
  // ---- throws (flight sound at the release)
  ["throw", 380, -16, ["sword20:sword - StarNinjas/sword.5.ogg"]],
  // boomerang, hubcap, tyre: spinning whirr (car_spinning 55% <150, 673 ms)
  ["throw-spin", 650, -16, ["spin:car_spinning.wav"]],
  // ---- drops on the floor, by material
  ["drop-metal", 480, -15, ["break75:bfh1_metal_falling_02.ogg", MW("metal_falling_02")]],
  ["drop-wood", 420, -15, ["break75:bfh1_wood_falling_02.ogg", MW("wood_falling_01")]],
  ["drop-soft", 300, -15, ["thwack:PCM/thwack-05.wav", "thwack:PCM/thwack-07.wav"]],
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
  ["move", 650, -13, ["jingles:OGG/jingles_HIT/jingles_HIT01.ogg", "jingles:OGG/jingles_HIT/jingles_HIT04.ogg", "jingles:OGG/jingles_HIT/jingles_HIT11.ogg", "jingles:OGG/jingles_HIT/jingles_HIT12.ogg"]],
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
  for (const p of PACKS) {
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
const used = [];
/** Two sprites: the core holds every set a stage family falls back to (so every cue has a sound
 *  as soon as the core is in); the content sprite holds the per-weapon, shield and pet sets and
 *  loads right after it. Both load only after the first tap. */
const CORE = new Set(Object.values(ALIASES));
const SPRITES = [
  { file: "sfx.mp3", sets: SETS.filter(([name]) => CORE.has(name)) },
  { file: "sfx-content.mp3", sets: SETS.filter(([name]) => !CORE.has(name)) },
];
for (const sp of SPRITES) {
  const parts = [];
  sp.planned = [];
  let cursor = gap;
  for (const [family, maxMs, target, slots] of sp.sets) {
    const list = [];
    slots.forEach((spec, v) => {
      const p = prepare(dirs, spec, maxMs, target);
      parts.push({ at: cursor, clip: p.clip });
      list.push({ at: cursor, len: p.clip.length });
      used.push({ family, variant: v, sprite: sp.file, files: p.layers.map((l) => `${l.pack}:${l.path}`), lenMs: ms(p.clip.length), peakDb: Number(p.peakDb.toFixed(1)), loudDb: Number(p.loudDb.toFixed(1)), peakAtMs: p.peakAtMs });
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
  sources: used.map((u) => ({ set: u.family, variant: u.variant, files: u.files })),
  credits: packsUsed.map((p) => ({ pack: p.id, name: p.name, author: p.author, licence: p.licence, licenceUrl: p.licenceUrl, page: p.page, fetched: p.fetched })),
};
writeFileSync(join(OUT, "sfx.json"), `${JSON.stringify(json, null, 1)}\n`);
for (const u of used) console.log(`${`${u.family}[${u.variant}]`.padEnd(20)} ${String(u.lenMs).padStart(6)} ms  peak ${String(u.peakDb).padStart(5)} dB  loud ${String(u.loudDb).padStart(6)} dB  peak at ${String(u.peakAtMs).padStart(5)} ms  ${u.files.join(" + ")}`);
console.log(`whole-sprite trim ${dB(trim).toFixed(2)} dB; ${k - disagree} of ${k} sounds agree on their file's encoder shift within 1 ms`);
if (failed) process.exit(1);
