/**
 * Rival ghosts for the prototype Arena: deterministic Champions generated
 * from a name pool, levelled by simulating drafts with a greedy picker.
 * In production these are real players' defence snapshots (03-gdd §1).
 */

import { combineSeed, makeRng } from "./prng.js";
import { createChampion, snapshot } from "./champion.js";
import { generateDraft } from "./draft.js";
import { skill } from "./content/skills.js";
import type { BattlePlan, Champion, ChampionSnapshot, FateOffer, GambitId, Stance, TrumpTrigger } from "./types.js";

const RIVAL_NAMES = [
  "Nikandros", "Thaleia", "Peisistratos", "Eurydike", "Lysimachos", "Chrysanthe",
  "Demophon", "Ianthe", "Kallikrates", "Melitta", "Orestes", "Phaidra",
  "Sostratos", "Timandra", "Xanthippos", "Zenobia", "Alkaios", "Berenike",
  "Damokles", "Elpis", "Glaukos", "Hypatia", "Iason", "Kassandra",
  "Leonidas", "Myrrine", "Nearchos", "Olympias", "Periandros", "Rhode",
  "Straton", "Theano", "Philon", "Aspasia", "Kleon", "Danae",
] as const;

/** Greedy draft AI: prefers its Omen's primary stat, samples the arsenal. */
function pickOffer(c: Champion, offers: FateOffer[], rng: ReturnType<typeof makeRng>): number {
  // Take a weapon if only the starter is carried; take a skill if none owned.
  const weaponIdx = offers.findIndex((o) => o.kind === "weapon");
  if (c.weapons.length < 3 && weaponIdx >= 0 && rng.pct(70)) return weaponIdx;
  const skillIdx = offers.findIndex((o) => o.kind === "skill");
  if (c.skills.length < 3 && skillIdx >= 0 && rng.pct(60)) return skillIdx;
  const beastIdx = offers.findIndex((o) => o.kind === "beast");
  if (beastIdx >= 0 && rng.pct(35)) return beastIdx;
  const stat3 = offers.findIndex((o) => o.kind === "stat3");
  if (stat3 >= 0) return stat3;
  return 0;
}

function makePlan(c: Champion, seed: number): BattlePlan {
  const rng = makeRng(combineSeed(seed, "plan"));
  const stances: Stance[] = ["aggressive", "measured", "guarded"];
  const gambits: GambitId[] = ["close_the_gap", "hold_ground", "feint", "test_the_shield", "war_cry"];
  if (c.weapons.some((w) => w.startsWith("ak") || w === "discus" || w === "peltast_blades" || w === "kestros")) {
    gambits.push("hurl_first");
  }
  if (c.beasts.length > 0) gambits.push("loose_the_beast");
  const plan: BattlePlan = { stance: rng.pick(stances), gambit: rng.pick(gambits) };
  const trumps = c.skills.filter((s) => skill(s).kind === "trump");
  if (trumps.length > 0) {
    const triggers: TrumpTrigger[] = [
      "first_clash", "first_blood_taken", "when_bloodied", "foe_bloodied", "tenth_exchange",
    ];
    plan.trumpSkill = rng.pick(trumps);
    plan.trumpTrigger = rng.pick(triggers);
  }
  return plan;
}

export interface Rival {
  snapshot: ChampionSnapshot;
  kleos: number;
  omen: string;
}

/** Build one rival at `level`, deterministic for (name, realmDay, slot). */
export function makeRival(name: string, level: number, varietySeed: number): Rival {
  const c = createChampion(name);
  const rng = makeRng(combineSeed(c.seed, "career", varietySeed));
  while (c.level < level) {
    const offers = generateDraft(c, c.level + 1, 0);
    applyDraftViaRival(c, offers, pickOffer(c, offers, rng));
  }
  const plan = makePlan(c, combineSeed(c.seed, varietySeed));
  const kleos = 1500 + (level - 1) * 40 + rng.roll(-30, 30);
  return { snapshot: snapshot(c, plan), kleos, omen: c.omen };
}

// Local import indirection to avoid a cycle at module init.
import { applyDraft } from "./draft.js";
function applyDraftViaRival(c: Champion, offers: FateOffer[], picked: number) {
  applyDraft(c, offers, picked, false);
}

/**
 * The Arena board: 6 rivals near the Champion (03-gdd §1.1's 2/2/2
 * beatable/even/reach bands, expressed in levels for the prototype).
 */
export function arenaBoard(c: Champion, dayKey: string, refresh: number): Rival[] {
  const rng = makeRng(combineSeed(c.seed, "board", dayKey, refresh));
  const spread = [-1, -1, 0, 0, 1, 2];
  const picked = new Set<string>();
  return spread.map((delta, slot) => {
    let name = RIVAL_NAMES[rng.int(RIVAL_NAMES.length)]!;
    while (picked.has(name) || name.toLowerCase() === c.name) {
      name = RIVAL_NAMES[rng.int(RIVAL_NAMES.length)]!;
    }
    picked.add(name);
    const level = Math.max(1, c.level + delta);
    return makeRival(name, level, combineSeed(dayKey, refresh, slot));
  });
}
