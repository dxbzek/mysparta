/**
 * The sim's version. Bump it in the same commit as any change that changes a bout log for the same
 * seed and snapshots (a rule, a number, a stream draw), and regenerate the golden digests with it:
 * test/golden.test.ts refuses new digests under an old version. A replay with no stored log is
 * played again from its seed only when the result comes out as it was stored (apps/web Replay).
 *   1: up to the sim-feel pass (15 November 2026).
 *   2: the pet pass (15 November 2026): pet growth, weapon starts, perk rerolls, redraw, Air Horn.
 */
export const SIM_VERSION = 2;
