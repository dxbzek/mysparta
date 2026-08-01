/**
 * AGOGE art library — chunky-cartoon style (MyBrute-era visual language:
 * big heads, thick ink outlines, flat warm colours) applied to our own
 * mythic-Greek champions. All art is original SVG.
 */

import type { Discipline } from "@agoge/core";

export const INK = "#402c16";

export interface Palette {
  skin: string;
  skinShade: string;
  armour: string;
  crest: string;
  shield: string;
}

export function paletteFromHues(hue: number, hue2: number): Palette {
  const skinHue = 24 + (hue % 16);
  return {
    skin: `hsl(${skinHue} 62% ${64 + (hue % 12)}%)`,
    skinShade: `hsl(${skinHue} 50% 52%)`,
    armour: "#cfa040",
    crest: `hsl(${hue2} 62% 48%)`,
    shield: `hsl(${hue} 45% 42%)`,
  };
}

const OUT = { stroke: INK, strokeWidth: 5, strokeLinejoin: "round" as const };
const LIMB = { stroke: INK, strokeLinecap: "round" as const, fill: "none" };

/* ---------------------------------------------------------------- */
/* Helmeted chibi bust — avatars, rival cards, forge preview.        */
/* ---------------------------------------------------------------- */

export function HelmBust({
  size,
  palette,
  mirror = false,
  ring = true,
}: {
  size: number;
  palette: Palette;
  mirror?: boolean;
  ring?: boolean;
}) {
  const p = palette;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 140 140"
      aria-hidden
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
    >
      {ring && <circle cx="70" cy="70" r="66" fill="#f7edd2" stroke={INK} strokeWidth="5" />}
      {/* shoulders */}
      <path d="M 22 132 Q 34 100 70 98 Q 106 100 118 132 Z" fill={p.armour} {...OUT} />
      {/* head */}
      <circle cx="70" cy="66" r="40" fill={p.skin} {...OUT} />
      {/* cheek blush + grin */}
      <circle cx="48" cy="80" r="5" fill={p.skinShade} stroke="none" />
      <circle cx="92" cy="80" r="5" fill={p.skinShade} stroke="none" />
      <path d="M 58 88 Q 70 96 82 88" stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* eyes */}
      <circle cx="54" cy="70" r="5" fill={INK} />
      <circle cx="86" cy="70" r="5" fill={INK} />
      {/* Corinthian-ish helmet: dome + brow + nose guard + cheek guards */}
      <path d="M 28 58 Q 30 18 70 16 Q 110 18 112 58 L 100 58 Q 98 30 70 28 Q 42 30 40 58 Z" fill={p.armour} {...OUT} />
      <path d="M 28 58 L 40 58 L 40 84 Q 32 80 28 70 Z" fill={p.armour} {...OUT} />
      <path d="M 112 58 L 100 58 L 100 84 Q 108 80 112 70 Z" fill={p.armour} {...OUT} />
      <path d="M 64 44 L 76 44 L 74 66 L 66 66 Z" fill={p.armour} {...OUT} />
      {/* crest */}
      <path d="M 30 40 Q 40 -12 110 6 Q 78 8 62 18 Q 42 26 36 44 Z" fill={p.crest} {...OUT} />
      <path d="M 44 26 Q 60 8 84 6 M 38 34 Q 52 14 74 10" stroke={INK} strokeWidth="3" fill="none" opacity="0.5" />
    </svg>
  );
}

/* ---------------------------------------------------------------- */
/* Full chibi hoplite for the fight stage & hall.                    */
/* ---------------------------------------------------------------- */

