/**
 * AGOGE art library — chunky-cartoon style with articulated part groups
 * (.p-legF, .p-legB, .p-armW, .p-armS, .p-head) that styles.css animates:
 * legs cycle while running, the weapon arm swings at contact, shields
 * raise on blocks. All art is original SVG, fully parameterised.
 */

import type { Appearance, Discipline } from "@agoge/core";
import { hashString, weapon as weaponDef } from "@agoge/core";

export const INK = "#322b38";

export const SKIN_TONES = [
  { base: "#f6d7ae", shade: "#e0b98a" },
  { base: "#eec49a", shade: "#d4a273" },
  { base: "#dda877", shade: "#bf8752" },
  { base: "#c08b57", shade: "#a06c3c" },
  { base: "#9a6b40", shade: "#7c5230" },
  { base: "#6f4b2d", shade: "#57381f" },
];

/** Outfit colours (hunter jackets, not bronze cuirasses). */
export const ARMOUR_TINTS = ["#4a5268", "#b43a4a", "#e8e4da", "#2f4a75"];
export const ARMOUR_TINT_NAMES = ["Charcoal", "Crimson", "Ivory", "Navy"];

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
    helm: (h >>> 7) % 4,
    tint: (h >>> 9) % 4,
  };
}

const OUT = { stroke: INK, strokeWidth: 5, strokeLinejoin: "round" as const };
const LIMB = { stroke: INK, strokeLinecap: "round" as const, fill: "none" };

/* ---------------------------------------------------------------- */
/* Helmet + head, shared between bust and figure.                    */
/* ---------------------------------------------------------------- */

/**
 * Anime head: big expressive eyes with shine, and four hairstyles in the
 * player's hair colour — 0 spiky shonen, 1 messy, 2 ponytail, 3 twin tails.
 */
