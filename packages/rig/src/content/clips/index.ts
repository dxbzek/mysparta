/** The content clips: the Move pass (calm fight, 15 Nov 2026) drew drink, power-up, slam,
 *  slammed and snared; the animation pass (16 Nov 2026) drew the rest, so no content clip plays
 *  a gate stand-in any more. `throw` is the rig lane's overarm clip. The per-weapon variants are
 *  in `use.ts`. */
import type { Clip, ContentClip } from "../../contracts";
import { THROW } from "../../gate/clips/throw";
import { DRINK } from "./drink";
import { POWER_UP } from "./power-up";
import { BLOCK, BLOCK_SHIELD, HIT_HEAVY } from "./reactions";
import { SLAM } from "./slam";
import { SLAMMED } from "./slammed";
import { SMASH } from "./smash";
import { SNARED } from "./snared";
import { THRUST } from "./thrust";

export const CONTENT_CLIPS: Record<ContentClip, Clip> = {
  drink: DRINK, "power-up": POWER_UP, slam: SLAM, slammed: SLAMMED, snared: SNARED,
  smash: SMASH, thrust: THRUST, throw: THROW, "hit-heavy": HIT_HEAVY, block: BLOCK, "block-shield": BLOCK_SHIELD,
};
