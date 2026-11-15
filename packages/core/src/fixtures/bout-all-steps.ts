/**
 * FROZEN FIXTURE (work package 0). A synthetic log that holds every one of the 17 step types
 * and every Move at least once (all twelve since content v2), with six actors on stage. It is a test bout, not a likely one.
 *
 * Side a: Junkyard Lil (135 HP) with a Raccoon (24) and a Goose (38), carrying a Car Door shield.
 * Side b: Big Dermot (151 HP) with a Boar (140) and a Raccoon (24), carrying a Bin Lid shield.
 * Both snapshots are sandbox snapshots at level 20 (built by hand, no Route behind them).
 * Max HP values follow the rules: (30 + 7 x Health + 3 x level) minus the companion cost, and
 * companion HP x 176 / 100 at level 20.
 *
 * What it covers beyond the step types: block and evade outcomes, a crit, a combo by a scrapper
 * and by a companion, the Stubborn extra swing, an intercept that disarms, a riposte, the three
 * `after` values of a throw, a Snatch that Firm Grip stops and one that works, a disarm that
 * Firm Grip resists, both causes of `disarm` and `shieldOff`, a knocked-out companion, a companion
 * that runs off, a snare that a hit ends (turn 17 is the skipped turn and has no step) and a
 * snare that times out (turns 25 and 28 are skipped, turn 31 holds the `free` alone), two swaps,
 * seven items on the floor (the stage shows six, so the oldest fades), a Last Stand save,
 * overtime, a knockout by overtime (`ko.by` is null), the four Moves of content v2 (a Grapple
 * hold that times out on its one skipped turn), and procs for both shields, Anticipation,
 * Firm Grip, Stubborn, Payback and Last Stand.
 *
 * Synthetic on purpose: the turn numbers jump from 31 to 50 so that the overtime steps carry a
 * legal turn number without 50 real turns. A real log only jumps for a skipped snared turn.
 * It ends with a knockout. The cap ending is the fixture `bout-cap`.
 */
import type { FighterSnapshot } from "../contracts/fighter";
import type { BagItem, BoutLog } from "../contracts/log";
import type { MoveId, WeaponId } from "../contracts/ids";

const PLAIN = { health: 100, strength: 100, agility: 100, speed: 100 } as const;

export const allStepsA: FighterSnapshot = {
  id: "fixture:all-steps-a", name: "Junkyard Lil",
  look: { build: 2, head: 0, hair: 3, face: 2, top: 4, bottom: 1, shoes: 2, accessory: 3, skin: 4, hairColor: 1, palette: 2 },
  level: 20,
  stats: { points: { health: 14, strength: 9, agility: 11, speed: 8 }, mult: PLAIN },
  perks: ["bat", "darts", "hand-axe", "car-door", "pitcher", "stubborn", "haymaker", "energy-drink",
    "tarp", "whistle", "snatch", "body-slam", "raccoon", "goose"],
  rulesVersion: 1,
};

export const allStepsB: FighterSnapshot = {
  id: "fixture:all-steps-b", name: "Big Dermot",
  look: { build: 1, head: 5, hair: 8, face: 4, top: 0, bottom: 3, shoes: 0, accessory: 0, skin: 7, hairColor: 4, palette: 10 },
  level: 20,
  stats: { points: { health: 22, strength: 8, agility: 10, speed: 7 }, mult: PLAIN },
  perks: ["broom", "monkey-wrench", "pocket-knife", "bin-lid", "firm-grip", "payback", "anticipation",
    "last-stand", "tarp", "firecrackers", "air-horn", "sand-in-the-eyes", "taunt", "second-wind", "grapple",
    "boar", "raccoon"],
  rulesVersion: 1,
};

const w = (id: WeaponId): BagItem => ({ k: "weapon", id });
const m = (id: MoveId, uses: number): BagItem => ({ k: "move", id, uses });
/** Dermot's four content v2 Moves, before and after each is used. */
const V2 = (): BagItem[] => [m("sand-in-the-eyes", 1), m("taunt", 1), m("second-wind", 1), m("grapple", 1)];

