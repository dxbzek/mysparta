import type { Clip, CompanionClip, RigDef, Shape } from "../../contracts";

/** A pet's art: its rig, its shapes and its six clips. */
export interface PetArt { rig: RigDef; shapes: readonly Shape[]; clips: Record<CompanionClip, Clip> }
