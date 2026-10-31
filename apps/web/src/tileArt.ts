/**
 * Real game art for weapons, skills and pets.
 *
 * The hand-drawn 16x16 SVG grids that used to fill these slots were mine, not
 * the game's: at icon size they read as coloured blobs, and nothing about them
 * matched the LPC paper dolls standing three inches away. These are 32px tiles
 * from Dungeon Crawl Stone Soup (github.com/crawl/crawl, `rltiles/`), which is
 * CC0 and drawn at the same scale and in the same idiom as the fighters — see
 * docs/CREDITS.md.
 *
 * Every file is 32x32 (the fox is 34), so the only crisp display sizes are
 * whole multiples: 32, 64, 96. Callers pick from those.
 */

const FILES = import.meta.glob("./assets/icons/*/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function group(kind: "weapon" | "skill" | "beast"): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(FILES)) {
    const m = path.match(/\.\/assets\/icons\/([a-z]+)\/([a-z_0-9]+)\.png$/);
    if (m && m[1] === kind) out[m[2]!] = url;
  }
  return out;
}

export const WEAPON_TILE = group("weapon");
export const SKILL_TILE = group("skill");
export const BEAST_TILE = group("beast");

/** Weapons that dropped before a tile existed still have to draw something. */
export function weaponTile(id: string): string | undefined {
  return WEAPON_TILE[id] ?? WEAPON_TILE["fists"];
}
export function skillTile(id: string): string | undefined {
  return SKILL_TILE[id] ?? SKILL_TILE["pankration"];
}
export function beastTile(id: string): string | undefined {
  return BEAST_TILE[id] ?? BEAST_TILE["lykos"];
}
