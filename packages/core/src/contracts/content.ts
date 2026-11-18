/**
 * FROZEN CONTRACT (work package 0). Shapes of the content tables, and the identity facts that the
 * stage, the fight screen and the rig need before the sim exists. The number tables (WEAPONS,
 * SKILLS, COMPANIONS as total Records) belong to the sim lane and spread WEAPON_META, so there is
 * one copy of every identity fact. Lookups by raw string from a save warn once and fall back.
 * They never throw.
 */
import type { CompanionId, GearId, GearSlot, HeldId, PerkId, ShieldId, SkillId, TalentBranch, TalentId } from "./ids";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "mythic";
export type WeaponTag = "light" | "heavy" | "pole" | "thrown" | "blade";
export type AttackClip = "punch" | "flick" | "swing" | "smash" | "thrust" | "throw";
export interface WeaponNumbers { tempo: number; dmg: number; reach: number | null /* null = thrown */;
  draw: number; aim: number; pierce: number; block: number; evade: number; riposte: number;
  combo: number; disarm: number; crit: number }
export interface WeaponDef { id: HeldId; rarity: Rarity | null; tags: readonly WeaponTag[];
  clip: AttackClip; tiers: readonly [WeaponNumbers] }     // array so tiers can come later
export interface SkillDef { id: SkillId; kind: "booster" | "passive" | "move"; rarity: Rarity;
  tiers: readonly [Readonly<Record<string, number>>];     // named numbers; behaviour is sim code keyed by id
  move?: { weight: number; uses: number } }
/** `swings` is how many swings one attack makes (2: the Alley Cat scratches twice; the second is
 *  written as a combo swing). `flies`: no intercept and no riposte against it (the Crow). */
export interface CompanionDef { id: CompanionId; rarity: Rarity /* label only */;
  weight: number; limit: number;
  excludes: readonly CompanionId[]; hpCostPct: number; hp: number; strength: number; agility: number;
  speed: number; dmg: number; combo: number; evade: number; aim: number; disarm: number;
  startClock: number; swings: 1 | 2; flies: boolean }
/** The numbers of a shield while it is on the back arm. Whole numbers; every one of them ends
 *  when the shield is knocked off.
 *  block        added to Block
 *  thrownBlock  added to Block against a throw only, after the throw halving
 *  armor        added to Armor
 *  riposte      added to Riposte
 *  damage       percent added to the owner's damage multiplier (a minus is the cost)
 *  tempo        percent added to the owner's turn time (a plus is the cost)
 *  knock        a swing that is not evaded knocks it off with this percent of the attacker's
 *               Disarm chance (a slam always does) */
export interface ShieldNumbers { block: number; thrownBlock: number; armor: number; riposte: number;
  damage: number; tempo: number; knock: number }
export interface ShieldDef { id: ShieldId; rarity: Rarity; tiers: readonly [ShieldNumbers] }

/**
 * The numbers of one piece of body equipment while it is worn (content v3, batch 2). Whole numbers,
 * each optional (absent = 0). One small bonus, sometimes a small cost (docs/RULES.md 6c).
 *  health strength agility speed toughness precision
 *               stat points, added to the snapshot's stats when a bout's snapshot is made (the sim
 *               never adds them again, like a booster's)
 *  evade block aim pierce intercept riposte combo disarm crit armor grip soak
 *               added to the derived value of that name while worn
 *  headTough    Toughness added for the soak of a crit taken (a crit is a clean blow to the head)
 *  critCut      percent cut from the half a crit adds to a hit taken (x1.5 becomes x(1.5 - critCut/100))
 *  sandProof    1: Sand in the Eyes takes no Aim from the wearer
 *  petEvade     Evade added against a companion's swing
 *  fistDmg      percent added to the damage multiplier of a swing with fists
 *  snatchResist percent chance to keep the weapon when a Snatch takes it
 *  thrownBlock  Block added against a throw only, after the throw halving
 *  moveSoak     HP taken off a Body Slam or a Grapple hit taken (never below 1)
 *  drawEase     taken off the 6 of the empty-hand draw `S / (S + 6)` (not with Quick Swap or Bare Knuckle)
 *  petSoak      HP taken off every hit of a companion's swing taken (never below 1)
 *  snareCut     a Tarp's snare on the wearer lasts this many skipped turns fewer (at least 1)
 *  startClock   added to the start clock (a minus starts sooner) */
