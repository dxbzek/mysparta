/**
 * Turn the deterministic event log into narration lines + stage choreography.
 * Each line carries: the caption, HP snapshot, damage-number effects (fx),
 * and animation directions (anim) — who runs in, who dodges, what flies.
 * The text doubles as the screen-reader fight (06-ui-ux.md).
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
  /** Damage/heal number shown over a champion. */
  fx?: { target: 0 | 1; amount: number; crit?: boolean; heal?: boolean };
  /** Stage directions. */
  anim?: {
    /** Which champion runs in / attacks this beat. */
    striker?: 0 | 1;
    /** Projectile beat instead of a run (thrown weapons). */
    thrown?: boolean;
    /** Defender's response animation. */
    reaction?: { side: 0 | 1; kind: "hurt" | "dodge" | "block" };
    /** A word floater when no number applies ("Miss!", "Blocked!"). */
    label?: { side: 0 | 1; text: string };
    /** Acting beast's display name (beast attack beats). */
    beastName?: string;
  };
  /** A beast on `side` was felled this beat. */
  beastDown?: { side: 0 | 1; beast: string };
  /** `side` drew a new weapon (display name) this beat. */
  drew?: { side: 0 | 1; weapon: string };
}

export function narrate(result: FightResult, names: [string, string]): Line[] {
  const n = (s: 0 | 1) => names[s];
  const foe = (s: 0 | 1): 0 | 1 => (s === 0 ? 1 : 0);
  const lines: Line[] = [];
  const hp: [number, number] = [result.hpMax[0], result.hpMax[1]];
  /** The most recent attack event, consumed by its resolution line. */
  let pending: { side: 0 | 1; thrown: boolean } | null = null;

  for (const e of result.events) {
    const push = (
      side: 0 | 1 | -1,
      text: string,
      kind: Line["kind"],
      hold = 550,
      extra?: Partial<Pick<Line, "fx" | "anim" | "beastDown" | "drew">>,
    ) => lines.push({ t: e.t, side, text, kind, hold, hp: [hp[0], hp[1]], ...extra });

    switch (e.type) {
      case "start":
        push(-1, `The bell rings! ${names[0]} and ${names[1]} enter the arena!`, "info", 1100);
        break;
      case "gambit": {
        const g = e.gambit.replace(/_/g, " ");
        push(e.side, `${n(e.side)} opens with ${g}.`, "info", 450);
        break;
      }
      case "attack":
        pending = { side: e.side, thrown: !!e.thrown };
        break;
      case "miss": {
        const p = pending; pending = null;
        push(e.side, `${n(e.side)} swings wide!`, "defend", 750, {
          anim: {
            striker: e.side,
            thrown: p?.thrown,
            reaction: { side: foe(e.side), kind: "dodge" },
            label: { side: foe(e.side), text: "Miss!" },
          },
        });
        break;
      }
      case "evade": {
        const p = pending; pending = null;
        push(e.side, `${n(e.side)} slips the blow!`, "defend", 750, {
          anim: {
            striker: foe(e.side),
            thrown: p?.thrown,
            reaction: { side: e.side, kind: "dodge" },
            label: { side: e.side, text: "Dodged!" },
          },
        });
        break;
      }
      case "block": {
        const p = pending; pending = null;
        if (e.chip > 0) hp[e.side] = Math.max(0, hp[e.side] - e.chip);
        push(
          e.side,
          e.chip > 0 ? `${n(e.side)} blocks — ${e.chip} chips through.` : `${n(e.side)} blocks it cold.`,
          "defend",
          750,
          {
            fx: e.chip > 0 ? { target: e.side, amount: e.chip } : undefined,
            anim: {
              striker: foe(e.side),
              thrown: p?.thrown,
              reaction: { side: e.side, kind: "block" },
              label: e.chip > 0 ? undefined : { side: e.side, text: "Blocked!" },
            },
          },
        );
        break;
      }
      case "hit": {
        const p = pending; pending = null;
        if (e.target.kind === "champion") {
          hp[foe(e.side)] = Math.max(0, e.targetHp);
          const comboTag = e.combo > 0 ? ` (combo ×${e.combo + 1})` : "";
          push(
            e.side,
            e.crit
              ? `CRITICAL! ${n(e.side)} lands ${e.amount}${comboTag}!`
              : `${n(e.side)} strikes for ${e.amount}${comboTag}.`,
            e.crit ? "crit" : "hit",
            e.crit ? 1000 : 820,
            {
              fx: { target: foe(e.side), amount: e.amount, crit: e.crit },
              anim: {
                striker: e.combo > 0 ? undefined : e.side, // chained hits stay in close
                thrown: p?.thrown,
                reaction: { side: foe(e.side), kind: "hurt" },
              },
            },
          );
        } else {
          push(e.side, `${n(e.side)} strikes the beast for ${e.amount}.`, "hit", 680, {
            anim: { striker: e.side, thrown: p?.thrown },
          });
        }
        break;
      }
      case "counter":
        hp[foe(e.side)] = Math.max(0, e.targetHp);
        push(e.side, `COUNTER! ${n(e.side)}'s reach punishes the advance — ${e.amount}!`, "crit", 950, {
          fx: { target: foe(e.side), amount: e.amount, crit: true },
          anim: { striker: e.side, reaction: { side: foe(e.side), kind: "hurt" } },
        });
        break;
      case "riposte":
        hp[foe(e.side)] = Math.max(0, e.targetHp);
        push(e.side, `Riposte! ${n(e.side)} answers for ${e.amount}.`, "hit", 850, {
          fx: { target: foe(e.side), amount: e.amount },
          anim: { striker: e.side, reaction: { side: foe(e.side), kind: "hurt" } },
        });
        break;
      case "disarm":
        push(e.side, `${n(e.side)}'s ${e.weapon} clatters across the arena floor!`, "trump", 900, {
          anim: { label: { side: e.side, text: "Disarmed!" } },
        });
        break;
      case "draw":
        push(e.side, `${n(e.side)} draws ${e.weapon}.`, "info", 500, {
          drew: { side: e.side, weapon: e.weapon },
        });
        break;
      case "trump":
        push(e.side, `⚡ ${n(e.side)} unleashes ${prettySkill(e.skill)}!`, "trump", 1100, {
          anim: { label: { side: e.side, text: prettySkill(e.skill) } },
        });
        break;
      case "technique":
        push(
          e.side,
          `${n(e.side)} — ${prettySkill(e.skill)}${e.amount ? ` (${e.amount})` : ""}.`,
          "trump",
          780,
          e.amount
            ? {
                fx: { target: foe(e.side), amount: e.amount },
                anim: { striker: e.side, reaction: { side: foe(e.side), kind: "hurt" } },
              }
            : { anim: { label: { side: e.side, text: prettySkill(e.skill) } } },
        );
        break;
      case "heal":
        hp[e.side] = e.hp;
        push(e.side, `${n(e.side)} recovers ${e.amount} (${e.source}).`, "defend", 650, {
          fx: { target: e.side, amount: e.amount, heal: true },
        });
        break;
      case "beastAttack":
        if (e.amount > 0) {
          hp[foe(e.side)] = Math.max(0, e.targetHp);
          push(e.side, `${n(e.side)}'s ${e.beast} savages for ${e.amount}!`, "hit", 720, {
            fx: { target: foe(e.side), amount: e.amount },
            anim: { beastName: e.beast, striker: e.side, reaction: { side: foe(e.side), kind: "hurt" } },
          });
        } else {
          push(e.side, `${n(e.side)}'s ${e.beast} lunges and misses.`, "defend", 650, {
            anim: {
              beastName: e.beast,
              striker: e.side,
              reaction: { side: foe(e.side), kind: "dodge" },
              label: { side: foe(e.side), text: "Miss!" },
            },
          });
        }
        break;
      case "beastDown":
        push(e.side, `${n(e.side)}'s ${e.beast} falls, vanishing in a burst of light.`, "trump", 850, {
          beastDown: { side: e.side, beast: e.beast },
        });
        break;
      case "status":
        push(e.side, `${n(e.side)}: ${e.what}.`, "info", 550);
        break;
      case "end": {
        const w = names[e.winner];
        push(
          -1,
          e.reason === "ko"
            ? `${w} stands alone. The crowd roars their name!`
            : `The judges call it — ${w} wins on stamina.`,
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
