/**
 * All thirty skills, drawn in the arsenal's hand (cartoonArt.tsx, beastArt.tsx,
 * gearArt.tsx): flat colour, one 2.2px #241c14 outline, one highlight, no
 * shading, authored in a 32x32 box.
 *
 * Replaces the CC0 Dungeon Crawl tiles. Those were real art, but 32px
 * roguelike pixels beside hand-drawn vector weapons read as two games spliced
 * together — which is exactly the complaint.
 *
 * Each icon says what the skill DOES, not what its myth name is: Bronze Hide
 * is a scaled pauldron, Eagle Eye is an eye over a sight, Chiron's Mending is
 * a cup and a cross. A player scanning the Codex should be able to sort boons
 * from trumps by silhouette.
 */
import type React from "react";

const INK = "#241c14";
const S = {
  stroke: INK,
  strokeWidth: 2.2,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
};
const S2 = { ...S, strokeWidth: 1.5 };

/* The palette is the arsenal's, so a skill plaque and a weapon tile agree. */
const STEEL = "#c9d2d8";
const STEEL_LIT = "#eef3f6";
const BRONZE = "#c98b3c";
const BRONZE_LIT = "#f0c070";
const GOLD = "#dcb14b";
const WOOD = "#9a6534";
const LEATHER = "#8a5a33";
const BLOOD = "#b8394a";
const GREEN = "#5f9a4c";
const SKY = "#5fa8d3";
const VIOLET = "#8f6fc4";
const BONE = "#efe3c8";
const SHADOW = "#4a4450";
const FLAME = "#e8763f";

function lit(hex: string, amt = 0.32): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(v + (255 - v) * amt);
  return `#${((ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).padStart(6, "0")}`;
}

/* ---------------- shared parts ---------------- */

/** A round-top kite shield, the block/armour motif. */
function ShieldShape({ fill = STEEL, cx = 16, top = 5, w = 18, bottom = 28 }) {
  const h = w / 2;
  return (
    <>
      <path
        d={`M${cx - h} ${top + 3} Q${cx} ${top - 2} ${cx + h} ${top + 3} L${cx + h - 1} ${(top + bottom) / 2} Q${cx + h - 3} ${bottom - 3} ${cx} ${bottom} Q${cx - h + 3} ${bottom - 3} ${cx - h + 1} ${(top + bottom) / 2} Z`}
        fill={fill}
        {...S}
      />
      <path d={`M${cx - h + 2.6} ${top + 4.6} Q${cx - 2} ${top + 2.6} ${cx - 1} ${top + 3.4} L${cx - 3} ${bottom - 6} Z`} fill={lit(fill)} />
    </>
  );
}

/** A simple upright blade, used wherever "your weapon" is the subject. */
function BladeShape({ x = 16, tip = 3, base = 19, wide = 6, fill = STEEL }) {
  const h = wide / 2;
  const mid = (tip + base) / 2;
  return (
    <>
      <path d={`M${x} ${tip} L${x + h} ${mid} L${x + h * 0.8} ${base} L${x - h * 0.8} ${base} L${x - h} ${mid} Z`} fill={fill} {...S} />
      <path d={`M${x} ${tip + 1.4} L${x - h * 0.55} ${mid} L${x - h * 0.45} ${base - 1.4} L${x - 0.6} ${base - 1.4} Z`} fill={lit(fill)} />
    </>
  );
}

/** Hilt + grip under a blade at the same x. */
function HiltShape({ x = 16, y = 19, w = 13 }) {
  return (
    <>
      <rect x={x - w / 2} y={y} width={w} height={2.6} rx={1.2} fill={BRONZE} {...S} />
      <line x1={x} y1={y + 3} x2={x} y2={27} {...S} strokeWidth={5.2} />
      <line x1={x} y1={y + 3} x2={x} y2={27} stroke={LEATHER} strokeWidth={3.2} strokeLinecap="round" />
      <circle cx={x} cy={28.4} r={2} fill={BRONZE} {...S} strokeWidth={1.6} />
    </>
  );
}

/** A four-point sparkle — the "this is magical" mark on trumps. */
function Spark({ x, y, r = 3.4, fill = GOLD }: { x: number; y: number; r?: number; fill?: string }) {
  return (
    <path
      d={`M${x} ${y - r} Q${x + r * 0.28} ${y - r * 0.28} ${x + r} ${y} Q${x + r * 0.28} ${y + r * 0.28} ${x} ${y + r} Q${x - r * 0.28} ${y + r * 0.28} ${x - r} ${y} Q${x - r * 0.28} ${y - r * 0.28} ${x} ${y - r} Z`}
      fill={fill}
      stroke={INK}
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  );
}

