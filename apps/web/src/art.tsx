/**
 * AGOGE art library — chunky-cartoon style: big heads, thick ink outlines,
 * flat warm colours. All art is original SVG, fully parameterised for
 * customisation (skin, helmet, crest, armour tint, shield, sigil).
 */

import type { Appearance, Discipline } from "@agoge/core";
import { hashString } from "@agoge/core";

export const INK = "#402c16";

export const SKIN_TONES = [
  { base: "#f6d7ae", shade: "#e0b98a" },
  { base: "#eec49a", shade: "#d4a273" },
  { base: "#dda877", shade: "#bf8752" },
  { base: "#c08b57", shade: "#a06c3c" },
  { base: "#9a6b40", shade: "#7c5230" },
  { base: "#6f4b2d", shade: "#57381f" },
];

export const ARMOUR_TINTS = ["#cfa040", "#aab0b4", "#e9c04a", "#8a6134"];
export const ARMOUR_TINT_NAMES = ["Bronze", "Iron", "Gold", "Dark bronze"];

export interface Palette {
  skin: string;
  skinShade: string;
  armour: string;
  crest: string;
  shield: string;
}

export function paletteFromAppearance(
  a: Pick<Appearance, "hue" | "hue2"> & Partial<Appearance>,
): Palette {
  const tone = SKIN_TONES[(a.skin ?? a.hue % 6) % SKIN_TONES.length]!;
  return {
    skin: tone.base,
    skinShade: tone.shade,
    armour: ARMOUR_TINTS[(a.tint ?? 0) % ARMOUR_TINTS.length]!,
    crest: `hsl(${a.hue2} 62% 46%)`,
    shield: `hsl(${a.hue} 46% 42%)`,
  };
}

/** Deterministic look for rivals, seeded from their name. */
export function rivalAppearance(name: string): Appearance {
  const h = hashString(name.toLowerCase());
  return {
    hue: h % 360,
    hue2: (h * 7) % 360,
    pose: h % 4,
    skin: (h >>> 3) % 6,
    sigil: (h >>> 5) % 4,
    helm: (h >>> 7) % 3,
    tint: (h >>> 9) % 4,
  };
}

const OUT = { stroke: INK, strokeWidth: 5, strokeLinejoin: "round" as const };
const LIMB = { stroke: INK, strokeLinecap: "round" as const, fill: "none" };

/* ---------------------------------------------------------------- */
/* Helmet + head, shared between bust and figure.                    */
/* ---------------------------------------------------------------- */

function Head({
  cx,
  cy,
  r,
  p,
  helm,
}: {
  cx: number;
  cy: number;
  r: number;
  p: Palette;
  helm: number;
}) {
  const s = r / 42; // scale relative to the figure head
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      <circle cx="0" cy="0" r="42" fill={p.skin} {...OUT} />
      <circle cx="-17" cy="14" r="5" fill={p.skinShade} stroke="none" />
      <path d="M -11 22 Q 1 30 13 22" stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none" />
      <circle cx="-13" cy="2" r="5" fill={INK} />
      <circle cx="19" cy="2" r="5" fill={INK} />
      {helm === 0 && (
        <>
          {/* Corinthian: dome + cheek guards + nose guard + tall crest */}
          <path d="M -43 -8 Q -41 -48 0 -50 Q 41 -48 43 -8 L 31 -8 Q 29 -36 0 -38 Q -29 -36 -31 -8 Z" fill={p.armour} {...OUT} />
          <path d="M -43 -8 L -31 -8 L -31 18 Q -40 14 -43 4 Z" fill={p.armour} {...OUT} />
          <path d="M 43 -8 L 31 -8 L 31 18 Q 40 14 43 4 Z" fill={p.armour} {...OUT} />
          <path d="M -6 -22 L 6 -22 L 4 0 L -4 0 Z" fill={p.armour} {...OUT} />
          <path d="M -41 -26 Q -29 -80 42 -60 Q 9 -58 -9 -48 Q -29 -40 -35 -22 Z" fill={p.crest} {...OUT} />
          <path d="M -25 -44 Q -7 -62 17 -60 M -33 -34 Q -19 -54 3 -58" stroke={INK} strokeWidth="3" fill="none" opacity="0.45" />
        </>
      )}
      {helm === 1 && (
        <>
          {/* Pilos cap: rounded cone, no guards, top tuft */}
          <path d="M -38 -14 Q -34 -56 0 -58 Q 34 -56 38 -14 Q 20 -24 0 -24 Q -20 -24 -38 -14 Z" fill={p.armour} {...OUT} />
          <path d="M -10 -54 Q 0 -76 14 -56 Q 4 -62 -2 -58 Z" fill={p.crest} {...OUT} />
          <path d="M -38 -14 Q 0 -30 38 -14" stroke={INK} strokeWidth="4" fill="none" />
        </>
      )}
      {helm === 2 && (
        <>
          {/* Bare: hair in the crest colour + laurel band */}
          <path d="M -40 -12 Q -38 -50 0 -52 Q 38 -50 40 -12 Q 26 -30 8 -34 Q 22 -22 18 -12 Q 4 -30 -14 -32 Q -2 -20 -8 -12 Q -22 -28 -40 -12 Z" fill={p.crest} {...OUT} />
          <ellipse cx="-28" cy="-26" rx="9" ry="4" transform="rotate(-30 -28 -26)" fill="#7c8a3a" stroke={INK} strokeWidth="2.5" />
          <ellipse cx="28" cy="-26" rx="9" ry="4" transform="rotate(30 28 -26)" fill="#7c8a3a" stroke={INK} strokeWidth="2.5" />
        </>
      )}
    </g>
  );
}

