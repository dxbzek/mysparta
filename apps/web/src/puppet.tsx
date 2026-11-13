/**
 * The fighter as a cut-out puppet, drawn in the arsenal's hand
 * (cartoonArt.tsx): flat colour, one #241c14 outline, one highlight, no
 * shading. A SAMPLE behind the `?puppet=1` flag — the LPC paper dolls are
 * still what ships.
 *
 * Why a puppet: the paper dolls are 64px pixel sheets that snap between a
 * handful of frames, standing next to vector weapons and a parchment UI —
 * two games glued together. The look Zek asked for is MyBrute's: chunky
 * flat-cartoon fighters whose limbs swing smoothly. Their art is Motion
 * Twin's and is not used or traced; only the idea (rigid parts on pivots,
 * tweened) is taken.
 *
 * How it moves: every limb is a `<g>` nested in its parent (torso > upper
 * arm > forearm > hand > weapon), each with its own pivot given in the
 * figure's own units (`transform-box: view-box`, the beasts' rig in
 * beastArt.tsx does the same). Rotating a shoulder carries the elbow, the
 * hand and the sword with it, so nothing can detach. The keyframes are plain
 * CSS generated from pose tables (puppetPoses.ts), which buys three things
 * the stage already relies on for free: `.stage.hitstop` pauses every
 * animation under it, `--spd` scales every duration, and
 * prefers-reduced-motion switches them off.
 *
 * Authored in a 100x140 box facing RIGHT, feet on y=138. The right-hand
 * fighter is the same drawing mirrored.
 */

import type React from "react";
import { CARTOON_WEAPON } from "./cartoonArt.js";
import { CLOTH_COLORS, EYE_COLORS, HAIR_COLORS, SKINS, normaliseLook, type Look } from "./paperdoll.js";
import { ensurePuppetStyles, JOINTS, type Joint } from "./puppetPoses.js";
import type { ClipPlan } from "./puppetClips.js";

const INK = "#241c14";
const S = { stroke: INK, strokeWidth: 2.4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const BRONZE = { fill: "#c98b3c", lit: "#f0c070" };
const LEATHER = "#8a5a33";
const CREST = "#c25b3f";

/** The box the figure is drawn in. */
export const PZ = { w: 100, h: 140, ground: 138 } as const;

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) =>
    Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `#${((ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).padStart(6, "0")}`;
}

/** A rigged joint: a group that turns about its own pivot. */
function J({ j, children }: { j: Joint; children: React.ReactNode }) {
  const [ox, oy] = JOINTS[j];
  return (
    <g className={`pz-j pz-${j}`} style={{ transformOrigin: `${ox}px ${oy}px` }}>
      {children}
    </g>
  );
}

/** A limb segment: a round-ended capsule, ink first, colour over it. */
function Seg({ x, y1, y2, w, fill }: { x: number; y1: number; y2: number; w: number; fill: string }) {
  return (
    <>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={INK} strokeWidth={w + 4.8} strokeLinecap="round" />
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={fill} strokeWidth={w} strokeLinecap="round" />
    </>
  );
}

/**
 * How each weapon family sits in the fist. Every weapon in CARTOON_WEAPON is
 * authored upright in a 32-box; `grip` is the point the fist closes on, `r`
 * turns it so it leaves the hand along the thumb (forward, at rest), and
 * `sx/sy` size it to the body — a spear's haft is stretched along its length
 * only, so its outline keeps the body's weight.
 */
const GRIP: Record<string, { grip: [number, number]; r: number; sx: number; sy: number }> = {
  blade: { grip: [16, 24], r: 90, sx: 1.6, sy: 2.0 },
  spear: { grip: [16, 22], r: 90, sx: 1.5, sy: 3.0 },
  axe: { grip: [16, 26], r: 128, sx: 1.7, sy: 2.1 },
  javelin: { grip: [16, 20], r: 90, sx: 1.5, sy: 2.6 },
  thrown: { grip: [16, 18], r: 90, sx: 1.5, sy: 1.5 },
  shield: { grip: [16, 16], r: 0, sx: 1.4, sy: 1.4 },
};

