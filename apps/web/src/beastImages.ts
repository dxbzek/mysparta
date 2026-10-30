/**
 * The eight beasts as generated art.
 *
 * Drawn in ComfyUI (local SDXL) from one approved reference — the wolf — with
 * img2img at 0.85 denoise, so the whole set shares one line weight and one
 * degree of flatness. Prompt-only generation could not hold that: the first
 * pass produced eight animals that each looked like a different artist.
 *
 * Each file is cut from its background by flood-fill, squared on the subject
 * and written at 256px (scripts in the session scratchpad: comfy.py,
 * img2img.py, cutout.py). They replace the hand-drawn vector beasts in
 * beastArt.tsx, which stay in the file as the fallback.
 */
const FILES = import.meta.glob("./assets/beasts/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const BY_ID: Record<string, string> = {};
for (const [path, url] of Object.entries(FILES)) {
  const id = path.split("/").pop()!.replace(/\.png$/, "");
  BY_ID[id] = url;
}

export function beastImage(id: string): string | undefined {
  return BY_ID[id];
}

export function hasBeastImage(id: string): boolean {
  return id in BY_ID;
}
