/**
 * Reduced motion from the setting ("auto" follows the device). Its own module so the first screen
 * (Create, the app shell) reads it without pulling in the fight screen and the stage, which load
 * as their own chunk.
 */
import type { Settings } from "../contracts";

export function reducedFrom(setting: Settings["reducedMotion"]): boolean {
  if (setting === "on") return true;
  if (setting === "off") return false;
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
