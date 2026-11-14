/** The 13 gate clips. Lengths and contact times follow the timing table of the rules. */
import type { Clip, GateClip } from "../../contracts";
import { BACKPEDAL } from "./backpedal";
import { BRACE } from "./brace";
import { DASH } from "./dash";
import { DRAW } from "./draw";
import { ENTER } from "./enter";
import { EVADE } from "./evade";
import { FLICK } from "./flick";
import { HIT_LIGHT } from "./hit-light";
import { IDLE } from "./idle";
import { KO_FALL } from "./ko-fall";
import { PUNCH } from "./punch";
import { SWING } from "./swing";
import { WIN } from "./win";

export const GATE_CLIP_ART: Record<GateClip, Clip> = {
  idle: IDLE, enter: ENTER, dash: DASH, backpedal: BACKPEDAL, brace: BRACE, punch: PUNCH, flick: FLICK, swing: SWING,
  draw: DRAW, "hit-light": HIT_LIGHT, evade: EVADE, "ko-fall": KO_FALL, win: WIN,
};
