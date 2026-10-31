/**
 * Gear drawn in the same hand as the arsenal (cartoonArt.tsx): flat colour,
 * one heavy outline, one highlight. Five silhouettes — one per slot — each
 * coloured by the piece itself, so a Crimson Plate and a Moss Tunic are the
 * same cuirass in two cloths, the way the weapons are one blade in four
 * metals.
 *
 * Why not the champion's bust wearing it: cloaks, trinkets and titles do not
 * change the head-and-shoulders crop at all, so the Worn strip was five
 * identical faces labelled ARMOR / HELM / CLOAK / TRINKET / TITLE.
 */
import type React from "react";
import { gearItem, type GearItem, type GearSlot, type ParticleKind } from "./gear.js";
import { CLOTH_COLORS, HELMS } from "./paperdoll.js";
import { AURAS } from "./fighters.js";

const INK = "#241c14";
const S = {
  stroke: INK,
  strokeWidth: 2.2,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
};

/** A lighter face of a flat colour, for the one highlight. */
function lit(hex: string, amt = 0.32): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(v + (255 - v) * amt);
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

const STEEL = "#c9d2d8";
const BRONZE = "#c98b3c";
const GOLD = "#dcb14b";
const LEAF = "#5f7a3c";

/* ------------------------------------------------------------------ */

/** Cuirass: shoulders, waist, a belt. Plate torsos are steel with a seam. */
function Body({ colour, plate }: { colour: string; plate: boolean }) {
  const fill = plate ? STEEL : colour;
  return (
    <>
      <path d="M8 7 L13 5 L16 8 L19 5 L24 7 L27 13 L23 15 L23 27 L9 27 L9 15 L5 13 Z" fill={fill} {...S} />
      <path d="M9.6 8.6 L13 7 L12 14 L10 14 Z" fill={lit(fill)} />
      <rect x={9} y={22} width={14} height={3} fill={plate ? BRONZE : "#7d5330"} {...S} strokeWidth={1.6} />
      {plate && <line x1={16} y1={9} x2={16} y2={21} stroke={INK} strokeWidth={1.4} opacity={0.6} />}
    </>
  );
}

/** Helmet: one dome, five crests. */
function Helm({ idx }: { idx: number }) {
  const name = HELMS[idx]?.name ?? "";
  const horned = /horn/i.test(name);
  const kettle = /kettle/i.test(name);
  return (
    <>
      {horned && (
        <>
          <path d="M8 13 Q3 8 6 3 Q9 8 10 12 Z" fill="#e8ddc6" {...S} />
          <path d="M24 13 Q29 8 26 3 Q23 8 22 12 Z" fill="#e8ddc6" {...S} />
        </>
      )}
      {kettle ? (
        <>
          <path d="M9 9 Q16 2 23 9 L23 15 L9 15 Z" fill={STEEL} {...S} />
          <path d="M4 15 L28 15 L26 19 L6 19 Z" fill={STEEL} {...S} />
        </>
      ) : (
        <path d="M8 16 Q8 5 16 5 Q24 5 24 16 L24 24 L20 24 L20 17 L12 17 L12 24 L8 24 Z" fill={STEEL} {...S} />
      )}
      <path d="M10.4 14 Q10.8 8 15 6.6 L14 10 L12 14 Z" fill={lit(STEEL)} />
      {/spangen/i.test(name) && <line x1={16} y1={6} x2={16} y2={16} stroke={BRONZE} strokeWidth={2} />}
      {/armet/i.test(name) && <rect x={11} y={17} width={10} height={6} fill={STEEL} {...S} />}
      {/barbute/i.test(name) && <path d="M13 16 L16 21 L19 16 Z" fill={INK} opacity={0.5} />}
    </>
  );
}

/** A mantle hanging from a clasp, with the aura it carries behind it. */
function Cloak({ colour, aura }: { colour: string; aura?: string }) {
  return (
    <>
      {aura && <ellipse cx={16} cy={18} rx={13} ry={11} fill={aura} opacity={0.35} />}
      <path d="M9 7 Q16 4 23 7 L27 27 L20 25 L16 28 L12 25 L5 27 Z" fill={colour} {...S} />
      <path d="M10.4 8.6 Q13 7 15 7 L13 24 L8 25 Z" fill={lit(colour)} />
      <circle cx={16} cy={7.5} r={2.6} fill={GOLD} {...S} strokeWidth={1.6} />
    </>
  );
}