/** Motion ticks — three short strokes for speed/haste. */
function Speedlines({ x = 4, y = 10, gap = 5, len = 6 }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <line key={i} x1={x} y1={y + i * gap} x2={x + len - i} y2={y + i * gap} {...S2} strokeWidth={2} />
      ))}
    </>
  );
}

/** An upward chevron: "more", used on the stat boons. */
function UpTick({ x = 24, y = 24, s = 5 }) {
  return (
    <path d={`M${x - s} ${y} L${x} ${y - s} L${x + s} ${y}`} fill="none" stroke={GREEN} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
  );
}

/* ================= BOONS — passive, always on ================= */

/** Bronze Hide (+4 Armour) — a scaled shoulder plate, worn on a shoulder. */
function BronzeHide() {
  return (
    <>
      {/* the shoulder it sits on, so it is a pauldron and not a stack */}
      <path d="M7 27 Q7 17 16 17 Q25 17 25 27 Z" fill="#7d5330" {...S} />
      {/* the plate: a dome with three overlapping scale courses */}
      <path d="M4 15 Q4 4 16 4 Q28 4 28 15 Q28 20 16 22 Q4 20 4 15 Z" fill={BRONZE} {...S} />
      <path d="M7 12.6 Q7.6 6.6 14 6" fill="none" stroke={BRONZE_LIT} strokeWidth={2.6} strokeLinecap="round" />
      <path d="M4.6 11.6 q3.8 3.4 7.6 0 q3.8 3.4 7.6 0 q3.8 3.4 7.6 0" {...S2} fill="none" />
      <path d="M5.4 16.6 q3.6 3.2 7.2 0 q3.6 3.2 7.2 0 q3.2 2.8 6.4 0" {...S2} fill="none" />
      <circle cx={16} cy={8.6} r={1.6} fill={BRONZE_LIT} {...S} strokeWidth={1.3} />
    </>
  );
}

/** Winged Heels (+10 Evasion) — a sandal with a wing. */
function WingedHeels() {
  return (
    <>
      <path d="M20 8 Q30 8 28 16 Q23 16 20 13 Z" fill={BONE} {...S} />
      <path d="M20 10.6 Q26 10.6 25.4 14" {...S2} fill="none" />
      <path d="M5 20 L18 20 Q22 20 22 23 L22 26 L7 26 Q4 26 4 23 Z" fill={LEATHER} {...S} />
      <path d="M6.4 21.6 L16 21.6" stroke={lit(LEATHER)} strokeWidth={2} strokeLinecap="round" />
      <line x1={9} y1={20} x2={12} y2={14} {...S2} strokeWidth={2.2} />
      <line x1={15} y1={20} x2={17} y2={14.6} {...S2} strokeWidth={2.2} />
    </>
  );
}

/** Eagle Eye (+10 Accuracy) — an eye inside a sight ring. */
function EagleEye() {
  return (
    <>
      <circle cx={16} cy={16} r={11} fill="none" {...S} strokeWidth={2.6} />
      <path d="M5 16 L1.6 16 M27 16 L30.4 16 M16 5 L16 1.6 M16 27 L16 30.4" {...S} strokeWidth={2.4} />
      <path d="M7 16 Q16 8 25 16 Q16 24 7 16 Z" fill={BONE} {...S} />
      <circle cx={16} cy={16} r={3.4} fill={SKY} {...S} strokeWidth={1.8} />
      <circle cx={16} cy={16} r={1.5} fill={INK} />
    </>
  );
}

/** Hoplite Drill (+Block) — shield braced behind a spear. */
function HopliteDrill() {
  return (
    <>
      <line x1={24} y1={4} x2={11} y2={29} {...S} strokeWidth={4.4} />
      <line x1={24} y1={4} x2={11} y2={29} stroke={WOOD} strokeWidth={2.6} strokeLinecap="round" />
      <path d="M26.4 1.6 L27.6 7.4 L22.4 5.6 Z" fill={STEEL} {...S} strokeWidth={1.8} />
      <ShieldShape cx={13} top={8} w={16} bottom={27} fill={BRONZE} />
      <circle cx={13} cy={17} r={2.6} fill={BRONZE_LIT} {...S} strokeWidth={1.6} />
    </>
  );
}

/**
 * Pankration (fists become a weapon) — a fist in PROFILE, punching right.
 * Knuckles-on failed twice: four domes on a block reads as a crown, and the
 * wrap bands read as a stack. In profile the thumb gives the shape an
 * asymmetry no barrel has, and the knuckle edge is a single silhouette.
 */
