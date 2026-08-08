/**
 * Weapons drawn the way the reference draws them: flat colour, one heavy dark
 * outline, one highlight, nothing rendered or shaded.
 *
 * Why not the CC0 tiles: those are 32px roguelike pixel art. They are honest
 * art and they scale crisply, but they are a different idiom from the look
 * Zek asked for — the arsenal-on-a-plank, thick-outline cartoon. Why not the
 * reference sheet itself: it is Motion Twin's, and copying it is not on the
 * table at any price.
 *
 * So: a vocabulary, not 25 bespoke blobs. Every weapon is a composition of
 * shared parts (haft, blade, head, guard, binding) over a shared palette, so
 * the set reads as one hand. A pike is a spear with a longer haft and a
 * needle; a trident is a spear with three prongs. That keeps each weapon its
 * own silhouette — the thing the old icons got right and must not lose —
 * without 25 unrelated drawings.
 *
 * Everything is authored in a 32x32 box, y increasing downward, and drawn with
 * `vector-effect: non-scaling-stroke` off: the outline scales with the art, so
 * a 64px icon has a 64px-appropriate outline.
 */

import type React from "react";

/** The whole set uses one outline colour. That is most of what "one hand" is. */
const INK = "#241c14";

interface Metal {
  /** the flat body */
  fill: string;
  /** the single lighter face, always upper-left */
  lit: string;
}

const STEEL: Metal = { fill: "#c9d2d8", lit: "#eef3f6" };
const BRONZE: Metal = { fill: "#c98b3c", lit: "#f0c070" };
const IRON: Metal = { fill: "#8e9aa3", lit: "#c2ccd3" };
const STONE: Metal = { fill: "#9c9384", lit: "#c9c2b3" };

const WOOD = "#9a6534";
const WOOD_DARK = "#6f4622";
const LEATHER = "#8a5a33";
const CLOTH = "#c25b3f";

/** Shared stroke settings: one weight, round joins, no scaling tricks. */
const S = {
  stroke: INK,
  strokeWidth: 2.2,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
};

/* ------------------------------------------------------------------ */
/* Parts                                                               */
/* ------------------------------------------------------------------ */

/** A shaft running up the icon. `from`/`to` are y, `x` its centre. */
function Haft({ x = 16, from = 30, to = 12, w = 3.4, colour = WOOD }) {
  return (
    <>
      <line x1={x} y1={from} x2={x} y2={to} {...S} strokeWidth={w + 2.2} />
      <line x1={x} y1={from} x2={x} y2={to} stroke={colour} strokeWidth={w} strokeLinecap="round" />
      {/* the lit edge of a round shaft is a thin line down one side */}
      <line x1={x - w / 3} y1={from - 1} x2={x - w / 3} y2={to + 1} stroke={WOOD_DARK} strokeWidth={w / 3} strokeLinecap="round" opacity={0.55} />
    </>
  );
}

/** A leaf blade — the sword/spear/dagger family, sized by `len` and `wide`. */
function Blade({ x = 16, tip = 2, base = 16, wide = 5, m = STEEL, curve = 0 }) {
  const half = wide / 2;
  const mid = (tip + base) / 2;
  const d =
    curve === 0
      ? `M${x} ${tip} L${x + half} ${mid} L${x + half * 0.8} ${base} L${x - half * 0.8} ${base} L${x - half} ${mid} Z`
      : // a forward curve: the outer edge bows, the inner stays straight
        `M${x} ${tip} Q${x + half + curve} ${mid} ${x + half * 0.7} ${base} L${x - half * 0.7} ${base} Q${x - half * 0.3} ${mid} ${x} ${tip} Z`;
  return (
    <>
      <path d={d} fill={m.fill} {...S} />
      {/* one highlight, always the upper-left facet */}
      <path d={`M${x} ${tip + 1.4} L${x - half * 0.55} ${mid} L${x - half * 0.45} ${base - 1.4} L${x - 0.6} ${base - 1.4} Z`} fill={m.lit} />
    </>
  );
}

/** A crossguard. */
function Guard({ x = 16, y = 16, w = 12, h = 2.6, m = BRONZE }) {
  return <rect x={x - w / 2} y={y} width={w} height={h} rx={1.2} fill={m.fill} {...S} />;
}