const FAMILY: Record<string, keyof typeof GRIP> = {
  xiphos: "blade",
  doru: "spear",
  labrys: "axe",
  akontia: "thrown",
  aspis: "shield",
};

function Weapon({ id, discipline }: { id: string; discipline?: string }) {
  const draw = CARTOON_WEAPON[id];
  if (!draw || !discipline || discipline === "cestus") return null;
  const fam = id === "akontion" ? "javelin" : FAMILY[discipline] ?? "blade";
  const g = GRIP[fam]!;
  // akontion is drawn leaning 24° in its icon box; stand it up first.
  const unlean = id === "akontion" ? " rotate(-24 16 16)" : "";
  return (
    <g className="pz-j pz-weapon" transform={`rotate(${g.r}) scale(${g.sx} ${g.sy}) translate(${-g.grip[0]} ${-g.grip[1]})${unlean}`}>
      {draw()}
    </g>
  );
}

/** The appearance, read off the existing Look so the Forge still decides it. */
function palette(look: Look) {
  const l = normaliseLook(look);
  const skin = SKINS[l.skin]!.css;
  const cloth = CLOTH_COLORS[l.torsoColor]!.css;
  return {
    l,
    skin,
    skinDark: shade(skin, -0.22),
    hair: HAIR_COLORS[l.hairColor]!.css,
    eye: EYE_COLORS[l.eyes]?.css ?? INK,
    cloth,
    clothDark: shade(cloth, -0.25),
    clothLit: shade(cloth, 0.3),
    legs: l.legs === 0 ? skin : CLOTH_COLORS[l.legsColor]!.css,
    boots: l.feet === 0 ? skin : CLOTH_COLORS[l.feetColor]!.css,
  };
}

type Pal = ReturnType<typeof palette>;

function Hair({ p }: { p: Pal }) {
  const h = p.l.hair;
  if (h === 0 || p.l.helm !== undefined && p.l.helm >= 0) return null;
  const lit = shade(p.hair, 0.25);
  // Three silhouettes cover the 24 styles at this size: a crop, a mass of
  // curls, and long hair falling behind the neck.
  const puffy = h >= 8 && h <= 12;
  const long = h >= 13 && h <= 20;
  return (
    <>
      {long && <path d="M33 30 Q31 52 40 58 L50 54 Q42 46 44 30 Z" fill={p.hair} {...S} />}
      {puffy ? (
        <path d="M33 36 Q26 22 36 14 Q44 4 56 8 Q70 8 72 22 Q64 18 58 22 Q50 20 46 28 Q42 32 42 40 Z" fill={p.hair} {...S} />
      ) : (
        <path d="M34 36 Q32 16 52 14 Q67 14 70 27 Q61 21 52 23 Q45 26 43 38 Z" fill={p.hair} {...S} />
      )}
      <path d="M44 18 Q52 15 60 17" stroke={lit} strokeWidth={2.2} fill="none" strokeLinecap="round" />
    </>
  );
}

function Helm() {
  return (
    <>
      {/* the crest: a horsehair brush front to back */}
      <path d="M30 22 Q36 4 56 4 Q66 5 70 12 Q58 9 50 12 Q40 14 36 26 Z" fill={CREST} {...S} />
      <path d="M33 38 Q31 14 52 13 Q71 13 71 30 L64 30 L63 42 L57 42 L57 32 Q50 30 46 34 L45 44 L36 44 Z" fill={BRONZE.fill} {...S} />
      <path d="M39 30 Q40 19 51 17" stroke={BRONZE.lit} strokeWidth={2.6} fill="none" strokeLinecap="round" />
    </>
  );
}

function Beard({ p }: { p: Pal }) {
  if (p.l.beard === 0) return null;
  // moustache styles (6+) keep the chin bare
  if (p.l.beard >= 6) return <path d="M58 40 Q63 37 69 40 Q64 42 58 42 Z" fill={p.hair} {...S} strokeWidth={1.6} />;
  return <path d="M45 38 Q46 52 58 52 Q68 51 70 40 Q64 44 57 43 Q51 42 48 37 Z" fill={p.hair} {...S} />;
}

