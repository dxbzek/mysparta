import type { SkillDef } from "../types.js";

/** The 30 launch skills (02-gdd-core.md §5.3), numbers verbatim. */
export const SKILLS: SkillDef[] = [
  // --- Boons (12): always-on passives ---
  { id: "bronze_hide", name: "Bronze Hide", kind: "boon", text: "+4 Armour", mods: { armour: 4 } },
  { id: "winged_heels", name: "Winged Heels", kind: "boon", text: "+10 Evasion", mods: { eva: 10 } },
  { id: "eagle_eye", name: "Eagle Eye", kind: "boon", text: "+10 Accuracy", mods: { acc: 10 } },
  {
    id: "hoplite_drill",
    name: "Hoplite Drill",
    kind: "boon",
    text: "+10 Block with an Aspis equipped; +5 without",
    // Conditional bonus applied in derive().
  },
  {
    id: "pankration",
    name: "Pankration",
    kind: "boon",
    text: "Fists become a true weapon: damage 10, Might scale 100%, interval 220, Combo +10",
  },
  {
    id: "titan_grip",
    name: "Titan Grip",
    kind: "boon",
    text: "Labrys-discipline interval −15%; cannot be disarmed while wielding a Labrys weapon",
  },
  { id: "keen_edge", name: "Keen Edge", kind: "boon", text: "+6 Crit", mods: { crit: 6 } },
  { id: "serpent_reflex", name: "Serpent Reflex", kind: "boon", text: "+10 Counter", mods: { counter: 10 } },
  {
    id: "iron_wrists",
    name: "Iron Wrists",
    kind: "boon",
    text: "+25 disarm resistance; +10 Disarm",
    mods: { disarmResist: 25, disarm: 10 },
  },
  {
    id: "marathon_lungs",
    name: "Marathon Lungs",
    kind: "boon",
    text: "Every 500 ticks, recover 3 + floor(Grit / 2) HP",
  },
  {
    id: "beast_bond",
    name: "Beast Bond",
    kind: "boon",
    text: "Each beast's Grit tax −1; beasts gain +15% HP",
  },
  {
    id: "endless_quiver",
    name: "Endless Quiver",
    kind: "boon",
    text: "Akontia ammo +3 per weapon; thrown damage +10%",
  },

  // --- Techniques (10): auto-triggered actives ---
  {
    id: "whirl_of_bronze",
    name: "Whirl of Bronze",
    kind: "technique",
    text: "Once per fight, when facing 2+ enemies: strike every enemy for 8 + floor(Might / 2)",
  },
  {
    id: "shield_slam",
    name: "Shield Slam",
    kind: "technique",
    text: "After a successful block, 40% chance (max once per 400 ticks): bash for 60% weapon damage; foe's next action +80 ticks",
  },
  {
    id: "perfect_riposte",
    name: "Perfect Riposte",
    kind: "technique",
    text: "Your first riposte each fight deals double damage",
  },
  {
    id: "hamstring",
    name: "Hamstring",
    kind: "technique",
    text: "Your first crit each fight also slows the foe: interval +15% for 400 ticks",
  },
  {
    id: "second_breath",
    name: "Second Breath",
    kind: "technique",
    text: "Once per fight, on dropping below 30% HP: heal 25% of HP lost",
  },
  {
    id: "rope_and_net",
    name: "Rope and Net",
    kind: "technique",
    text: "Once per fight, on your first attack after tick 300: entangle the foe for 200 ticks — no acting, evading or blocking",
  },
  {
    id: "skyfall",
    name: "Skyfall",
    kind: "technique",
    text: "Once per fight, when the foe drops below 35% HP: leap strike for 150% weapon damage; cannot be evaded or blocked",
  },
  {
    id: "twin_fangs",
    name: "Twin Fangs",
    kind: "technique",
    text: "Your first combo each fight extends by 2 guaranteed chain hits",
  },
  {
    id: "beasts_fury",
    name: "Beast's Fury",
    kind: "technique",
    text: "When one of your beasts falls: +20% damage for the rest of the fight",
  },
  {
    id: "stone_wall",
    name: "Stone Wall",
    kind: "technique",
    text: "The first three hits against you each fight deal −50% damage",
  },

  // --- Trumps (8): player-conditioned ultimates, once per fight ---
  {
    id: "wrath_of_herakles",
    name: "Wrath of Herakles",
    kind: "trump",
    text: "Your next 3 attacks within 400 ticks: +100% damage, unblockable (counters and ripostes count)",
  },
  {
    id: "aegis_of_dawn",
    name: "Aegis of Dawn",
    kind: "trump",
    text: "For 600 ticks, automatically block every incoming melee hit; your ripostes still roll",
  },
  {
    id: "gorgons_glare",
    name: "Gorgon's Glare",
    kind: "trump",
    text: "The foe is frozen for 250 ticks (their beasts are unaffected)",
  },
  {
    id: "chirons_mending",
    name: "Chiron's Mending",
    kind: "trump",
    text: "Heal 40% of missing HP; cleanse slows and entangles",
  },
  {
    id: "hermes_rush",
    name: "Hermes' Rush",
    kind: "trump",
    text: "For 500 ticks: interval −40%, +15 Evasion",
  },
  {
    id: "brontes_bolt",
    name: "Bronte's Bolt",
    kind: "trump",
    text: "20 + floor(Grace / 2) damage to the foe and all their beasts; ignores Armour",
  },
  {
    id: "cast_down",
    name: "Cast Down",
    kind: "trump",
    text: "Disarm the foe's held weapon; their next draw is delayed 300 ticks",
  },
  {
    id: "moiras_thread",
    name: "Moira's Thread",
    kind: "trump",
    text: "The next killing blow against you leaves you at 1 HP instead; your damage +25% thereafter",
  },
];

const byId = new Map(SKILLS.map((s) => [s.id, s] as const));

export function skill(id: string): SkillDef {
  const s = byId.get(id);
  if (!s) throw new Error(`Unknown skill: ${id}`);
  return s;
}

export const BOONS = SKILLS.filter((s) => s.kind === "boon");
export const TECHNIQUES = SKILLS.filter((s) => s.kind === "technique");
export const TRUMPS = SKILLS.filter((s) => s.kind === "trump");