export type GearKey = "health" | "strength" | "agility" | "speed" | "toughness" | "precision"
  | "evade" | "block" | "aim" | "pierce" | "intercept" | "riposte" | "combo" | "disarm" | "crit" | "armor" | "grip" | "soak"
  | "headTough" | "critCut" | "sandProof" | "petEvade" | "fistDmg" | "snatchResist" | "thrownBlock" | "moveSoak"
  | "drawEase" | "petSoak" | "snareCut" | "startClock";
export type GearNumbers = Readonly<Partial<Record<GearKey, number>>>;
export interface GearDef { id: GearId; slot: GearSlot; rarity: Rarity; tiers: readonly [GearNumbers] }
/** What must be known about a piece of gear before any number table exists: its slot, its rarity
 *  colour, and what the real object is and where it sits on the body. Identity only. */
export interface GearMeta { slot: GearSlot; rarity: Rarity; look: string }
export const GEAR_META: Readonly<Record<GearId, GearMeta>> = {
  // head (on the head bone)
  "bandana":          { slot: "head",  rarity: "common",   look: "a cloth band knotted round the brow, the tails hanging at the back" },
  "beanie":           { slot: "head",  rarity: "common",   look: "a knitted cap pulled over the crown, a folded cuff over the brow" },
  "hard-hat":         { slot: "head",  rarity: "uncommon", look: "a yellow builder's hard hat with a ridge and a short brim" },
  "goggles":          { slot: "head",  rarity: "uncommon", look: "work goggles over the eyes, a strap round the head" },
  "welding-mask":     { slot: "head",  rarity: "rare",     look: "a dark welding mask over the face with a narrow viewing slot, hinged at the temples" },
  "motorbike-helmet": { slot: "head",  rarity: "epic",     look: "a full-face motorbike helmet with a dark visor and a chin bar" },
  // torso (on the torso bone)
  "work-vest":        { slot: "torso", rarity: "common",   look: "a canvas work vest with chest pockets over the shirt" },
  "hi-vis-vest":      { slot: "torso", rarity: "common",   look: "an orange high-visibility vest with two silver bands" },
  "padded-jacket":    { slot: "torso", rarity: "uncommon", look: "a puffy quilted jacket, the quilting in rows" },
  "leather-jacket":   { slot: "torso", rarity: "uncommon", look: "a black leather jacket, open, with a zip and a collar" },
  "hockey-chest-pad": { slot: "torso", rarity: "rare",     look: "a hard hockey chest protector over the shirt, plates on the chest and shoulders" },
  "tyre-rubber-vest": { slot: "torso", rarity: "epic",     look: "a vest cut from old tyre rubber, tread on the outside, laced at the sides" },
  // hands (on both hand bones)
  "work-gloves":      { slot: "hands", rarity: "common",   look: "tan leather work gloves with a cuff" },
  "taped-fists":      { slot: "hands", rarity: "common",   look: "white tape wound round the knuckles and wrists" },
  "rubber-gloves":    { slot: "hands", rarity: "uncommon", look: "long yellow rubber washing-up gloves up the forearm" },
  "fingerless-gloves":{ slot: "hands", rarity: "uncommon", look: "black fingerless gloves, the fingertips bare" },
  "oven-mitts":       { slot: "hands", rarity: "rare",     look: "big padded oven mitts, a thumb and a mitten, checked cloth" },
  "welding-gloves":   { slot: "hands", rarity: "epic",     look: "heavy suede welding gauntlets up to the mid forearm" },
  // legs (on the thigh and shin bones)
  "ripped-jeans":     { slot: "legs",  rarity: "common",   look: "blue jeans torn open at the knees" },
  "cargo-pants":      { slot: "legs",  rarity: "common",   look: "khaki cargo trousers with a big pocket on each thigh" },
  "knee-pads":        { slot: "legs",  rarity: "uncommon", look: "hard knee pads strapped over the knees" },
  "track-pants":      { slot: "legs",  rarity: "uncommon", look: "track trousers with two stripes down the side" },
  "magazine-shin-guards": { slot: "legs", rarity: "rare",  look: "rolled magazines taped round both shins as guards" },
  "overalls":         { slot: "legs",  rarity: "epic",     look: "denim work overalls, the bib up the chest on two straps" },
  // feet (on the foot bones)
  "sneakers":         { slot: "feet",  rarity: "common",   look: "white sneakers with a coloured stripe and laces" },
  "flip-flops":       { slot: "feet",  rarity: "common",   look: "rubber flip-flops, bare toes and a thong strap" },
  "rain-boots":       { slot: "feet",  rarity: "uncommon", look: "green rubber rain boots up the calf" },
  "skate-shoes":      { slot: "feet",  rarity: "uncommon", look: "flat chunky skate shoes with a thick sole" },
  "steel-toe-boots":  { slot: "feet",  rarity: "rare",     look: "brown work boots laced up the ankle, a scuffed steel toe cap" },
  "slippers":         { slot: "feet",  rarity: "epic",     look: "fluffy house slippers" },
};

