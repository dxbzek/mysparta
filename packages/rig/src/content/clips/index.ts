/** The content clips drawn by the Move pass (calm fight, 15 Nov 2026). The others still play the
 *  gate clip `CLIP_FALLBACK` names until the animation pass draws them. */
import type { Clip, ContentClip } from "../../contracts";
import { DRINK } from "./drink";
import { POWER_UP } from "./power-up";
import { SLAM } from "./slam";
import { SLAMMED } from "./slammed";
import { SNARED } from "./snared";

export const CONTENT_CLIPS: Partial<Record<ContentClip, Clip>> = {
  drink: DRINK, "power-up": POWER_UP, slam: SLAM, slammed: SLAMMED, snared: SNARED,
};
