/**
 * The private audio pipeline (plan 13.17, tools/audio-private.mjs): paid audio is mixed into the
 * built site only, and without the private folder everything falls back to the repo's CC0 files.
 * Plus the shipped (tracked) audio: no Envato item in it, and the music map in step with its files.
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const PUB = join(ROOT, "apps/web/public/audio");

interface PrivateApi {
  PRIVATE_DIR_NAME: string;
  resolvePrivateRoot(o: { argv?: string[]; env?: Record<string, string>; gitCommonDir?: string | null; exists?: (p: string) => boolean }): string | null;
  readManifest(root: string | null, o: { setNames: string[] }): { sets: Record<string, string[]>; music: Record<string, unknown> } | null;
  applySetOverrides(sets: unknown[][], m: unknown): { sets: unknown[][]; replaced: string[] };
  musicPlan(m: unknown): Record<string, { source: string }>;
  isTrackedPath(out: string, root: string): boolean;
}
const api = async (): Promise<PrivateApi> => (await import(/* @vite-ignore */ pathToFileURL(join(ROOT, "tools/audio-private.mjs")).href)) as PrivateApi;

const tmp = mkdtempSync(join(tmpdir(), "rz-private-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("where the private folder is", () => {
  it("is found next to the main checkout through git's common dir, from a worktree too", async () => {
    const a = await api();
    const main = join(tmp, "Projects", "Rank Zero");
    const priv = join(tmp, "Projects", a.PRIVATE_DIR_NAME);
    mkdirSync(join(main, ".git"), { recursive: true });
    mkdirSync(priv, { recursive: true });
    expect(a.resolvePrivateRoot({ gitCommonDir: join(main, ".git") })).toBe(priv);
  });

  it("is none when the folder is missing, when --no-private is given, or when an explicit folder does not exist", async () => {
    const a = await api();
    expect(a.resolvePrivateRoot({ gitCommonDir: join(tmp, "nowhere", "repo", ".git") })).toBeNull();
    expect(a.resolvePrivateRoot({ argv: ["--no-private"], env: { RANKZERO_PRIVATE_AUDIO: tmp } })).toBeNull();
    expect(a.resolvePrivateRoot({ argv: ["--private", join(tmp, "missing")], env: { RANKZERO_PRIVATE_AUDIO: tmp } })).toBeNull();
    expect(a.resolvePrivateRoot({ env: { RANKZERO_PRIVATE_AUDIO: tmp } })).toBe(tmp);
  });
});

