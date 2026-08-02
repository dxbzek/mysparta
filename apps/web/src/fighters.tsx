/**
 * Hand-animated fighters — real frame-by-frame sprite-sheet animation.
 *
 * Art: "Martial Hero" & "Martial Hero 2" by LuizMelo (free for commercial
 * use) and the "Oak Woods" arena backdrop bundled with them. Each animation
 * is a horizontal strip of 200×200 frames drawn by hand: 8-frame idles that
 * genuinely breathe, run cycles, sword swings with anticipation and
 * follow-through, hit reactions and deaths.
 *
 * Playback is pure CSS: background-position stepped through the strip with
 * steps(N) — no per-frame JS, no canvas.
 */

import mackIdle from "./assets/fighters/mack-idle.webp";
import mackRun from "./assets/fighters/mack-run.webp";
import mackAttack1 from "./assets/fighters/mack-attack1.webp";
import mackAttack2 from "./assets/fighters/mack-attack2.webp";
import mackHit from "./assets/fighters/mack-hit.webp";
import mackDeath from "./assets/fighters/mack-death.webp";
import kenjiIdle from "./assets/fighters/kenji-idle.webp";
import kenjiRun from "./assets/fighters/kenji-run.webp";
import kenjiAttack1 from "./assets/fighters/kenji-attack1.webp";
import kenjiAttack2 from "./assets/fighters/kenji-attack2.webp";
import kenjiHit from "./assets/fighters/kenji-hit.webp";
import kenjiDeath from "./assets/fighters/kenji-death.webp";
import pixelArenaImg from "./assets/fighters/pixel-arena.webp";
import { useEffect, useState } from "react";
import { CLOTH_TINTS, FACE_TINTS, HAIR_TINTS, tintedSheet, type TintChoice } from "./recolor.js";

export { pixelArenaImg };

export const DEFAULT_TINT: TintChoice = { hair: 0, face: 0, clothes: 0 };

/** Resolve a sheet's (possibly recoloured) source; default art until ready. */
function useTintedSrc(src: string, fighter: number, tint: TintChoice | undefined): string {
  const t = tint ?? DEFAULT_TINT;
  const [url, setUrl] = useState(src);
  useEffect(() => {
    let live = true;
    setUrl(src);
    tintedSheet(src, fighter, t).then((u) => {
      if (live) setUrl(u);
    });
    return () => {
      live = false;
    };
  }, [src, fighter, t.hair, t.face, t.clothes]);
  return url;
}

export type FighterAnim = "idle" | "run" | "attack1" | "attack2" | "hit" | "death";

interface Sheet {
  src: string;
  frames: number;
  /** seconds for one full pass */
  dur: number;
  loop: boolean;
}

export interface Fighter {
  name: string;
  role: string;
  /** Body descriptor for the appearance-only creation screen. */
  build: string;
  blurb: string;
  sheets: Record<FighterAnim, Sheet>;
  /** frame box (px) */
  box: number;
  /** character bounds inside the frame (from the idle pose) */
  char: { cx: number; w: number; h: number; groundOff: number };
  /** true when the artist drew the sheets facing LEFT (mirror logic inverts) */
  facesLeft?: boolean;
}

export const FIGHTERS: Fighter[] = [
  {
    name: "Ronin",
    role: "Greatsword duelist",
    build: "Broad & grounded",
    blurb: "Patient stance, brutal follow-through. Every swing is a sentence.",
    box: 200,
    char: { cx: 94, w: 38, h: 52, groundOff: 79 },
    sheets: {
      idle: { src: mackIdle, frames: 8, dur: 0.9, loop: true },
      run: { src: mackRun, frames: 8, dur: 0.55, loop: true },
      attack1: { src: mackAttack1, frames: 6, dur: 0.45, loop: false },
      attack2: { src: mackAttack2, frames: 6, dur: 0.45, loop: false },
      hit: { src: mackHit, frames: 4, dur: 0.35, loop: false },
      death: { src: mackDeath, frames: 6, dur: 0.65, loop: false },
    },
  },
  {
    name: "Shinobi",
    role: "Twin-blade assassin",
    build: "Slight & swift",
    blurb: "Strikes twice before the first cut is felt.",
    box: 200,
    char: { cx: 102, w: 34, h: 54, groundOff: 73 },
    facesLeft: true,
    sheets: {
      idle: { src: kenjiIdle, frames: 4, dur: 0.75, loop: true },
      run: { src: kenjiRun, frames: 8, dur: 0.5, loop: true },
      attack1: { src: kenjiAttack1, frames: 4, dur: 0.35, loop: false },
      attack2: { src: kenjiAttack2, frames: 4, dur: 0.35, loop: false },
      hit: { src: kenjiHit, frames: 3, dur: 0.3, loop: false },
      death: { src: kenjiDeath, frames: 7, dur: 0.75, loop: false },
    },
  },
];