function Pankration() {
  const skin = "#c39058";
  return (
    <>
      <Speedlines x={1.4} y={11} gap={5} len={6} />
      {/* forearm running off the left edge */}
      <path d="M6 13.6 L14 13.6 L14 24 L6 24 Z" fill="#a3703f" {...S} />
      {/* the fist: taller than the arm, knuckle edge on the right */}
      <path d="M12 11.6 Q12 8 16.4 8 L21 8 Q27 8 27 14 L27 21 Q27 26 21.4 26 L16 26 Q12 26 12 22 Z" fill={skin} {...S} />
      <path d="M14.6 12.6 Q14.6 10.4 17 10.4 L20 10.4 L19 14.4 L15.4 14.4 Z" fill={lit(skin, 0.3)} />
      {/* the knuckle edge: three shallow scallops down the leading side */}
      <path d="M27 12.4 q-2.4 2.6 0 5.2 q-2.4 2.6 0 5.2" {...S2} fill="none" />
      {/* the thumb, laid over the fingers — the asymmetry that says fist */}
      <path d="M13.6 15.6 Q19 14.6 20.4 17.6 Q19 20.4 13.6 19.6 Z" fill={lit(skin, 0.12)} {...S} />
      {/* one binding strap across the wrist */}
      <path d="M8 17.6 L13.6 17.6 M8 21.6 L13.4 21.6" stroke={BONE} strokeWidth={3} strokeLinecap="round" />
      <path d="M8 17.6 L13.6 17.6 M8 21.6 L13.4 21.6" {...S2} strokeWidth={1} />
    </>
  );
}

/** Titan Grip (axe speed, no disarm) — a fist clamped on a haft. */
function TitanGrip() {
  return (
    <>
      <line x1={16} y1={2} x2={16} y2={30} {...S} strokeWidth={5.6} />
      <line x1={16} y1={2} x2={16} y2={30} stroke={WOOD} strokeWidth={3.4} strokeLinecap="round" />
      <path d="M16 4 Q26 3 27 10 Q21 12 16 10 Z" fill={STEEL} {...S} />
      <path d="M17.6 5.4 Q23 5 24.4 8.4" fill="none" stroke={STEEL_LIT} strokeWidth={2} strokeLinecap="round" />
      {/* the grip */}
      <rect x={8} y={15} width={16} height={11} rx={4} fill={BRONZE} {...S} />
      <path d="M9.6 17 Q9.6 16 12 16 L16 16 L15 19 L10 19 Z" fill={BRONZE_LIT} />
      <path d="M10 22.4 h12" {...S2} />
    </>
  );
}

/** Keen Edge (+6 Crit) — a blade with a struck spark on it. */
function KeenEdge() {
  return (
    <>
      <BladeShape x={14} tip={4} base={20} wide={7} />
      <HiltShape x={14} y={20} w={12} />
      <Spark x={24} y={9} r={4.4} fill={GOLD} />
      <Spark x={27} y={16} r={2.4} fill={BONE} />
    </>
  );
}

/** Serpent Reflex (+10 Counter) — a coiled snake striking. */
function SerpentReflex() {
  return (
    <>
      <path d="M7 28 Q3 22 9 19 Q17 16 12 11 Q8 7 14 4" fill="none" {...S} strokeWidth={6} />
      <path d="M7 28 Q3 22 9 19 Q17 16 12 11 Q8 7 14 4" fill="none" stroke={GREEN} strokeWidth={3.8} strokeLinecap="round" />
      {/* head */}
      <path d="M13 6.6 Q20 1.6 25 6 Q21 10.6 14 9 Z" fill={GREEN} {...S} />
      <circle cx={20} cy={5.6} r={1.1} fill={INK} />
      {/* forked tongue */}
      <path d="M25 6 L30 5 M28.4 5.4 L30.4 6.8" {...S2} strokeWidth={1.6} stroke={BLOOD} />
    </>
  );
}

/** Iron Wrists (disarm resistance) — a riveted bracer. */
function IronWrists() {
  return (
    <>
      <path d="M8 8 Q16 5 24 8 L26 22 Q16 27 6 22 Z" fill={STEEL} {...S} />
      <path d="M10 9.6 Q15 8 19 8.8 L18 13 L11 13.6 Z" fill={STEEL_LIT} />
      <path d="M7 14.6 Q16 18 25 14.6" {...S2} fill="none" />
      {([[10.6, 11], [21.4, 11], [10, 19.4], [22, 19.4]] as const).map(([x, y]) => (
        <circle key={`${x}`} cx={x} cy={y} r={1.4} fill={BRONZE} {...S} strokeWidth={1.2} />
      ))}
    </>
  );
}