describe("the manifest and the fallback", () => {
  const sets = [["voice-goose", 520, -16, ["synth:goose-honk"]], ["hit-fist", 360, -12.5, ["hits37:a.flac"]]];

  it("no folder or no manifest: every set and every music slot keeps its CC0 source", async () => {
    const a = await api();
    expect(a.readManifest(null, { setNames: ["voice-goose"] })).toBeNull();
    expect(a.readManifest(tmp, { setNames: ["voice-goose"] })).toBeNull();
    const { sets: out, replaced } = a.applySetOverrides(sets, null);
    expect(out).toBe(sets);
    expect(replaced).toEqual([]);
    expect(Object.values(a.musicPlan(null)).every((p) => p.source === "synth")).toBe(true);
  });

  it("a manifest replaces only the slots it names, its files read from the private folder", async () => {
    const a = await api();
    const dir = join(tmp, "with-manifest");
    mkdirSync(join(dir, "Effects", "Goose"), { recursive: true });
    mkdirSync(join(dir, "Music", "Menu"), { recursive: true });
    writeFileSync(join(dir, "Effects", "Goose", "honk.wav"), "x");
    writeFileSync(join(dir, "Music", "Menu", "theme.wav"), "x");
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({
      sets: { "voice-goose": ["Effects/Goose/honk.wav@400", "Effects/Goose/honk.wav + qpunch:p.flac*0.3"] },
      music: { menu: { file: "Music/Menu/theme.wav", loopStartMs: 0, loopEndMs: 30000 } },
    }));
    const m = a.readManifest(dir, { setNames: ["voice-goose", "hit-fist"] });
    const { sets: out, replaced } = a.applySetOverrides(sets, m);
    expect(replaced).toEqual(["voice-goose"]);
    expect(out[0]![3]).toEqual(["private:Effects/Goose/honk.wav@400", "private:Effects/Goose/honk.wav + qpunch:p.flac*0.3"]);
    expect(out[0]!.slice(0, 3)).toEqual([sets[0]![0], sets[0]![1], sets[0]![2]]);   // length and loudness kept
    expect(out[1]).toBe(sets[1]);
    const plan = a.musicPlan(m);
    expect(plan.menu!.source).toBe("private");
    expect(plan["fight-calm"]!.source).toBe("synth");
  });

  it("a manifest naming a missing file or an unknown slot stops the build with the reason", async () => {
    const a = await api();
    const dir = join(tmp, "bad-manifest");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({ sets: { "voice-yeti": ["x.wav"] }, music: { menu: { file: "gone.wav", loopStartMs: 5, loopEndMs: 1 } } }));
    expect(() => a.readManifest(dir, { setNames: ["voice-goose"] })).toThrow(/voice-yeti: no such sound set[\s\S]*no file gone\.wav[\s\S]*loopStartMs < loopEndMs/);
  });

  it("never writes private audio into a tracked path: only dist/ (ignored) or outside the repo", async () => {
    const a = await api();
    expect(a.isTrackedPath(join(ROOT, "apps/web/public/audio"), ROOT)).toBe(true);
    expect(a.isTrackedPath(join(ROOT, "tools"), ROOT)).toBe(true);
    expect(a.isTrackedPath(join(ROOT, "apps/web/dist/audio"), ROOT)).toBe(false);
    expect(a.isTrackedPath(join(tmp, "out"), ROOT)).toBe(false);
    const ignore = readFileSync(join(ROOT, ".gitignore"), "utf8");
    expect(ignore).toMatch(/^dist\/$/m);
  });
});

describe("the shipped audio in the public repo", () => {
  it("holds no Envato Elements item (they live in the private folder)", () => {
    const sfx = JSON.parse(readFileSync(join(PUB, "sfx.json"), "utf8")) as { credits: { licence: string }[]; sources: { files: string[] }[] };
    expect(sfx.credits.some((c) => /envato/i.test(c.licence))).toBe(false);
    expect(sfx.sources.flatMap((s) => s.files).some((f) => f.startsWith("private:") || /goose:|raccoon:/.test(f))).toBe(false);
    const music = JSON.parse(readFileSync(join(PUB, "music.json"), "utf8")) as { credits: { licence: string }[] };
    expect(music.credits.every((c) => c.licence === "CC0 1.0")).toBe(true);
  });

  it("music.json names every loop and sting, each file present and within its cap; the fight layers share one period", () => {
    const m = JSON.parse(readFileSync(join(PUB, "music.json"), "utf8")) as {
      version: number; tracks: Record<string, { file: string; loopStart: number; loopEnd: number }>; stings: Record<string, { file: string; start: number; dur: number }>;
    };
    expect(m.version).toBe(1);
    expect(Object.keys(m.tracks).sort()).toEqual(["fight-calm", "fight-intense", "menu"]);
    expect(Object.keys(m.stings).sort()).toEqual(["ko", "level-up", "lose", "win"]);
    for (const t of Object.values(m.tracks)) {
      expect(existsSync(join(PUB, t.file)), t.file).toBe(true);
      expect(statSync(join(PUB, t.file)).size, t.file).toBeLessThanOrEqual(1024 * 1024);
      expect(t.loopEnd - t.loopStart, t.file).toBeGreaterThan(4);
      expect(t.loopStart, t.file).toBeGreaterThan(0.3);                  // the pad before the seam
    }
    for (const s of Object.values(m.stings)) expect(statSync(join(PUB, s.file)).size, s.file).toBeLessThanOrEqual(160 * 1024);
    const calm = m.tracks["fight-calm"]!;
    const intense = m.tracks["fight-intense"]!;
    expect(intense.loopEnd - intense.loopStart).toBeCloseTo(calm.loopEnd - calm.loopStart, 3);
  });
});
