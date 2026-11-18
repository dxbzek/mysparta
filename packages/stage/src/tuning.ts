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
  /** Each companion starts its run in this long after the one before it in the log. */
  companionStaggerMs: 90,
  /** Two companions' entry sounds never come nearer than this (the later one runs in later). */
  companionSoundGapMs: 80,

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
  dashBackSpeed: 250,      // units per second: a backward walk in guard, 33-unit steps (rig backpedal)
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

/**
 * Footwork (movement pass 2, 16 Nov 2026; footwork.ts). A swing's approach runs from `runFrom`
 * units away (times the fighter's drawn size): the push-off, whole dash loops, the brake's flight
 * (at least `minFlightMs`), the brake. Nearer, and on every way home, the fighter shuffles: one
 * bounce covers at most `hopMax`, on an arc of `hopArc` of its length (at least `hopArcMin`),
 * so a foot is off the floor before the body has moved half a unit. Under `stillUnder` he does
 * not step at all. `fallback` is the footwork clips' timing for a rig without them (the gate pack
 * alone, the test doubles); `join` (the dash loop's clip time the push-off ends on and the brake
 * starts on) and `paw` (the end of the brake's flight, always played at 1x) are the stage's.
 */
export const FOOTWORK = {
  runFrom: 46,
  minFlightMs: 20,
  hopMax: 34,
  hopArc: 0.32,
  hopArcMin: 3,
  stillUnder: 0.5,
  /** The idle loop's moment closest to the guard the footwork clips end in (weight centred, knees
   *  up: rig gate/clips/idle.ts at 750 ms). */
  idleFrom: 750,
  fallback: { push: 52, join: 12, cycle: 240, land: 48, stop: 98, brake: 158, paw: 8, hop: 180, up: 50, down: 120 },
} as const;

/** Keeping the fighters in the camera's fixed frame (review round 2: with a long weapon a fighter
 *  backed off the phone's screen to swing). A scrapper's swing stop stays `inset` units (times its
 *  drawn size: its body's half width) inside the frame every canvas shows (camera.frameSpan); a
 *  stop pulled in by more than `giveMin` makes the target give that ground instead. */
export const FRAMING = { inset: 22, giveMin: 2,
  /** A dodge's hop back may land nearer the frame's edge (its back foot at the edge, not its body
   *  half width in): only a hop that would carry the place itself past this is a slip instead. */
  hopInset: 2,
  /** The narrowest canvas the app gives the stage, in stage units across: the 390 x 467 phone
   *  shows 240 x 390 / 467 = 200. */
  viewMin: 200,
  /** Half a body kept inside that view round a scrapper's place (`CAMERA.excursion` and a margin). */
  viewBody: 18,
  /** More room kept inside that view for an owner who steps back past his pinned pet: the view the
   *  camera settles on later can sit a few units off the one known when he steps. */
  ownerSlack: 10 } as const;

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
  knockbackMax: 20,
  /** A scrapper on a rig with footwork takes the blow as a step back of this many figure units
   *  (times his drawn size), over `knockbackOutMs` eased out; the rig's flinch clips step with it
   *  (rig content/clips/reactions.ts KNOCK_STEP draws the same numbers). The amounts above are a
   *  pet's (and a rig without footwork's) knockback, which goes out and comes back. */
  knockStep: { light: 6, heavy: 10 },
  burstMs: 220,
  numberPopMs: 100,
  numberPopFrom: 1.2,
  numberRise: 44,
  numberMs: 800,
  numberFadeMs: 250,
  critScale: 1.4,
  /** Screen shake, in CSS px under the camera (calm camera): none on a plain hit; a crit and the
   *  knockout blow get a small, short one. The frame keeps the shake inside 3 px. */
  shake: { crit: { amp: 2, ms: 120 }, knockout: { amp: 2.6, ms: 140 } },
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
  /** A pet's dodge (it has no evade clip): it springs back on its run, holds, and runs back in. */
  petEvadeHoldMs: 260,
  petEvadeBackMs: 220,
  /** The evade clip's feet leave the floor and the back one lands at these clip times: the stage
   *  carries the hop between them, on its arc (rig gate/clips/evade.ts EVADE_UP, EVADE_DOWN). */
  evadeUp: 60,
  evadeDown: 270,
  /** A swing that is neither heavy nor light is slipped this share of the time, else hopped
   *  (seeded by the log's seed and the step). */
  slipShare: 0.5,
  /** A guard raised before a block or a dodge takes at least this long, or it is not raised. */
  guardMinMs: 40,
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
  /** A skill tag ("PARRY!") with its icon stays this long (was 500: too short to read the name). */
  skillTagMs: 900,
  healRingMs: 400,
  healFillMs: 200,
  healHop: 10,
  /** A pet standing where a knocked-out body will lie runs this far clear of it (choreo/fall.ts). */
  fallClear: 3,
  healHopMs: 260,
} as const;