function Head({ p }: { p: Pal }) {
  const helm = p.l.helm !== undefined && p.l.helm >= 0;
  return (
    <J j="head">
      {/* neck */}
      <rect x={45} y={44} width={11} height={12} rx={3} fill={p.skinDark} {...S} />
      {/* skull and a jaw that juts toward the foe */}
      <path d="M36 34 Q35 16 52 16 Q69 16 70 32 Q71 38 70 42 Q68 50 58 51 Q46 51 41 45 Q36 40 36 34 Z" fill={p.skin} {...S} />
      <path d="M41 26 Q44 20 50 19" stroke={shade(p.skin, 0.35)} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      {/* ear */}
      <ellipse cx={46} cy={35} rx={3.4} ry={4.2} fill={p.skin} {...S} strokeWidth={1.8} />
      <Beard p={p} />
      {/* eye: white, iris, a heavy brow — the face reads at 40px */}
      <ellipse cx={61.5} cy={32} rx={3.6} ry={4.2} fill="#fffaf0" {...S} strokeWidth={1.6} />
      <circle cx={63} cy={32.5} r={2} fill={p.eye} />
      <circle cx={63.4} cy={32.5} r={1} fill={INK} />
      <path d="M56 26.5 L67 27.5" {...S} strokeWidth={3} />
      {/* nose and mouth */}
      <path d="M69 31 Q74 36 69 38" fill={p.skin} {...S} strokeWidth={1.8} />
      <path d="M62 44 L67 43" {...S} strokeWidth={1.8} />
      {helm ? <Helm /> : <Hair p={p} />}
    </J>
  );
}

function Torso({ p, broad }: { p: Pal; broad: boolean }) {
  const t = p.l.torso;
  const k = broad ? 0 : 3;
  const chest = `M${32 + k} 58 Q34 50 50 50 Q66 50 ${68 - k} 58 L${63 - k} 88 Q50 93 ${37 + k} 88 Z`;
  const armour = t === 1 || t === 2;
  const body = t === 0 ? p.skin : armour ? BRONZE.fill : p.cloth;
  const lit = t === 0 ? shade(p.skin, 0.3) : armour ? BRONZE.lit : p.clothLit;
  return (
    <>
      {/* skirt / pteruges over the hips */}
      <path d={`M${37 + k} 86 L${63 - k} 86 L${66 - k} 104 Q50 108 ${34 + k} 104 Z`} fill={armour ? LEATHER : p.clothDark} {...S} />
      {armour &&
        [42, 50, 58].map((x) => <line key={x} x1={x} y1={90} x2={x} y2={105} stroke={INK} strokeWidth={1.4} opacity={0.6} />)}
      <path d={chest} fill={body} {...S} />
      <path d={`M${37 + k} 58 Q40 54 48 53`} stroke={lit} strokeWidth={3} fill="none" strokeLinecap="round" />
      {t === 0 && <path d="M52 62 Q58 68 64 63" stroke={INK} strokeWidth={1.4} fill="none" opacity={0.55} />}
      {armour && <path d="M42 66 Q50 70 58 66 M44 75 Q50 78 56 75" stroke={INK} strokeWidth={1.4} fill="none" opacity={0.6} />}
      {/* belt */}
      <rect x={36 + k} y={83} width={28 - 2 * k} height={6} rx={2} fill={LEATHER} {...S} strokeWidth={2} />
      <rect x={48} y={83.5} width={6} height={5} rx={1} fill={BRONZE.fill} stroke={INK} strokeWidth={1.2} />
    </>
  );
}

function Leg({ side, p }: { side: "F" | "B"; p: Pal }) {
  const x = side === "F" ? 54 : 46;
  const back = side === "B";
  const thigh = back ? shade(p.legs, -0.18) : p.legs;
  // shorts and bare legs leave the shin bare
  const shinCol = p.l.legs === 0 || p.l.legs === 2 ? p.skin : p.legs;
  const shin = back ? shade(shinCol, -0.18) : shinCol;
  const boot = back ? shade(p.boots, -0.18) : p.boots;
  return (
    <J j={`thigh${side}`}>
      <Seg x={x} y1={92} y2={112} w={13} fill={thigh} />
      <J j={`shin${side}`}>
        <Seg x={x} y1={113} y2={130} w={11} fill={shin} />
        <path d={`M${x - 6} 127 L${x + 5} 127 Q${x + 13} 130 ${x + 13} 135 L${x + 13} 138 L${x - 6} 138 Z`} fill={boot} {...S} />
      </J>
    </J>
  );
}

