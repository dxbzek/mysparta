/**
 * Turn the deterministic event log into narration lines.
 * Doubles as the screen-reader story (06-ui-ux.md: the event log IS the
 * accessible fight).
 */

import type { FightEvent, FightResult } from "@agoge/core";

export interface Line {
  t: number;
  side: 0 | 1 | -1;
  text: string;
  kind: "info" | "hit" | "crit" | "defend" | "trump" | "end";
  /** ms of theatre time this line holds the stage at 1× speed. */
  hold: number;
  hp?: [number, number];
}

export function narrate(result: FightResult, names: [string, string]): Line[] {
  const n = (s: 0 | 1) => names[s];
  const foe = (s: 0 | 1): 0 | 1 => (s === 0 ? 1 : 0);
  const lines: Line[] = [];
  const hp: [number, number] = [result.hpMax[0], result.hpMax[1]];

  for (const e of result.events) {
    const push = (
      side: 0 | 1 | -1,
      text: string,
      kind: Line["kind"],
      hold = 550,
    ) => lines.push({ t: e.t, side, text, kind, hold, hp: [hp[0], hp[1]] });

    switch (e.type) {
      case "start":
        push(-1, `The Herald raises a fist. Initiative: ${names[0]} ${e.init[0]} — ${names[1]} ${e.init[1]}.`, "info", 900);
        break;
      case "gambit": {
        const g = e.gambit.replace(/_/g, " ");
        push(e.side, `${n(e.side)} opens with ${g}.`, "info", 450);
        break;
      }
      case "attack":
        break; // the resolution line carries the beat
      case "miss":
        push(e.side, `${n(e.side)} swings wide!`, "defend", 700);
        break;
      case "evade":
        push(e.side, `${n(e.side)} slips the blow.`, "defend", 700);
        break;
      case "block":
        push(
          e.side,
          e.chip > 0 ? `${n(e.side)} blocks — ${e.chip} chips through.` : `${n(e.side)} blocks it cold.`,
          "defend",
          700,
        );
        if (e.chip > 0) hp[e.side] = Math.max(0, hp[e.side] - e.chip);
        break;
      case "hit": {
        if (e.target.kind === "champion") {
          hp[foe(e.side)] = Math.max(0, e.targetHp);
          const comboTag = e.combo > 0 ? ` (combo ×${e.combo + 1})` : "";
          push(
            e.side,
            e.crit
              ? `CRITICAL! ${n(e.side)} lands ${e.amount}${comboTag}!`
              : `${n(e.side)} strikes for ${e.amount}${comboTag}.`,
            e.crit ? "crit" : "hit",
            e.crit ? 1000 : 800,
          );
        } else {
          push(e.side, `${n(e.side)} strikes the beast for ${e.amount}.`, "hit", 650);
        }
        break;
      }
      case "counter":
        hp[foe(e.side)] = Math.max(0, e.targetHp);
        push(e.side, `COUNTER! ${n(e.side)}'s reach punishes the advance — ${e.amount}!`, "crit", 950);
        break;
      case "riposte":
        hp[foe(e.side)] = Math.max(0, e.targetHp);
        push(e.side, `Riposte! ${n(e.side)} answers for ${e.amount}.`, "hit", 850);
        break;
      case "disarm":
        push(e.side, `${n(e.side)}'s ${e.weapon} clatters across the marble!`, "trump", 900);
        break;
      case "draw":
        push(e.side, `${n(e.side)} draws ${e.weapon}.`, "info", 500);
        break;
      case "trump":
        push(e.side, `⚡ ${n(e.side)} unleashes their Trump — ${prettySkill(e.skill)}!`, "trump", 1100);
        break;
      case "technique":
        push(e.side, `${n(e.side)} — ${prettySkill(e.skill)}${e.amount ? ` (${e.amount})` : ""}.`, "trump", 750);
        break;
      case "heal":
        hp[e.side] = e.hp;
        push(e.side, `${n(e.side)} recovers ${e.amount} (${e.source}).`, "defend", 650);
        break;
      case "beastAttack":
        hp[foe(e.side)] = Math.max(0, e.targetHp);
        push(
          e.side,
          e.amount > 0 ? `${n(e.side)}'s ${e.beast} savages for ${e.amount}!` : `${n(e.side)}'s ${e.beast} lunges and misses.`,
          e.amount > 0 ? "hit" : "defend",
          700,
        );
        break;
      case "beastDown":
        push(e.side, `${n(e.side)}'s ${e.beast} falls, bursting into bronze dust.`, "trump", 850);
        break;
      case "status":
        push(e.side, `${n(e.side)}: ${e.what}.`, "info", 550);
        break;
      case "end": {
        const w = names[e.winner];
        push(
          -1,
          e.reason === "ko"
            ? `${w} stands alone. The Herald bellows their name!`
            : `The judges call it — ${w} takes it on vigour remaining.`,
          "end",
          1200,
        );
        break;
      }
    }
  }
  return lines;
}

function prettySkill(id: string): string {
  return id
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .replace("Brontes", "Bronte's")
    .replace("Gorgons", "Gorgon's")
    .replace("Hermes ", "Hermes' ")
    .replace("Moiras", "Moira's")
    .replace("Beasts Fury", "Beast's Fury");
}
