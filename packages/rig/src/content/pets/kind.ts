import type { Clip, CompanionClip, RigDef, Shape } from "../../contracts";

/** A pet's art: its rig, its shapes and its six clips. */
export interface PetArt { rig: RigDef; shapes: readonly Shape[]; clips: Record<CompanionClip, Clip>;
  /** Ink outline weight in the art's units (the engine multiplies it by the pet's scale). */
  line?: number }
