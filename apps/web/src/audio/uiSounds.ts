/**
 * The three app sounds the brief lists (ui-tap, card-flip, level-up), wired at the app root.
 * A press on any button plays ui-tap, or the sound its `data-sfx` attribute names (the level-up
 * cards say "card-flip"). The level-up screen opening plays level-up (see App.tsx). The fight
 * screen's own controls stay quiet: the fight has its own sounds.
 */
import type { AudioEngine } from "./engine";

/** The sounds a `data-sfx` attribute may name. */
export const UI_SOUNDS = ["ui-tap", "card-flip", "level-up"] as const;
export type UiSound = (typeof UI_SOUNDS)[number];

interface ClosestTarget { closest?(selector: string): { getAttribute(name: string): string | null } | null }

/** The sound a click on `target` makes, or null for none. */
export function uiSoundFor(target: unknown): UiSound | null {
  const t = target as ClosestTarget | null;
  if (!t || typeof t.closest !== "function") return null;
  if (t.closest("[data-sfx-quiet]")) return null;
  const el = t.closest("button, [role=button], [data-sfx]");
  if (!el) return null;
  const named = el.getAttribute("data-sfx");
  return named !== null && (UI_SOUNDS as readonly string[]).includes(named) ? (named as UiSound) : "ui-tap";
}

/** Plays the app sounds for clicks under `root`. Returns a remover. */
export function playUiSounds(engine: Pick<AudioEngine, "play">, root: Pick<EventTarget, "addEventListener" | "removeEventListener">): () => void {
  const on = (e: Event): void => {
    const s = uiSoundFor(e.target);
    if (s !== null) engine.play(s, 0);
  };
  root.addEventListener("click", on);
  return () => root.removeEventListener("click", on);
}
