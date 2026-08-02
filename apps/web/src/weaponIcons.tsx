/**
 * Weapon icons, in the same pixel hand as the rest of the interface.
 * One glyph per discipline — a blade, a shaft, an axe head, a fist, a shield.
 */

import { PixIcon, type IconName } from "./pixelIcons.js";

export type Discipline = "xiphos" | "doru" | "cestus" | "labrys" | "akontia" | "aspis";

const BY_DISCIPLINE: Record<string, IconName> = {
  xiphos: "wpnSword",
  doru: "wpnSpear",
  labrys: "wpnAxe",
  cestus: "wpnFist",
  aspis: "wpnShield",
  akontia: "wpnJavelin",
  fists: "wpnFist",
};

export function WeaponIcon({
  d,
  size = 14,
  className,
}: {
  d: Discipline | "fists" | string;
  size?: number;
  className?: string;
}) {
  return <PixIcon name={BY_DISCIPLINE[d] ?? "wpnSword"} size={size} className={className} />;
}