function Head({
  cx,
  cy,
  r,
  p,
  helm: hair,
}: {
  cx: number;
  cy: number;
  r: number;
  p: Palette;
  helm: number;
}) {
  const s = r / 42;
  const h = p.crest; // hair colour
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      {/* back hair (behind the face) */}
      {hair === 2 && (
        <path d="M 26 -26 Q 66 -12 58 46 Q 46 20 30 4 Z" fill={h} {...OUT} />
      )}
      {hair === 3 && (
        <>
          <path d="M -32 -14 Q -68 0 -58 48 Q -48 20 -32 2 Z" fill={h} {...OUT} />
          <path d="M 32 -14 Q 68 0 58 48 Q 48 20 32 2 Z" fill={h} {...OUT} />
        </>
      )}

      {/* face */}
      <circle cx="0" cy="0" r="42" fill={p.skin} {...OUT} />
      <circle cx="-24" cy="18" r="5" fill={p.skinShade} stroke="none" />
      <circle cx="24" cy="18" r="5" fill={p.skinShade} stroke="none" />
      <path d="M -7 26 Q 1 32 9 26" stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none" />

      {/* big anime eyes */}
      <ellipse cx="-15" cy="8" rx="8.5" ry="11" fill="#fff" stroke={INK} strokeWidth="3" />
      <ellipse cx="17" cy="8" rx="8.5" ry="11" fill="#fff" stroke={INK} strokeWidth="3" />
      <circle cx="-14" cy="10" r="5" fill={INK} />
      <circle cx="18" cy="10" r="5" fill={INK} />
      <circle cx="-12" cy="7" r="2" fill="#fff" />
      <circle cx="20" cy="7" r="2" fill="#fff" />
      <path d="M -24 -8 L -6 -6 M 8 -6 L 26 -8" stroke={INK} strokeWidth="4" strokeLinecap="round" />

      {/* front hair */}
      {hair === 0 && (
        <path
          d="M -43 6 Q -48 -34 -12 -46 Q 28 -52 43 -10 L 43 4 L 33 -16 L 28 2 L 18 -20 L 11 0 L 2 -22 L -6 -2 L -15 -24 L -22 0 L -31 -18 L -37 4 Z"
          fill={h}
          {...OUT}
        />
      )}
      {hair === 1 && (
        <path
          d="M -43 2 Q -46 -40 0 -47 Q 46 -40 43 2 Q 34 -12 25 -15 Q 31 -4 20 -7 Q 8 -18 -2 -13 Q -12 -18 -21 -9 Q -29 -13 -35 -2 Z"
          fill={h}
          {...OUT}
        />
      )}
      {(hair === 2 || hair === 3) && (
        <path
          d="M -43 0 Q -43 -42 0 -47 Q 43 -42 43 0 Q 28 -22 10 -24 Q 16 -12 4 -18 Q -14 -26 -28 -12 Q -36 -8 -43 0 Z"
          fill={h}
          {...OUT}
        />
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
      {ring && <circle cx="70" cy="70" r="66" fill="#232a3c" stroke={INK} strokeWidth="5" />}
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
/* Full hoplite figure with articulated part groups.                 */
/* ---------------------------------------------------------------- */

export function HopliteFigure({
  height,
  palette,
  discipline,
  weaponId,
  shieldId,
  helm = 0,
  sigil = 0,
  mirror = false,
}: {
  height: number;
  palette: Palette;
  discipline: Discipline | "fists";
  /** Specific weapon to draw in hand (falls back to a generic per-discipline look). */
  weaponId?: string;
  /** Specific shield carried (Aspis / Pelte / Tower / Spiked). */
  shieldId?: string;
  helm?: number;
  sigil?: number;
  mirror?: boolean;
}) {
  const p = palette;
  const width = (height * 200) / 230;
  const disc: Discipline | "fists" =
    weaponId && weaponId !== "fists" ? weaponDef(weaponId).discipline : discipline;
  const twoHanded = disc === "labrys" || weaponId === "twin_xiphoi";
  const boxer = disc === "cestus" || disc === "fists";
  const thrower = disc === "akontia";
  const showShield = !twoHanded && !boxer && !thrower;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 230"
      aria-hidden
      data-disc={discipline}
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
    >
      <ellipse className="fig-aura" cx="102" cy="128" rx="82" ry="100" fill={p.crest} opacity="0" />
      <ellipse cx="102" cy="216" rx="58" ry="10" fill="#00000030" />

      <g className="p-legB">
        <path d="M 88 152 L 82 196" {...LIMB} strokeWidth={16} stroke={p.skin} />
        <path d="M 84 172 L 82 196" {...LIMB} strokeWidth={16} stroke={p.armour} />
        <ellipse cx="80" cy="204" rx="16" ry="8" fill="#454b5e" {...OUT} />
      </g>
      <g className="p-legF">
        <path d="M 118 152 L 128 196" {...LIMB} strokeWidth={16} stroke={p.skin} />
        <path d="M 122 172 L 128 196" {...LIMB} strokeWidth={16} stroke={p.armour} />
        <ellipse cx="132" cy="204" rx="16" ry="8" fill="#454b5e" {...OUT} />
      </g>

      <g className="p-armW">
        <WeaponArm discipline={disc} weaponId={weaponId} p={p} />
      </g>

      <g className="p-body">
        <path d="M 76 146 L 84 164 L 92 146 L 100 164 L 108 146 L 116 164 L 124 146 L 126 150 L 122 154 L 80 154 L 78 150 Z" fill="#3b4254" {...OUT} />
        <path d="M 74 110 Q 102 100 128 110 L 124 150 Q 102 158 78 150 Z" fill={p.armour} {...OUT} />
        <path d="M 84 122 Q 102 116 118 122" stroke={INK} strokeWidth="3" fill="none" opacity="0.45" />
      </g>

      <g className="p-head">
        <Head cx={103} cy={62} r={42} p={p} helm={helm} />
      </g>

      <g className="p-armS">
        {showShield && <ShieldArm shieldId={shieldId} p={p} sigil={sigil} />}
        {weaponId === "twin_xiphoi" && (
          <g>
            <path d="M 82 118 L 58 132" {...LIMB} strokeWidth={14} stroke={p.skin} />
            <path d="M 54 128 L 32 72" stroke="#ded3c0" strokeWidth="10" strokeLinecap="round" />
            <path d="M 44 116 L 66 108" stroke={p.armour} strokeWidth="6" strokeLinecap="round" />
            <circle cx="55" cy="127" r="10" fill={p.skin} {...OUT} />
          </g>
        )}
        {boxer && <Fists weaponId={weaponId} p={p} />}
        {thrower && <path d="M 84 120 L 52 132" {...LIMB} strokeWidth={14} stroke={p.skin} />}
      </g>
    </svg>
  );
}

/** Shield shapes per specific Aspis-discipline item. */
function ShieldArm({ shieldId, p, sigil }: { shieldId?: string; p: Palette; sigil: number }) {
  return (
    <g>
      <path d="M 82 118 L 60 138" {...LIMB} strokeWidth={14} stroke={p.skin} />
      {shieldId === "pelte" && (
        <>
          {/* crescent skirmisher's shield */}
          <path d="M 50 114 A 32 32 0 1 0 50 178 A 40 40 0 0 1 50 114 Z" fill={p.shield} {...OUT} />
          <Sigil cx={40} cy={146} r={10} variant={sigil} fill={p.armour} />
        </>
      )}
      {shieldId === "tower_of_dikte" && (
        <>
          <rect x="24" y="102" width="54" height="90" rx="18" fill={p.shield} {...OUT} />
          <rect x="34" y="114" width="34" height="66" rx="12" fill="none" stroke={INK} strokeWidth="3" opacity="0.4" />
          <Sigil cx={51} cy={147} r={12} variant={sigil} fill={p.armour} />
        </>
      )}
      {shieldId === "spiked_aspis" && (
        <>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const rad = (a * Math.PI) / 180;
            const x1 = 50 + Math.cos(rad) * 33;
            const y1 = 146 + Math.sin(rad) * 33;
            const x2 = 50 + Math.cos(rad) * 46;
            const y2 = 146 + Math.sin(rad) * 46;
            return <path key={a} d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke={INK} strokeWidth="7" strokeLinecap="round" />;
          })}
          <circle cx="50" cy="146" r="34" fill={p.shield} {...OUT} />
          <Sigil cx={50} cy={146} r={12} variant={sigil} fill={p.armour} />
        </>
      )}
      {(shieldId === "aspis" || !shieldId) && (
        <>
          <circle cx="50" cy="146" r="36" fill={p.shield} {...OUT} />
          <circle cx="50" cy="146" r="24" fill="none" stroke={INK} strokeWidth="3" opacity="0.4" />
          <Sigil cx={50} cy={146} r={13} variant={sigil} fill={p.armour} />
        </>
      )}
    </g>
  );
}

