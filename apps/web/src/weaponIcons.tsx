/**
 * One tile per weapon, drawn by people who draw weapons for a living.
 *
 * This used to be 500 lines of my own 16x16 pixel grids — one per weapon, so
 * at least the Spear and the Trident were different objects, but at icon size
 * they read as coloured smudges and none of them looked like they came from
 * the same world as the LPC fighters. They are now 32px CC0 tiles from
 * Dungeon Crawl Stone Soup; see docs/CREDITS.md and src/tileArt.ts.
 */
import { weaponTile } from "./tileArt.js";

export type Discipline = "xiphos" | "doru" | "cestus" | "labrys" | "akontia" | "aspis";

/** `d` takes a weapon id first, then a discipline. Size should be a whole
 *  multiple of 32 — the tiles are 32px and anything else is mush. */
export function WeaponIcon({
  d,
  size = 32,
  className,
}: {
  d: Discipline | "fists" | string;
  size?: number;
  className?: string;
}) {
  const src = weaponTile(d);
  return (
    <img
      className={`weapon-icon tile-art ${className ?? ""}`}
      src={src}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
    />
  );
}
