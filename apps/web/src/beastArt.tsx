/**
 * The eight beasts, drawn in the arsenal's hand (cartoonArt.tsx, gearArt.tsx):
 * flat colour, one 2.2px #241c14 outline, one highlight, no shading.
 *
 * They replace the CC0 Dungeon Crawl tiles, which were honest 32px roguelike
 * art but a different idiom from the weapons — muddy the moment they were
 * scaled past their native size, and unmistakably borrowed from another game.
 *
 * All eight face LEFT in their own box, matching the old tiles so every
 * mirror decision in FightTheatre keeps working. A shared vocabulary again —
 * Body, Head, Leg, Ear, Tail, Eye — so a Wolf and a Hound read as two animals
 * by one hand rather than two drawings.
 *
 * Authored in a 32x32 box, feet on y=29, so a beast stands on the same ground
 * line as its hunter.
 */
import type React from "react";

const INK = "#241c14";
const S = {
  stroke: INK,
  strokeWidth: 2.2,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
};
/** Interior lines — the ones that do not silhouette — stay thinner. */
const S2 = { ...S, strokeWidth: 1.5 };

function lit(hex: string, amt = 0.3): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(v + (255 - v) * amt);
  return `#${((ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).padStart(6, "0")}`;
}

/* ---------------- parts ---------------- */

/** A four-legged body: barrel, four legs, a chest highlight. */
function Quad({
  fill,
  y = 14,
  h = 8,
  x0 = 6,
  x1 = 26,
  legs = [9, 13, 20, 24],
  legLen = 7,
  legW = 3,
}: {
  fill: string;
  y?: number;
  h?: number;
  x0?: number;
  x1?: number;
  legs?: number[];
  legLen?: number;
  legW?: number;
}) {
  return (
    <>
      {legs.map((lx, i) => (
        <line
          key={lx}
          x1={lx}
          y1={y + h - 2}
          x2={lx + (i % 2 ? 0.8 : -0.8)}
          y2={y + h - 2 + legLen}
          {...S}
          strokeWidth={legW + 2.2}
        />
      ))}
      {legs.map((lx, i) => (
        <line
          key={`f${lx}`}
          x1={lx}
          y1={y + h - 2}
          x2={lx + (i % 2 ? 0.8 : -0.8)}
          y2={y + h - 2 + legLen}
          stroke={fill}
          strokeWidth={legW}
          strokeLinecap="round"
        />
      ))}
      <rect x={x0} y={y} width={x1 - x0} height={h} rx={h / 2} fill={fill} {...S} />
      <path d={`M${x0 + 2} ${y + 2.2} Q${(x0 + x1) / 2} ${y + 0.6} ${x1 - 3} ${y + 2.4}`} stroke={lit(fill)} strokeWidth={2} fill="none" strokeLinecap="round" />
    </>
  );
}

/** A muzzle-forward head on the LEFT of the box. */
function Head({
  fill,
  cx = 8,
  cy = 11,
  r = 5,
  snout = 4,
}: {
  fill: string;
  cx?: number;
  cy?: number;
  r?: number;
  snout?: number;
}) {
  return (
    <>
      <path
        d={`M${cx + r} ${cy} a${r} ${r} 0 1 0 -${r * 2} 0 a${r} ${r} 0 1 0 ${r * 2} 0 Z`}
        fill={fill}
        {...S}
      />
      {snout > 0 && (
        <path d={`M${cx - r + 1} ${cy - 1} L${cx - r - snout} ${cy + 1.4} L${cx - r + 1} ${cy + 3.4} Z`} fill={fill} {...S} />
      )}
      <circle cx={cx - r - snout + 0.6} cy={cy + 1.2} r={1.1} fill={INK} />
    </>
  );
}

function Ear({ x, y, fill, w = 3, h = 5, lean = 0 }: { x: number; y: number; fill: string; w?: number; h?: number; lean?: number }) {
  return <path d={`M${x} ${y} L${x + lean} ${y - h} L${x + w} ${y - 0.5} Z`} fill={fill} {...S} />;
}

function Eye({ x, y, r = 1.2, colour = INK }: { x: number; y: number; r?: number; colour?: string }) {
  return <circle cx={x} cy={y} r={r} fill={colour} />;
}

