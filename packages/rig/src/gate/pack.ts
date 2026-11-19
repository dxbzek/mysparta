/**
 * The gate pack: everything the first integration (I1) draws with. Style 13, "gritty comic,
 * sodium streetlight". `createRig(gatePack)` is the rig of the gate.
 */
import type { GatePack } from "../contracts";
import { GATE_CLIP_ART } from "./clips";
import { GATE_FX } from "./fx";
import { GATE_ICONS } from "./icons";
import { GATE_LOOKS } from "./parts";
import { SCRAPPER_RIG } from "./skeleton";
import { FISTS } from "./weapons/fists";
import { PIPE } from "./weapons/pipe";
import { POCKET_KNIFE } from "./weapons/pocket-knife";
import { drawYard } from "./yard";

export const gatePack: GatePack = {
  scrapper: SCRAPPER_RIG,
  clips: GATE_CLIP_ART,
  weapons: { fists: FISTS, pipe: PIPE, "pocket-knife": POCKET_KNIFE },
  looks: GATE_LOOKS,
  stages: { yard: drawYard },
  fx: GATE_FX,
  icons: GATE_ICONS,
};

export { palette } from "./style";
