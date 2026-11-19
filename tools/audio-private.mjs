/**
 * The private audio pipeline (plan 13.17). Paid audio (Envato Elements) never enters git: the repo
 * is public, and the Envato licence (clause 12 b and e) forbids redistributing an item "as-is or
 * with superficial modifications" or letting anyone extract it. So the paid files live in a folder
 * OUTSIDE the repo, and `tools/build-audio.mjs --overlay` mixes them into the BUILT site only
 * (apps/web/dist/audio, which git ignores). A clone without that folder builds and plays with the
 * CC0 sounds and the CC0 synthesised music in apps/web/public/audio.
 *
 * Where the folder is: `--private <dir>`, else RANKZERO_PRIVATE_AUDIO, else a folder named
 * "Rank Zero Private Audio" next to the main checkout (found through git's common dir, so a
 * worktree finds the same folder as the main checkout).
 *
 * What it holds: the owner's downloads in plain folders (Music/<Slot>/, Effects/<Slot>/), and
 * `manifest.json`, which says which file (and which part of it) fills which slot:
 *
 *   {
 *     "sets":  { "voice-goose": ["Effects/Goose Voice/GooseHonks.wav@400", "..."] },
 *     "music": { "menu": { "file": "Music/Menu Theme/x.wav", "loopStartMs": 0, "loopEndMs": 41739 },
 *                "ko":   { "file": "Music/KO Sting/y.wav", "startMs": 0, "endMs": 1800 } },
 *     "credits": { "Effects/Goose Voice/GooseHonks.wav": { "name": "Goose Honks", "author": "HollywoodEdge",
 *                  "page": "https://elements.envato.com/goose-honks-AS7EXLF" } }
 *   }
 *
 * A set's variants use the build's layer syntax with the pack "private:" implied when a layer
 * has no pack (a CC0 layer such as "qpunch:..." may be mixed under a private one). A set or a
 * music slot the manifest does not name keeps its CC0 sound.
 *
 * Everything here is pure (no ffmpeg, no network) so the fallback rules are tested on their own
 * (apps/web/test/audio/private-pipeline.test.ts).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export const PRIVATE_DIR_NAME = "Rank Zero Private Audio";
export const MUSIC_TRACKS = ["menu", "fight-calm", "fight-intense"];
export const MUSIC_STINGS = ["ko", "win", "lose", "level-up"];

/** The private folder to use, or null when none is configured or it does not exist.
 *  `gitCommonDir` is `git rev-parse --git-common-dir` (absolute), or null outside git. */
export function resolvePrivateRoot({ argv = [], env = {}, gitCommonDir = null, exists = existsSync } = {}) {
  const i = argv.indexOf("--private");
  const given = i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith("--") ? argv[i + 1] : undefined;
  if (argv.includes("--no-private")) return null;
  const candidates = [given, env.RANKZERO_PRIVATE_AUDIO,
    gitCommonDir ? join(dirname(dirname(resolve(gitCommonDir))), PRIVATE_DIR_NAME) : undefined].filter(Boolean);
  // an explicit folder that is missing is an error the caller reports; the default may be absent
  if (given !== undefined) return exists(given) ? resolve(given) : null;
  for (const c of candidates) if (exists(c)) return resolve(c);
  return null;
}

/** `git rev-parse --git-common-dir` from `root`, absolute, or null. */
export function gitCommonDirOf(root) {
  try {
    const out = execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return isAbsolute(out) ? out : resolve(root, out);
  } catch {
    return null;
  }
}

/** The manifest in a private folder, checked. Null when the folder has none. Throws on a
 *  manifest that names a slot the game does not have or a file that is not there. */
export function readManifest(root, { setNames, exists = existsSync, read = (p) => readFileSync(p, "utf8") }) {
  if (root === null) return null;
  const path = join(root, "manifest.json");
  if (!exists(path)) return null;
  const m = JSON.parse(read(path));
  const sets = m.sets ?? {};
  const music = m.music ?? {};
  const problems = [];
  for (const [name, variants] of Object.entries(sets)) {
    if (!setNames.includes(name)) problems.push(`sets.${name}: no such sound set`);
    if (!Array.isArray(variants) || variants.length === 0) { problems.push(`sets.${name}: needs a list of variants`); continue; }
    for (const v of variants) for (const l of String(v).split(" + ")) {
      const spec = privateLayer(l);
      if (spec.startsWith("private:")) {
        const file = spec.slice("private:".length).replace(/(@\d+)?(~\d+)?(\*[\d.]+)?$/, "");
        if (!exists(join(root, file))) problems.push(`sets.${name}: no file ${file}`);
      }
    }
  }
  for (const [slot, def] of Object.entries(music)) {
    if (!MUSIC_TRACKS.includes(slot) && !MUSIC_STINGS.includes(slot)) problems.push(`music.${slot}: no such music slot`);
    if (!def || typeof def.file !== "string") { problems.push(`music.${slot}: needs a file`); continue; }
    if (!exists(join(root, def.file))) problems.push(`music.${slot}: no file ${def.file}`);
    if (MUSIC_TRACKS.includes(slot) && !(Number.isFinite(def.loopStartMs) && Number.isFinite(def.loopEndMs) && def.loopEndMs > def.loopStartMs)) {
      problems.push(`music.${slot}: a loop needs loopStartMs < loopEndMs`);
    }
  }
  if (problems.length > 0) throw new Error(`private audio manifest ${path}:\n  ${problems.join("\n  ")}`);
  return { sets, music, credits: m.credits ?? {} };
}

/** A layer with no pack is a private file. */
export function privateLayer(layer) {
  const t = layer.trim();
  return /^[a-z0-9-]+:/.test(t) ? t : `private:${t}`;
}

/** The sets with the manifest's replacements: same order, same lengths and loudness targets,
 *  new variants. Returns the new list and the names that changed. */
export function applySetOverrides(sets, manifest) {
  if (manifest === null) return { sets, replaced: [] };
  const replaced = [];
  const out = sets.map((set) => {
    const [name, maxMs, target, , opts] = set;
    const mine = manifest.sets[name];
    if (!mine) return set;
    replaced.push(name);
    return [name, maxMs, target, mine.map((v) => String(v).split(" + ").map(privateLayer).join(" + ")), opts];
  });
  return { sets: out, replaced };
}

/** Which music slots come from the private folder; the rest stay CC0 synthesised. */
export function musicPlan(manifest) {
  const plan = {};
  for (const slot of [...MUSIC_TRACKS, ...MUSIC_STINGS]) {
    const def = manifest?.music?.[slot];
    plan[slot] = def ? { source: "private", ...def } : { source: "synth" };
  }
  return plan;
}

/** True when `out` is inside one of the tracked folders. Private audio may only be written to
 *  the build output, never into a path git tracks. */
export function isTrackedPath(out, root) {
  const rel = relative(resolve(root), resolve(out));
  if (rel.startsWith("..") || isAbsolute(rel)) return false;
  const parts = rel.split(sep).join("/");
  // dist/ and node_modules/ are ignored by .gitignore; every other folder in the repo is tracked
  return !/(^|\/)(dist|node_modules)(\/|$)/.test(parts);
}
