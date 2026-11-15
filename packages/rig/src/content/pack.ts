/**
 * The content pack (WP6): everything the gate pack does not draw. `createRig(gatePack, contentPack)`.
 *
 * Static batch (this commit): every weapon outside the gate, the six shields, the three Move
 * props, the four other arenas, the six pets (rig, shapes, idle), the six content effects and
 * every skill and content UI icon.
 *
 * Stand-ins until the animation pass (said here so nobody ships them by mistake):
 *  - clips: the 11 content clips are the gate clips the contract's `CLIP_FALLBACK` names (smash
 *    plays swing, thrust plays flick, ...), except `throw`, which is the rig lane's `THROW` clip
 *    handed to WP6. Their timeline therefore differs from the timing table for smash (280 / 150,
 *    not 380 / 240), as the contract's fallback rule says;
 *  - companion clips other than idle hold the idle pose for the placeholder timeline;
 *  - looks: the gate's two looks (every list wraps), not yet the LOOK_SPACE counts (batch 6a).
 */
import type { ContentPack } from "../contracts";
import { GATE_LOOKS } from "../gate/parts";
import { CONTENT_CLIPS } from "./clips";
import { USES, VARIANTS } from "./clips/use";
import { CONTENT_FX, PROPS } from "./fx";
import { CONTENT_UI_ICONS, SKILL_ICONS } from "./icons";
import { PET_ART } from "./pets";
import { SHIELD_ART } from "./shields";
import { CONTENT_STAGES } from "./stages";
import { CONTENT_WEAPONS } from "./weapons";

export const contentPack: ContentPack = {
  clips: CONTENT_CLIPS,
  variants: VARIANTS,
  uses: USES,
  weapons: CONTENT_WEAPONS,
  shields: SHIELD_ART,
  props: PROPS,
  stages: CONTENT_STAGES,
  looks: GATE_LOOKS,
  companions: PET_ART,
  fx: CONTENT_FX,
  icons: { ...SKILL_ICONS, ...CONTENT_UI_ICONS },
};