/** Marathon Lungs (regen) — a heart with a pulse line. */
function MarathonLungs() {
  return (
    <>
      <path d="M16 27 Q3 18 3 11.6 Q3 5 9 5 Q13.6 5 16 9.4 Q18.4 5 23 5 Q29 5 29 11.6 Q29 18 16 27 Z" fill={BLOOD} {...S} />
      <path d="M7 9.4 Q6.6 6.6 9.6 7 Q12 7.4 12.4 10" fill="none" stroke={lit(BLOOD, 0.42)} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M4.6 15.4 L11 15.4 L13.4 11 L16.6 19.4 L19 15.4 L27 15.4" fill="none" stroke={BONE} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

/** Beast Bond (cheaper, tougher beasts) — a paw inside a heart-collar. */
function BeastBond() {
  return (
    <>
      <circle cx={16} cy={17} r={11} fill={LEATHER} {...S} />
      <circle cx={16} cy={17} r={7.6} fill="#f2e6d0" {...S} strokeWidth={1.8} />
      {/* the collar buckle */}
      <rect x={12.6} y={2.6} width={7} height={5} rx={1.6} fill={BRONZE} {...S} strokeWidth={1.8} />
      {/* paw */}
      <ellipse cx={16} cy={19.4} rx={4} ry={3.2} fill={LEATHER} {...S} strokeWidth={1.8} />
      {([[12.2, 14.6], [15, 13.2], [18.4, 13.6], [20.6, 15.8]] as const).map(([x, y]) => (
        <circle key={`${x}`} cx={x} cy={y} r={1.7} fill={LEATHER} {...S} strokeWidth={1.5} />
      ))}
    </>
  );
}

/** Endless Quiver (more ammo) — a quiver stuffed with javelins. */
function EndlessQuiver() {
  return (
    <>
      {/* shafts */}
      {([[10, 3.6], [16, 1.6], [22, 3.6]] as const).map(([x, ty]) => (
        <g key={x}>
          <line x1={x} y1={ty} x2={x} y2={18} {...S} strokeWidth={4} />
          <line x1={x} y1={ty} x2={x} y2={18} stroke={WOOD} strokeWidth={2.2} strokeLinecap="round" />
          <path d={`M${x} ${ty - 2.6} L${x + 2.2} ${ty + 2.4} L${x - 2.2} ${ty + 2.4} Z`} fill={STEEL} {...S} strokeWidth={1.6} />
        </g>
      ))}
      {/* the quiver */}
      <path d="M7 15 L25 15 L23 29 L9 29 Z" fill={LEATHER} {...S} />
      <path d="M8.6 16.6 L11.4 16.6 L10.4 27.4 L9.6 27.4 Z" fill={lit(LEATHER)} />
      <rect x={6.4} y={19.6} width={19.2} height={3} rx={1.4} fill={BRONZE} {...S} strokeWidth={1.6} />
    </>
  );
}

/* ================= TECHNIQUES — conditional, in-fight ================= */

/** Whirl of Bronze (hit everyone) — a blade sweeping a full circle. */
function WhirlOfBronze() {
  return (
    <>
      <path d="M27 16 A11 11 0 1 1 16 5" fill="none" {...S} strokeWidth={5.4} />
      <path d="M27 16 A11 11 0 1 1 16 5" fill="none" stroke={BRONZE} strokeWidth={3.2} strokeLinecap="round" />
      <path d="M14.6 1.6 L20 5.4 L14.6 9 Z" fill={BRONZE} {...S} strokeWidth={1.8} />
      <BladeShape x={16} tip={11} base={22} wide={5} />
      <circle cx={16} cy={23.6} r={2} fill={BRONZE} {...S} strokeWidth={1.6} />
    </>
  );
}

/** Shield Slam (bash after a block) — a shield thrown forward with impact. */
function ShieldSlam() {
  return (
    <>
      <Speedlines x={2} y={9} gap={6} len={7} />
      <ShieldShape cx={17} top={5} w={17} bottom={27} fill={STEEL} />
      <circle cx={17} cy={16} r={3} fill={BRONZE} {...S} strokeWidth={1.8} />
      {/* impact burst on the leading edge */}
      <path d="M26 9 l4.4 -2.4 M27 16 l4.6 0 M26 23 l4.4 2.4" {...S} strokeWidth={2.4} stroke={GOLD} />
    </>
  );
}

/** Perfect Riposte (doubled first riposte) — two blades crossing. */
function PerfectRiposte() {
  return (
    <>
      <g transform="rotate(38 16 16)">
        <BladeShape x={16} tip={2} base={18} wide={5.4} fill="#aab4bc" />
        <rect x={10} y={18} width={12} height={2.4} rx={1.1} fill={BRONZE} {...S} strokeWidth={1.6} />
        <line x1={16} y1={20} x2={16} y2={28} {...S} strokeWidth={4.4} />
        <line x1={16} y1={20} x2={16} y2={28} stroke={LEATHER} strokeWidth={2.6} strokeLinecap="round" />
      </g>
      <g transform="rotate(-38 16 16)">
        <BladeShape x={16} tip={2} base={18} wide={5.4} />
        <rect x={10} y={18} width={12} height={2.4} rx={1.1} fill={BRONZE} {...S} strokeWidth={1.6} />
        <line x1={16} y1={20} x2={16} y2={28} {...S} strokeWidth={4.4} />
        <line x1={16} y1={20} x2={16} y2={28} stroke={LEATHER} strokeWidth={2.6} strokeLinecap="round" />
      </g>
      <Spark x={16} y={9} r={3} fill={BONE} />
    </>
  );
}

/** Hamstring (crit slows) — a blade at a cut leg. */
function Hamstring() {
  return (
    <>
      {/* the leg */}
      <path d="M11 3 Q17 8 15 15 Q13 21 17 27" fill="none" {...S} strokeWidth={7} />
      <path d="M11 3 Q17 8 15 15 Q13 21 17 27" fill="none" stroke="#d3a875" strokeWidth={4.6} strokeLinecap="round" />
      <path d="M14 27 L22 29" {...S} strokeWidth={5} />
      <path d="M14 27 L22 29" stroke="#d3a875" strokeWidth={3.2} strokeLinecap="round" />
      {/* the cut */}
      <path d="M6 20 L24 12" stroke={BLOOD} strokeWidth={3.6} strokeLinecap="round" />
      <path d="M6 20 L24 12" {...S2} strokeWidth={1.2} />
      <path d="M24 10 l4 -1.6 M22 22 l3 2.6" {...S2} strokeWidth={2} stroke={BLOOD} />
    </>
  );
}

/** Second Breath (heal at low HP) — a heart drawing air in. */
function SecondBreath() {
  return (
    <>
      <path d="M16 28 Q4 19.6 4 13.6 Q4 7.6 9.4 7.6 Q13.6 7.6 16 11.6 Q18.4 7.6 22.6 7.6 Q28 7.6 28 13.6 Q28 19.6 16 28 Z" fill={BLOOD} {...S} />
      <path d="M7.6 11.6 Q7.4 9.4 9.8 9.6 Q12 9.8 12.4 12" fill="none" stroke={lit(BLOOD, 0.42)} strokeWidth={2.2} strokeLinecap="round" />
      {/* the second wind curling in */}
      <path d="M2 6 Q9 2 14 5" fill="none" {...S2} strokeWidth={2.2} stroke={SKY} />
      <path d="M18 4 Q24 1 30 5" fill="none" {...S2} strokeWidth={2.2} stroke={SKY} />
      <path d="M13.4 5.6 L14.6 4 L13 3.4" fill="none" {...S2} strokeWidth={2} stroke={SKY} />
    </>
  );
}

/** Rope and Net (entangle) — a weighted net. */
function RopeAndNet() {
  return (
    <>
      <path d="M4 8 Q16 2 28 8 L26 24 Q16 30 6 24 Z" fill="#e6d8b8" {...S} />
      {/* mesh */}
      <path d="M10 5.6 L9 26 M16 4 L16 28 M22 5.6 L23 26" {...S2} fill="none" />
      <path d="M4.6 13 Q16 8.6 27.4 13 M5 19 Q16 15 27 19" {...S2} fill="none" />
      {/* the weights */}
      {([[6, 24], [16, 28], [26, 24]] as const).map(([x, y]) => (
        <circle key={`${x}`} cx={x} cy={y} r={2.2} fill={BRONZE} {...S} strokeWidth={1.6} />
      ))}
    </>
  );
}

/** Skyfall (leap strike) — a blade falling point-down with motion. */
function Skyfall() {
  return (
    <>
      <path d="M8 2 Q10 8 9 13 M24 2 Q22 8 23 13" fill="none" {...S2} strokeWidth={2.2} stroke={SKY} />
      <g transform="rotate(180 16 16)">
        <BladeShape x={16} tip={2} base={19} wide={7} />
        <rect x={9} y={19} width={14} height={2.6} rx={1.2} fill={BRONZE} {...S} strokeWidth={1.8} />
        <line x1={16} y1={21.6} x2={16} y2={28} {...S} strokeWidth={5} />
        <line x1={16} y1={21.6} x2={16} y2={28} stroke={LEATHER} strokeWidth={3} strokeLinecap="round" />
      </g>
      {/* the ground it lands on */}
      <path d="M4 29 L28 29" {...S} strokeWidth={2.6} />
      <path d="M11 27.6 l-3 2.8 M21 27.6 l3 2.8" {...S2} strokeWidth={2} />
    </>
  );
}

/** Twin Fangs (extended combo) — two fangs, two strike lines. */
function TwinFangs() {
  return (
    <>
      <path d="M9 4 L14.6 4 L12.6 20 Q11.8 23 11 20 Z" fill={BONE} {...S} />
      <path d="M17.4 4 L23 4 L21 20 Q20.2 23 19.4 20 Z" fill={BONE} {...S} />
      <path d="M10.4 6 L13.4 6 L12.4 15 Z" fill="#fffaf0" />
      <path d="M6 25.6 L26 25.6 M8 29 L24 29" {...S} strokeWidth={2.4} stroke={BLOOD} />
    </>
  );
}

/** Beast's Fury (damage when a beast falls) — a howling head over a spark. */
function BeastsFury() {
  return (
    <>
      {/* rage burst behind */}
      <path d="M16 1.6 l2.6 5.4 5.4 -1.4 -2 5.4 5 2.6 -5 2.6 2 5.4 -5.4 -1.4 -2.6 5.4 -2.6 -5.4 -5.4 1.4 2 -5.4 -5 -2.6 5 -2.6 -2 -5.4 5.4 1.4 Z" fill={FLAME} {...S} strokeWidth={1.8} />
      {/* the beast's head, muzzle up */}
      <path d="M11 22 Q8 16 12 12 Q16 8 21 11 L26 7 L24 13 Q26 18 21 21 Z" fill={SHADOW} {...S} />
      <path d="M13.4 13.6 Q16 11 19 12" fill="none" stroke={lit(SHADOW, 0.28)} strokeWidth={2} strokeLinecap="round" />
      <circle cx={17.6} cy={15} r={1.3} fill="#e2695c" />
      <path d="M11.4 19 l2.6 2 2.4 -2 2.4 2 2.4 -2" fill="none" {...S2} stroke={BONE} strokeWidth={1.8} />
    </>
  );
}

/** Stone Wall (first hits halved) — a brick wall. */
function StoneWall() {
  const brick = "#9c9384";
  return (
    <>
      <rect x={3} y={8} width={26} height={19} rx={2} fill={brick} {...S} />
      <path d="M4.6 10 L14 10" stroke={lit(brick)} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M3 14.4 H29 M3 20.6 H29" {...S2} />
      <path d="M11 8 V14.4 M21 8 V14.4 M6.6 14.4 V20.6 M16 14.4 V20.6 M25.4 14.4 V20.6 M11 20.6 V27 M21 20.6 V27" {...S2} />
      {/* an impact glancing off the top */}
      <path d="M8 5.6 l-2.6 -3.4 M16 4.6 l0 -3.4 M24 5.6 l2.6 -3.4" {...S2} strokeWidth={2.2} stroke={GOLD} />
    </>
  );
}

/* ================= TRUMPS — the big once-a-fight moves ================= */

/** Wrath of Herakles (+100% damage) — a club inside a clear flame. */
function WrathOfHerakles() {
  return (
    <>
      {/* the flame reads only if it has tongues, not a blob */}
      <path
        d="M16 1.6 Q22 8 21 13 Q26 11 26 17 Q26 27 16 30 Q6 27 6 17 Q6 11 11 13 Q10 8 16 1.6 Z"
        fill={FLAME}
        {...S}
      />
      <path d="M16 8 Q20 13.6 18.4 18 Q22 17.4 21 22 Q19.4 26.4 16 27 Q11 26 10.4 21 Q10 16.6 13.4 17.4 Q11.6 12.6 16 8 Z" fill="#f6c45a" stroke="none" />
      {/* the club, dark against the fire */}
      <line x1={10} y1={27} x2={20} y2={12} {...S} strokeWidth={7.4} />
      <line x1={10} y1={27} x2={20} y2={12} stroke={WOOD} strokeWidth={4.6} strokeLinecap="round" />
      <circle cx={20.6} cy={10.6} r={4.4} fill={WOOD} {...S} />
      <circle cx={19.2} cy={9.4} r={1.2} fill="#6f4622" />
      <circle cx={22} cy={11.8} r={1} fill="#6f4622" />
    </>
  );
}

/** Aegis of Dawn (auto-block) — a shield inside a sunburst. */
function AegisOfDawn() {
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        return (
          <line
            key={i}
            x1={16 + Math.cos(a) * 11.6}
            y1={16 + Math.sin(a) * 11.6}
            x2={16 + Math.cos(a) * 15.4}
            y2={16 + Math.sin(a) * 15.4}
            {...S}
            strokeWidth={2.4}
            stroke={GOLD}
          />
        );
      })}
      <ShieldShape cx={16} top={4} w={20} bottom={28} fill={GOLD} />
      <path d="M16 10 L18.4 15 L23.6 15.6 L19.8 19 L21 24 L16 21.4 L11 24 L12.2 19 L8.4 15.6 L13.6 15 Z" fill="#fff3cf" {...S} strokeWidth={1.5} />
    </>
  );
}

