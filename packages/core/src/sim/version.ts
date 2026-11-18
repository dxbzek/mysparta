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
 *   6: round 2, third pass (17 November 2026): tags spaced by screen time (TAG_GAP_MS), the tag
 *      waiting longest wins a step, owed rule tags, Quick Swap no tag on the sure draws, Firm Grip
 *      keeps its weapon over Quick Swap and shows a kept weapon, Bare Knuckle's first turn is
 *      fists, Parry shows on its own blocks, Light Feet on throws, Glass Cannon on the first hit
 *      taken, Stubborn 95, Junk Collector 65, Trick Shot 50, Flurry 28, Snatch weight 16.
 *   7: round 2, third pass, gate fixes (17 November 2026): Bare Knuckle fists +200% and Combo +20
 *      while unarmed (it now really opens with fists: 39.5% ownership at level 2), Body Slam base 19
 *      (46.9% with-and-without at level 30).
 *   8: content v3, batch 1 (18 November 2026): six stats. Toughness (soak off every hit from
 *      Toughness 6, grip off disarm and shield knock-off chances), Precision (Aim and Crit; base Aim
 *      -2 and Crit -5), a starting budget of 20 with Toughness + Precision 6, stat cards and stat
 *      bonuses drawn from six stats, stat card +3 from the 9th (was +3 from the 7th, +4 from the
 *      21st), perk card +1 on the first level-up and the 18th to 22nd card (was the first two and
 *      the 17th to 22nd), Snatch weight 22, Flurry Combo 32, Body Slam time +40 (was +100), Broom
 *      Dmg 7, Pipe Dmg 14, Frying Pan Dmg 12, Rubber Chicken Dmg 6, Bike Chain Aim 25, Wok Block 26
 *      (docs/RULES.md section 9).
 *   9: content v3, batch 2 (18 November 2026): body equipment (30 pieces, docs/RULES.md 6c) worn by
 *      rivals and by the loadout, gear cards on the Route (14% of perk cards, each with +1 stat
 *      point), rivals take the default loadout.
 *  10: content v3, batch 3 (19 November 2026): the talent tree (docs/RULES.md 3c): 30 node rules,
 *      rivals spend their points down one branch that fits their kit, capstone tags.
 */
export const SIM_VERSION = 10;
