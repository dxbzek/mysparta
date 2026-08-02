/**
 * Fighter rendering — modular paper-doll characters on real sprite sheets.
 *
 * The look itself (which head, hair, outfit, colours) lives in paperdoll.ts;
 * this file turns a Look into something on screen. Playback stays pure CSS:
 * background-position stepped across the composited strip with steps(N), so
 * there is no per-frame JavaScript.
 */

import { useEffect, useState } from "react";
import {
  ANIMS,
  CHAR,
  DEFAULT_LOOK,
  FRAME,
  STRIP_FRAMES,
  lookStrip,
  cachedStrip,
  weaponStrip,
  normaliseLook,
  randomLook,
  type Anim,
  type Look,
  type WeaponArt,
} from "./paperdoll.js";

export type FighterAnim = Anim;

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

/** Deterministic PRNG so a given name always produces the same hunter. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The hunter a name awakens as, before the player customises anything. */
export function lookFor(name: string): Look {
  return randomLook(seeded(hash(name)));
}

/** A rival's full look and aura, all derived from their name. */
export function rivalLook(name: string): { look: Look; aura: number } {
  const h = hash(name);
  return { look: lookFor(name), aura: (h >>> 7) % AURAS.length };
}

/** Resolve a look's composited strip, rendering the default until it's ready. */
function useLookStrip(look: Look | undefined): string | undefined {
  const l = look ?? DEFAULT_LOOK;
  const [url, setUrl] = useState<string | undefined>(() => cachedStrip(l));
  useEffect(() => {
    let live = true;
    const cached = cachedStrip(l);
    if (cached) {
      setUrl(cached);
      return;
    }
    lookStrip(l).then(
      (u) => {
        if (live) setUrl(u);
      },
      () => {
        /* canvas unavailable — the figure simply stays blank */
      },
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(normaliseLook(l))]);
  return url;
}

/**
 * A fighter on stage. The wrapper's layout box is the CHARACTER's size (feet
 * at the wrapper bottom); the 64px frame box overflows invisibly around it,
 * so stage layout and choreography stay exact.
 */
export function FighterFig({
  look,
  height,
  anim = "idle",
  mirror,
  aura,
  particles,
  weapon,
  className,
}: {
  look?: Look;
  /** desired on-screen character height in px */
  height: number;
  anim?: Anim;
  mirror?: boolean;
  aura?: number;
  /** equipped trinket effect swirling around the fighter */
  particles?: string;
  /** weapon drawn in hand, animated on the same frames as the body */
  weapon?: WeaponArt;
  className?: string;
}) {
  const src = useLookStrip(look);
  const scale = height / CHAR.h;
  const a = ANIMS[anim];
  const w = FRAME * scale;
  const glow = AURAS[(aura ?? 0) % AURAS.length]!.color;
  // A looping strip may step onto the frame past its last one — it wraps
  // straight back to the start. A one-shot must stop ON its last frame and
  // hold there, so it steps one fewer time and ends a frame earlier.
  const steps = a.loop ? a.count : Math.max(1, a.count - 1);
  const lastFrame = a.from + (a.loop ? a.count : a.count - 1);
  return (
    <span
      className={`fighter-fig ${className ?? ""}`}
      style={
        {
          width: Math.round(CHAR.w * scale),
          height: Math.round(CHAR.h * scale),
          filter: `drop-shadow(0 0 6px ${glow}44)`,
          "--aura": glow,
        } as React.CSSProperties
      }
    >
      <span
        className="fighter-frame"
        key={anim}
        style={{
          left: `calc(50% - ${Math.round(CHAR.cx * scale)}px)`,
          bottom: -Math.round(CHAR.groundOff * scale),
        }}
      >
        <span
          className="strip"
          style={
            {
              width: w,
              height: w,
              backgroundImage: src ? `url(${src})` : undefined,
              backgroundSize: `${w * STRIP_FRAMES}px ${w}px`,
              transform: mirror ? "scaleX(-1)" : undefined,
              animation: `stripPlay ${a.dur}s steps(${steps}) ${
                a.loop ? "infinite" : "1 forwards"
              }`,
              "--strip-from": `${-a.from * w}px`,
              "--strip-to": `${-lastFrame * w}px`,
            } as React.CSSProperties
          }
        />
        {weapon && (
          <span
            className="strip weapon-strip"
            style={
              {
                width: w,
                height: w,
                backgroundImage: `url(${weaponStrip(weapon)})`,
                backgroundSize: `${w * STRIP_FRAMES}px ${w}px`,
                transform: mirror ? "scaleX(-1)" : undefined,
                animation: `stripPlay ${a.dur}s steps(${steps}) ${
                  a.loop ? "infinite" : "1 forwards"
                }`,
                "--strip-from": `${-a.from * w}px`,
                "--strip-to": `${-lastFrame * w}px`,
              } as React.CSSProperties
            }
          />
        )}
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
  look,
  size,
  mirror,
}: {
  look?: Look;
  size: number;
  mirror?: boolean;
}) {
  return (
    <span className="hero-bust fighter-bust" style={{ width: size, height: size }} aria-hidden>
      <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: size * 0.06 }}>
        <FighterFig look={look} height={size * 0.82} mirror={mirror} />
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