/**
 * A talent node (content v3, batch 3, plan 13.11). Identity: its branch, its tier (0 and 1 hold two
 * nodes each, 2 holds one, 3 is the capstone) and how many ranks it takes. A node of tier t needs
 * TALENT_TIER_NEED[t] points spent in the lower tiers of its branch. `per` holds the node's named
 * numbers for ONE rank: a node at rank r gives r times each (a capstone has one rank). What the
 * numbers do is sim code keyed by the id (docs/RULES.md 3c).
 */
export interface TalentMeta { branch: TalentBranch; tier: 0 | 1 | 2 | 3; max: 1 | 2 | 3 }
export interface TalentDef extends TalentMeta { id: TalentId; per: Readonly<Record<string, number>> }
export const TALENT_TIER_NEED = [0, 2, 4, 5] as const;
export const TALENT_META: Readonly<Record<TalentId, TalentMeta>> = {
  "iron-knuckles":  { branch: "brawler",   tier: 0, max: 3 },
  "gym-rat":        { branch: "brawler",   tier: 0, max: 3 },
  "follow-through": { branch: "brawler",   tier: 1, max: 3 },
  "stagger":        { branch: "brawler",   tier: 1, max: 2 },
  "bruiser":        { branch: "brawler",   tier: 2, max: 2 },
  "knockdown":      { branch: "brawler",   tier: 3, max: 1 },
  "weapon-care":    { branch: "arsenal",   tier: 0, max: 3 },
  "quick-hands":    { branch: "arsenal",   tier: 0, max: 3 },
  "hook":           { branch: "arsenal",   tier: 1, max: 3 },
  "fast-swap":      { branch: "arsenal",   tier: 1, max: 2 },
  "steel-guard":  { branch: "arsenal",   tier: 2, max: 2 },
  "fresh-steel":    { branch: "arsenal",   tier: 3, max: 1 },
  "strong-arm":     { branch: "thrower",   tier: 0, max: 3 },
  "sidearm":        { branch: "thrower",   tier: 0, max: 3 },
  "dead-eye":       { branch: "thrower",   tier: 1, max: 3 },
  "bank-shot":      { branch: "thrower",   tier: 1, max: 2 },
  "quick-catch":    { branch: "thrower",   tier: 2, max: 2 },
  "bullseye":       { branch: "thrower",   tier: 3, max: 1 },
  "good-boy":       { branch: "pack",      tier: 0, max: 3 },
  "sharp-teeth":    { branch: "pack",      tier: 0, max: 3 },
  "quick-paws":     { branch: "pack",      tier: 1, max: 3 },
  "second-bowl":    { branch: "pack",      tier: 1, max: 2 },
  "guard-dog":      { branch: "pack",      tier: 2, max: 2 },
  "loyal-pack":     { branch: "pack",      tier: 3, max: 1 },
  "thick-skin":     { branch: "iron-wall", tier: 0, max: 3 },
  "brace":          { branch: "iron-wall", tier: 0, max: 3 },
  "shield-strap":   { branch: "iron-wall", tier: 1, max: 2 },
  "counter":        { branch: "iron-wall", tier: 1, max: 3 },
  "turtle":         { branch: "iron-wall", tier: 2, max: 2 },
  "unbreakable":    { branch: "iron-wall", tier: 3, max: 1 },
};