function Tail({ d, fill, w = 3.4 }: { d: string; fill: string; w?: number }) {
  return (
    <>
      <path d={d} {...S} strokeWidth={w + 2.2} fill="none" />
      <path d={d} stroke={fill} strokeWidth={w} fill="none" strokeLinecap="round" />
    </>
  );
}

/* ---------------- the eight ---------------- */

/** Wolf — ash grey, upright ears, brush tail, the pack animal. */
function Wolf() {
  const c = "#8d949c";
  return (
    <>
      <Tail d="M25 16 Q31 13 28 7" fill={c} w={4} />
      <Quad fill={c} />
      <Ear x={5} y={7.5} fill={c} lean={-1} />
      <Ear x={9.5} y={7} fill={c} lean={0.5} />
      <Head fill={c} />
      <Eye x={6.4} y={10.2} />
    </>
  );
}

/** Raven — the storm crow: long beak, swept wing, legs under it. */
function Raven() {
  const c = "#3f4450";
  return (
    <>
      {/* far wing, then body, then near wing: depth by overlap only */}
      <path d="M18 11 Q27 9 26 19 Q21 18 18 14 Z" fill="#2c303a" {...S} />
      {/* tail */}
      <path d="M22 17 L30 22 L21 21 Z" fill={c} {...S} />
      {/* legs, clear of the body */}
      <path d="M11 22 L10 27 M16 22 L16.6 27" {...S} strokeWidth={2.4} />
      <path d="M10 27 L7 28.4 M16.6 27 L14 28.4" {...S} strokeWidth={1.8} />
      {/* body: a leaning teardrop, head end to the LEFT */}
      <path d="M9 8 Q20 6 22 14 Q23 22 14 22 Q6 22 6 15 Q6 10 9 8 Z" fill={c} {...S} />
      <path d="M9.6 10.6 Q7.6 14 8.6 18" stroke={lit(c, 0.22)} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      {/* near wing, folded along the flank */}
      <path d="M12 11 Q21 11 20 18 Q15 19 12 15 Z" fill={lit(c, 0.12)} {...S} />
      {/* the beak: long, straight, unmistakable */}
      <path d="M7.6 10.6 L0.8 13 L7.8 14.6 Z" fill="#d8a63c" {...S} />
      <Eye x={9.6} y={10.6} r={1.6} colour="#f2e2c2" />
      <Eye x={9.4} y={10.6} r={0.8} />
    </>
  );
}

/** Boar — heavy shoulders, a low head and two tusks that read at 32px. */
function Boar() {
  const c = "#6f5a48";
  const dark = "#5a4839";
  return (
    <>
      <Tail d="M27 16 q3.4 1 2.6 3.6" fill={c} w={2} />
      <Quad fill={c} y={14} h={9} x0={9} x1={28} legs={[13, 16, 23, 26]} legLen={5} legW={3.4} />
      {/* the hump is the boar's silhouette; drawn dark so the head stays clear */}
      <path d="M14 14 Q19 5 27 14 Z" fill={dark} {...S} />
      <path d="M17 9.6 l0.8 -2.8 M20 7.4 l0.8 -2.8 M23 8.4 l1.2 -2.6" {...S2} />
      {/* head: a wedge, snout DOWN and forward, not a circle with a cone */}
      <path d="M14 11.6 Q7 11.6 4 17 Q4.6 20.6 9 20.4 Q14 20.4 15 16 Z" fill={c} {...S} />
      <Ear x={11.4} y={11.8} fill={dark} w={3} h={4} lean={-1} />
      {/* snout disc and nostril */}
      <ellipse cx={5.2} cy={17.6} rx={2.2} ry={1.8} fill={dark} {...S} strokeWidth={1.8} />
      <circle cx={4.8} cy={17.6} r={0.7} fill={INK} />
      {/* two tusks, ink-outlined ivory, sweeping up past the jaw */}
      <path d="M6.4 19 Q3.4 17.6 4.2 13.6" stroke={INK} strokeWidth={3.6} fill="none" strokeLinecap="round" />
      <path d="M6.4 19 Q3.4 17.6 4.2 13.6" stroke="#f4e9d2" strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M9.6 19.6 Q7.6 18.6 8 15.6" stroke={INK} strokeWidth={3.2} fill="none" strokeLinecap="round" />
      <path d="M9.6 19.6 Q7.6 18.6 8 15.6" stroke="#f4e9d2" strokeWidth={1.7} fill="none" strokeLinecap="round" />
      <Eye x={10} y={14} />
    </>
  );
}