/** A grip with its binding rings. */
function Grip({ x = 16, from = 28, to = 19, colour = LEATHER }) {
  return (
    <>
      <line x1={x} y1={from} x2={x} y2={to} {...S} strokeWidth={5.4} />
      <line x1={x} y1={from} x2={x} y2={to} stroke={colour} strokeWidth={3.2} strokeLinecap="round" />
      {[0.25, 0.55, 0.85].map((t) => (
        <line
          key={t}
          x1={x - 1.9}
          y1={to + (from - to) * t}
          x2={x + 1.9}
          y2={to + (from - to) * t}
          stroke={INK}
          strokeWidth={1}
          opacity={0.7}
        />
      ))}
    </>
  );
}

function Pommel({ x = 16, y = 29, r = 2.4, m = BRONZE }) {
  return <circle cx={x} cy={y} r={r} fill={m.fill} {...S} />;
}

/** An axe bit: a crescent hanging off one side of the haft. */
function AxeHead({ x = 16, y = 10, size = 9, m = STEEL, mirror = false }) {
  const s = mirror ? -1 : 1;
  return (
    <>
      <path
        d={`M${x} ${y - size * 0.62} Q${x + s * size} ${y - size * 0.5} ${x + s * size * 0.92} ${y + size * 0.28} Q${x + s * size * 0.4} ${y + size * 0.62} ${x} ${y + size * 0.5} Z`}
        fill={m.fill}
        {...S}
      />
      <path
        d={`M${x + s * 1.5} ${y - size * 0.4} Q${x + s * size * 0.72} ${y - size * 0.26} ${x + s * size * 0.66} ${y + size * 0.1} Q${x + s * size * 0.3} ${y + size * 0.28} ${x + s * 1.5} ${y + size * 0.24} Z`}
        fill={m.lit}
      />
    </>
  );
}

/** A blunt head: mace, maul, club knob. */
function Knob({ x = 16, y = 9, r = 6, m = IRON, spikes = 0 }) {
  return (
    <>
      {spikes > 0 &&
        Array.from({ length: spikes }, (_, i) => {
          const a = (Math.PI * 2 * i) / spikes - Math.PI / 2;
          return (
            <line
              key={i}
              x1={x + Math.cos(a) * (r - 1)}
              y1={y + Math.sin(a) * (r - 1)}
              x2={x + Math.cos(a) * (r + 3.4)}
              y2={y + Math.sin(a) * (r + 3.4)}
              {...S}
              strokeWidth={3}
            />
          );
        })}
      <circle cx={x} cy={y} r={r} fill={m.fill} {...S} />
      <circle cx={x - r * 0.3} cy={y - r * 0.32} r={r * 0.42} fill={m.lit} />
    </>
  );
}

/** A shield body. `shape` decides the silhouette. */
function ShieldBody({ shape, m = BRONZE }: { shape: "round" | "crescent" | "tower" | "spiked"; m?: Metal }) {
  const face =
    shape === "tower"
      ? "M9 3 H23 Q25 3 25 5 V23 Q16 30 7 23 V5 Q7 3 9 3 Z"
      : shape === "crescent"
        ? "M16 3 Q27 9 25 18 Q22 27 16 29 Q10 27 7 18 Q5 9 16 3 Z"
        : "M16 2.5 A13.5 13.5 0 1 1 15.9 2.5 Z";
  return (
    <>
      {shape === "spiked" &&
        Array.from({ length: 8 }, (_, i) => {
          const a = (Math.PI * 2 * i) / 8;
          return (
            <line
              key={i}
              x1={16 + Math.cos(a) * 11}
              y1={16 + Math.sin(a) * 11}
              x2={16 + Math.cos(a) * 15.2}
              y2={16 + Math.sin(a) * 15.2}
              {...S}
              strokeWidth={2.8}
            />
          );
        })}
      <path d={face} fill={m.fill} {...S} />
      <path d={face} fill={m.lit} opacity={0.35} transform="translate(-1.6 -1.6) scale(0.86) translate(2.6 2.6)" />
      <circle cx={16} cy={16} r={3.6} fill={m.lit} {...S} strokeWidth={1.8} />
    </>
  );
}

