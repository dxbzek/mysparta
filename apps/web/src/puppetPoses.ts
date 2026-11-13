/**
 * The puppet's poses, as data, and the CSS they compile to.
 *
 * Each clip is a list of keyframes; a keyframe names only the joints it moves
 * (After Effects style: a joint interpolates between ITS OWN keys, so a leg
 * can run while the arm holds its wind-up). Rotations are degrees, clockwise
 * on screen; the figure faces right, so a NEGATIVE turn swings a limb
 * forward, toward the foe. 0% and 100% fall back to the guard pose unless a
 * clip says otherwise — a swing that winds the arm past -180 must end at the
 * guard's equivalent angle (-30 + 360) or the tween would unwind it the long
 * way round.
 *
 * Why generated CSS rather than a JS tween: the stage already freezes on the
 * killing blow by pausing every CSS animation under `.stage.hitstop`, scales
 * every duration by `--spd` at 2x, and drops animation under
 * prefers-reduced-motion. Keyframes inherit all three without a line of
 * extra code; a requestAnimationFrame tween would have to re-implement each.
 */

export type Joint =
  | "squash"
  | "root"
  | "torso"
  | "head"
  | "uarmF"
  | "farmF"
  | "handF"
  | "uarmB"
  | "farmB"
  | "handB"
  | "thighF"
  | "shinF"
  | "thighB"
  | "shinB";

/** Pivots, in the 100x140 box's own units (puppet.tsx draws to these). */
export const JOINTS: Record<Joint, [number, number]> = {
  squash: [50, 138], // the ground under the body: squash, stretch, the fall
  root: [50, 92], // the hips: the body bobs and drops from here
  torso: [50, 92],
  head: [51, 52],
  uarmF: [58, 58],
  farmF: [58, 76],
  handF: [58, 95],
  uarmB: [42, 58],
  farmB: [42, 76],
  handB: [42, 95],
  thighF: [54, 92],
  shinF: [54, 113],
  thighB: [46, 92],
  shinB: [46, 113],
};

/**
 * One keyframe. Joint names are rotations; x/y move the hips; rot/sx/sy turn
 * and squash the whole figure about the ground; wpn is the weapon's opacity
 * (a thrown javelin leaves the hand).
 */
export type Pose = Partial<Record<Exclude<Joint, "squash" | "root">, number>> & {
  x?: number;
  y?: number;
  rot?: number;
  sx?: number;
  sy?: number;
  wpn?: number;
};

type Key = keyof Required<Pose>;

/** The guard: weapon up and forward, back fist at the chest, feet apart. */
export const GUARD: Required<Pose> = {
  torso: 4,
  head: -4,
  uarmF: -30,
  farmF: -70,
  handF: 0,
  uarmB: -40,
  farmB: -80,
  handB: 0,
  thighF: -12,
  shinF: 8,
  thighB: 14,
  shinB: 4,
  x: 0,
  y: 0,
  rot: 0,
  sx: 1,
  sy: 1,
  wpn: 1,
};

export interface Frame {
  at: number;
  pose: Pose;
  /** easing for the segment that STARTS here */
  ease?: string;
}

export interface ClipDef {
  frames: Frame[];
  /** keep the last pose after the clip ends (the knockout) */
  hold?: boolean;
}

const f = (at: number, pose: Pose, ease?: string): Frame => ({ at, pose, ease });

/** Easing that holds back then whips: the swing accelerates into contact. */
const WHIP = "cubic-bezier(0.55, 0, 0.9, 0.5)";
const SETTLE = "cubic-bezier(0.2, 0.8, 0.3, 1)";

/* Run-cycle contacts and passing poses, shared by the walk-on and the dash. */
const STRIDE_A: Pose = { thighF: -42, shinF: 18, thighB: 32, shinB: 62, y: -3 };
const PASS_1: Pose = { thighF: -2, shinF: 12, thighB: -12, shinB: 78, y: 2 };
const STRIDE_B: Pose = { thighF: 32, shinF: 62, thighB: -42, shinB: 18, y: -3 };
const PASS_2: Pose = { thighF: -12, shinF: 78, thighB: -2, shinB: 12, y: 2 };
/** back-pedalling to the corner after a blow: short hops, knees soft */
const HOP_UP: Pose = { thighF: -26, shinF: 30, thighB: 24, shinB: 34, y: -4 };
const HOP_DOWN: Pose = { thighF: -6, shinF: 22, thighB: 6, shinB: 30, y: 2 };