/** Roll weight of one item inside its category. Common to Mythic is 200 to 1. */
export const RARITY_WEIGHT: Readonly<Record<Rarity, number>> = {
  common: 400, uncommon: 150, rare: 50, epic: 12, mythic: 2,
};

/** What must be known about a weapon before any number table exists: which swing clip, which
 *  sound family, which rarity colour, and how the object is really held and used. Identity
 *  only, never balance; Reach is the one number of the rules in it.
 *
 *  `hands` is how many hands the weapon takes. 2 means one of two things:
 *    - both hands on one shaft: the back hand is pinned to the art's `grip2`; or
 *    - `pair`: one object in each fist (bare fists count). The art is drawn in both hands, and an
 *      extra combo swing is made with the other hand (the stage sets `Dress.lead`).
 *  `use` is one plain line: how it is held and swung, then which part hits. The art lanes draw
 *  and key to it, and a reviewer checks the use strips against it. It is not player text.
 *  `flight` is how a Thrown weapon flies; exactly the Thrown weapons have one.
 *  `flex` marks a weapon that bends: it is drawn as linked segments that trail the hand. */
export interface WeaponMeta { rarity: Rarity | null; tags: readonly WeaponTag[]; clip: AttackClip;
  reach: number /* 0 for fists and Thrown weapons */;
  hands: 1 | 2; pair?: true; use: string;
  flight?: ThrownFlight; flex?: true }
/** How a Thrown weapon flies. straight: point first, no spin. tumble: end over end on an arc.
 *  return: a curve that comes back to the hand. spin: flat like a disc, on a low straight line.
 *  roll: bowled, it rolls along the floor into the target. bounce: bounces once on the floor. */
export type ThrownFlight = "straight" | "tumble" | "return" | "spin" | "roll" | "bounce";