/** Guard Dog — the shrine lion: mane AROUND the head, broad stance. */
function GuardDog() {
  const c = "#c98b3c";
  const mane = "#8f5a22";
  return (
    <>
      <Tail d="M26 16 q4 2 2 7" fill={mane} w={2.6} />
      <circle cx={28} cy={23.4} r={2.4} fill={mane} {...S} strokeWidth={1.8} />
      <Quad fill={c} y={15} h={8} x0={12} x1={28} legs={[15, 18, 24, 27]} legLen={6} legW={3.4} />
      {/*
        The mane is a ring of eight petals around the head's centre, not a
        shape stacked on top of it — the first attempt read as a hat.
      */}
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2;
        const mx = 11 + Math.cos(a) * 5.6;
        const my = 12 + Math.sin(a) * 5.6;
        return <circle key={i} cx={mx} cy={my} r={3.1} fill={mane} {...S} strokeWidth={1.8} />;
      })}
      <circle cx={11} cy={12} r={5} fill={mane} stroke="none" />
      <Head fill={c} cx={10.6} cy={12} r={4.2} snout={2.8} />
      <Eye x={9} y={11} />
      <Eye x={12.6} y={11} />
    </>
  );
}

/** Fox — ember-wreathed, small, quick, big tail. */
function Fox() {
  const c = "#d4703a";
  return (
    <>
      <Tail d="M24 17 Q31 15 28 8" fill={c} w={4.6} />
      <path d="M28.6 8.6 q1.6 -1.6 0.4 -3.2 q-1.8 1.4 -0.4 3.2 Z" fill="#f4e6c8" {...S} strokeWidth={1.5} />
      <Quad fill={c} y={16} h={7} x0={7} x1={25} legs={[10, 13, 20, 23]} legLen={5} legW={2.6} />
      <Ear x={5} y={9.5} fill={c} h={6} lean={-1.4} />
      <Ear x={9.6} y={9} fill={c} h={5.6} lean={0.8} />
      <Head fill={c} cx={9} cy={13} r={4.4} snout={3.6} />
      <Eye x={7.4} y={12.2} />
      {/* embers */}
      <circle cx={17} cy={7} r={1.2} fill="#f4c94e" />
      <circle cx={21.5} cy={4.6} r={0.9} fill="#e8865f" />
      <circle cx={13.4} cy={4.4} r={0.8} fill="#f4c94e" />
    </>
  );
}

/** Firebird — the dusk owl: round, perched, huge eyes, small talons. */
function Firebird() {
  const c = "#b45f36";
  return (
    <>
      <path d="M12 25 L12 28 M18 25 L18 28" {...S} strokeWidth={2.4} />
      <path d="M12 28 L9 29 M18 28 L15.4 29" {...S} strokeWidth={1.8} />
      {/* body */}
      <path d="M15 4 Q25 4 25 15 Q25 25 15 25 Q5 25 5 15 Q5 4 15 4 Z" fill={c} {...S} />
      <path d="M8.6 8.6 Q7 14 8.4 19" stroke={lit(c)} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      {/* ear tufts */}
      <path d="M7.6 6 L6 1.6 L11 4.4 Z" fill={c} {...S} />
      <path d="M22.4 6 L24 1.6 L19 4.4 Z" fill={c} {...S} />
      {/* face disc + eyes */}
      <circle cx={11.6} cy={11.6} r={4} fill="#f2e2c2" {...S} strokeWidth={1.6} />
      <circle cx={19.4} cy={11.6} r={4} fill="#f2e2c2" {...S} strokeWidth={1.6} />
      <Eye x={11.2} y={11.6} r={2} />
      <Eye x={19} y={11.6} r={2} />
      <path d="M15.4 13.6 L12.6 16 L15.4 18 Z" fill="#c9a13c" {...S} strokeWidth={1.4} />
      {/* breast feathering */}
      <path d="M11 20.6 q2 1.6 4 0 q2 1.6 4 0" {...S2} fill="none" />
    </>
  );
}

