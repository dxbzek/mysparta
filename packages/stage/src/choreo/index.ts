/**
 * One choreography handler per step type. The record below must name all 17 (the mapped type
 * fails to compile when one is missing), and `dispatch` ends in a `never` check, so a new step
 * type in the log cannot reach the stage without a handler.
 */
import type { Step, StepOf, StepType } from "@rankzero/core";
import type { Builder } from "../timeline";
import { attack } from "./attack";
import { disarm } from "./disarm";
import { doorOff } from "./doorOff";
import { draw } from "./draw";
import { end } from "./end";
import { enter } from "./enter";
import { flee } from "./flee";
import { free } from "./free";
import { heal } from "./heal";
import { intercept } from "./intercept";
import { ko } from "./ko";
import { move } from "./move";
import { overtime } from "./overtime";
import { riposte } from "./riposte";
import { snare } from "./snare";
import { swap } from "./swap";
import { throwStep } from "./throw";

/** Where a step sits on the clock: `at` is when its choreography starts, `apply` is when its
 *  result is shown (a hit lands, a weapon is in the hand, a body is down). */
export interface Placed { at: number; apply: number }
export type Handler<T extends StepType> = (b: Builder, step: StepOf<T>, i: number) => Placed;

export const HANDLERS: { readonly [K in StepType]: Handler<K> } = {
  enter, draw, swap, move, attack, intercept, riposte, throw: throwStep, disarm, doorOff, heal, snare, free, flee, ko,
  overtime, end,
};

export function dispatch(b: Builder, step: Step, i: number): Placed {
  switch (step.t) {
    case "enter": return HANDLERS.enter(b, step, i);
    case "draw": return HANDLERS.draw(b, step, i);
    case "swap": return HANDLERS.swap(b, step, i);
    case "move": return HANDLERS.move(b, step, i);
    case "attack": return HANDLERS.attack(b, step, i);
    case "intercept": return HANDLERS.intercept(b, step, i);
    case "riposte": return HANDLERS.riposte(b, step, i);
    case "throw": return HANDLERS.throw(b, step, i);
    case "disarm": return HANDLERS.disarm(b, step, i);
    case "doorOff": return HANDLERS.doorOff(b, step, i);
    case "heal": return HANDLERS.heal(b, step, i);
    case "snare": return HANDLERS.snare(b, step, i);
    case "free": return HANDLERS.free(b, step, i);
    case "flee": return HANDLERS.flee(b, step, i);
    case "ko": return HANDLERS.ko(b, step, i);
    case "overtime": return HANDLERS.overtime(b, step, i);
    case "end": return HANDLERS.end(b, step, i);
    default: {
      const unknown: never = step;
      throw new Error(`stage: no handler for step ${JSON.stringify(unknown)}`);
    }
  }
}
