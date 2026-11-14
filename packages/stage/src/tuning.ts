/**
 * Every number of the fight presentation spec that the stage owns, in one place (brief 3.12).
 * All times are ms at 1x, all distances are stage units (the stage is 360 x 240).
 *
 * NOT here, on purpose: the length of a clip and the time of its strike. Those come from
 * `rig.clipInfo()` only (one timing source). The two numbers of the short combo swing are here
 * because the rig holds no second clip; `comboClipTime` from the rig contract maps them.
 */

/** The intro beats. */
export const INTRO = {
  leftJumpAt: 0,
  rightJumpAt: 250,
  companionsAt: 600,
  companionsRunMs: 300,
  namesFrom: 700,
  namesTo: 900,
  fightCardAt: 900,
  fightCardMs: 500,
  firstActionAt: 1500,
  /** How far off stage a scrapper starts its jump, past the stage edge. */
  offStage: 46,
} as const;

/** One melee turn. */
export const BEAT = {
  anticipationMs: 100,
  dashSpeed: 560,          // units per second
  dashMinMs: 140,
  dashBackSpeed: 640,      // units per second
  dashBackMinMs: 120,
  /** The next actor may start its anticipation when the dash back is this far done. */
  nextAfterBack: 0.6,
  recoverMs: 100,
  comboMs: 220,
  comboStrikeMs: 120,
  /** A combo swing that needs a small step to its new stop takes this long to step. */
  stepMs: 120,
  /** A turn with nothing to watch (a draw with no swing after it) still gets this much air. */
  restMs: 120,
} as const;

/** Hit-stop at the moment of contact, by kind of hit. */
export const HIT_STOP = { plain: 60, crit: 110, knockout: 220 } as const;

/** The knockout: hit-stop, then time scale 0.4 for 500 ms, then the fall clip (its length is the rig's). */
export const KNOCKOUT = { slowScale: 0.4, slowMs: 500 } as const;

/** The nine contact effects. */
export const CONTACT = {
  flashMs: 60,
  knockbackOutMs: 120,
  knockbackBackMs: 180,
  knockbackBase: 4,
  knockbackPerHp: 60,      // x damage / maxHP
  knockbackMin: 4,
  knockbackMax: 26,
  burstMs: 220,
  numberPopMs: 100,
  numberPopFrom: 1.5,
  numberRise: 44,
  numberMs: 800,
  numberFadeMs: 250,
  critScale: 1.4,
  shake: { plain: { amp: 3, ms: 160 }, crit: { amp: 6, ms: 240 }, knockout: { amp: 8, ms: 300 } },
  hpDropMs: 80,
  hpTrailWaitMs: 250,
  hpTrailShrinkMs: 300,
  crowdMs: 320,
  /** Heavy flinch from this share of max HP (the brief's 25%). */
  heavyShare: 0.25,
} as const;

/** Other outcomes. */
export const OUTCOME = {
  blockSlide: 6,
  blockSlideMs: 120,
  blockSlideBackMs: 160,
  blockTagMs: 500,
  recoilMs: 100,
  recoil: 5,
  evadeHop: 22,
  evadeArc: 14,
  evadeMs: 320,
  /** The hop starts this long before the contact, so the swing passes where the body was. */
  evadeLead: 110,
  tagMs: 500,
  interceptAt: 0.7,        // share of the dash done when the defender hits
  interceptStep: 16,
  disarmMs: 450,
  disarmArc: 46,
  disarmLand: 34,          // units behind the owner that a dropped item lands
  swapDropMs: 250,
  swapBounce: 8,
  overtimeStickerMs: 700,
  overtimeBeatMs: 520,
  skillTagMs: 500,
  healRingMs: 400,
  healFillMs: 200,
  healHop: 10,
  healHopMs: 260,
} as const;

/** Throws and flying things. */
export const FLIGHT = {
  speed: 900,              // units per second
  minMs: 120,
  tumbleArc: 0.22,         // arc height as a share of the distance
  returnBow: 0.28,         // how far a boomerang bows sideways, as a share of the distance
  spinPerMs: 1.1,          // degrees per ms for an item that spins
  tumblePerMs: 0.9,
  vanishMs: 160,           // a weapon going back to the bag fades over this
  dropFallMs: 260,         // a "gone" weapon falls from the target to the floor
} as const;

/** Moves. */
export const MOVE = {
  bannerMs: 500,
  tarpFlightMs: 240,
  tarpDropMs: 140,
  crackersMs: 400,
  snatchJumpMs: 250,
  ringsMs: 400,
  freeMs: 220,
  fleeSpeed: 300,          // units per second
} as const;

/** The end of the bout. */
export const OUTRO = {
  bannerAt: 400,
  tapeMs: 2200,
  resultAt: 1600,
  /** The result card's XP bar fills over this, after `resultAt`. */
  resultFillMs: 700,
  /** On a cap ending the loser flinches this long before it falls. */
  capFlinchMs: 300,
} as const;

/** Floor props. */
export const FLOOR = { max: 6, fadeMs: 240, lieY: 2 } as const;

/** Idle: each actor gets its own phase in the 1.2 s breathing loop. */
export const IDLE = { phaseStepMs: 157 } as const;

/** Sound: at most one impact cue in any span this long. */
export const SOUND = { impactGapMs: 60 } as const;

/** Text sizes in stage units. */
export const TEXT = {
  number: 13,
  numberSmall: 10,
  tag: 8,
  banner: 22,
  sticker: 13,
  liftAbove: 8,
} as const;