/** Hound — the demon whelp: three heads on three necks, one appetite. */
function Hound() {
  const c = "#54474f";
  const back = "#3d3239";
  const front = "#6b5964";
  return (
    <>
      <Tail d="M27 16 q4.6 2 1.6 6.6" fill={c} w={2.6} />
      <Quad fill={c} y={16} h={7.4} x0={12} x1={28} legs={[15, 18, 24, 27]} legLen={5} legW={3} />
      {/* Necks fan wide out of the shoulders: at 32px two heads touching read
          as one lump, so they are spread across the whole left half. */}
      {[
        { hx: 17.6, hy: 6.2, fill: back, r: 3.2, eye: 16.6 },
        { hx: 10.6, hy: 4.6, fill: c, r: 3.5, eye: 9.4 },
        { hx: 4.6, hy: 10.4, fill: front, r: 3.8, eye: 3.4 },
      ].map((h) => (
        <g key={h.hx}>
          <line x1={13.6} y1={17} x2={h.hx} y2={h.hy + 2} {...S} strokeWidth={5} />
          <line x1={13.6} y1={17} x2={h.hx} y2={h.hy + 2} stroke={h.fill} strokeWidth={3.2} strokeLinecap="round" />
          <Ear x={h.hx - 2.8} y={h.hy - 2.2} fill={h.fill} w={2.4} h={3.6} lean={-0.8} />
          <Ear x={h.hx + 0.6} y={h.hy - 2.6} fill={h.fill} w={2.2} h={3.2} lean={0.6} />
          <Head fill={h.fill} cx={h.hx} cy={h.hy} r={h.r} snout={2.6} />
          <Eye x={h.eye} y={h.hy - 0.6} r={1} colour="#e2695c" />
        </g>
      ))}
    </>
  );
}

/** Tortoise — stone shell, nothing gets through. */
function Tortoise() {
  const c = "#7f9a5c";
  const shell = "#9c9384";
  return (
    <>
      {/* legs and tail first */}
      <path d="M9 21 L7.4 26 M15 22 L14.4 27 M21 21 L22.6 26" {...S} strokeWidth={4.4} />
      <path d="M9 21 L7.4 26 M15 22 L14.4 27 M21 21 L22.6 26" stroke={c} strokeWidth={2.6} strokeLinecap="round" />
      <Tail d="M25 18 q3.4 1.4 3 4" fill={c} w={2} />
      {/* neck + head, low and forward */}
      <path d="M9 18 Q5 18 4 15" {...S} strokeWidth={5.4} />
      <path d="M9 18 Q5 18 4 15" stroke={c} strokeWidth={3.6} fill="none" strokeLinecap="round" />
      <Head fill={c} cx={5} cy={13.4} r={3.4} snout={2.2} />
      <Eye x={4} y={12.6} r={1} />
      {/* the shell: a dome and its plates */}
      <path d="M5.6 20 Q6 9 16 9 Q26 9 26.4 20 Z" fill={shell} {...S} />
      <path d="M8.4 13.6 Q11 10.6 15 10.6" stroke={lit(shell)} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <path d="M11 9.6 L10 20 M16 9 L16 20 M21 9.6 L22 20 M7 15.4 Q16 13.4 25 15.4" {...S2} fill="none" />
      <rect x={5.2} y={19.4} width={21.6} height={2.6} rx={1.3} fill={lit(shell, 0.12)} {...S} strokeWidth={1.8} />
    </>
  );
}

/* ---------------- registry ---------------- */

export const CARTOON_BEAST: Record<string, () => React.ReactElement> = {
  lykos: Wolf,
  stymphal_shrike: Raven,
  kalydon_boar: Boar,
  nemean_cub: GuardDog,
  ember_fox: Fox,
  bronze_owl: Firebird,
  kerberos_pup: Hound,
  marble_tortoise: Tortoise,
};

export function hasBeastArt(id: string): boolean {
  return id in CARTOON_BEAST;
}

export function drawBeast(id: string): React.ReactElement | undefined {
  return CARTOON_BEAST[id]?.();
}
