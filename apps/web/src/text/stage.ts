/**
 * Every word the stage paints on the canvas (fight-screen lane). The stage holds no player text.
 */
import type { MoveId, SkillId } from "@rankzero/core";
import type { StageText } from "@rankzero/stage";
import { NAMES } from "./names";

export const STAGE_TEXT: StageText = {
  fight: "FIGHT!",
  wins: (name: string) => `${name.toUpperCase()} WINS`,
  block: "BLOCK",
  miss: "MISS",
  crit: "CRIT",
  overtime: "OVERTIME",
  moveName: (id: MoveId) => NAMES[id].toUpperCase(),
  skillName: (id: SkillId) => NAMES[id].toUpperCase(),
};