export const WEAPON_META: Readonly<Record<HeldId, WeaponMeta>> = {
  "fists": {
    rarity: null, tags: [], clip: "punch", reach: 0, hands: 2, pair: true,
    use: "boxing guard, straight punches, the hands take turns on a combo; the knuckles hit" },
  "pipe": {
    rarity: "common", tags: [], clip: "swing", reach: 1, hands: 1,
    use: "gripped near one end, side swing like a club; the far end hits" },
  "pocket-knife": {
    rarity: "common", tags: ["light", "blade"], clip: "flick", reach: 0, hands: 1,
    use: "fist grip, blade forward, short quick stabs; the point hits" },
  "broom": {
    rarity: "common", tags: ["pole"], clip: "thrust", reach: 3, hands: 2,
    use: "held like a staff, thrust head first; the bristle head hits" },
  "machete": {
    rarity: "common", tags: ["blade"], clip: "swing", reach: 1, hands: 1,
    use: "diagonal slash from the shoulder; the blade edge hits" },
  "hand-axe": {
    rarity: "common", tags: ["heavy", "blade"], clip: "swing", reach: 1, hands: 1,
    use: "short overhead chop; the axe head hits" },
  "bat": {
    rarity: "uncommon", tags: [], clip: "swing", reach: 2, hands: 2,
    use: "both hands at the knob, full side swing from the shoulder; the barrel hits" },
  "pitchfork": {
    rarity: "uncommon", tags: ["pole"], clip: "thrust", reach: 3, hands: 2,
    use: "low thrust with both hands; the tines hit" },
  "crowbar": {
    rarity: "uncommon", tags: ["heavy"], clip: "swing", reach: 1, hands: 1,
    use: "side swing with the hook end leading; the hook hits" },
  "knuckle-dusters": {
    rarity: "uncommon", tags: ["light"], clip: "punch", reach: 0, hands: 2, pair: true,
    use: "worn on both fists, punches like bare fists; the metal knuckles hit" },
  "shovel": {
    rarity: "uncommon", tags: ["heavy", "pole"], clip: "smash", reach: 2, hands: 2,
    use: "lifted overhead, brought down flat; the flat of the blade hits" },
  "sledgehammer": {
    rarity: "uncommon", tags: ["heavy"], clip: "smash", reach: 1, hands: 2,
    use: "hands apart on the shaft, a big slow overhead arc; the hammer head hits" },
  "darts": {
    rarity: "uncommon", tags: ["thrown", "light"], clip: "throw", reach: 0, hands: 1, flight: "straight",
    use: "pinch grip at eye level, a flick of the wrist, flies straight and point first; the point hits" },
  "bike-chain": {
    rarity: "rare", tags: ["pole"], clip: "swing", reach: 4, hands: 1, flex: true,
    use: "whipped in an arc, the chain trails and bends; the last links hit" },
  "monkey-wrench": {
    rarity: "rare", tags: ["heavy"], clip: "swing", reach: 1, hands: 1,
    use: "side swing or a downward knock; the jaw end hits" },
  "pickaxe": {
    rarity: "rare", tags: ["heavy"], clip: "smash", reach: 2, hands: 2,
    use: "overhead arc, point down; the pick point hits" },
  "rebar": {
    rarity: "rare", tags: ["heavy"], clip: "swing", reach: 2, hands: 2,
    use: "heavy side swing with both hands; the far third of the bar hits" },
  "screwdrivers": {
    rarity: "rare", tags: ["light"], clip: "flick", reach: 0, hands: 2, pair: true,
    use: "one in each fist, jabs that take turns; the tips hit" },
  "garden-shears": {
    rarity: "rare", tags: ["light", "blade"], clip: "flick", reach: 1, hands: 2,
    use: "one hand on each handle, lunge and snip shut; the closing blades hit" },
  "stop-sign": {
    rarity: "rare", tags: ["pole", "heavy", "blade"], clip: "smash", reach: 3, hands: 2,
    use: "held by the post, overhead chop, edge first; the edge of the sign hits" },
  "boomerang": {
    rarity: "rare", tags: ["thrown"], clip: "throw", reach: 0, hands: 1, flight: "return",
    use: "side-arm throw, flies a curve and comes back to the hand when the log says so; the leading wing hits" },
  "anvil": {
    rarity: "epic", tags: ["heavy"], clip: "smash", reach: 1, hands: 2,
    use: "hugged, heaved overhead with bent knees, dropped forward; the flat base hits" },
  "ball-and-chain": {
    rarity: "epic", tags: ["heavy"], clip: "smash", reach: 2, hands: 2, flex: true,
    use: "handle in both hands, the ball swings overhead on its chain and lands after the hands stop; the ball hits" },
  "umbrella": {
    rarity: "epic", tags: ["light"], clip: "flick", reach: 1, hands: 1,
    use: "closed, a fencing lunge, pops open on a block or an evade; the ferrule tip hits" },
  "pool-cue": {
    rarity: "epic", tags: ["pole", "light"], clip: "thrust", reach: 3, hands: 2,
    use: "bridge hand in front, back hand drives it like a cue shot; the cue tip hits" },
  "bricks": {
    rarity: "epic", tags: ["thrown", "heavy"], clip: "throw", reach: 0, hands: 1, flight: "tumble",
    use: "overarm lob, tumbles on an arc; the brick hits" },
  "rubber-chicken": {
    rarity: "mythic", tags: ["light"], clip: "swing", reach: 1, hands: 1, flex: true,
    use: "held by the feet, a floppy slap that bends and trails; the head hits" },
  "lawn-flamingo": {
    rarity: "mythic", tags: ["pole"], clip: "thrust", reach: 4, hands: 2,
    use: "held by the steel legs, thrust beak first; the beak hits" },
  // ---- content v2: melee
  "frying-pan": {
    rarity: "common", tags: [], clip: "swing", reach: 1, hands: 1,
    use: "held by the handle, a flat forehand swing like a tennis shot; the flat base of the pan hits" },
  "tyre-iron": {
    rarity: "common", tags: [], clip: "swing", reach: 1, hands: 1,
    use: "gripped at the long arm of the cross, a short hard downward knock; the socket end hits" },
  "golf-club": {
    rarity: "uncommon", tags: [], clip: "swing", reach: 2, hands: 2,
    use: "both hands on the grip, a full golf swing from low to high; the club head hits" },
  "hockey-stick": {
    rarity: "uncommon", tags: ["pole"], clip: "swing", reach: 2, hands: 2,
    use: "both hands apart on the shaft, a low sweeping slap shot; the blade of the stick hits" },
  "folding-chair": {
    rarity: "uncommon", tags: ["heavy"], clip: "smash", reach: 1, hands: 2,
    use: "folded flat, held by the back legs, lifted and brought down overhead; the folded seat hits" },
  "cricket-bat": {
    rarity: "rare", tags: ["heavy"], clip: "swing", reach: 2, hands: 2,
    use: "both hands on the handle, a driving swing from the shoulder; the flat face of the bat hits" },
  "wok": {
    rarity: "rare", tags: ["heavy"], clip: "swing", reach: 1, hands: 1,
    use: "held by its long handle, swung flat from the side; the round base hits" },
  "plunger": {
    rarity: "mythic", tags: ["light"], clip: "thrust", reach: 2, hands: 1,
    use: "held by the end of the stick, a straight fencing jab cup first; the rubber cup hits" },
  // ---- content v2: Thrown
  "plastic-bottle": {
    rarity: "common", tags: ["thrown", "light"], clip: "throw", reach: 0, hands: 1, flight: "tumble",
    use: "a plastic water bottle, never glass, lobbed overarm, it tumbles end over end; the bottle hits" },
  "rubber-ball": {
    rarity: "common", tags: ["thrown", "light"], clip: "throw", reach: 0, hands: 1, flight: "bounce",
    use: "a hard overarm throw at the floor, it bounces once up into the target; the ball hits" },
  "paint-can": {
    rarity: "uncommon", tags: ["thrown", "heavy"], clip: "throw", reach: 0, hands: 1, flight: "tumble",
    use: "a closed can swung by its wire handle and let go, it tumbles on a low arc; the can hits" },
  "traffic-cone": {
    rarity: "uncommon", tags: ["thrown"], clip: "throw", reach: 0, hands: 1, flight: "tumble",
    use: "held by its narrow top, flung base first, it tumbles; the wide base hits" },
  "hubcap": {
    rarity: "rare", tags: ["thrown"], clip: "throw", reach: 0, hands: 1, flight: "spin",
    use: "a side-arm throw like a flying disc, it spins flat on a straight line; the rim hits" },
  "tyre": {
    rarity: "epic", tags: ["thrown", "heavy"], clip: "throw", reach: 0, hands: 2, flight: "roll",
    use: "lifted in both hands and bowled low, it rolls along the floor into the shins; the tread hits" },
};