function Arm({ side, p, children }: { side: "F" | "B"; p: Pal; children?: React.ReactNode }) {
  const x = side === "F" ? 58 : 42;
  const back = side === "B";
  const t = p.l.torso;
  const sleeve = t === 0 || t === 10 ? p.skin : t === 1 || t === 2 ? BRONZE.fill : p.cloth;
  const skin = back ? p.skinDark : p.skin;
  return (
    <J j={`uarm${side}`}>
      <Seg x={x} y1={58} y2={75} w={12} fill={back ? shade(sleeve, -0.2) : sleeve} />
      <J j={`farm${side}`}>
        <Seg x={x} y1={76} y2={91} w={10} fill={skin} />
        <J j={`hand${side}`}>
          {children}
          {/* the fist closes over whatever it holds */}
          <circle cx={x} cy={95} r={6.6} fill={skin} {...S} />
          <path d={`M${x + 1} 91.5 Q${x + 5.5} 93 ${x + 4.5} 97`} stroke={INK} strokeWidth={1.4} fill="none" opacity={0.6} />
        </J>
      </J>
    </J>
  );
}

export interface PuppetProps {
  look: Look;
  /** weapon id in hand and its discipline (core) */
  weaponId?: string;
  discipline?: string;
  /** on-screen height in px of the 140-unit box */
  height: number;
  plan: ClipPlan;
  mirror?: boolean;
  /** start of a looping idle, so a remount mid-breath does not pop (ms) */
  phaseMs?: number;
  /** how far into a held clip (the fall) we already are, across remounts (ms) */
  elapsedMs?: number;
  className?: string;
}

/** Width of the layout box: the body, not the reach of the weapon. */
export function puppetWidth(height: number): number {
  return Math.round(height * 0.42);
}

export function PuppetFig({
  look,
  weaponId,
  discipline,
  height,
  plan,
  mirror,
  phaseMs = 0,
  elapsedMs = 0,
  className,
}: PuppetProps) {
  ensurePuppetStyles();
  const p = palette(look);
  const broad = p.l.build === 0;
  const w = puppetWidth(height);
  const svgW = (height * PZ.w) / PZ.h;
  const react = plan.clip === "hit" ? "hurt" : plan.clip === "dodge" || plan.clip === "duck" ? "dodge" : plan.clip === "block" ? "block" : undefined;
  const loops = plan.clip === "idle" || plan.clip === "win";
  return (
    <span
      className={`pz ${className ?? ""}`}
      data-clip={plan.heavy ? `${plan.clip}-heavy` : plan.clip}
      data-react={react}
      data-heavy={plan.heavy ? "" : undefined}
      style={
        {
          width: w,
          height,
          "--pz-dur": `${plan.durMs}ms`,
          "--pz-wait": loops
            ? `${-(phaseMs % (plan.durMs * 2))}ms`
            : `${plan.delayMs - Math.round(elapsedMs)}ms`,
        } as React.CSSProperties
      }
    >
      <svg
        className="pz-svg"
        width={svgW}
        height={height}
        viewBox={`0 0 ${PZ.w} ${PZ.h}`}
        overflow="visible"
        aria-hidden
        style={{ left: (w - svgW) / 2, transform: mirror ? "scaleX(-1)" : undefined }}
      >
        <g className="pz-j pz-squash" style={{ transformOrigin: `${JOINTS.squash[0]}px ${JOINTS.squash[1]}px` }}>
          <J j="root">
            <Leg side="B" p={p} />
            <Leg side="F" p={p} />
            <J j="torso">
              <Arm side="B" p={p} />
              <Torso p={p} broad={broad} />
              <Head p={p} />
              <Arm side="F" p={p}>
                {weaponId && (
                  <g transform="translate(58 95)">
                    <Weapon id={weaponId} discipline={discipline} />
                  </g>
                )}
              </Arm>
            </J>
          </J>
        </g>
      </svg>
    </span>
  );
}
