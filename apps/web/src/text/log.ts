/**
 * The live text log (fight-screen lane): one plain sentence per step, the full account of the
 * bout in words (brief 3.15). Never names a sim unit: no clock, no turn order, no chances.
 * A `never` check fails the compiler when a step type is added and not written here.
 */
import type { ActorId, BoutInit, CompanionId, FighterSnapshot, HeldId, Step } from "@rankzero/core";
import { NAMES } from "./names";

export type ActorNames = Partial<Record<ActorId, string>>;

/** "Cuff", "Cuff's Raccoon", "Cuff's second Raccoon". */
export function actorNames(init: BoutInit, a: FighterSnapshot, b: FighterSnapshot): ActorNames {
  const out: ActorNames = {};
  const seen: Record<string, number> = {};
  for (const actor of init.actors) {
    const owner = actor.id.startsWith("a") ? a.name : b.name;
    if (actor.kind === "scrapper") {
      out[actor.id] = owner;
      continue;
    }
    const key = `${actor.id[0]}:${actor.kind}`;
    seen[key] = (seen[key] ?? 0) + 1;
    const pet = NAMES[actor.kind as CompanionId];
    out[actor.id] = seen[key] > 1 ? `${owner}'s second ${pet}` : `${owner}'s ${pet}`;
  }
  return out;
}

const item = (id: HeldId | null): string => (id === null || id === "fists" ? "bare fists" : `the ${NAMES[id]}`);
const lower = (id: HeldId): string => (id === "fists" ? "fists" : NAMES[id]);
const hp = (n: number): string => `${n} HP`;

/** One sentence for one step. `names` maps actor ids to display names. */
export function logLine(step: Step, names: ActorNames): string {
  const n = (id: ActorId | null | undefined): string => (id ? (names[id] ?? "Someone") : "Someone");
  switch (step.t) {
    case "enter":
      return `${n(step.actor)} steps into the Yard.`;
    case "draw":
      return `${n(step.actor)} pulls out ${item(step.weapon)}.`;
    case "swap":
      return `${n(step.actor)} drops ${item(step.dropped)} and grabs ${item(step.weapon)}.`;
    case "move": {
      const name = NAMES[step.move];
      if (step.hits && step.hits.length > 0) {
        const hits = step.hits.map((h) => `${n(h.target)} takes ${h.damage} (${hp(h.hpAfter)} left)`).join(", ");
        return `${n(step.actor)} uses ${name}: ${hits}.`;
      }
      if (step.move === "snatch") {
        return step.taken
          ? `${n(step.actor)} snatches ${item(step.taken)} from ${n(step.target)}.`
          : `${n(step.actor)} tries to snatch from ${n(step.target)}, who holds on.`;
      }
      if (step.target) return `${n(step.actor)} uses ${name} on ${n(step.target)}.`;
      return `${n(step.actor)} uses ${name}.`;
    }
    case "attack":
    case "intercept":
    case "riposte":
    case "throw": {
      const who = n(step.actor);
      const target = n(step.target);
      const tool = step.weapon === null ? "" : step.weapon === "fists" ? "" : ` with the ${lower(step.weapon)}`;
      const lead = step.t === "intercept" ? `${who} cuts ${target} off` : step.t === "riposte" ? `${who} hits back at ${target}` : step.t === "throw" ? `${who} throws ${item(step.weapon)} at ${target}` : `${who} goes for ${target}${tool}`;
      const again = (step.t === "attack" || step.t === "throw") && step.why === "combo" ? " again" : "";
      const stubborn = step.t === "attack" && step.why === "stubborn" ? " and refuses to quit" : "";
      const big = step.t === "attack" && step.boosted ? " with everything they have" : "";
      const opener = `${lead}${again}${stubborn}${big}`;
      if (step.outcome === "evade") return `${opener}, but ${target} dodges.`;
      if (step.outcome === "block") return `${opener}, but ${target} blocks it.`;
      const crit = step.crit ? " A clean shot!" : "";
      return `${opener} and lands ${step.damage}.${crit} ${target} has ${hp(step.hpAfter)}.`;
    }
    case "disarm":
      return step.resisted
        ? `${n(step.target)} keeps hold of ${item(step.weapon)}.`
        : `${n(step.actor)} knocks ${item(step.weapon)} out of ${n(step.target)}'s hands.`;
    case "doorOff":
      return `${n(step.target)} loses the car door.`;
    case "heal":
      return step.actor === step.target
        ? `${n(step.actor)} gets ${step.amount} HP back (${hp(step.hpAfter)}).`
        : `${n(step.target)} gets ${step.amount} HP back (${hp(step.hpAfter)}).`;
    case "snare":
      return `${n(step.target)} is stuck under the tarp.`;
    case "free":
      return step.cause === "hit" ? `The hit knocks ${n(step.actor)} free of the tarp.` : `${n(step.actor)} wriggles out from under the tarp.`;
    case "flee":
      return `${n(step.actor)} runs off.`;
    case "ko":
      return `${n(step.actor)} is down!`;
    case "overtime":
      return `Overtime: ${n(step.actor)} loses ${step.damage} (${hp(step.hpAfter)} left).`;
    case "end":
      return step.reason === "cap"
        ? `The bout is stopped. ${n(`${step.winner}0`)} has more left and takes it.`
        : `${n(`${step.winner}0`)} wins the bout.`;
    default: {
      const never: never = step;
      return String(never);
    }
  }
}