export const CLIPS: Record<string, ClipDef> = {
  idle: {
    frames: [
      f(0, {}),
      f(100, { torso: 6.5, head: -1, uarmF: -26, farmF: -78, uarmB: -16, farmB: -92, thighF: -14, shinF: 13, thighB: 16, shinB: 8, y: 1.8 }),
    ],
  },

  run: {
    frames: [
      f(0, { ...STRIDE_A, torso: 14, head: -10, uarmF: 12, farmF: -62, uarmB: -48, farmB: -80 }),
      f(9, PASS_1),
      f(18, { ...STRIDE_B, uarmF: -60, farmF: -80, uarmB: 18, farmB: -70 }),
      f(27, PASS_2),
      f(36, { ...STRIDE_A, uarmF: 12, farmF: -62, uarmB: -48, farmB: -80 }),
      f(45, PASS_1),
      f(54, { ...STRIDE_B, torso: 14, uarmF: -60, farmF: -80, uarmB: 18, farmB: -70 }),
      // the brake: the slot overshoots at 60%, the body leans back against it
      f(64, { torso: -6, head: 3, thighF: -32, shinF: 10, thighB: 22, shinB: 22, y: 2, uarmF: -42, farmF: -62, uarmB: -10, farmB: -80 }, SETTLE),
      f(80, { torso: 8, head: -6, y: 0.5 }),
    ],
  },

  /*
   * The overhead chop. The slot sprints in over 0-34% and arrives; the blade
   * goes up and back on the way in (anticipation), whips down to contact at
   * 38% — 289ms, the beats.ts melee clock — overshoots, and the body follows
   * through before running back.
   */
  chop: {
    frames: [
      f(0, {}),
      f(7, { ...STRIDE_A, torso: 12 }),
      f(14, PASS_1),
      f(21, { ...STRIDE_B, uarmF: -120, farmF: -62 }),
      f(30, { uarmF: -205, farmF: -48, handF: -20, torso: -12, head: -6, uarmB: 12, farmB: -60, thighF: -30, shinF: 10, thighB: 26, shinB: 14, y: 0, sx: 0.96, sy: 1.05 }, WHIP),
      f(38, { uarmF: -78, farmF: -14, handF: 64, torso: 24, head: 4, uarmB: 26, farmB: -40, thighF: -46, shinF: 42, thighB: 42, shinB: 8, y: 7, sx: 1.07, sy: 0.93 }),
      f(45, { uarmF: -46, farmF: -4, handF: 84, torso: 28, head: 6, y: 8, sx: 1, sy: 1 }),
      f(55, { uarmF: -62, farmF: -34, handF: 40, torso: 16, y: 5 }),
      f(64, { uarmF: -36, farmF: -64, handF: 0, torso: 6, head: -4, uarmB: -40, farmB: -80, y: 2, thighF: -14, shinF: 14, thighB: 16, shinB: 10 }),
      f(73, HOP_UP),
      f(82, HOP_DOWN),
      f(91, HOP_UP),
    ],
  },

  /* The thrust: elbow drawn back, then the whole arm and the blade straight out. */
  thrust: {
    frames: [
      f(0, {}),
      f(7, { ...STRIDE_A, torso: 12 }),
      f(14, PASS_1),
      f(21, { ...STRIDE_B, uarmF: 0, farmF: -100, handF: 50 }),
      f(30, { uarmF: 28, farmF: -122, handF: 94, torso: -9, head: -4, uarmB: -40, farmB: -40, thighF: -22, shinF: 8, thighB: 30, shinB: 12, y: 0, sx: 0.97, sy: 1.04 }, WHIP),
      f(38, { uarmF: -82, farmF: -8, handF: 90, torso: 22, head: 4, uarmB: 30, farmB: -50, thighF: -52, shinF: 36, thighB: 46, shinB: 6, y: 6, sx: 1.06, sy: 0.94 }),
      f(45, { uarmF: -90, farmF: -2, handF: 92, torso: 26, y: 7, sx: 1, sy: 1 }),
      f(56, { uarmF: -60, farmF: -40, handF: 50, torso: 12, y: 4 }),
      f(66, { uarmF: -34, farmF: -66, handF: 0, torso: 6, head: -4, uarmB: -40, farmB: -80, y: 2, thighF: -14, shinF: 14, thighB: 16, shinB: 10 }),
      f(75, HOP_UP),
      f(84, HOP_DOWN),
      f(92, HOP_UP),
    ],
  },

  /* A short answer from where they stand: chains and ripostes. */
  jab: {
    frames: [
      f(0, {}),
      f(30, { uarmF: -172, farmF: -58, handF: -20, torso: -7, head: -4, thighF: -30, shinF: 20, thighB: 30, shinB: 40, y: -2 }, WHIP),
      f(60, { uarmF: -70, farmF: -10, handF: 60, torso: 21, head: 4, thighF: -40, shinF: 34, thighB: 38, shinB: 8, y: 5, sx: 1.05, sy: 0.95 }),
      f(76, { uarmF: -52, farmF: -24, handF: 30, torso: 15, y: 3, sx: 1, sy: 1 }),
    ],
  },

  /*
   * The javelin. Step back and lay the arm out behind (the shaft stays level,
   * pointing at the foe), whip it over the shoulder, and let go at 34% —
   * 211ms, the beats.ts launch time; the stage's missile takes over from
   * there, so the one in the hand vanishes on that frame and a fresh one is
   * drawn as the arm comes home.
   */
  throw: {
    frames: [
      f(0, {}),
      f(14, { uarmF: 40, farmF: -40, handF: -10, torso: -4, thighF: -20, thighB: 26 }),
      f(26, { uarmF: 118, farmF: -28, handF: -95, torso: -16, head: -4, uarmB: -62, farmB: -18, thighF: -30, shinF: 8, thighB: 32, shinB: 8, sx: 0.97, sy: 1.03 }, WHIP),
      f(33, { wpn: 1 }),
      f(34, { uarmF: 215, farmF: -20, handF: -100, torso: 18, head: 2, uarmB: 18, farmB: -60, thighF: -42, shinF: 32, thighB: 42, shinB: 6, wpn: 0 }),
      f(45, { uarmF: 282, farmF: -8, handF: -100, torso: 26, y: 4, sx: 1.04, sy: 0.96 }),
      f(64, { uarmF: 318, farmF: -48, handF: -40, torso: 10, y: 1, sx: 1, sy: 1 }),
      f(86, { wpn: 0 }),
      f(94, { wpn: 1 }),
      f(100, { uarmF: 330 }),
    ],
  },

  /* Drawing a weapon: brandish it high, then settle into guard. */
  ready: {
    frames: [
      f(0, {}),
      f(35, { uarmF: -162, farmF: -18, torso: -6, head: -8, y: -1 }),
      f(62, { uarmF: -48, farmF: -52, torso: 10, y: 2 }, SETTLE),
    ],
  },

  /* A skill or a mend: plant, then both arms open and the head goes up. */
  cast: {
    frames: [
      f(0, {}),
      f(20, { y: 4, thighF: -26, shinF: 30, thighB: 20, shinB: 26, torso: 0 }),
      f(45, { uarmF: -148, farmF: -22, uarmB: -150, farmB: -10, torso: -10, head: -16, y: -2, thighF: -10, shinF: 5, thighB: 10, shinB: 5 }),
      f(75, { uarmF: -152, farmF: -16, uarmB: -156, farmB: -6, torso: -12, head: -18, y: -2 }),
    ],
  },

  /* Struck: snap back from the blow, flinch the arms up, come back to guard. */
  hit: {
    frames: [
      f(0, {}),
      f(10, { torso: -20, head: -26, uarmF: -6, farmF: -40, uarmB: 30, farmB: -30, x: -4, y: 2, sx: 0.9, sy: 1.08 }),
      f(30, { torso: -24, head: -18, x: -5, sx: 1.04, sy: 0.96 }),
      f(62, { torso: 9, head: 4, uarmF: -40, uarmB: -26, x: 0, sx: 1, sy: 1 }, SETTLE),
    ],
  },
  /* A critical knocks them off their feet for a moment, arms thrown wide. */
  "hit-heavy": {
    frames: [
      f(0, {}),
      f(9, { torso: -32, head: -34, uarmF: 30, farmF: -10, uarmB: 50, farmB: -10, thighF: -40, shinF: 20, thighB: 10, shinB: 30, x: -8, y: -6, sx: 0.86, sy: 1.12 }),
      f(32, { torso: -26, head: -20, thighF: -20, shinF: 30, thighB: 26, shinB: 30, x: -6, y: 4, sx: 1.08, sy: 0.92 }),
      f(60, { torso: 12, head: 6, uarmF: -40, farmF: -60, uarmB: -26, farmB: -80, x: 0, y: 1, sx: 1, sy: 1 }, SETTLE),
    ],
  },

  /* Evade: lean away and tuck the knees as the slot hops them clear. */
  dodge: {
    frames: [
      f(0, {}),
      f(25, { torso: -22, head: -12, uarmF: 8, farmF: -100, uarmB: 20, farmB: -110, thighF: -52, shinF: 82, thighB: -12, shinB: 72, y: -4 }),
      f(55, { torso: -10, head: -4, thighF: -20, shinF: 22, thighB: 22, shinB: 22, y: 3, sx: 1.05, sy: 0.95 }),
      f(80, { torso: 6, sx: 1, sy: 1, y: 0 }, SETTLE),
    ],
  },
  duck: {
    frames: [
      f(0, {}),
      f(22, { torso: 30, head: 12, uarmF: -10, farmF: -112, uarmB: -12, farmB: -120, thighF: -62, shinF: 96, thighB: 44, shinB: 72, y: 14 }),
      f(50, { torso: 18, head: 6, thighF: -40, shinF: 60, thighB: 30, shinB: 40, y: 7 }),
    ],
  },

  /* Take it on the guard: weapon and fist come up, the body is pushed back. */
  block: {
    frames: [
      f(0, {}),
      f(20, { uarmF: -100, farmF: -42, handF: -8, uarmB: -108, farmB: -42, torso: -4, y: 3, thighF: -20, shinF: 18, thighB: 22, shinB: 14 }),
      f(36, { torso: -11, head: -8, x: -3, sx: 1.05, sy: 0.95 }),
      f(70, { torso: 1, x: 0, sx: 1, sy: 1 }, SETTLE),
    ],
  },

  /*
   * Knocked out: the last blow rocks them, the knees go, and they pitch
   * forward onto their face — toward the middle of the stage, so the body
   * never falls off its own edge.
   */
  ko: {
    hold: true,
    frames: [
      f(0, {}),
      f(14, { torso: -18, head: -26, uarmF: 20, farmF: -20, uarmB: 40, farmB: -10, y: 2 }),
      f(36, { y: 22, thighF: -76, shinF: 122, thighB: -62, shinB: 112, torso: 10, head: 12, uarmF: 0, farmF: -10, uarmB: 10, farmB: -10, rot: 0 }),
      f(54, { rot: 12, torso: 22, head: 20 }, "cubic-bezier(0.6, 0, 1, 0.6)"),
      f(76, { rot: 80, torso: 8, head: -12, uarmF: -70, farmF: 0, uarmB: -60, farmB: 0, sx: 1, sy: 1 }),
      f(84, { rot: 76, sx: 1.06, sy: 0.92 }),
      f(100, { rot: 78, sx: 1, sy: 1 }),
    ],
  },

  win: {
    frames: [
      f(0, { uarmF: -165, farmF: -20, uarmB: -150, farmB: -30, torso: -4, head: -10 }),
      f(50, { uarmF: -176, farmF: -4, uarmB: -162, farmB: -8, y: -2, head: -14 }),
      f(100, { uarmF: -165, farmF: -20, uarmB: -150, farmB: -30, torso: -4, head: -10 }),
    ],
  },
};