/** A fist wrap: knuckles plus binding. */
function Fist({ studs = 0, m = LEATHER, plate = false }: { studs?: number; m?: string; plate?: boolean }) {
  return (
    <>
      <path d="M8 13 Q8 8 13 8 H21 Q25 8 25 13 V20 Q25 25 20 25 H13 Q8 25 8 20 Z" fill={m} {...S} />
      <path d="M10.5 12.5 Q10.5 10 13 10 H18 V14 H10.5 Z" fill="#ffffff" opacity={0.22} />
      {plate && <rect x={9.5} y={11} width={13} height={5.4} rx={1.6} fill={IRON.fill} {...S} strokeWidth={1.8} />}
      {[0, 1, 2].map((i) => (
        <line key={i} x1={11 + i * 3.6} y1={19} x2={11 + i * 3.6} y2={24} stroke={INK} strokeWidth={1.4} opacity={0.6} />
      ))}
      {studs > 0 &&
        Array.from({ length: studs }, (_, i) => (
          <circle key={i} cx={11.5 + i * 3.4} cy={13.5} r={1.7} fill={IRON.lit} {...S} strokeWidth={1.4} />
        ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The arsenal                                                         */
/* ------------------------------------------------------------------ */

/**
 * One entry per weapon id. Each is its own silhouette — the Spear, the Pike,
 * the Trident and the Boar Spear are four different objects, which is the one
 * thing the icons before these got right and this set must not lose.
 */
export const CARTOON_WEAPON: Record<string, () => React.ReactElement> = {
  /* --- fists: what is on the hand --- */
  fists: () => <Fist />,
  cestus: () => <Fist m={CLOTH} />,
  iron_cestus: () => <Fist m={LEATHER} plate />,
  sphairai: () => <Fist m={LEATHER} studs={3} />,
  himantes: () => (
    <>
      <Fist m="#b8895c" />
      {/* straps trailing off the wrist */}
      <path d="M9 24 Q6 27 7 30" {...S} fill="none" strokeWidth={2.4} />
      <path d="M9 24 Q6 27 7 30" stroke={CLOTH} strokeWidth={1.4} fill="none" />
    </>
  ),

  /* --- blades --- */
  xiphos: () => (
    <>
      <Blade tip={2} base={17} wide={6} m={BRONZE} />
      <Guard y={17} w={13} />
      <Grip from={28} to={20} />
      <Pommel />
    </>
  ),
  kopis: () => (
    <>
      <Blade tip={3} base={17} wide={7} m={STEEL} curve={4.5} />
      <Guard y={17} w={11} m={IRON} />
      <Grip from={28} to={20} />
      <Pommel m={IRON} />
    </>
  ),
  makhaira: () => (
    <>
      <Blade tip={2} base={18} wide={5} m={STEEL} curve={2.4} />
      <path d="M11 18 Q16 15 21 18 L21 20 Q16 17.5 11 20 Z" fill={BRONZE.fill} {...S} strokeWidth={1.8} />
      <Grip from={28} to={21} />
      <Pommel y={29} r={2.2} />
    </>
  ),
  twin_xiphoi: () => (
    <>
      <g transform="rotate(-16 16 16)">
        <Blade x={11} tip={4} base={17} wide={4.6} m={BRONZE} />
        <Guard x={11} y={17} w={9} h={2.2} />
        <Grip x={11} from={26} to={19} />
      </g>
      <g transform="rotate(16 16 16)">
        <Blade x={21} tip={4} base={17} wide={4.6} m={STEEL} />
        <Guard x={21} y={17} w={9} h={2.2} />
        <Grip x={21} from={26} to={19} />
      </g>
    </>
  ),

  /* --- spears: same family, four silhouettes --- */
  doru: () => (
    <>
      <Haft from={30} to={12} />
      <Blade tip={2} base={13} wide={6} m={BRONZE} />
    </>
  ),
  sarissa: () => (
    <>
      {/* a pike: the haft never ends and the head is a needle */}
      <Haft from={31} to={8} w={2.8} />
      <Blade tip={1.5} base={9} wide={3.6} m={IRON} />
      <line x1={12} y1={17} x2={20} y2={17} {...S} strokeWidth={2.4} />
    </>
  ),
  trident: () => (
    <>
      <Haft from={30} to={13} />
      <path d="M9 12 V4 M16 11 V2 M23 12 V4" {...S} strokeWidth={3.4} />
      <path d="M9 12 V4 M16 11 V2 M23 12 V4" stroke={STEEL.fill} strokeWidth={1.8} strokeLinecap="round" />
      <rect x={7.5} y={11} width={17} height={3} rx={1.2} fill={STEEL.fill} {...S} />
    </>
  ),
  boar_spear: () => (
    <>
      <Haft from={30} to={12} />
      <Blade tip={2} base={12} wide={6.4} m={STEEL} />
      {/* the crossbar that stops a charging animal running up the shaft */}
      <path d="M9 15 Q16 12.5 23 15" {...S} fill="none" strokeWidth={3} />
      <path d="M9 15 Q16 12.5 23 15" stroke={IRON.fill} fill="none" strokeWidth={1.6} />
    </>
  ),

  /* --- axes and blunt --- */
  labrys: () => (
    <>
      <Haft from={30} to={6} w={3} />
      <AxeHead x={16} y={11} size={8.5} m={STEEL} />
      <AxeHead x={16} y={11} size={8.5} m={STEEL} mirror />
    </>
  ),
  minoan_crusher: () => (
    <>
      <Haft from={30} to={12} w={4} colour={WOOD_DARK} />
      <Knob x={16} y={10} r={7.5} m={STONE} />
    </>
  ),
  bipennis: () => (
    <>
      <Haft from={30} to={8} w={2.8} />
      <AxeHead x={16} y={12} size={7} m={BRONZE} />
      <AxeHead x={16} y={12} size={7} m={BRONZE} mirror />
      <circle cx={16} cy={5} r={2} fill={BRONZE.fill} {...S} strokeWidth={1.8} />
    </>
  ),
  olive_root_club: () => (
    <>
      <path d="M20 30 Q17 22 15 15" {...S} strokeWidth={6} />
      <path d="M20 30 Q17 22 15 15" stroke={WOOD} strokeWidth={4} fill="none" strokeLinecap="round" />
      <path d="M15 15 Q9 10 12 5 Q17 2 22 6 Q25 11 20 15 Z" fill={WOOD_DARK} {...S} />
      <path d="M14.5 12 Q12 8.5 14 6 Q17 5 18.5 7" fill="none" stroke="#c08a4e" strokeWidth={1.8} />
    </>
  ),

  /* --- thrown --- */
  akontion: () => (
    <g transform="rotate(24 16 16)">
      <Haft from={29} to={9} w={2.6} />
      <Blade tip={3} base={10} wide={4.2} m={BRONZE} />
      {/* the throwing loop */}
      <circle cx={16} cy={20} r={2.6} fill="none" stroke={CLOTH} strokeWidth={2} />
    </g>
  ),
  kestros: () => (
    <>
      {/* a sling: the pouch and its two cords */}
      <path d="M8 6 Q12 17 16 20 Q20 17 24 6" fill="none" {...S} strokeWidth={2.6} />
      <path d="M8 6 Q12 17 16 20 Q20 17 24 6" fill="none" stroke={LEATHER} strokeWidth={1.4} />
      <path d="M11 18 Q16 15 21 18 Q16 25 11 18 Z" fill={LEATHER} {...S} />
      <circle cx={16} cy={20} r={2.6} fill={STONE.fill} {...S} strokeWidth={1.8} />
    </>
  ),
  discus: () => (
    <>
      <ellipse cx={16} cy={16} rx={13} ry={8} fill={BRONZE.fill} {...S} />
      <ellipse cx={16} cy={16} rx={7} ry={4} fill={BRONZE.lit} />
      <ellipse cx={16} cy={16} rx={2.4} ry={1.4} fill={INK} opacity={0.5} />
    </>
  ),
  peltast_blades: () => (
    <>
      {[-1, 0, 1].map((i) => (
        <g key={i} transform={`rotate(${i * 26} 16 26)`}>
          <path d={`M16 5 L18.6 15 L16 18 L13.4 15 Z`} fill={STEEL.fill} {...S} strokeWidth={1.8} />
          <line x1={16} y1={18} x2={16} y2={23} {...S} strokeWidth={2.6} />
          <line x1={16} y1={18} x2={16} y2={23} stroke={LEATHER} strokeWidth={1.4} />
        </g>
      ))}
    </>
  ),

  /* --- shields --- */
  aspis: () => <ShieldBody shape="round" />,
  pelte: () => <ShieldBody shape="crescent" m={STEEL} />,
  tower_of_dikte: () => <ShieldBody shape="tower" m={IRON} />,
  spiked_aspis: () => <ShieldBody shape="spiked" m={BRONZE} />,
};
