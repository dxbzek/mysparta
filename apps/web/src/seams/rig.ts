/**
 * SEAM FILE (work package 0). Only the Lead edits it, at integration points.
 * The one place where the app gets its rig. Screens and the fight screen import `rig` from
 * here and never from a rig package directly.
 *   G0: the capsule test double.
 *   I1 (now): createRig(gatePack).
 *   I3: createRig(gatePack, contentPack).
 */
import type { Rig } from "@rankzero/rig";
import { createRig, gatePack } from "@rankzero/rig";

export const rig: Rig = createRig(gatePack);