const JOINT_KEYS: Record<Joint, Key[]> = {
  squash: ["rot", "sx", "sy"],
  root: ["x", "y"],
  torso: ["torso"],
  head: ["head"],
  uarmF: ["uarmF"],
  farmF: ["farmF"],
  handF: ["handF"],
  uarmB: ["uarmB"],
  farmB: ["farmB"],
  handB: ["handB"],
  thighF: ["thighF"],
  shinF: ["shinF"],
  thighB: ["thighB"],
  shinB: ["shinB"],
};

function transformOf(j: Joint, v: (k: Key) => number): string {
  if (j === "squash") return `rotate(${v("rot")}deg) scale(${v("sx")}, ${v("sy")})`;
  if (j === "root") return `translate(${v("x")}px, ${v("y")}px)`;
  return `rotate(${v(j as Key)}deg)`;
}

/**
 * One joint's track through a clip: the frames that key it, with 0% and 100%
 * filled from the guard (or, on a held clip, the last key) when not given.
 */
export function track(clip: ClipDef, keys: Key[]): { at: number; vals: Record<string, number>; ease?: string }[] {
  const keyed = clip.frames.filter((fr) => keys.some((k) => fr.pose[k] !== undefined));
  const out: { at: number; vals: Record<string, number>; ease?: string }[] = [];
  const last: Record<string, number> = {};
  for (const k of keys) last[k] = GUARD[k];
  const push = (at: number, pose: Pose, ease?: string) => {
    for (const k of keys) if (pose[k] !== undefined) last[k] = pose[k]!;
    out.push({ at, vals: { ...last }, ease });
  };
  if (!keyed.some((fr) => fr.at === 0)) push(0, {});
  for (const fr of keyed) push(fr.at, fr.pose, fr.ease);
  if (!keyed.some((fr) => fr.at === 100)) {
    if (clip.hold) push(100, {});
    else {
      // back to guard: reset to the guard's values, not the last key's
      for (const k of keys) last[k] = GUARD[k];
      out.push({ at: 100, vals: { ...last } });
    }
  }
  return out;
}