/** Gorgon's Glare (freeze) — a staring eye with snakes rearing off it. */
function GorgonsGlare() {
  return (
    <>
      {/* four snakes: each a curl with a HEAD, or they read as grass */}
      {([[6, 12, -1], [11.6, 7.4, -0.5], [20.4, 7.4, 0.5], [26, 12, 1]] as const).map(([x, y, d]) => (
        <g key={x}>
          <path d={`M${x} ${y + 7} Q${x + d * 6} ${y + 1} ${x + d * 1.6} ${y - 3}`} fill="none" {...S} strokeWidth={4.2} />
          <path d={`M${x} ${y + 7} Q${x + d * 6} ${y + 1} ${x + d * 1.6} ${y - 3}`} fill="none" stroke={GREEN} strokeWidth={2.6} strokeLinecap="round" />
          <circle cx={x + d * 1.6} cy={y - 3.6} r={2.1} fill={GREEN} {...S} strokeWidth={1.5} />
          <circle cx={x + d * 2.2} cy={y - 4} r={0.6} fill={INK} />
        </g>
      ))}
      <path d="M2.6 19 Q16 8.6 29.4 19 Q16 29.4 2.6 19 Z" fill={BONE} {...S} />
      <circle cx={16} cy={19} r={5.6} fill={VIOLET} {...S} />
      <circle cx={16} cy={19} r={2.3} fill={INK} />
      <circle cx={14} cy={17} r={1.2} fill="#fff" />
    </>
  );
}

