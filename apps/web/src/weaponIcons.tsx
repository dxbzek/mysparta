/**
 * One drawn weapon per weapon.
 *
 * Three sets have stood here. Mine at 16x16, which read as coloured smudges.
 * Then CC0 roguelike tiles, which are real art but a pixel idiom — and the
 * look Zek asked for is the flat, heavy-outlined cartoon arsenal. These are
 * that: vector, drawn from a shared parts vocabulary so twenty-five weapons
 * read as one hand, in `cartoonArt.tsx`.
 *
 * The 32px tiles stay as the fallback for any id the cartoon set has not been
 * drawn for yet, so a new weapon is never a blank square.
 */
import { CARTOON_WEAPON } from "./cartoonArt.js";
import { weaponTile } from "./tileArt.js";

export type Discipline = "xiphos" | "doru" | "cestus" | "labrys" | "akontia" | "aspis";

/** `d` takes a weapon id first, then a discipline. */
export function WeaponIcon({
  d,
  size = 32,
  className,
}: {
  d: Discipline | "fists" | string;
  size?: number;
  className?: string;
}) {
  const draw = CARTOON_WEAPON[d];
  if (draw) {
    return (
      <svg
        className={`weapon-icon cartoon-art ${className ?? ""}`}
        viewBox="0 0 32 32"
        width={size}
        height={size}
        aria-hidden
        focusable="false"
      >
        {draw()}
      </svg>
    );
  }
  return (
    <img
      className={`weapon-icon tile-art ${className ?? ""}`}
      src={weaponTile(d)}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
    />
  );
}
