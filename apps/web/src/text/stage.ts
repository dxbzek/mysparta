/**
 * Every word the stage paints on the canvas (fight-screen lane). The stage holds no player text.
 */
import type { MoveId, ProcId } from "@rankzero/core";
import type { StageText } from "@rankzero/stage";
import { moveResult } from "./moves";
import { NAMES } from "./names";

export const STAGE_TEXT: StageText = {
  fight: "FIGHT!",
  wins: (name: string) => `${name.toUpperCase()} WINS`,
  block: "BLOCK",
  miss: "MISS",
  crit: "CRIT",
  overtime: "OVERTIME",
  moveName: (id: MoveId) => NAMES[id].toUpperCase(),
  skillName: (id: ProcId) => NAMES[id].toUpperCase(),          // a skill, or the shield that blocked
  moveResult: (id: MoveId, part?: "pet") => moveResult(id, part).toUpperCase(),
};