/** Chiron's Mending (heal) — a cup pouring a cross of light. */
function ChironsMending() {
  return (
    <>
      <path d="M8 6 L24 6 L22 17 Q19 21 16 21 Q13 21 10 17 Z" fill={GREEN} {...S} />
      <path d="M10 8 L13.6 8 L12.6 16 Q11.4 14 10.6 11 Z" fill={lit(GREEN, 0.36)} />
      <line x1={16} y1={21} x2={16} y2={27} {...S} strokeWidth={4.4} />
      <line x1={16} y1={21} x2={16} y2={27} stroke={GREEN} strokeWidth={2.6} strokeLinecap="round" />
      <rect x={9.6} y={26.6} width={12.8} height={3} rx={1.4} fill={GREEN} {...S} strokeWidth={1.8} />
      {/* the cross of light in the bowl */}
      <path d="M16 8.4 V15 M12.6 11.6 H19.4" stroke="#f4f8ee" strokeWidth={3} strokeLinecap="round" />
      <Spark x={26} y={6} r={3} fill="#dff0cf" />
    </>
  );
}

/** Hermes' Rush (haste) — a winged sandal: flat sole, straps, three feathers. */
function HermesRush() {
  return (
    <>
      <Speedlines x={1} y={7} gap={5.4} len={7} />
      {/* the wing: three tapered feathers swept back, not a curl */}
      {([[20, 10.6, 11.6], [21, 14, 10], [22, 17, 8]] as const).map(([fx, fy, len]) => (
        <path
          key={fy}
          d={`M${fx} ${fy} L${fx + len} ${fy - 2.2} L${fx + len + 1.6} ${fy + 1} L${fx + len} ${fy + 2.6} L${fx} ${fy + 2.6} Z`}
          fill={BONE}
          {...S}
          strokeWidth={1.8}
        />
      ))}
      {/* sole */}
      <path d="M5 21 L23 21 Q26 21 26 24 Q26 27 23 27 L6 27 Q3 27 3 24 Q3 21 5 21 Z" fill={LEATHER} {...S} />
      <path d="M5.6 22.6 L18 22.6" stroke={lit(LEATHER, 0.34)} strokeWidth={2} strokeLinecap="round" />
      {/* straps: a V up the foot and an ankle band */}
      <path d="M8 21 L13 13.6 L18.6 21" fill="none" {...S} strokeWidth={3} stroke="#a3703f" />
      <path d="M9.6 16.6 L17 16.6" fill="none" {...S} strokeWidth={2.6} stroke="#a3703f" />
      <circle cx={13} cy={12.6} r={1.8} fill={GOLD} {...S} strokeWidth={1.5} />
      <path d="M6 30 L14 30 M18 30 L26 30" {...S2} strokeWidth={2} stroke={SKY} />
    </>
  );
}

