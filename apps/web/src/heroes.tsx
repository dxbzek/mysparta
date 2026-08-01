/**
 * The awakened-hunter roster — real painted anime sprites (generated art,
 * keyed and trimmed), each with idle / attack / hurt poses. A champion picks
 * a form, a style tint and an aura colour at awakening; rivals derive theirs
 * from their name so the same rival always looks the same.
 */

import bladeImg from "./assets/hunter-blade.webp";
import bladeAtk from "./assets/hunter-blade-atk.webp";
import bladeHurt from "./assets/hunter-blade-hurt.webp";
import spearImg from "./assets/hunter-spear.webp";
import spearAtk from "./assets/hunter-spear-atk.webp";
import spearHurt from "./assets/hunter-spear-hurt.webp";
import fistImg from "./assets/hunter-fist.webp";
import fistAtk from "./assets/hunter-fist-atk.webp";
import fistHurt from "./assets/hunter-fist-hurt.webp";
import axeImg from "./assets/hunter-axe.webp";
import axeAtk from "./assets/hunter-axe-atk.webp";
import axeHurt from "./assets/hunter-axe-hurt.webp";
import throwImg from "./assets/hunter-throw.webp";
import throwAtk from "./assets/hunter-throw-atk.webp";
import throwHurt from "./assets/hunter-throw-hurt.webp";
import guardImg from "./assets/hunter-guard.webp";
import guardAtk from "./assets/hunter-guard-atk.webp";
import guardHurt from "./assets/hunter-guard-hurt.webp";
import arenaBgImg from "./assets/arena-bg.webp";

export { arenaBgImg };

export type Pose = "idle" | "attack" | "hurt";

export interface Hero {
  name: string;
  role: string;
  blurb: string;
  img: string;
  atk: string;
  hurt: string;
  /** trimmed idle sprite width ÷ height — used to size stage slots */
  aspect: number;
  /** bust-crop tuning: sprite height in bust-diameters, and head offset */
  bust: { scale: number; y: number; x: number };
}

export const HEROES: Hero[] = [
  {
    name: "Riftblade",
    role: "Katana duelist",
    blurb: "Calm eyes, violet edge. Ends fights in one clean line.",
    img: bladeImg,
    atk: bladeAtk,
    hurt: bladeHurt,
    aspect: 0.96,
    bust: { scale: 2.4, y: 0.06, x: 0.08 },
  },
  {
    name: "Storm Lancer",
    role: "Spear vanguard",
    blurb: "Keeps every foe at the tip of a golden spear.",
    img: spearImg,
    atk: spearAtk,
    hurt: spearHurt,
    aspect: 0.97,
    bust: { scale: 2.4, y: 0.05, x: 0 },
  },
  {
    name: "Iron Fist",
    role: "Gauntlet brawler",
    blurb: "No weapon, no problem. The gauntlets hum when he smiles.",
    img: fistImg,
    atk: fistAtk,
    hurt: fistHurt,
    aspect: 0.6,
    bust: { scale: 2.9, y: 0.06, x: 0.02 },
  },
  {
    name: "Doombreaker",
    role: "Greataxe colossus",
    blurb: "Carries a Rift-forged axe most hunters can't lift.",
    img: axeImg,
    atk: axeAtk,
    hurt: axeHurt,
    aspect: 0.76,
    bust: { scale: 2.3, y: 0.05, x: -0.05 },
  },
  {
    name: "Phantom Edge",
    role: "Knife thrower",
    blurb: "You'll hear the knives before you ever see her move.",
    img: throwImg,
    atk: throwAtk,
    hurt: throwHurt,
    aspect: 0.62,
    bust: { scale: 2.2, y: 0.05, x: 0.02 },
  },
  {
    name: "Aegis Knight",
    role: "Sword & shield",
    blurb: "The wall the front line hides behind — shield first, always.",
    img: guardImg,
    atk: guardAtk,
    hurt: guardHurt,
    aspect: 1.22,
    bust: { scale: 2.6, y: 0.08, x: 0.1 },
  },
];

/** Colour-grade presets — kept subtle so skin tones stay believable. */
export const STYLES = [
  { name: "Default", filter: "" },
  { name: "Ember", filter: "sepia(0.22) saturate(1.45) hue-rotate(-10deg) contrast(1.05)" },
  { name: "Frost", filter: "saturate(0.92) hue-rotate(14deg) brightness(1.07)" },
  { name: "Void", filter: "saturate(1.25) contrast(1.16) brightness(0.86)" },
  { name: "Radiant", filter: "saturate(1.25) brightness(1.12) contrast(1.03)" },
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

/** Stable hero index for any name (rivals, and the pre-pick default). */
export function heroIndexFor(name: string): number {
  return hash(name) % HEROES.length;
}

/** A rival's full look — form, style tint and aura, all from the name. */
export function rivalLook(name: string): { hero: number; style: number; aura: number } {
  const h = hash(name);
  return {
    hero: h % HEROES.length,
    style: (h >>> 3) % STYLES.length,
    aura: (h >>> 7) % AURAS.length,
  };
}

export function heroOf(index: number): Hero {
  return HEROES[((index % HEROES.length) + HEROES.length) % HEROES.length]!;
}

function composedFilter(style?: number, aura?: number): string {
  const grade = STYLES[(style ?? 0) % STYLES.length]!.filter;
  const glow = AURAS[(aura ?? 0) % AURAS.length]!.color;
  return `${grade} drop-shadow(0 10px 10px rgba(0,0,0,0.5)) drop-shadow(0 0 12px ${glow}55)`.trim();
}

/**
 * Full-body sprite with pose + customization. The wrapper carries the
 * always-on breathing animation (transforms), the img carries pose art and
 * colour filters — keeping them on separate elements means breathing never
 * fights the theatre's flash/glow filter animations.
 */
export function HeroSprite({
  hero,
  height,
  mirror,
  pose = "idle",
  style: styleFx,
  aura,
  className,
}: {
  hero: number;
  height: number;
  mirror?: boolean;
  pose?: Pose;
  style?: number;
  aura?: number;
  className?: string;
}) {
  const h = heroOf(hero);
  const src = pose === "attack" ? h.atk : pose === "hurt" ? h.hurt : h.img;
  return (
    <span
      className={`hero-anim ${pose === "idle" ? "breathe" : ""} ${className ?? ""}`}
      style={{ "--aura": AURAS[(aura ?? 0) % AURAS.length]!.color } as React.CSSProperties}
    >
      <img
        className="hero-sprite"
        src={src}
        alt={h.name}
        style={{
          height,
          transform: mirror ? "scaleX(-1)" : undefined,
          filter: composedFilter(styleFx, aura),
        }}
        draggable={false}
      />
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

/** Circular head-and-shoulders crop for cards and lists. */
export function HeroBust({
  hero,
  size,
  mirror,
  style: styleFx,
}: {
  hero: number;
  size: number;
  mirror?: boolean;
  style?: number;
}) {
  const h = heroOf(hero);
  const imgH = size * h.bust.scale;
  return (
    <span className="hero-bust" style={{ width: size, height: size }} aria-hidden>
      <img
        src={h.img}
        alt=""
        style={{
          height: imgH,
          top: -imgH * h.bust.y,
          filter: STYLES[(styleFx ?? 0) % STYLES.length]!.filter || undefined,
          transform: `translateX(calc(-50% + ${Math.round(size * h.bust.x * (mirror ? -1 : 1))}px)) ${mirror ? "scaleX(-1)" : ""}`,
        }}
        draggable={false}
      />
    </span>
  );
}