export function HopliteFigure({
  height,
  palette,
  discipline,
  mirror = false,
}: {
  height: number;
  palette: Palette;
  discipline: Discipline | "fists";
  mirror?: boolean;
}) {
  const p = palette;
  const width = (height * 200) / 230;
  const twoHanded = discipline === "labrys";
  const boxer = discipline === "cestus" || discipline === "fists";
  const thrower = discipline === "akontia";
  const showShield = !twoHanded && !boxer && !thrower;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 230"
      aria-hidden
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
    >
      {/* shadow */}
      <ellipse cx="102" cy="216" rx="58" ry="10" fill="#00000030" />

      {/* legs */}
      <path d="M 88 152 L 82 196" {...LIMB} strokeWidth={16} stroke={p.skin} />
      <path d="M 118 152 L 128 196" {...LIMB} strokeWidth={16} stroke={p.skin} />
      {/* greaves */}
      <path d="M 84 172 L 82 196" {...LIMB} strokeWidth={16} stroke={p.armour} />
      <path d="M 122 172 L 128 196" {...LIMB} strokeWidth={16} stroke={p.armour} />
      {/* sandals */}
      <ellipse cx="80" cy="204" rx="16" ry="8" fill="#8a5a2e" {...OUT} />
      <ellipse cx="132" cy="204" rx="16" ry="8" fill="#8a5a2e" {...OUT} />

      {/* weapon arm (behind body) */}
      <WeaponArm discipline={discipline} p={p} />

      {/* pteruges skirt */}
      <path d="M 76 146 L 84 164 L 92 146 L 100 164 L 108 146 L 116 164 L 124 146 L 126 150 L 122 154 L 80 154 L 78 150 Z" fill="#b98d4f" {...OUT} />

      {/* cuirass */}
      <path d="M 74 110 Q 102 100 128 110 L 124 150 Q 102 158 78 150 Z" fill={p.armour} {...OUT} />
      <path d="M 84 122 Q 102 116 118 122" stroke={INK} strokeWidth="3" fill="none" opacity="0.45" />

      {/* head — big chibi head over the body */}
      <g>
        <circle cx="103" cy="62" r="42" fill={p.skin} {...OUT} />
        <circle cx="86" cy="76" r="5" fill={p.skinShade} stroke="none" />
        <path d="M 92 84 Q 104 92 116 84" stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none" />
        <circle cx="90" cy="64" r="5" fill={INK} />
        <circle cx="122" cy="64" r="5" fill={INK} />
        {/* helmet */}
        <path d="M 60 54 Q 62 14 103 12 Q 144 14 146 54 L 134 54 Q 132 26 103 24 Q 74 26 72 54 Z" fill={p.armour} {...OUT} />
        <path d="M 60 54 L 72 54 L 72 80 Q 63 76 60 66 Z" fill={p.armour} {...OUT} />
        <path d="M 146 54 L 134 54 L 134 80 Q 143 76 146 66 Z" fill={p.armour} {...OUT} />
        <path d="M 97 40 L 109 40 L 107 62 L 99 62 Z" fill={p.armour} {...OUT} />
        {/* crest */}
        <path d="M 62 36 Q 74 -18 145 2 Q 112 4 94 14 Q 74 22 68 40 Z" fill={p.crest} {...OUT} />
        <path d="M 78 20 Q 96 4 120 2 M 70 30 Q 86 10 108 6" stroke={INK} strokeWidth="3" fill="none" opacity="0.5" />
      </g>

      {/* shield arm (front) */}
      {showShield && (
        <g>
          <path d="M 82 118 L 60 138" {...LIMB} strokeWidth={14} stroke={p.skin} />
          <circle cx="50" cy="146" r="36" fill={p.shield} {...OUT} />
          <circle cx="50" cy="146" r="24" fill="none" stroke={INK} strokeWidth="3" opacity="0.4" />
          <Star cx={50} cy={146} r={13} fill={p.armour} />
        </g>
      )}
      {boxer && (
        <g>
          <path d="M 118 116 L 152 102" {...LIMB} strokeWidth={14} stroke={p.skin} />
          <path d="M 112 134 L 156 126" {...LIMB} strokeWidth={14} stroke={p.skin} />
          <circle cx="158" cy="98" r="12" fill={p.armour} {...OUT} />
          <circle cx="163" cy="126" r="12" fill={p.armour} {...OUT} />
          <path d="M 152 94 L 164 92 M 152 100 L 165 99" stroke={INK} strokeWidth="2.5" opacity="0.6" />
        </g>
      )}
      {thrower && (
        <path d="M 84 120 L 52 132" {...LIMB} strokeWidth={14} stroke={p.skin} />
      )}
    </svg>
  );
}