/** Bronte's Bolt (lightning, hits everything) — a thunderbolt. */
function BrontesBolt() {
  return (
    <>
      <path d="M19 1.6 L7 17 L14 17 L11 30.4 L25 13.6 L17.6 13.6 Z" fill={GOLD} {...S} />
      <path d="M18 4.6 L11 14.6 L15.4 14.6 Z" fill="#fff3cf" />
      <path d="M3 6 l3.4 2 M29 22 l-3.4 -2 M4.6 24 l3 -2.4 M27 8.6 l-3 2.4" {...S2} strokeWidth={2.2} stroke={SKY} />
    </>
  );
}

/** Cast Down (disarm) — a sword knocked out of the frame. */
function CastDown() {
  return (
    <>
      {/* the arc it was struck along */}
      <path d="M4 8 Q10 4 16 7" fill="none" {...S2} strokeWidth={2.2} stroke={GOLD} />
      <g transform="rotate(128 17 17)">
        <BladeShape x={17} tip={3} base={19} wide={6} fill="#aab4bc" />
        <rect x={10.6} y={19} width={13} height={2.6} rx={1.2} fill={BRONZE} {...S} strokeWidth={1.8} />
        <line x1={17} y1={21.6} x2={17} y2={28} {...S} strokeWidth={4.8} />
        <line x1={17} y1={21.6} x2={17} y2={28} stroke={LEATHER} strokeWidth={3} strokeLinecap="round" />
      </g>
      {/* the ground */}
      <path d="M2 27.6 L30 27.6" {...S} strokeWidth={2.6} />
      <path d="M8 26 l-2.6 -3 M14 25.4 l-0.6 -3.4" {...S2} strokeWidth={2} stroke={GOLD} />
    </>
  );
}