const fix = (n: number) => +n.toFixed(2);

/** Every clip's keyframes and selectors, as one stylesheet. */
export function puppetCss(): string {
  const parts: string[] = [];
  for (const [name, clip] of Object.entries(CLIPS)) {
    for (const j of Object.keys(JOINT_KEYS) as Joint[]) {
      const keys = JOINT_KEYS[j];
      if (!clip.frames.some((fr) => keys.some((k) => fr.pose[k] !== undefined))) continue;
      const id = `pz-${name}-${j}`;
      const body = track(clip, keys)
        .map((t) => {
          const ease = t.ease ? ` animation-timing-function: ${t.ease};` : "";
          return `${t.at}% { transform: ${transformOf(j, (k) => fix(t.vals[k]!))};${ease} }`;
        })
        .join(" ");
      parts.push(`@keyframes ${id} { ${body} }`);
      parts.push(`.pz[data-clip="${name}"] .pz-${j} { animation-name: ${id}; }`);
    }
    if (clip.frames.some((fr) => fr.pose.wpn !== undefined)) {
      const id = `pz-${name}-wpn`;
      const body = track(clip, ["wpn"])
        .map((t) => `${t.at}% { opacity: ${t.vals.wpn}; animation-timing-function: steps(1, end); }`)
        .join(" ");
      parts.push(`@keyframes ${id} { ${body} }`);
      parts.push(`.pz[data-clip="${name}"] .pz-weapon { animation-name: ${id}; }`);
    }
  }
  const guard = (Object.keys(JOINT_KEYS) as Joint[])
    .map((j) => `.pz .pz-${j} { transform: ${transformOf(j, (k) => GUARD[k])}; }`)
    .join("\n");
  return `${BASE_CSS}\n${guard}\n${parts.join("\n")}\n${AFTER_CSS}`;
}