/** Throws and flying things. */
export const FLIGHT = {
  speed: 900,              // units per second
  minMs: 120,
  tumbleArc: 0.22,         // arc height as a share of the distance
  /** The least arc of a lob, so a short throw between close scrappers (80 units) still reads as a lob. */
  tumbleArcMin: 20,
  returnBow: 0.28,         // how far a boomerang bows sideways, as a share of the distance
  spinPerMs: 1.1,          // degrees per ms for an item that spins
  tumblePerMs: 0.9,
  vanishMs: 160,           // a weapon going back to the bag fades over this
  dropFallMs: 260,         // a "gone" weapon falls from the target to the floor
  rollDropShare: 0.25,     // a rolled Tyre falls to the floor in this share of its flight, then rolls on it
  rollShin: 0.6,           // its hub stops this many radii short of the target's legs, so its rim meets the shins
  bounceDip: 34,           // a Rubber Ball dips this far down to the floor before it bounces up
} as const;

/** Moves. */
export const MOVE = {
  /** A Move simply happens (owner, 15 Nov 2026: "I don't like the skill preview. It should just
   *  show"): no wind-up, no dim, no banner. A small tag with its icon and name pops over the user
   *  as the action starts, as long as a passive's tag. What says which Move it is, is the action
   *  itself: the real object, the body's own gesture and the Move's signature effect (owner,
   *  16 Nov 2026, against bigger tags: "No it's not about it. The effects aren't there"). */
  nameTagMs: 900,
  /** How long after its end a skill's signature effect fades out (sigs.ts). */
  sigFadeMs: 180,
  /** A passive's mark when it procs (sigs.ts): this long. */
  procMarkMs: 700,
  /** The parts of the rig's power-up clip (Second Wind's breath, the Haymaker's charge,
   *  the whistle or horn blow) and the slam clip's grab are read from their `step` events in
   *  `rig.clipInfo` (choreo/move.ts). A clip without them is split by these shares of its length. */
  partShares: [0.35, 0.7, 0.75],
  /** A Haymaker charges this long; a blow lasts this long; Second Wind breathes in this long. */
  chargeMs: 700,
  blowMs: 820,
  breathMs: 860,
  /** A Grapple squeezes for this long; the squeeze hurts this far into it. */
  squeezeMs: 700,
  squeezeHitMs: 260,
  /** How close a Body Slam stands to its target to grab it (stage units between the two places). */
  grappleGap: 27,
  /** How close a Grapple's bear hug stands (review round 2: at 27 the bodies stacked into one
   *  shape), and how high the hug lifts the target off its feet, eased up and down over this long. */
  hugGap: 33,
  /** The target's pets clear a Body Slam's landing strip: set this long before the floor hit, on a
   *  run of at most `slamClearMs` (choreo/fall.ts clearLanding). */
  slamClearLead: 80,
  slamClearMs: 420,
  hugLift: 7,
  hugLiftMs: 140,
  tarpFlightMs: 240,
  tarpDropMs: 140,
  /** The tarp drawing's phases over its progress (rig content/fx.ts TARP, one drawing for a pet and
   *  a fighter): in flight, the drop (its hem reaches the floor at `land`), the slump to its low
   *  pegged shape, the heave (looped), and off. */
  tarpPhases: { fly: 0.12, land: 0.3, slump: 0.4, heave: 0.88 },
  /** After the touchdown the sheet sinks to its low shape over this long, as the body goes down. */
  tarpSlumpMs: 140,
  /** Coming off, the sheet slides along the floor, crumples and fades over this long. */
  tarpOffMs: 420,
  /** The thrown tarp's arc tops out this far over the tallest standing head (stage units). */
  tarpClear: 16,

  /** The pops of the Firecrackers round each target after they land. */
  crackersMs: 650,
  /** Where the lit-bundle part of the content crackers effect ends (content/fx.ts CRACKERS_LIT). */
  crackersLit: 0.2,
  snatchJumpMs: 250,
  /** A Snatch stops this much further off than the body gap: the reach to the weapon hand. */
  snatchReach: 12,
  ringsMs: 800,
  /** Sand: the handful flies as a few puffs, this far apart; the target rubs its eyes this long. */
  sandGapMs: 45,
  rubMs: 900,
  /** An Air Horn's blast: the enemy scrapper covers its ears this long. */
  earsMs: 1100,
  /** A Move's result tag ("-25 AIM", "SNARED") stays this long. */
  resultMs: 1100,
  /** A blow's sound rings start this far in front of the mouth: past the whistle's and the horn's
   *  end, so the object shows (units, in the user's facing). */
  ringsOut: { whistle: 13, horn: 19 },
  /** A whistled pet runs to its owner's side, this far behind it (in front when that is within
   *  `petFloorEdge` of the stage's edge), at this speed. */
  petRunGap: 34,
  petFloorEdge: 24,
  petRunSpeed: 260,        // units per second
  freeMs: 220,
  fleeSpeed: 300,          // units per second
  /** Scared by an Air Horn, a pet first jumps on the spot this long, then runs off at this speed. */
  startleMs: 260,
  scaredSpeed: 190,
  /** A scared pet at the frame's edge jumps in toward the middle by at most this (choreo/flee.ts). */
  startleIn: 40,
  /** A shield slung on a fighter's back reaches this far past its drawn body (the startle keeps clear of it). */
  slungRoom: 8,
  /** A Taunt's target squares up, fists shaking, this long. */
  angryMs: 900,
  /** The Taunt's own gesture (rig content clips/gestures.ts: two fist pumps and a beckon). */
  tauntMs: 1300,
  /** A snare this soon after a sling ended (a Grapple's hold, then "pinned") carries that sling on. */
  reslingMs: 700,
  /** The longest stretch of one Move the clock holds at 1x at a higher speed (clock.ts). */
  holdMaxMs: 2200,
  /** Sound moments (contract rev 4). The Taunt's shout goes with its rings (120 ms in); the
   *  enemy's snort with the ANGRY clip's first "shout" face (120 ms into it). The gulp sounds when
   *  the drink clip's head goes back (320 of its 700 ms). */
  tauntShoutMs: 120,
  angrySnortMs: 120,
  gulpShare: 0.45,
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
  /** The winner's banner, drawn without a camera: its middle this far down the stage (the sky,
   *  above every head and raised fist). Under the camera it sits in the view's top band. */
  bannerY: 40,
  /** Its text size (was 24: at the top of a 720 x 480 view it reached the winner's head while
   *  the knockout reframe was still opening the view). */
  bannerSize: 20,
  /** The winner's outro place (choreo/fall.ts): its drawn front this far from the near end of the
   *  body on the floor, and its back at least this far inside the stage. */
  standGap: 8,
  standEdge: 4,
  /** Half the floor the winner's feet take there (times its drawn size): no pet's drawn span may
   *  reach into it, and the place moves at most `standSearch` from the body to find such floor. */
  standFeet: 16,
  standSearch: 90,
  standNearer: 4,
  standTouch: 3,
  /** Air kept round the win pose as drawn, in the outro frame. */
  standRoom: 3,
  /** The falling body's legs count as out of the winner's way once they are within this of where
   *  they will lie. */
  legsSlack: 3,
} as const;