/* ---------------------------------------------------------------- */
/* Bust — avatars, rival cards, forge preview.                       */
/* ---------------------------------------------------------------- */

export function HelmBust({
  size,
  palette,
  helm = 0,
  mirror = false,
  ring = true,
}: {
  size: number;
  palette: Palette;
  helm?: number;
  mirror?: boolean;
  ring?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 140 140"
      aria-hidden
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
    >
      {ring && <circle cx="70" cy="70" r="66" fill="#f7edd2" stroke={INK} strokeWidth="5" />}
      <path d="M 22 132 Q 34 100 70 98 Q 106 100 118 132 Z" fill={palette.armour} {...OUT} />
      <Head cx={70} cy={70} r={38} p={palette} helm={helm} />
    </svg>
  );
}

/* ---------------------------------------------------------------- */
/* Sigils                                                            */
/* ---------------------------------------------------------------- */

export function Sigil({
  cx,
  cy,
  r,
  variant,
  fill,
}: {
  cx: number;
  cy: number;
  r: number;
  variant: number;
  fill: string;
}) {
  switch (variant % 4) {
    case 1:
      return (
        <g>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={fill} strokeWidth={r / 2.4} />
          <circle cx={cx} cy={cy} r={r / 3.2} fill={fill} />
        </g>
      );
    case 2:
      return (
        <path
          d={`M ${cx + r * 0.35} ${cy - r * 1.1} L ${cx - r * 0.55} ${cy + r * 0.15} L ${cx} ${cy + r * 0.15} L ${cx - r * 0.35} ${cy + r * 1.1} L ${cx + r * 0.6} ${cy - r * 0.1} L ${cx + r * 0.05} ${cy - r * 0.1} Z`}
          fill={fill}
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      );
    case 3:
      return (
        <path
          d={`M ${cx - r * 0.2} ${cy - r} A ${r} ${r} 0 1 0 ${cx - r * 0.2} ${cy + r} A ${r * 1.25} ${r * 1.25} 0 1 1 ${cx - r * 0.2} ${cy - r} Z`}
          fill={fill}
          stroke={INK}
          strokeWidth="3"
        />
      );
    default:
      return <StarShape cx={cx} cy={cy} r={r} fill={fill} />;
  }
}