/** Fist gear per cestus-discipline weapon. */
function Fists({ weaponId, p }: { weaponId?: string; p: Palette }) {
  const glove =
    weaponId === "iron_cestus" ? "#aab0b4" : weaponId === "himantes" ? p.skin : weaponId === "sphairai" ? "#8a6134" : "#a06c3c";
  return (
    <g>
      <path d="M 118 116 L 152 102" {...LIMB} strokeWidth={14} stroke={p.skin} />
      <path d="M 112 134 L 156 126" {...LIMB} strokeWidth={14} stroke={p.skin} />
      <circle cx="158" cy="98" r="12" fill={glove} {...OUT} />
      <circle cx="163" cy="126" r="12" fill={glove} {...OUT} />
      {weaponId === "sphairai" && (
        <>
          <path d="M 168 90 L 175 84 M 170 100 L 179 100 M 172 120 L 181 116 M 174 130 L 182 134" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      {(weaponId === "cestus" || weaponId === "iron_cestus") && (
        <path d="M 150 94 L 164 92 M 150 102 L 166 101 M 155 122 L 170 120 M 156 130 L 171 130" stroke={INK} strokeWidth="2.5" opacity="0.6" />
      )}
    </g>
  );
}

function WeaponArm({
  discipline,
  weaponId,
  p,
}: {
  discipline: Discipline | "fists";
  weaponId?: string;
  p: Palette;
}) {
  const BLADE = "#ded3c0";
  const WOOD = "#8a5a2e";
  switch (discipline) {
    case "doru":
      return (
        <g>
          <path d="M 122 118 L 152 100" {...LIMB} strokeWidth={14} stroke={p.skin} />
          {weaponId === "sarissa" ? (
            <path d="M 166 190 L 178 4" stroke={WOOD} strokeWidth="5.5" strokeLinecap="round" />
          ) : (
            <path d="M 162 170 L 176 18" stroke={WOOD} strokeWidth="7" strokeLinecap="round" />
          )}
          {weaponId === "trident" ? (
            <g>
              <path d="M 176 20 L 176 2 M 167 22 L 164 6 M 185 22 L 188 6" stroke={p.armour} strokeWidth="6" strokeLinecap="round" />
              <path d="M 167 22 L 185 22" stroke={p.armour} strokeWidth="6" strokeLinecap="round" />
            </g>
          ) : weaponId === "boar_spear" ? (
            <g>
              <path d="M 176 18 L 190 -6 L 184 26 Z" fill={p.armour} {...OUT} />
              <path d="M 164 38 L 190 34" stroke={INK} strokeWidth="6" strokeLinecap="round" />
            </g>
          ) : weaponId === "sarissa" ? (
            <path d="M 178 4 L 186 -10 L 183 10 Z" fill={p.armour} {...OUT} />
          ) : (
            <path d="M 176 18 L 186 -2 L 182 24 Z" fill={p.armour} {...OUT} />
          )}
          <circle cx="160" cy="96" r="11" fill={p.skin} {...OUT} />
        </g>
      );
    case "akontia":
      return (
        <g>
          <path d="M 120 114 L 150 88" {...LIMB} strokeWidth={14} stroke={p.skin} />
          {weaponId === "discus" ? (
            <ellipse cx="158" cy="74" rx="18" ry="7" transform="rotate(-24 158 74)" fill="#b9b0a0" {...OUT} />
          ) : weaponId === "peltast_blades" ? (
            <g>
              <path d="M 128 66 L 186 96" stroke={WOOD} strokeWidth="5" strokeLinecap="round" />
              <path d="M 140 52 L 192 78" stroke={WOOD} strokeWidth="5" strokeLinecap="round" />
              <path d="M 186 96 L 200 104 L 184 106 Z" fill={p.armour} stroke={INK} strokeWidth="3" />
              <path d="M 192 78 L 206 86 L 190 88 Z" fill={p.armour} stroke={INK} strokeWidth="3" />
            </g>
          ) : weaponId === "kestros" ? (
            <g>
              <path d="M 126 60 L 188 94" stroke={WOOD} strokeWidth="5" strokeLinecap="round" />
              <path d="M 188 94 L 204 103 L 186 105 Z" fill={p.armour} stroke={INK} strokeWidth="3" />
              <path d="M 132 70 Q 150 88 168 78" stroke="#6a4a26" strokeWidth="3.5" fill="none" />
            </g>
          ) : (
            <g>
              <path d="M 108 52 L 196 96" stroke={WOOD} strokeWidth="6" strokeLinecap="round" />
              <path d="M 196 96 L 214 106 L 194 108 Z" fill={p.armour} {...OUT} />
            </g>
          )}
          <circle cx="154" cy="82" r="11" fill={p.skin} {...OUT} />
        </g>
      );
    case "labrys": {
      const scale = weaponId === "minoan_crusher" ? 1.4 : weaponId === "bipennis" ? 0.8 : 1;
      return (
        <g>
          <path d="M 118 116 L 146 84" {...LIMB} strokeWidth={14} stroke={p.skin} />
          <path d="M 116 136 L 138 116" {...LIMB} strokeWidth={14} stroke={p.skin} />
          {weaponId === "olive_root_club" ? (
            <g>
              <path d="M 132 148 L 172 56" stroke={WOOD} strokeWidth="12" strokeLinecap="round" />
              <circle cx="176" cy="48" r="15" fill={WOOD} {...OUT} />
              <circle cx="164" cy="40" r="7" fill={WOOD} stroke={INK} strokeWidth="3.5" />
              <circle cx="188" cy="58" r="7" fill={WOOD} stroke={INK} strokeWidth="3.5" />
            </g>
          ) : (
            <g>
              <path d="M 128 152 L 168 34" stroke={WOOD} strokeWidth="8" strokeLinecap="round" />
              <g transform={`translate(168 34) scale(${scale}) translate(-168 -34)`}>
                <path d="M 168 34 Q 196 22 200 52 Q 180 46 168 56 Z" fill={BLADE} {...OUT} />
                <path d="M 168 34 Q 144 16 132 42 Q 152 40 162 52 Z" fill={BLADE} {...OUT} />
              </g>
            </g>
          )}
          <circle cx="150" cy="80" r="11" fill={p.skin} {...OUT} />
          <circle cx="140" cy="112" r="11" fill={p.skin} {...OUT} />
        </g>
      );
    }
    case "xiphos":
    case "aspis":
      return (
        <g>
          <path d="M 122 118 L 154 96" {...LIMB} strokeWidth={14} stroke={p.skin} />
          {weaponId === "kopis" ? (
            <path d="M 158 92 Q 188 68 176 24" stroke={BLADE} strokeWidth="11" strokeLinecap="round" fill="none" />
          ) : weaponId === "makhaira" ? (
            <g>
              <path d="M 158 92 L 186 34" stroke={BLADE} strokeWidth="14" strokeLinecap="round" />
              <path d="M 162 84 L 186 36" stroke={INK} strokeWidth="2.5" opacity="0.5" />
            </g>
          ) : (
            <path d="M 158 92 L 184 30" stroke={BLADE} strokeWidth="11" strokeLinecap="round" />
          )}
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
/* Beasts — fanged, glow-eyed, built to menace.                      */
/* ---------------------------------------------------------------- */

const EYE = "#e3452f";
const FANG = "#f5efdd";

const BEAST_LOOKS: Record<string, { colour: string; dark: string; scale: number }> = {
  lykos: { colour: "#6e6e78", dark: "#4c4c56", scale: 0.95 },
  stymphal_shrike: { colour: "#5c7284", dark: "#43555f", scale: 0.85 },
  kalydon_boar: { colour: "#6b4a2c", dark: "#4e3520", scale: 1.1 },
  nemean_cub: { colour: "#b9862f", dark: "#8f6420", scale: 1.2 },
  ember_fox: { colour: "#bf5426", dark: "#8f3c18", scale: 0.85 },
  bronze_owl: { colour: "#8d7440", dark: "#6a562d", scale: 0.75 },
  kerberos_pup: { colour: "#3f3438", dark: "#2a2226", scale: 1.0 },
  marble_tortoise: { colour: "#77876f", dark: "#576550", scale: 0.95 },
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
  const look = BEAST_LOOKS[beastId] ?? BEAST_LOOKS.lykos!;
  const c = look.colour;
  const d = look.dark;
  const style: React.CSSProperties = {
    transform: `${mirror ? "scaleX(-1) " : ""}${down ? "rotate(80deg)" : ""}`,
    filter: down ? "grayscale(0.8) brightness(0.85)" : undefined,
  };
  const s = size * look.scale;
  const bird = beastId === "stymphal_shrike" || beastId === "bronze_owl";
  const shell = beastId === "marble_tortoise";

  return (
    <svg width={s} height={s * 0.84} viewBox="0 0 120 100" aria-hidden style={style}>
      <ellipse cx="60" cy="94" rx="40" ry="6" fill="#00000028" />

      {bird && (
        <g>
          {/* hunched predatory body, wing raised */}
          <path d="M 26 64 Q 24 34 58 34 Q 88 36 88 60 Q 88 76 58 78 Q 32 78 26 64 Z" fill={c} {...OUT} />
          <path d="M 34 52 Q 12 40 18 68 Q 30 74 44 64 Z" fill={d} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          {/* head low and forward, hooked beak */}
          <circle cx="92" cy="40" r="16" fill={c} {...OUT} />
          <path d="M 104 34 Q 122 38 108 50 L 102 44 Z" fill="#d9a43c" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
          {/* glowing eye + angry brow */}
          <circle cx="94" cy="36" r="4.5" fill={EYE} />
          <circle cx="95.5" cy="34.5" r="1.5" fill="#fff" />
          <path d="M 86 30 L 100 34" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          {/* talons spread */}
          <path d="M 48 80 L 44 92 M 48 80 L 50 93 M 66 80 L 64 93 M 66 80 L 71 92" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          {beastId === "stymphal_shrike" && (
            <path d="M 40 40 L 52 30 L 56 42 L 68 32 L 70 44" stroke="#aab0b4" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          )}
        </g>
      )}

      {shell && (
        <g>
          {/* jagged war-shell */}
          <path d="M 22 72 Q 22 36 60 34 Q 98 36 98 72 Z" fill={c} {...OUT} />
          <path d="M 32 46 L 40 34 L 46 46 L 56 32 L 64 46 L 74 34 L 80 46 L 90 40" stroke={INK} strokeWidth="3.5" fill="none" strokeLinejoin="round" />
          <path d="M 40 58 Q 60 48 80 58 M 32 68 Q 60 56 88 68" stroke={INK} strokeWidth="3" fill="none" opacity="0.5" />
          {/* snapping head */}
          <circle cx="104" cy="64" r="13" fill="#9aa892" {...OUT} />
          <path d="M 112 62 L 121 58 L 115 66 L 121 72 L 111 69 Z" fill={FANG} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <circle cx="104" cy="60" r="3.5" fill={EYE} />
          <path d="M 34 72 L 32 88 M 84 72 L 88 88" stroke={INK} strokeWidth="6" strokeLinecap="round" />
        </g>
      )}

      {!bird && !shell && (
        <g>
          {/* low prowling body */}
          <path d="M 22 66 Q 22 44 52 42 Q 84 42 90 58 L 90 72 Q 60 82 30 76 Z" fill={c} {...OUT} />
          {/* raised hackles */}
          <path d="M 30 48 L 38 38 L 44 48 L 52 38 L 58 47 L 66 39 L 70 48" fill={d} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
          {/* tail */}
          {beastId === "ember_fox" ? (
            <path d="M 24 56 Q -2 42 8 70 Q 16 78 28 70 Z" fill="#e88b3a" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          ) : (
            <path d="M 26 54 Q 8 44 12 62" stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none" />
          )}
          {/* clawed legs */}
          <path d="M 38 78 L 36 92 M 54 80 L 54 92 M 70 80 L 70 92 M 82 76 L 86 92" stroke={INK} strokeWidth="6" strokeLinecap="round" />
          <path d="M 33 92 L 39 92 M 51 92 L 57 92 M 67 92 L 73 92 M 83 92 L 89 92" stroke={FANG} strokeWidth="4" strokeLinecap="round" />

          {/* main head: snarling, jaws open */}
          <g>
            <path d="M 78 34 Q 76 20 92 20 Q 110 20 112 36 Q 114 46 106 50 L 84 50 Q 76 44 78 34 Z" fill={c} {...OUT} />
            {/* ears pinned back */}
            <path d="M 80 24 L 70 10 L 88 18 Z" fill={d} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
            <path d="M 98 18 L 102 4 L 110 20 Z" fill={d} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
            {/* glowing eye, angry brow */}
            <circle cx="96" cy="33" r="4.5" fill={EYE} />
            <circle cx="97.5" cy="31.5" r="1.5" fill="#fff" />
            <path d="M 88 27 L 102 31" stroke={INK} strokeWidth="4" strokeLinecap="round" />
            {/* open jaw with fangs */}
            <path d="M 106 50 L 84 50 L 86 58 Q 98 62 110 56 Z" fill="#7c2f24" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
            <path d="M 88 50 L 91 56 L 94 50 Z M 100 50 L 103 56 L 106 50 Z" fill={FANG} />
            <path d="M 90 58 L 93 53 L 96 58 Z" fill={FANG} />
          </g>

          {/* extra heads for Kerberos */}
          {beastId === "kerberos_pup" && (
            <>
              <g transform="translate(-22 -6) scale(0.72)">
                <path d="M 78 34 Q 76 20 92 20 Q 110 20 112 36 Q 114 46 106 50 L 84 50 Q 76 44 78 34 Z" fill={c} {...OUT} />
                <circle cx="96" cy="33" r="5" fill={EYE} />
                <path d="M 106 50 L 84 50 L 86 58 Q 98 62 110 56 Z" fill="#7c2f24" stroke={INK} strokeWidth="4" />
              </g>
              <g transform="translate(14 -14) scale(0.66)">
                <path d="M 78 34 Q 76 20 92 20 Q 110 20 112 36 Q 114 46 106 50 L 84 50 Q 76 44 78 34 Z" fill={c} {...OUT} />
                <circle cx="96" cy="33" r="5" fill={EYE} />
                <path d="M 106 50 L 84 50 L 86 58 Q 98 62 110 56 Z" fill="#7c2f24" stroke={INK} strokeWidth="4" />
              </g>
            </>
          )}
          {/* mane for the Nemean cub */}
          {beastId === "nemean_cub" && (
            <path d="M 74 40 Q 62 16 84 14 Q 92 0 102 12 Q 118 6 118 24 Q 130 30 118 42 L 108 36 Q 94 24 80 32 Z" fill={d} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          )}
          {/* tusks for the boar */}
          {beastId === "kalydon_boar" && (
            <path d="M 104 52 Q 114 58 118 46 M 86 52 Q 78 60 72 50" stroke={FANG} strokeWidth="5" strokeLinecap="round" fill="none" />
          )}
        </g>
      )}
    </svg>
  );
}

/* ---------------------------------------------------------------- */
/* Crowd — silhouettes that bob, and roar on crits.                  */
/* ---------------------------------------------------------------- */

export function CrowdStrip() {
  const heads = Array.from({ length: 26 });
  return (
    <svg viewBox="0 0 520 36" preserveAspectRatio="none" className="crowd-svg" aria-hidden>
      {heads.map((_, i) => {
        const x = 6 + i * 20 + (i % 3) * 3;
        const y = 18 + ((i * 7) % 3) * 4;
        const dark = i % 2 === 0 ? "#10141f" : "#161b2b";
        return (
          <g key={i} className={`crowd-head ch-${i % 3}`}>
            <circle cx={x} cy={y} r="8" fill={dark} />
            <path d={`M ${x - 10} 36 Q ${x} ${y + 6} ${x + 10} 36 Z`} fill={dark} />
          </g>
        );
      })}
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