/** Floor props. */
export const FLOOR = {
  max: 6, fadeMs: 240, lieY: 2,
  /** A dropped item keeps this clear of a pet's drawn reach, and of the stage edge. A pet counts
   *  when its floor line is within `petDepth` of the item's. */
  petClear: 3, petDepth: 14, edge: 4,
  /** A fallen shield lies flat: drawn this squashed toward the floor line (seen from a little
   *  above), squashing over `flopMs` as it falls over after it lands on its edge. */
  shieldFlat: 0.32, flopMs: 140,
} as const;

/** Idle: each actor gets its own phase in the 1.2 s breathing loop. */
export const IDLE = { phaseStepMs: 157 } as const;

/** Sound: at most one impact cue in any span this long. */
export const SOUND = { impactGapMs: 60,
  /** How long after its start a swing whoosh is loudest: the swish sprites (build-audio.mjs) are at
   *  their 5 ms peak 5 to 40 ms in, 15 ms in the median, and fall 10 to 20 dB by 50 ms. The whoosh
   *  is cued this long before the fastest frame of the forward drive (`Builder.swooshOf`), so its
   *  loud part is heard on it (round-2 close: cued at the drive's start, it was loud 45 to 55 ms
   *  before the arm came through and nearly silent before the hit). */
  whooshPeakMs: 15 } as const;

/** Text sizes in stage units. */
export const TEXT = {
  number: 13,
  numberSmall: 10,
  tag: 8,
  banner: 22,
  sticker: 13,
  liftAbove: 8,
  /** The widest a glyph of the fight fonts is drawn, as a share of the text size (for spacing). */
  glyph: 0.66,
  /** Clear room between the CRIT sticker and the crit's number beside it. */
  critGap: 4,
} as const;

/** The pose crossfade at every clip change (fight screen v2, the Lead's animation note): the
 *  outgoing pose, frozen at the switch, blends into the incoming clip over this long, bone angles
 *  by the shortest arc and the root linearly. A new flinch that lands mid-flinch so continues
 *  from the pose on screen instead of snapping back to frame 0. */
export const BLEND = {
  /** The shortest and longest crossfade. A bigger gap between the two poses takes longer, so no
   *  joint has to turn faster than the rig's own limit to close it. */
  minMs: 70, maxMs: 230,
  /** ms of crossfade per degree of the largest bone gap at the cut. */
  msPerDeg: 4.5,
  maxDepth: 4,
} as const;