function StarShape({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${cx + Math.cos(a) * rad},${cy + Math.sin(a) * rad}`);
  }
  return <polygon points={pts.join(" ")} fill={fill} stroke={INK} strokeWidth="3" strokeLinejoin="round" />;
}

/* ---------------------------------------------------------------- */
/* Full hoplite figure.                                              */
/* ---------------------------------------------------------------- */

export function HopliteFigure({
  height,
  palette,
  discipline,
  helm = 0,
  sigil = 0,
  mirror = false,
}: {
  height: number;
  palette: Palette;
  discipline: Discipline | "fists";
  helm?: number;
  sigil?: number;
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
      <ellipse cx="102" cy="216" rx="58" ry="10" fill="#00000030" />

      <path d="M 88 152 L 82 196" {...LIMB} strokeWidth={16} stroke={p.skin} />
      <path d="M 118 152 L 128 196" {...LIMB} strokeWidth={16} stroke={p.skin} />
      <path d="M 84 172 L 82 196" {...LIMB} strokeWidth={16} stroke={p.armour} />
      <path d="M 122 172 L 128 196" {...LIMB} strokeWidth={16} stroke={p.armour} />
      <ellipse cx="80" cy="204" rx="16" ry="8" fill="#8a5a2e" {...OUT} />
      <ellipse cx="132" cy="204" rx="16" ry="8" fill="#8a5a2e" {...OUT} />

      <WeaponArm discipline={discipline} p={p} />

      <path d="M 76 146 L 84 164 L 92 146 L 100 164 L 108 146 L 116 164 L 124 146 L 126 150 L 122 154 L 80 154 L 78 150 Z" fill="#b98d4f" {...OUT} />
      <path d="M 74 110 Q 102 100 128 110 L 124 150 Q 102 158 78 150 Z" fill={p.armour} {...OUT} />
      <path d="M 84 122 Q 102 116 118 122" stroke={INK} strokeWidth="3" fill="none" opacity="0.45" />

      <Head cx={103} cy={62} r={42} p={p} helm={helm} />

      {showShield && (
        <g>
          <path d="M 82 118 L 60 138" {...LIMB} strokeWidth={14} stroke={p.skin} />
          <circle cx="50" cy="146" r="36" fill={p.shield} {...OUT} />
          <circle cx="50" cy="146" r="24" fill="none" stroke={INK} strokeWidth="3" opacity="0.4" />
          <Sigil cx={50} cy={146} r={13} variant={sigil} fill={p.armour} />
        </g>
      )}
      {boxer && (
        <g>
          <path d="M 118 116 L 152 102" {...LIMB} strokeWidth={14} stroke={p.skin} />
          <path d="M 112 134 L 156 126" {...LIMB} strokeWidth={14} stroke={p.skin} />
          <circle cx="158" cy="98" r="12" fill={p.armour} {...OUT} />
          <circle cx="163" cy="126" r="12" fill={p.armour} {...OUT} />
        </g>
      )}
      {thrower && <path d="M 84 120 L 52 132" {...LIMB} strokeWidth={14} stroke={p.skin} />}
    </svg>
  );
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
          <path d="M 146 84 L 174 74" stroke={p.armour} strokeWidth="7" strokeLinecap="round" />
          <circle cx="158" cy="94" r="11" fill={p.skin} {...OUT} />
        </g>
      );
    case "cestus":
    case "fists":
      return null;
  }
}

/* ---------------------------------------------------------------- */
/* Beasts — chibi companions for the stage and the Codex.            */
/* ---------------------------------------------------------------- */

const BEAST_LOOKS: Record<string, { colour: string; scale: number; kind: "quad" | "bird" | "shell" }> = {
  lykos: { colour: "#8d8d94", scale: 0.9, kind: "quad" },
  stymphal_shrike: { colour: "#7f95a8", scale: 0.75, kind: "bird" },
  kalydon_boar: { colour: "#7a5b3c", scale: 1.05, kind: "quad" },
  nemean_cub: { colour: "#c9973f", scale: 1.15, kind: "quad" },
  ember_fox: { colour: "#cf6a35", scale: 0.8, kind: "quad" },
  bronze_owl: { colour: "#a58a4e", scale: 0.7, kind: "bird" },
  kerberos_pup: { colour: "#54484a", scale: 0.95, kind: "quad" },
  marble_tortoise: { colour: "#8fa08a", scale: 0.9, kind: "shell" },
};

export function BeastFigure({
  beastId,
  size,
  mirror = false,
  down = false,
}: {
  beastId: string;
  size: number;
  mirror?: boolean;
  down?: boolean;
}) {
  const look = BEAST_LOOKS[beastId] ?? { colour: "#8d8d94", scale: 0.9, kind: "quad" as const };
  const c = look.colour;
  const style: React.CSSProperties = {
    transform: `${mirror ? "scaleX(-1) " : ""}${down ? "rotate(80deg)" : ""}`,
    filter: down ? "grayscale(0.8) brightness(0.85)" : undefined,
  };
  const s = size * look.scale;
  return (
    <svg width={s} height={s * 0.8} viewBox="0 0 120 96" aria-hidden style={style}>
      <ellipse cx="60" cy="90" rx="38" ry="6" fill="#00000028" />
      {look.kind === "bird" && (
        <g>
          <ellipse cx="55" cy="58" rx="30" ry="24" fill={c} {...OUT} />
          <path d="M 40 52 Q 24 60 36 74 Q 46 68 52 60 Z" fill={c} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          <circle cx="86" cy="40" r="17" fill={c} {...OUT} />
          <path d="M 101 40 L 116 45 L 101 50 Z" fill="#e9c04a" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
          <circle cx="90" cy="36" r="4" fill={INK} />
          <path d="M 48 80 L 48 88 M 64 80 L 64 88" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        </g>
      )}
      {look.kind === "shell" && (
        <g>
          <path d="M 24 70 Q 24 34 60 34 Q 96 34 96 70 Z" fill={c} {...OUT} />
          <path d="M 42 52 Q 60 42 78 52 M 34 64 Q 60 52 86 64" stroke={INK} strokeWidth="3" fill="none" opacity="0.5" />
          <circle cx="103" cy="66" r="12" fill="#b5c2b0" {...OUT} />
          <circle cx="107" cy="63" r="3.5" fill={INK} />
          <path d="M 34 70 L 32 84 M 84 70 L 88 84" stroke={INK} strokeWidth="6" strokeLinecap="round" />
        </g>
      )}
      {look.kind === "quad" && (
        <g>
          <ellipse cx="56" cy="60" rx="34" ry="22" fill={c} {...OUT} />
          {/* tail */}
          {beastId === "ember_fox" ? (
            <path d="M 24 56 Q 2 46 8 68 Q 16 74 26 68 Z" fill="#f0e0c8" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          ) : (
            <path d="M 26 52 Q 12 44 14 58" stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none" />
          )}
          {/* legs */}
          <path d="M 38 76 L 36 90 M 52 78 L 52 90 M 66 78 L 66 90 M 78 76 L 82 90" stroke={INK} strokeWidth="6" strokeLinecap="round" />
          {/* head(s) */}
          <circle cx="90" cy="42" r="18" fill={c} {...OUT} />
          {beastId === "kerberos_pup" && (
            <>
              <circle cx="72" cy="32" r="13" fill={c} {...OUT} />
              <circle cx="102" cy="28" r="13" fill={c} {...OUT} />
              <circle cx="74" cy="30" r="3" fill={INK} />
              <circle cx="104" cy="26" r="3" fill={INK} />
            </>
          )}
          {beastId === "nemean_cub" && (
            <path d="M 72 32 Q 66 14 84 20 Q 96 8 102 24 Q 116 20 112 36 Z" fill="#a06c2c" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          )}
          {beastId === "kalydon_boar" && (
            <path d="M 100 52 Q 110 56 112 46" stroke="#f0e6d2" strokeWidth="5" strokeLinecap="round" fill="none" />
          )}
          {/* ears */}
          <path d="M 80 28 L 84 14 L 92 26 Z" fill={c} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          <path d="M 96 26 L 104 14 L 106 28 Z" fill={c} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          <circle cx="95" cy="40" r="4" fill={INK} />
          <path d="M 104 48 Q 108 50 106 44" stroke={INK} strokeWidth="3" fill="none" />
        </g>
      )}
    </svg>
  );
}

/* ---------------------------------------------------------------- */
/* Stage effects.                                                    */
/* ---------------------------------------------------------------- */

export function ImpactBurst({ size, crit }: { size: number; crit: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <StarShape cx={50} cy={50} r={44} fill={crit ? "#e3452f" : "#f4c94e"} />
      <StarShape cx={50} cy={50} r={22} fill="#fdf3d0" />
    </svg>
  );
}

/** Slash arc that flashes at the point of contact for melee hits. */
export function SlashArc({ size, mirror }: { size: number; mirror?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M 88 8 A 66 66 0 0 1 88 92 A 88 88 0 0 0 70 8 Z" fill="#ffffffd8" stroke="#f4c94e" strokeWidth="4" />
    </svg>
  );
}

/** Javelin projectile for thrown attacks. */
export function Javelin({ size, mirror }: { size: number; mirror?: boolean }) {
  return (
    <svg
      width={size}
      height={size / 4}
      viewBox="0 0 120 30"
      aria-hidden
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M 4 18 L 96 12" stroke="#8a5a2e" strokeWidth="6" strokeLinecap="round" />
      <path d="M 96 12 L 118 10 L 100 22 Z" fill="#cfa040" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------------------------------------------------------------- */
/* Laurel wreath.                                                    */
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
/* Discipline glyphs.                                                */
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