/** What must be known about a shield before any number table exists: its rarity colour and how
 *  the object is really carried and raised. Identity only. Every shield is carried on the back
 *  forearm by a handle while the front hand keeps its weapon, comes up on a block (the
 *  "block-shield" clip), and lies on the floor as a prop when it is knocked off. */
export interface ShieldMeta { rarity: Rarity; use: string }
export const SHIELD_META: Readonly<Record<ShieldId, ShieldMeta>> = {
  "car-door": { rarity: "uncommon",
    use: "a car door held by its inner handle on the back arm, raised to take a swing; the panel blocks" },
  "bin-lid": { rarity: "common",
    use: "a round bin lid held by its centre handle on the back arm, punched up to meet a swing; the lid blocks" },
  "wooden-pallet": { rarity: "uncommon",
    use: "a heavy wooden pallet hugged to the back arm, a wall to hide behind; the slats block and splinter" },
  "ironing-board": { rarity: "rare",
    use: "a long ironing board held upright on the back arm, wide enough to catch a throw; the board face blocks" },
  "skateboard": { rarity: "rare",
    use: "a skateboard held by its trucks on the back arm, flicked up to knock a swing aside; the deck blocks" },
  "riot-shield": { rarity: "epic",
    use: "a clear plastic riot shield on the back arm, the biggest cover there is; the shield face blocks" },
};

/** The rarity word every perk card shows. For companions it is a label and a colour only: their
 *  roll uses the companion weights, not RARITY_WEIGHT. */