const CHARM: Record<ParticleKind, { gem: string; glow: string }> = {
  embers: { gem: "#e8865f", glow: "#f4c94e" },
  petals: { gem: "#f47c8e", glow: "#ffd6de" },
  snow: { gem: "#bfe3f5", glow: "#ffffff" },
  fireflies: { gem: "#c9e26b", glow: "#f6f19a" },
  storm: { gem: "#7b8cff", glow: "#c9d0ff" },
};

/** An amulet on a cord; the stone is the particle it summons. */
function Trinket({ kind }: { kind?: ParticleKind }) {
  const c = CHARM[kind ?? "embers"];
  return (
    <>
      <path d="M8 4 Q16 14 24 4" fill="none" {...S} strokeWidth={2} />
      <circle cx={16} cy={10.5} r={2.2} fill={GOLD} {...S} strokeWidth={1.6} />
      <path d="M16 13 L23 20 L16 29 L9 20 Z" fill={c.gem} {...S} />
      <path d="M16 15 L12 20 L16 22 Z" fill={c.glow} />
    </>
  );
}

/** A laurel: a title is worn in the memory of the crowd. */
function Title() {
  const leaves: Array<[number, number, number]> = [
    [7, 12, -70], [8, 17, -50], [11, 22, -25], [15, 25, 0],
    [25, 12, 70], [24, 17, 50], [21, 22, 25],
  ];
  return (
    <>
      <path d="M6 12 Q6 26 16 27 Q26 26 26 12" fill="none" {...S} strokeWidth={2.4} />
      {leaves.map(([x, y, r]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={3.4} ry={1.9} transform={`rotate(${r} ${x} ${y})`} fill={LEAF} {...S} strokeWidth={1.4} />
      ))}
      <circle cx={16} cy={8} r={3} fill={GOLD} {...S} strokeWidth={1.6} />
    </>
  );
}

/* ------------------------------------------------------------------ */

export function drawGear(g: GearItem): React.ReactElement {
  switch (g.slot) {
    case "body":
      return <Body colour={CLOTH_COLORS[g.torsoColor ?? 0]?.css ?? "#918f99"} plate={(g.torso ?? 0) > 0 && (g.torso ?? 0) <= 2} />;
    case "helm":
      return <Helm idx={g.helm ?? 0} />;
    case "cloak":
      return <Cloak colour={CLOTH_COLORS[g.capeColor ?? 0]?.css ?? "#918f99"} aura={g.aura != null ? AURAS[g.aura]?.color : undefined} />;
    case "trinket":
      return <Trinket kind={g.particles} />;
    case "title":
      return <Title />;
  }
}

const EMPTY: Record<GearSlot, GearItem> = {
  body: { id: "", name: "", slot: "body", flavour: "", stats: {}, torso: 5, torsoColor: 1 },
  helm: { id: "", name: "", slot: "helm", flavour: "", stats: {}, helm: 0 },
  cloak: { id: "", name: "", slot: "cloak", flavour: "", stats: {}, capeColor: 1 },
  trinket: { id: "", name: "", slot: "trinket", flavour: "", stats: {}, particles: "snow" },
  title: { id: "", name: "", slot: "title", flavour: "", stats: {} },
};

/** The piece by id, or the slot's silhouette ghosted when nothing is worn. */
export function GearIcon({
  id,
  slot,
  size = 32,
  className = "",
}: {
  id?: string;
  slot: GearSlot;
  size?: number;
  className?: string;
}) {
  const g = id ? gearItem(id) : undefined;
  return (
    <svg
      className={`gear-icon cartoon-art ${className}`.trim()}
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
    >
      {g ? drawGear(g) : <g opacity={0.3}>{drawGear(EMPTY[slot])}</g>}
    </svg>
  );
}