export const boutAllSteps: BoutLog = {
  logVersion: 2, rulesVersion: 1, seed: 1402,
  init: {
    actors: [
      { id: "a0", kind: "scrapper", maxHp: 135 },
      { id: "a1", kind: "raccoon", maxHp: 24 },
      { id: "a2", kind: "goose", maxHp: 38 },
      { id: "b0", kind: "scrapper", maxHp: 151 },
      { id: "b1", kind: "boar", maxHp: 140 },
      { id: "b2", kind: "raccoon", maxHp: 24 },
    ],
    bag: {
      a: [w("bat"), w("darts"), w("hand-axe"), m("haymaker", 1), m("energy-drink", 1), m("tarp", 1), m("whistle", 2), m("snatch", 2), m("body-slam", 1)],
      b: [w("broom"), w("monkey-wrench"), w("pocket-knife"), m("tarp", 1), m("firecrackers", 2), m("air-horn", 1), ...V2()],
    },
    shield: { a: "car-door", b: "bin-lid" },
  },
  steps: [
    // 0: the intro. Scrappers first, then the companions.
    { t: "enter", turn: 0, actor: "a0" },
    { t: "enter", turn: 0, actor: "b0" },
    { t: "enter", turn: 0, actor: "a1" },
    { t: "enter", turn: 0, actor: "a2" },
    { t: "enter", turn: 0, actor: "b1" },
    { t: "enter", turn: 0, actor: "b2" },

    // 1: Dermot draws the Broom. Lil blocks it with the Car Door, and the door is knocked off.
    { t: "draw", turn: 1, actor: "b0", weapon: "broom", bagAfter: [w("monkey-wrench"), w("pocket-knife"), m("tarp", 1), m("firecrackers", 2), m("air-horn", 1), ...V2()] },
    { t: "attack", turn: 1, actor: "b0", target: "a0", weapon: "broom", outcome: "block", damage: 0, crit: false, hpAfter: 135, n: 0, procs: [{ by: "a0", skill: "car-door" }] },
    { t: "shieldOff", turn: 1, actor: "b0", target: "a0", shield: "car-door", cause: "hit" },

    // 2: Lil draws the Bat and lands a two-swing combo on the Boar.
    { t: "draw", turn: 2, actor: "a0", weapon: "bat", bagAfter: [w("darts"), w("hand-axe"), m("haymaker", 1), m("energy-drink", 1), m("tarp", 1), m("whistle", 2), m("snatch", 2), m("body-slam", 1)] },
    { t: "attack", turn: 2, actor: "a0", target: "b1", weapon: "bat", outcome: "hit", damage: 23, crit: false, hpAfter: 117, n: 0 },
    { t: "attack", turn: 2, actor: "a0", target: "b1", weapon: "bat", outcome: "hit", damage: 21, crit: false, hpAfter: 96, n: 1, why: "combo" },

    // 3: the Boar flattens Lil's Raccoon. It stays down.
    { t: "attack", turn: 3, actor: "b1", target: "a1", weapon: null, outcome: "hit", damage: 27, crit: false, hpAfter: 0, n: 0 },
    { t: "ko", turn: 3, actor: "a1", by: "b1" },

    // 4: Dermot's Raccoon bites the Goose.
    { t: "attack", turn: 4, actor: "b2", target: "a2", weapon: null, outcome: "hit", damage: 6, crit: false, hpAfter: 32, n: 0 },

    // 5: Firecrackers. Every living enemy is hit at the same contact moment.
    { t: "move", turn: 5, actor: "b0", move: "firecrackers", bagAfter: [w("monkey-wrench"), w("pocket-knife"), m("tarp", 1), m("firecrackers", 1), m("air-horn", 1), ...V2()],
      hits: [{ target: "a0", damage: 16, hpAfter: 119 }, { target: "a2", damage: 15, hpAfter: 17 }] },

    // 6: Whistle. The Goose is healed and takes the next turn.
    { t: "move", turn: 6, actor: "a0", move: "whistle", bagAfter: [w("darts"), w("hand-axe"), m("haymaker", 1), m("energy-drink", 1), m("tarp", 1), m("whistle", 1), m("snatch", 2), m("body-slam", 1)] },
    { t: "heal", turn: 6, actor: "a0", target: "a2", amount: 19, hpAfter: 36 },

    // 7: the Goose pecks the other Raccoon twice.
    { t: "attack", turn: 7, actor: "a2", target: "b2", weapon: null, outcome: "hit", damage: 11, crit: false, hpAfter: 13, n: 0 },
    { t: "attack", turn: 7, actor: "a2", target: "b2", weapon: null, outcome: "hit", damage: 10, crit: false, hpAfter: 3, n: 1, why: "combo" },

    // 8: Lil's turn. She dashes in with the Bat, and Dermot's longer Broom hits first and
    //    knocks the Bat away. No attack step follows an intercept.
    { t: "intercept", turn: 8, actor: "b0", target: "a0", weapon: "broom", outcome: "hit", damage: 10, crit: false, hpAfter: 109, procs: [{ by: "b0", skill: "anticipation" }] },
    { t: "disarm", turn: 8, actor: "b0", target: "a0", weapon: "bat", cause: "hit" },

    // 9: Snatch, stopped by Firm Grip. No weapon changes hands. Snatch costs no time.
    { t: "move", turn: 9, actor: "a0", move: "snatch", bagAfter: [w("darts"), w("hand-axe"), m("haymaker", 1), m("energy-drink", 1), m("tarp", 1), m("whistle", 1), m("snatch", 1), m("body-slam", 1)],
      target: "b0", procs: [{ by: "b0", skill: "firm-grip" }] },

    // 10: Snatch again. This time Lil takes the Broom.
    { t: "move", turn: 10, actor: "a0", move: "snatch", bagAfter: [w("darts"), w("hand-axe"), m("haymaker", 1), m("energy-drink", 1), m("tarp", 1), m("whistle", 1), m("body-slam", 1)],
      target: "b0", taken: "broom" },

    // 11: Dermot blocks the Broom with his Bin Lid. Stubborn swings again and hits. Payback: a bare-handed riposte.
    { t: "attack", turn: 11, actor: "a0", target: "b0", weapon: "broom", outcome: "block", damage: 0, crit: false, hpAfter: 151, n: 0, procs: [{ by: "b0", skill: "bin-lid" }] },
    { t: "attack", turn: 11, actor: "a0", target: "b0", weapon: "broom", outcome: "hit", damage: 13, crit: false, hpAfter: 138, n: 1, why: "stubborn", procs: [{ by: "a0", skill: "stubborn" }] },
    { t: "riposte", turn: 11, actor: "b0", target: "a0", weapon: "fists", outcome: "hit", damage: 8, crit: false, hpAfter: 101, procs: [{ by: "b0", skill: "payback" }] },

    // 12: Dermot draws the Monkey Wrench and hits.
    { t: "draw", turn: 12, actor: "b0", weapon: "monkey-wrench", bagAfter: [w("pocket-knife"), m("tarp", 1), m("firecrackers", 1), m("air-horn", 1), ...V2()] },
    { t: "attack", turn: 12, actor: "b0", target: "a0", weapon: "monkey-wrench", outcome: "hit", damage: 17, crit: false, hpAfter: 84, n: 0 },

    // 13: Pitcher. Lil throws the Broom and it goes back in her bag. The hit would disarm, and Firm Grip holds on.
    { t: "throw", turn: 13, actor: "a0", target: "b0", weapon: "broom", outcome: "hit", damage: 18, crit: false, hpAfter: 120, n: 0, after: "bag",
      bagAfter: [w("darts"), w("hand-axe"), m("haymaker", 1), m("energy-drink", 1), m("tarp", 1), m("whistle", 1), m("body-slam", 1), w("broom")] },
    { t: "disarm", turn: 13, actor: "a0", target: "b0", weapon: "monkey-wrench", cause: "hit", resisted: true, procs: [{ by: "b0", skill: "firm-grip" }] },

    // 14: Body Slam with empty hands. The wrench and the Bin Lid both fly off.
    { t: "move", turn: 14, actor: "a0", move: "body-slam", bagAfter: [w("darts"), w("hand-axe"), m("haymaker", 1), m("energy-drink", 1), m("tarp", 1), m("whistle", 1), w("broom")],
      target: "b0", hits: [{ target: "b0", damage: 41, hpAfter: 79 }] },
    { t: "disarm", turn: 14, actor: "a0", target: "b0", weapon: "monkey-wrench", cause: "slam" },
    { t: "shieldOff", turn: 14, actor: "a0", target: "b0", shield: "bin-lid", cause: "slam" },

    // 15: Air Horn. The Goose runs off.
    { t: "move", turn: 15, actor: "b0", move: "air-horn", bagAfter: [w("pocket-knife"), m("tarp", 1), m("firecrackers", 1), ...V2()] },
    { t: "flee", turn: 15, actor: "a2" },

    // 16: Tarp. Lil has no companion left on stage, so the tarp lands on her.
    { t: "move", turn: 16, actor: "b0", move: "tarp", bagAfter: [w("pocket-knife"), m("firecrackers", 1), ...V2()], target: "a0" },
    { t: "snare", turn: 16, actor: "b0", target: "a0" },

    // 17: Lil's snared turn is skipped. It writes no step.

    // 18: the Boar hits her under the tarp, and the hit sets her free.
    { t: "attack", turn: 18, actor: "b1", target: "a0", weapon: null, outcome: "hit", damage: 28, crit: false, hpAfter: 56, n: 0 },
    { t: "free", turn: 18, actor: "a0", cause: "hit" },

    // 19: below half HP: Energy Drink.
    { t: "move", turn: 19, actor: "a0", move: "energy-drink", bagAfter: [w("darts"), w("hand-axe"), m("haymaker", 1), m("tarp", 1), m("whistle", 1), w("broom")] },
    { t: "heal", turn: 19, actor: "a0", target: "a0", amount: 43, hpAfter: 99 },

    // 20: Lil draws the Darts. The first is dodged, the combo dart lands. Darts stay in the hand.
    { t: "draw", turn: 20, actor: "a0", weapon: "darts", bagAfter: [w("hand-axe"), m("haymaker", 1), m("tarp", 1), m("whistle", 1), w("broom")] },
    { t: "throw", turn: 20, actor: "a0", target: "b0", weapon: "darts", outcome: "evade", damage: 0, crit: false, hpAfter: 79, n: 0, after: "held",
      bagAfter: [w("hand-axe"), m("haymaker", 1), m("tarp", 1), m("whistle", 1), w("broom")] },
    { t: "throw", turn: 20, actor: "a0", target: "b0", weapon: "darts", outcome: "hit", damage: 12, crit: false, hpAfter: 67, n: 1, why: "combo", after: "held",
      bagAfter: [w("hand-axe"), m("haymaker", 1), m("tarp", 1), m("whistle", 1), w("broom")] },

    // 21: Dermot draws the Pocket Knife and throws it. It is gone for the bout and stays on the floor.
    { t: "draw", turn: 21, actor: "b0", weapon: "pocket-knife", bagAfter: [m("firecrackers", 1), ...V2()] },
    { t: "throw", turn: 21, actor: "b0", target: "a0", weapon: "pocket-knife", outcome: "hit", damage: 14, crit: false, hpAfter: 85, n: 0, after: "gone",
      bagAfter: [m("firecrackers", 1), ...V2()] },

    // 22: Lil's Tarp. Dermot has companions on stage, so it lands on one of them: the Boar.
    { t: "move", turn: 22, actor: "a0", move: "tarp", bagAfter: [w("hand-axe"), m("haymaker", 1), m("whistle", 1), w("broom")], target: "b1" },
    { t: "snare", turn: 22, actor: "a0", target: "b1" },

    // 23: she swaps the Darts for the Broom. The Darts stay on the floor (the sixth item there).
    { t: "swap", turn: 23, actor: "a0", dropped: "darts", weapon: "broom", bagAfter: [w("hand-axe"), m("haymaker", 1), m("whistle", 1)] },
    { t: "attack", turn: 23, actor: "a0", target: "b0", weapon: "broom", outcome: "hit", damage: 11, crit: false, hpAfter: 56, n: 0 },

    // 25 and 28: the Boar's snared turns are skipped. They write no step.
    // 31: its third skipped turn. Nobody hit it, so the snare times out: the only step of the turn.
    { t: "free", turn: 31, actor: "b1", cause: "timeout" },

    // 32: Sand in the Eyes. Dermot throws a fistful at Lil: her Aim drops for the bout.
    { t: "move", turn: 32, actor: "b0", move: "sand-in-the-eyes", bagAfter: [m("firecrackers", 1), m("taunt", 1), m("second-wind", 1), m("grapple", 1)], target: "a0" },
    // 33: Taunt. Nothing else happens; his Riposte is up until his next turn.
    { t: "move", turn: 33, actor: "b0", move: "taunt", bagAfter: [m("firecrackers", 1), m("second-wind", 1), m("grapple", 1)] },
    // 34: Grapple with empty hands. A squeeze for 10, then he holds her: she is snared.
    { t: "move", turn: 34, actor: "b0", move: "grapple", bagAfter: [m("firecrackers", 1), m("second-wind", 1)], target: "a0",
      hits: [{ target: "a0", damage: 10, hpAfter: 75 }] },
    { t: "snare", turn: 34, actor: "b0", target: "a0" },
    // 35: a Grapple hold lasts one skipped turn, so that turn ends it: the free step alone.
    { t: "free", turn: 35, actor: "a0", cause: "timeout" },
    // 36: Dermot is under 40% HP: Second Wind heals 20% of his max HP.
    { t: "move", turn: 36, actor: "b0", move: "second-wind", bagAfter: [m("firecrackers", 1)] },
    { t: "heal", turn: 36, actor: "b0", target: "b0", amount: 30, hpAfter: 86 },

    // 50: overtime starts (the jump from 31 is synthetic). Dermot misses bare-handed, then loses 8% of his max HP.
    { t: "attack", turn: 50, actor: "b0", target: "a0", weapon: "fists", outcome: "evade", damage: 0, crit: false, hpAfter: 75, n: 0 },
    { t: "overtime", turn: 50, actor: "b0", damage: 12, hpAfter: 74 },

    // 51: Haymaker. It costs no time, so Lil acts again at once. Overtime still bites after the turn.
    { t: "move", turn: 51, actor: "a0", move: "haymaker", bagAfter: [w("hand-axe"), m("whistle", 1)] },
    { t: "overtime", turn: 51, actor: "a0", damage: 10, hpAfter: 65 },

    // 52: she swaps the Broom for the Hand Axe (the seventh item on the floor) and lands the
    //     boosted swing, a crit. It would be the knockout, and Last Stand leaves Dermot at 1 HP.
    { t: "swap", turn: 52, actor: "a0", dropped: "broom", weapon: "hand-axe", bagAfter: [m("whistle", 1)] },
    { t: "attack", turn: 52, actor: "a0", target: "b0", weapon: "hand-axe", outcome: "hit", damage: 87, crit: true, hpAfter: 1, n: 0, boosted: true,
      procs: [{ by: "b0", skill: "last-stand" }] },
    { t: "overtime", turn: 52, actor: "a0", damage: 10, hpAfter: 55 },

    // 53: Dermot lands a punch, and then overtime takes his last HP. Last Stand does not save
    //     from overtime. The overtime step is the kill step, and nobody is named in `ko.by`.
    { t: "attack", turn: 53, actor: "b0", target: "a0", weapon: "fists", outcome: "hit", damage: 9, crit: false, hpAfter: 46, n: 0 },
    { t: "overtime", turn: 53, actor: "b0", damage: 12, hpAfter: 0 },
    { t: "ko", turn: 53, actor: "b0", by: null },
    { t: "end", turn: 53, winner: "a", reason: "ko" },
  ],
  result: { winner: "a", reason: "ko", turns: 53, hpPct: { a: 35, b: 0 } },
};
