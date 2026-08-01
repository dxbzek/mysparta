/**
 * The awakened-hunter roster — real painted anime sprites (generated art,
 * keyed and trimmed). A champion picks a form at awakening; rivals derive
 * theirs from their name so the same rival always looks the same.
 */

import bladeImg from "./assets/hunter-blade.webp";
import spearImg from "./assets/hunter-spear.webp";
import fistImg from "./assets/hunter-fist.webp";
import axeImg from "./assets/hunter-axe.webp";
import throwImg from "./assets/hunter-throw.webp";
import guardImg from "./assets/hunter-guard.webp";
import arenaBgImg from "./assets/arena-bg.webp";

export { arenaBgImg };

export interface Hero {
  name: string;
  role: string;
  blurb: string;
  img: string;
  /** trimmed sprite width ÷ height — used to size stage slots */
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
    aspect: 0.96,
    bust: { scale: 2.4, y: 0.06, x: 0.08 },
  },
  {
    name: "Storm Lancer",
    role: "Spear vanguard",
    blurb: "Keeps every foe at the tip of a golden spear.",
    img: spearImg,
    aspect: 0.97,
    bust: { scale: 2.4, y: 0.05, x: 0 },
  },
  {
    name: "Iron Fist",
    role: "Gauntlet brawler",
    blurb: "No weapon, no problem. The gauntlets hum when he smiles.",
    img: fistImg,
    aspect: 0.6,
    bust: { scale: 2.9, y: 0.06, x: 0.02 },
  },
  {
    name: "Doombreaker",
    role: "Greataxe colossus",
    blurb: "Carries a Rift-forged axe most hunters can't lift.",
    img: axeImg,
    aspect: 0.76,
    bust: { scale: 2.3, y: 0.05, x: -0.05 },
  },
  {
    name: "Phantom Edge",
    role: "Knife thrower",
    blurb: "You'll hear the knives before you ever see her move.",
    img: throwImg,
    aspect: 0.62,
    bust: { scale: 2.2, y: 0.05, x: 0.02 },
  },
  {
    name: "Aegis Knight",
    role: "Sword & shield",
    blurb: "The wall the front line hides behind — shield first, always.",
    img: guardImg,
    aspect: 1.22,
    bust: { scale: 2.6, y: 0.08, x: 0.1 },
  },
];

/** Stable hero index for any name (rivals, and the pre-pick default). */
export function heroIndexFor(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % HEROES.length;
}

export function heroOf(index: number): Hero {
  return HEROES[((index % HEROES.length) + HEROES.length) % HEROES.length]!;
}

/** Full-body sprite. */
export function HeroSprite({
  hero,
  height,
  mirror,
  className,
}: {
  hero: number;
  height: number;
  mirror?: boolean;
  className?: string;
}) {
  const h = heroOf(hero);
  return (
    <img
      className={`hero-sprite ${className ?? ""}`}
      src={h.img}
      alt={h.name}
      style={{ height, transform: mirror ? "scaleX(-1)" : undefined }}
      draggable={false}
    />
  );
}

/** Circular head-and-shoulders crop for cards and lists. */
export function HeroBust({
  hero,
  size,
  mirror,
}: {
  hero: number;
  size: number;
  mirror?: boolean;
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
          transform: `translateX(calc(-50% + ${Math.round(size * h.bust.x * (mirror ? -1 : 1))}px)) ${mirror ? "scaleX(-1)" : ""}`,
        }}
        draggable={false}
      />
    </span>
  );
}