/** Colour-grade presets — palette-swap variants, the classic fighter trick. */
export const STYLES = [
  { name: "Default", filter: "" },
  { name: "Ember", filter: "sepia(0.35) saturate(1.6) hue-rotate(-12deg) contrast(1.06)" },
  { name: "Frost", filter: "saturate(0.85) hue-rotate(150deg) brightness(1.08)" },
  { name: "Void", filter: "saturate(1.2) contrast(1.22) brightness(0.8) hue-rotate(45deg)" },
  { name: "Radiant", filter: "saturate(1.35) brightness(1.15) hue-rotate(-100deg)" },
];

/** Aura colours — the glow around the fighter, flares on victory. */
export const AURAS = [
  { name: "Violet", color: "#a78bfa" },
  { name: "Gold", color: "#f4c94e" },
  { name: "Crimson", color: "#f4526e" },
  { name: "Azure", color: "#5fc9f5" },
  { name: "Emerald", color: "#34d399" },
  { name: "Rose", color: "#f47c8e" },
  { name: "Ivory", color: "#e9ecf6" },
  { name: "Storm", color: "#7b8cff" },
];

function hash(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function fighterIndexFor(name: string): number {
  return hash(name) % FIGHTERS.length;
}

/** A rival's full look — fighter, palette style and aura, all from the name. */
export function rivalLook(name: string): {
  fighter: number;
  style: number;
  aura: number;
  tint: TintChoice;
} {
  const h = hash(name);
  return {
    fighter: h % FIGHTERS.length,
    style: (h >>> 3) % STYLES.length,
    aura: (h >>> 7) % AURAS.length,
    tint: {
      hair: (h >>> 10) % HAIR_TINTS.length,
      face: (h >>> 14) % FACE_TINTS.length,
      clothes: (h >>> 18) % CLOTH_TINTS.length,
    },
  };
}

export function fighterOf(index: number): Fighter {
  return FIGHTERS[((index % FIGHTERS.length) + FIGHTERS.length) % FIGHTERS.length]!;
}

function gradeFilter(style?: number, aura?: number): string {
  const grade = STYLES[(style ?? 0) % STYLES.length]!.filter;
  const glow = AURAS[(aura ?? 0) % AURAS.length]!.color;
  return `${grade} drop-shadow(0 0 6px ${glow}44)`.trim();
}

/** One playing sprite-sheet strip. Re-mounts (via key) to restart. */
function SheetAnim({
  sheet,
  box,
  scale,
  mirror,
  holdEnd,
  fighter,
  tint,
}: {
  sheet: Sheet;
  box: number;
  scale: number;
  mirror?: boolean;
  holdEnd?: boolean;
  fighter: number;
  tint?: TintChoice;
}) {
  const src = useTintedSrc(sheet.src, fighter, tint);
  const w = box * scale;
  const anim = `stripPlay ${sheet.dur}s steps(${sheet.frames}) ${
    sheet.loop ? "infinite" : `1 ${holdEnd ? "forwards" : ""}`
  }`;
  return (
    <div
      className="strip"
      style={
        {
          width: w,
          height: w,
          backgroundImage: `url(${src})`,
          backgroundSize: `${w * sheet.frames}px ${w}px`,
          transform: mirror ? "scaleX(-1)" : undefined,
          animation: anim,
          "--sheet-to": `${-w * sheet.frames}px`,
        } as React.CSSProperties
      }
    />
  );
}

/**
 * A fighter on stage. The wrapper's layout box is the CHARACTER's size
 * (feet at the wrapper bottom); the 200×200 frame box overflows invisibly
 * around it, so stage layout and choreography stay exact.
 */
export function FighterFig({
  fighter,
  height,
  anim = "idle",
  mirror,
  style: styleFx,
  aura,
  particles,
  tint,
  className,
}: {
  fighter: number;
  /** desired on-screen character height in px */
  height: number;
  anim?: FighterAnim;
  mirror?: boolean;
  style?: number;
  aura?: number;
  /** equipped trinket effect swirling around the fighter */
  particles?: string;
  /** hair / face / clothes recolour (recolor.ts) */
  tint?: TintChoice;
  className?: string;
}) {
  const f = fighterOf(fighter);
  const scale = height / f.char.h;
  const sheet = f.sheets[anim];
  // `mirror` means "face left on screen"; sheets drawn facing left invert it.
  const flip = f.facesLeft ? !mirror : !!mirror;
  const cx = flip ? f.box - f.char.cx : f.char.cx;
  return (
    <span
      className={`fighter-fig ${className ?? ""}`}
      style={
        {
          width: Math.round(f.char.w * scale),
          height: Math.round(f.char.h * scale),
          filter: gradeFilter(styleFx, aura),
          "--aura": AURAS[(aura ?? 0) % AURAS.length]!.color,
        } as React.CSSProperties
      }
    >
      <span
        className="fighter-frame"
        key={anim}
        style={{
          left: `calc(50% - ${Math.round(cx * scale)}px)`,
          bottom: -Math.round(f.char.groundOff * scale),
        }}
      >
        <SheetAnim sheet={sheet} box={f.box} scale={scale} mirror={flip} holdEnd={anim === "death"} fighter={fighter} tint={tint} />
      </span>
      {particles && <WeatherFx kind={particles} count={5} />}
    </span>
  );
}

/**
 * Ambient particle layer — used for arena weather (many, stage-wide) and
 * equipped trinket effects (few, around one fighter). Pure CSS.
 */
export function WeatherFx({ kind, count }: { kind: string; count: number }) {
  const items = Array.from({ length: count }, (_, i) => ({
    left: `${(i * 83 + 13) % 100}%`,
    delay: `${((i * 47) % 30) / 10}s`,
    dur: `${2.6 + ((i * 31) % 25) / 10}s`,
  }));
  return (
    <span className={`weather weather-${kind}`} aria-hidden>
      {items.map((s, i) => (
        <span key={i} className="wpart" style={{ left: s.left, animationDelay: s.delay, animationDuration: s.dur }} />
      ))}
    </span>
  );
}

/** Circular bust: a live mini idle loop framed in a ring. */
export function FighterBust({
  fighter,
  size,
  mirror,
  style: styleFx,
  tint,
}: {
  fighter: number;
  size: number;
  mirror?: boolean;
  style?: number;
  tint?: TintChoice;
}) {
  const f = fighterOf(fighter);
  const height = size * 0.82;
  return (
    <span className="hero-bust fighter-bust" style={{ width: size, height: size }} aria-hidden>
      <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: size * 0.06 }}>
        <FighterFig fighter={fighter} height={height} mirror={mirror} style={styleFx} tint={tint} />
      </span>
    </span>
  );
}

/** Floating energy motes for showcase stages (forge preview, home card). */
export function AuraSparks({ aura }: { aura?: number }) {
  const color = AURAS[(aura ?? 0) % AURAS.length]!.color;
  const sparks = [
    { left: "16%", delay: "0s", dur: "3.2s", size: 5 },
    { left: "30%", delay: "1.1s", dur: "4.1s", size: 4 },
    { left: "48%", delay: "0.4s", dur: "3.6s", size: 6 },
    { left: "63%", delay: "1.8s", dur: "3.1s", size: 4 },
    { left: "78%", delay: "0.8s", dur: "4.4s", size: 5 },
    { left: "88%", delay: "2.2s", dur: "3.8s", size: 3 },
  ];
  return (
    <span className="sparks" aria-hidden>
      {sparks.map((s, i) => (
        <span
          key={i}
          className="spark"
          style={{
            left: s.left,
            width: s.size,
            height: s.size,
            background: color,
            boxShadow: `0 0 ${s.size * 2}px ${color}`,
            animationDelay: s.delay,
            animationDuration: s.dur,
          }}
        />
      ))}
    </span>
  );
}
