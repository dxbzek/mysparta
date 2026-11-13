/**
 * Which clip the cut-out puppet plays on a beat, and for how long.
 *
 * Pure on purpose: the stage decides poses from the same beat data the old
 * sprite path reads (`animOf` in FightTheatre), and this is the one place
 * that turns a beat into a clip, so it can be tested without a DOM.
 *
 * Durations are the 1x lengths of the slot animations each clip rides on
 * (styles.css `.strike-r`, `.throw-r`, `.hurt-l` ...). The puppet moves its
 * limbs inside the slot while the slot carries it across the stage, so the
 * two must share one clock: the swing peaks where the slot arrives, and the
 * reaction starts where the slot's reaction starts. The stylesheet multiplies
 * every one of them by `--spd`, exactly as it does for the slot.
 */

import type { Line } from "./narrate.js";
import { MELEE_CONTACT_MS, MISSILE_LAUNCH_MS } from "./beats.js";

export type PuppetClip =
  | "idle"
  | "run"
  | "chop"
  | "thrust"
  | "jab"
  | "throw"
  | "ready"
  | "cast"
  | "hit"
  | "dodge"
  | "duck"
  | "block"
  | "ko"
  | "win";

export interface ClipPlan {
  clip: PuppetClip;
  /** length at 1x, ms */
  durMs: number;
  /**
   * When the clip starts, at 1x. Reactions wait for the blow (the slot's own
   * delay); the stylesheet swaps in the javelin's landing time on a thrown
   * beat, as it does for the slot.
   */
  delayMs: number;
  /** a crit hurts harder: the reaction plays its heavy variant */
  heavy?: boolean;
}

export interface ClipInput {
  side: 0 | 1;
  /** the beat on stage (undefined after a skip) */
  anim: Line["anim"] | undefined;
  /** the beat's fx (crit flag) */
  crit: boolean;
  /** 1-based count of beats shown; 1 is the walk-on */
  idx: number;
  finished: boolean;
  result: { reason: string; winner: 0 | 1 };
  /**
   * The killing blow has already landed (a later beat is on stage). The core
   * keeps talking after it — a fresh weapon drawn, a rider announced — and
   * the verdict card covers the stage once it ends, so a fall that waited
   * for the verdict happened behind it.
   */
  fallen?: boolean;
  /** swings and dodges this side has made so far, for the alternation */
  swings: number;
  dodges: number;
}

/** Slot clip lengths at 1x, mirrored from styles.css. */
export const CLIP_MS = {
  enter: 900,
  strike: 760,
  strikeCrit: 900,
  chain: [360, 360, 310, 260] as const,
  riposte: 420,
  throw: 620,
  hurt: 460,
  hurtHard: 620,
  dodge: 540,
  block: 460,
  ready: 460,
  cast: 900,
  mend: 980,
  ko: 1100,
  win: 700,
  idle: 1600,
} as const;

/** The slot's reaction delays at 1x (styles.css `.hurt-l`, `.dodge-l`, `.block-l`). */
export const REACT_DELAY_MS = { hurt: 280, dodge: 230, block: 230 } as const;

export function puppetClip(i: ClipInput): ClipPlan {
  const { side, anim, finished, result } = i;
  const loser: 0 | 1 = result.winner === 0 ? 1 : 0;
  if (i.fallen && side === loser && result.reason === "ko") {
    return { clip: "ko", durMs: CLIP_MS.ko, delayMs: 0 };
  }
  if (finished) {
    if (side === loser && result.reason === "ko") return { clip: "ko", durMs: CLIP_MS.ko, delayMs: 0 };
    if (side === result.winner) return { clip: "win", durMs: CLIP_MS.win, delayMs: 0 };
    return { clip: "idle", durMs: CLIP_MS.idle, delayMs: 0 };
  }

  const react = anim?.reaction?.side === side ? anim.reaction.kind : undefined;
  if (react === "hurt") {
    return i.crit
      ? { clip: "hit", durMs: CLIP_MS.hurtHard, delayMs: REACT_DELAY_MS.hurt, heavy: true }
      : { clip: "hit", durMs: CLIP_MS.hurt, delayMs: REACT_DELAY_MS.hurt };
  }
  if (react === "dodge") {
    // The slot cycles step back / side-step / duck; the body follows: the
    // first two are a lean-and-hop, the third drops under the blow.
    return {
      clip: i.dodges % 3 === 2 ? "duck" : "dodge",
      durMs: CLIP_MS.dodge,
      delayMs: REACT_DELAY_MS.dodge,
    };
  }
  if (react === "block") return { clip: "block", durMs: CLIP_MS.block, delayMs: REACT_DELAY_MS.block };

  if (anim?.striker === side && !anim.beastId) {
    if (anim.heal) return { clip: "cast", durMs: CLIP_MS.mend, delayMs: 0 };
    if (anim.cast) return { clip: "cast", durMs: CLIP_MS.cast, delayMs: 0 };
    if (anim.riposte) return { clip: "jab", durMs: CLIP_MS.riposte, delayMs: 0 };
    if (anim.chain) {
      return { clip: "jab", durMs: CLIP_MS.chain[Math.min(3, anim.chain)]!, delayMs: 0 };
    }
    if (anim.thrown) return { clip: "throw", durMs: CLIP_MS.throw, delayMs: 0 };
    // Two swings, alternated on this side's own count so the two fighters
    // never chop in lockstep: an overhead chop and a straight thrust.
    return {
      clip: i.swings % 2 === 0 ? "chop" : "thrust",
      durMs: i.crit ? CLIP_MS.strikeCrit : CLIP_MS.strike,
      delayMs: 0,
    };
  }
  if (anim?.ready === side) return { clip: "ready", durMs: CLIP_MS.ready, delayMs: 0 };
  if (i.idx <= 1) return { clip: "run", durMs: CLIP_MS.enter, delayMs: 0 };
  return { clip: "idle", durMs: CLIP_MS.idle, delayMs: 0 };
}

/**
 * Where in a clip the blow lands, as a fraction of the clip — the keyframes
 * in puppet.css put the weapon's contact pose here. Exposed so a test can
 * hold the art to the beats.ts clock instead of trusting a comment.
 */
export const CONTACT_AT = {
  /** chop and thrust: contact keyframe at 38% of 760ms ≈ 289ms */
  strike: 0.38,
  /** throw: the release keyframe at 34% of 620ms ≈ 211ms */
  release: 0.34,
} as const;

export function contactFor(clip: "strike" | "release"): number {
  return clip === "strike"
    ? Math.round(CONTACT_AT.strike * CLIP_MS.strike)
    : Math.round(CONTACT_AT.release * CLIP_MS.throw);
}

/** Re-exported so the test reads both clocks from one import. */
export const BEAT_CLOCK = { melee: MELEE_CONTACT_MS, launch: MISSILE_LAUNCH_MS } as const;

/**
 * The flag. The shipped game is unchanged until Zek approves the puppet:
 * `?puppet=1` turns it on and remembers it, `?puppet=0` turns it off.
 */
export const PUPPET_KEY = "agoge.puppet";

export function puppetEnabled(search: string, store: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null): boolean {
  const q = new URLSearchParams(search).get("puppet");
  try {
    if (q === "1") store?.setItem(PUPPET_KEY, "1");
    else if (q === "0") store?.removeItem(PUPPET_KEY);
    return store?.getItem(PUPPET_KEY) === "1" || q === "1";
  } catch {
    return q === "1";
  }
}