function Star({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${cx + Math.cos(a) * rad},${cy + Math.sin(a) * rad}`);
  }
  return <polygon points={pts.join(" ")} fill={fill} stroke={INK} strokeWidth="3" strokeLinejoin="round" />;
}

function WeaponArm({ discipline, p }: { discipline: Discipline | "fists"; p: Palette }) {
  switch (discipline) {
    case "doru":
      return (
        <g>
          <path d="M 122 118 L 152 100" {...LIMB} strokeWidth={14} stroke={p.skin} />
          <path d="M 162 170 L 176 18" stroke="#8a5a2e" strokeWidth="7" strokeLinecap="round" />
          <path d="M 176 18 L 186 -2 L 182 24 Z" fill={p.armour} {...OUT} />
          <circle cx="160" cy="96" r="11" fill={p.skin} {...OUT} />
        </g>
      );
    case "akontia":
      return (
        <g>
          <path d="M 120 114 L 150 88" {...LIMB} strokeWidth={14} stroke={p.skin} />
          <path d="M 108 52 L 196 96" stroke="#8a5a2e" strokeWidth="6" strokeLinecap="round" />
          <path d="M 196 96 L 214 106 L 194 108 Z" fill={p.armour} {...OUT} />
          <circle cx="154" cy="82" r="11" fill={p.skin} {...OUT} />
        </g>
      );
    case "labrys":
      return (
        <g>
          <path d="M 118 116 L 146 84" {...LIMB} strokeWidth={14} stroke={p.skin} />
          <path d="M 116 136 L 138 116" {...LIMB} strokeWidth={14} stroke={p.skin} />
          <path d="M 128 152 L 168 34" stroke="#8a5a2e" strokeWidth="8" strokeLinecap="round" />
          <path d="M 168 34 Q 196 22 200 52 Q 180 46 168 56 Z" fill="#ded3c0" {...OUT} />
          <path d="M 168 34 Q 144 16 132 42 Q 152 40 162 52 Z" fill="#ded3c0" {...OUT} />
          <circle cx="150" cy="80" r="11" fill={p.skin} {...OUT} />
          <circle cx="140" cy="112" r="11" fill={p.skin} {...OUT} />
        </g>
      );
    case "xiphos":
    case "aspis":
      return (
        <g>
          <path d="M 122 118 L 154 96" {...LIMB} strokeWidth={14} stroke={p.skin} />
          <path d="M 158 92 L 184 30" stroke="#ded3c0" strokeWidth="11" strokeLinecap="round" />
          <path d="M 158 92 L 184 30" stroke={INK} strokeWidth="15" strokeLinecap="round" opacity="0" />
          <path d="M 146 84 L 174 74" stroke={p.armour} strokeWidth="7" strokeLinecap="round" />
          <circle cx="158" cy="94" r="11" fill={p.skin} {...OUT} />
        </g>
      );
    case "cestus":
    case "fists":
      return null; // fists drawn in front
  }
}

/* ---------------------------------------------------------------- */
/* Impact burst for the stage.                                       */
/* ---------------------------------------------------------------- */

export function ImpactBurst({ size, crit }: { size: number; crit: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <Star cx={50} cy={50} r={44} fill={crit ? "#e3452f" : "#f4c94e"} />
      <Star cx={50} cy={50} r={22} fill="#fdf3d0" />
    </svg>
  );
}

/* ---------------------------------------------------------------- */
/* Laurel wreath (victory framing).                                  */
/* ---------------------------------------------------------------- */

export function Laurel({ size, color = "#7c8a3a" }: { size: number; color?: string }) {
  const leaves = Array.from({ length: 8 });
  const leaf = (t: number, xBase: number, dir: 1 | -1, i: number) => {
    const x = xBase + dir * t * 70;
    const y = 92 - Math.sin(t * Math.PI * 0.55) * 76;
    const angle = dir * (-20 - t * 60);
    return (
      <g key={`${dir}${i}`} transform={`translate(${x} ${y}) rotate(${angle})`}>
        <ellipse rx="15" ry="6" fill={color} stroke={INK} strokeWidth="2.5" />
      </g>
    );
  };
  return (
    <svg width={size} height={size / 2} viewBox="0 0 200 100" aria-hidden>
      {leaves.map((_, i) => leaf(i / 7, 22, 1, i))}
      {leaves.map((_, i) => leaf(i / 7, 178, -1, i))}
    </svg>
  );
}

/* ---------------------------------------------------------------- */
/* Discipline glyphs for chips and lists.                            */
/* ---------------------------------------------------------------- */

export function DisciplineGlyph({ d, size = 20 }: { d: Discipline | "fists"; size?: number }) {
  const c = "#8a5a2e";
  const common = { stroke: c, strokeWidth: 9, strokeLinecap: "round" as const, fill: "none" };
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      {d === "doru" && (
        <>
          <path d="M 20 88 L 74 22" {...common} />
          <path d="M 74 22 L 88 8 L 80 30 Z" fill={c} stroke="none" />
        </>
      )}
      {d === "xiphos" && (
        <>
          <path d="M 50 12 L 50 64" {...common} />
          <path d="M 30 60 L 70 60" {...common} />
          <path d="M 50 64 L 50 88" {...common} />
        </>
      )}
      {(d === "cestus" || d === "fists") && (
        <>
          <circle cx="50" cy="50" r="26" fill={c} />
          <path d="M 30 42 L 70 42 M 30 56 L 70 56" stroke="#f7edd2" strokeWidth="7" />
        </>
      )}
      {d === "labrys" && (
        <>
          <path d="M 50 12 L 50 88" {...common} />
          <path d="M 50 24 Q 80 12 84 42 Q 62 38 50 46 Z" fill={c} stroke="none" />
          <path d="M 50 24 Q 20 12 16 42 Q 38 38 50 46 Z" fill={c} stroke="none" />
        </>
      )}
      {d === "akontia" && (
        <>
          <path d="M 14 86 L 72 28" {...common} strokeWidth={6} />
          <path d="M 72 28 L 86 14 L 78 34 Z" fill={c} stroke="none" />
        </>
      )}
      {d === "aspis" && (
        <>
          <circle cx="50" cy="50" r="34" fill="none" stroke={c} strokeWidth="10" />
          <circle cx="50" cy="50" r="13" fill={c} />
        </>
      )}
    </svg>
  );
}