/** Moira's Thread (survive a killing blow) — a spindle and a cut thread. */
function MoirasThread() {
  return (
    <>
      {/* the thread, running the whole box, severed at the middle */}
      <path d="M2 6 Q9 12 13 10" fill="none" {...S} strokeWidth={3} stroke={VIOLET} />
      <path d="M19 22 Q23 20 30 26" fill="none" {...S} strokeWidth={3} stroke={VIOLET} />
      {/* the spindle */}
      <line x1={11} y1={22} x2={21} y2={10} {...S} strokeWidth={4.4} />
      <line x1={11} y1={22} x2={21} y2={10} stroke={WOOD} strokeWidth={2.6} strokeLinecap="round" />
      <ellipse cx={16} cy={16} rx={5.6} ry={3.6} transform="rotate(-50 16 16)" fill={VIOLET} {...S} />
      <path d="M13.6 14.4 Q15 12.6 17 12.6" fill="none" stroke={lit(VIOLET, 0.42)} strokeWidth={1.8} strokeLinecap="round" />
      <Spark x={26} y={7} r={3.2} fill="#e6d8ff" />
    </>
  );
}

/* ---------------- registry ---------------- */

export const SKILL_ART: Record<string, () => React.ReactElement> = {
  // boons
  bronze_hide: BronzeHide,
  winged_heels: WingedHeels,
  eagle_eye: EagleEye,
  hoplite_drill: HopliteDrill,
  pankration: Pankration,
  titan_grip: TitanGrip,
  keen_edge: KeenEdge,
  serpent_reflex: SerpentReflex,
  iron_wrists: IronWrists,
  marathon_lungs: MarathonLungs,
  beast_bond: BeastBond,
  endless_quiver: EndlessQuiver,
  // techniques
  whirl_of_bronze: WhirlOfBronze,
  shield_slam: ShieldSlam,
  perfect_riposte: PerfectRiposte,
  hamstring: Hamstring,
  second_breath: SecondBreath,
  rope_and_net: RopeAndNet,
  skyfall: Skyfall,
  twin_fangs: TwinFangs,
  beasts_fury: BeastsFury,
  stone_wall: StoneWall,
  // trumps
  wrath_of_herakles: WrathOfHerakles,
  aegis_of_dawn: AegisOfDawn,
  gorgons_glare: GorgonsGlare,
  chirons_mending: ChironsMending,
  hermes_rush: HermesRush,
  brontes_bolt: BrontesBolt,
  cast_down: CastDown,
  moiras_thread: MoirasThread,
};

export function hasSkillArt(id: string): boolean {
  return id in SKILL_ART;
}

export function drawSkill(id: string): React.ReactElement | undefined {
  return SKILL_ART[id]?.();
}

/** Unused today, but keeps the boon "more of a stat" mark in the vocabulary. */
export { UpTick };