export const RARITY_OF: Readonly<Record<PerkId, Rarity>> = {
  // weapons (9 common, 12 uncommon, 11 rare, 6 epic, 3 mythic)
  "pipe": "common", "pocket-knife": "common", "broom": "common", "machete": "common", "hand-axe": "common",
  "frying-pan": "common", "tyre-iron": "common", "plastic-bottle": "common", "rubber-ball": "common",
  "bat": "uncommon", "pitchfork": "uncommon", "crowbar": "uncommon", "knuckle-dusters": "uncommon",
  "shovel": "uncommon", "sledgehammer": "uncommon", "darts": "uncommon",
  "golf-club": "uncommon", "hockey-stick": "uncommon", "folding-chair": "uncommon", "paint-can": "uncommon",
  "traffic-cone": "uncommon",
  "cricket-bat": "rare", "wok": "rare", "hubcap": "rare", "tyre": "epic", "plunger": "mythic",
  "bike-chain": "rare", "monkey-wrench": "rare", "pickaxe": "rare", "rebar": "rare", "screwdrivers": "rare",
  "garden-shears": "rare", "stop-sign": "rare", "boomerang": "rare",
  "anvil": "epic", "ball-and-chain": "epic", "umbrella": "epic", "pool-cue": "epic", "bricks": "epic",
  "rubber-chicken": "mythic", "lawn-flamingo": "mythic",
  // boosters
  "big-heart": "common", "heavy-hands": "common", "light-feet": "common", "fast-twitch": "common",
  "glass-cannon": "epic", "mountain": "mythic",
  // passives
  "padding": "common", "anticipation": "common",
  "sharpening-stone": "uncommon", "bare-knuckle": "uncommon", "payback": "uncommon", "flurry": "uncommon",
  "firm-grip": "uncommon", "head-start": "uncommon", "sharp-eye": "uncommon",
  "parry": "uncommon", "quick-swap": "common", "pet-lover": "uncommon", "junk-collector": "uncommon",
  "trick-shot": "rare",
  "heavy-lifter": "rare", "pitcher": "rare", "plate-vest": "rare", "knock-loose": "rare",
  "last-stand": "rare", "stubborn": "rare",
  "slippery": "epic",
  // Moves
  "haymaker": "uncommon", "energy-drink": "uncommon", "tarp": "uncommon", "whistle": "uncommon",
  "firecrackers": "rare", "snatch": "rare", "air-horn": "rare",
  "body-slam": "epic",
  "sand-in-the-eyes": "uncommon", "taunt": "uncommon", "second-wind": "rare", "grapple": "rare",
  // companions (label only)
  "raccoon": "uncommon", "goose": "epic", "boar": "epic",
  "stray-dog": "uncommon", "crow": "rare", "alley-cat": "rare",
  // shields (the same words as SHIELD_META)
  "car-door": "uncommon", "bin-lid": "common", "wooden-pallet": "uncommon", "ironing-board": "rare",
  "skateboard": "rare", "riot-shield": "epic",
  // gear (the same words as GEAR_META: 10 common, 10 uncommon, 5 rare, 5 epic)
  "bandana": "common", "beanie": "common", "hard-hat": "uncommon", "goggles": "uncommon", "welding-mask": "rare",
  "motorbike-helmet": "epic",
  "work-vest": "common", "hi-vis-vest": "common", "padded-jacket": "uncommon", "leather-jacket": "uncommon",
  "hockey-chest-pad": "rare", "tyre-rubber-vest": "epic",
  "work-gloves": "common", "taped-fists": "common", "rubber-gloves": "uncommon", "fingerless-gloves": "uncommon",
  "oven-mitts": "rare", "welding-gloves": "epic",
  "ripped-jeans": "common", "cargo-pants": "common", "knee-pads": "uncommon", "track-pants": "uncommon",
  "magazine-shin-guards": "rare", "overalls": "epic",
  "sneakers": "common", "flip-flops": "common", "rain-boots": "uncommon", "skate-shoes": "uncommon",
  "steel-toe-boots": "rare", "slippers": "epic",
};

/** Sound family of a held item: fists and knuckle-dusters "fist", a Blade tag "blade", the rest
 *  "blunt". `null` is a companion's bare attack and counts as "fist". An unknown id is "blunt". */
export function impactFamily(id: HeldId | null): "fist" | "blade" | "blunt" {
  if (id === null || id === "fists" || id === "knuckle-dusters") return "fist";
  const meta: WeaponMeta | undefined = WEAPON_META[id];
  if (meta !== undefined && meta.tags.includes("blade")) return "blade";
  return "blunt";
}
