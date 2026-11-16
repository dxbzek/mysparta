/**
 * The sim's version. Bump it in the same commit as any change that changes a bout log for the same
 * seed and snapshots (a rule, a number, a stream draw), and regenerate the golden digests with it:
 * test/golden.test.ts refuses new digests under an old version. A replay with no stored log is
 * played again from its seed only when the result comes out as it was stored (apps/web Replay).
 *   1: up to the sim-feel pass (15 November 2026).
 *   2: the pet pass (15 November 2026): pet growth, weapon starts, perk rerolls, redraw, Air Horn.
 *   3: the start pass (15 November 2026): 25 weapon rows retuned so no starting weapon, Thrown
 *      or melee, decides level-1 bouts.
 *   4: round 2 (16 November 2026): a starting skill, Moves after the opening (unarmed ones
 *      excepted), big hits in the opening, the sure first draw, once-a-bout tags and booster tags,
 *      the weapon cap and the falling weapon share, +1 stat on early perk cards, Snatch 10/1,
 *      Anticipation 20, Firm Grip 80, Junk Collector's throws, Hockey Stick Dmg 7, the easy card.
 *   5: round 2, second pass (16 November 2026): rare tags never wait and an owed tag shows later,
 *      Quick Swap's faster draw and swap turns, Bare Knuckle opens with fists, the last weapon is
 *      held harder, stat cards that grow, +1 stat on the 17th to 22nd perk card, 20 weapon, skill
 *      and pet rows (docs/RULES.md section 9).
 */
export const SIM_VERSION = 5;