const BASE_CSS = `
.pz { position: relative; display: inline-block; vertical-align: bottom; }
.pz-svg { position: absolute; bottom: 0; overflow: visible; }
.pz .pz-j {
  transform-box: view-box;
  animation-duration: calc(var(--pz-dur, 600ms) * var(--spd, 1));
  animation-delay: calc(var(--pz-wait, 0ms) * var(--spd, 1));
  animation-timing-function: ease-in-out;
  animation-fill-mode: backwards;
}
.pz[data-clip="idle"] .pz-j { animation-iteration-count: infinite; animation-direction: alternate; animation-delay: var(--pz-wait, 0ms); }
.pz[data-clip="win"] .pz-j { animation-iteration-count: infinite; animation-delay: 0ms; }
.pz[data-clip="ko"] .pz-j { animation-fill-mode: both; }
`;

const AFTER_CSS = `
/* a thrown blow's reaction waits for the javelin, as the slot's does */
.stage.thrown-beat .pz[data-react="hurt"] { --pz-wait: var(--land, 470ms) !important; }
.stage.thrown-beat .pz[data-react="dodge"],
.stage.thrown-beat .pz[data-react="block"] { --pz-wait: calc(var(--land, 470ms) - 60ms) !important; }

/* the struck body goes white-hot for a moment */
.pz[data-react="hurt"] .pz-svg {
  animation: pzFlash calc(var(--pz-dur) * var(--spd, 1)) ease-out calc(var(--pz-wait) * var(--spd, 1)) backwards;
}
@keyframes pzFlash {
  0% { filter: none; }
  6% { filter: brightness(2.4) saturate(0.3); }
  22% { filter: brightness(1.35); }
  40%, 100% { filter: none; }
}

/*
 * The slot carries the body across the stage; with a puppet, the BODY does
 * the swinging, so the slot's whole-figure tilts (rotate ±16° on a strike)
 * are taken out and only the travel is kept. Same durations, same arrival.
 */
.stage.pz-on .fig-inner.idle { animation: none; }
.stage.pz-on .strike-r, .stage.pz-on .strike-r.sv1, .stage.pz-on .strike-r.sv2 { animation-name: pzDashR; }
.stage.pz-on .strike-l, .stage.pz-on .strike-l.sv1, .stage.pz-on .strike-l.sv2 { animation-name: pzDashL; }
@keyframes pzDashR {
  0% { transform: translateX(0); }
  34% { transform: translateX(var(--dash)); }
  42% { transform: translateX(calc(var(--dash) + 8px)); }
  64% { transform: translateX(var(--dash)); }
  100% { transform: translateX(0); }
}
@keyframes pzDashL {
  0% { transform: translateX(0); }
  34% { transform: translateX(calc(var(--dash) * -1)); }
  42% { transform: translateX(calc(var(--dash) * -1 - 8px)); }
  64% { transform: translateX(calc(var(--dash) * -1)); }
  100% { transform: translateX(0); }
}
.stage.pz-on .throw-r { animation-name: pzThrowR; }
.stage.pz-on .throw-l { animation-name: pzThrowL; }
@keyframes pzThrowR { 26% { transform: translateX(-8px); } 42% { transform: translateX(10px); } 100% { transform: none; } }
@keyframes pzThrowL { 26% { transform: translateX(8px); } 42% { transform: translateX(-10px); } 100% { transform: none; } }
.stage.pz-on .chain-r { animation-name: pzChainR; }
.stage.pz-on .chain-l { animation-name: pzChainL; }
@keyframes pzChainR {
  0%, 100% { transform: translateX(var(--dash)); }
  30% { transform: translateX(calc(var(--dash) - 12px)); }
  55% { transform: translateX(calc(var(--dash) + 14px)); }
}
@keyframes pzChainL {
  0%, 100% { transform: translateX(calc(var(--dash) * -1)); }
  30% { transform: translateX(calc(var(--dash) * -1 + 12px)); }
  55% { transform: translateX(calc(var(--dash) * -1 - 14px)); }
}
/*
 * A counter still has to reach someone. The paper doll pivoted 42px on the
 * spot, which with a figure this size read as stabbing the air while the foe
 * recoiled across the stage — on a killing blow, the last thing the bout
 * shows. The puppet lunges the distance and is back by the end of the beat.
 */
.stage.pz-on .riposte-r { animation-name: pzRiposteR; }
.stage.pz-on .riposte-l { animation-name: pzRiposteL; }
@keyframes pzRiposteR {
  0% { transform: none; }
  55% { transform: translateX(var(--dash)); }
  70% { transform: translateX(calc(var(--dash) + 6px)); }
  100% { transform: none; }
}
@keyframes pzRiposteL {
  0% { transform: none; }
  55% { transform: translateX(calc(var(--dash) * -1)); }
  70% { transform: translateX(calc(var(--dash) * -1 - 6px)); }
  100% { transform: none; }
}
/* the duck: the knees do the dropping now, the slot only slides */
.stage.pz-on .dodge-l.dv2 { animation-name: pzSlideL; }
.stage.pz-on .dodge-r.dv2 { animation-name: pzSlideR; }
@keyframes pzSlideL { 30% { transform: translateX(-12px); } 100% { transform: none; } }
@keyframes pzSlideR { 30% { transform: translateX(12px); } 100% { transform: none; } }

/*
 * The fall is the last thing the bout shows, and the verdict card covered it:
 * the killing blow is usually the final line, so the loser only starts down
 * when the bout ends — the same frame the card pops. The card waits until the
 * body has hit the ground (the ko clip lands at 76% of 1100ms).
 */
.stage.pz-on .verdict-wrap { animation-delay: calc(850ms * var(--spd, 1)); animation-fill-mode: backwards; }

/* the javelin leaves from the puppet's hand, not the paper doll's */
.stage.pz-on .missile { bottom: var(--pz-hand-y, 44%); }
.stage.pz-on .missile-r { left: calc(7% + var(--pz-hand-x, 104px)); }
.stage.pz-on .missile-l { right: calc(7% + var(--pz-hand-x, 104px)); }

@media (prefers-reduced-motion: reduce) {
  .pz .pz-j, .pz .pz-svg { animation: none !important; }
}
`;

let injected = false;

/** Put the puppet stylesheet in the document once (no-op outside a browser). */
export function ensurePuppetStyles(): void {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const el = document.createElement("style");
  el.id = "puppet-css";
  el.textContent = puppetCss();
  document.head.appendChild(el);
}
