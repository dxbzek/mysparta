/**
 * Small motion helpers for the app screens. Every animation in this lane is CSS under
 * `html[data-motion="full"]` (set by App from the reduced-motion setting); the one JS effect is
 * the count-up below, which runs in an effect, never in render, and is off under reduced motion.
 */
import { useEffect, useLayoutEffect, useState } from "react";

/** True when the app runs with full motion (App sets `data-motion` on <html>). */
export function motionOn(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.motion === "full";
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * A number that counts up from 0 to `target` after `delayMs`, over `durMs`, with an ease-out.
 * The first render (and server render, and reduced motion, and `run: false`) shows `target`.
 */
export function useCountUp(target: number, delayMs: number, durMs: number, run = true): number {
  const [v, setV] = useState(target);
  useIsoLayoutEffect(() => {
    if (!run || !motionOn() || typeof requestAnimationFrame !== "function") {
      setV(target);
      return undefined;
    }
    setV(0);
    let id = 0;
    let start = -1;
    const step = (now: number): void => {
      if (start < 0) start = now;
      const u = Math.min(1, Math.max(0, (now - start - delayMs) / durMs));
      setV(Math.round(target * (1 - (1 - u) ** 3)));
      if (u < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [target, delayMs, durMs, run]);
  return v;
}

/** True on a short phone (667 px tall or less), where screens tighten to keep the action in view. */
export function useShortScreen(): boolean {
  const q = "(max-height: 700px)";
  const [short, setShort] = useState(() => typeof matchMedia === "function" && matchMedia(q).matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return undefined;
    const m = matchMedia(q);
    const on = (): void => setShort(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return short;
}
