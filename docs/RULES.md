# Rules of Rank Zero

This is how the game works, written for the people who build and tune it. The code in `packages/core` is the authority; this file says the same thing in words. Every number here is the number the code uses today. A number that the balance pass moved away from its first value is listed in the last section with its old value and the reason.

All rule maths is whole numbers. Division rounds down. A chance is a whole percent and passes when a roll from 0 to 99 is below it. `roll(a..b)` is a whole number from a to b, both included.

## 1. Stats

A scrapper has four stats: Health, Strength, Agility and Speed. Each has points and a multiplier (a whole percent, 100 at the start). The value used everywhere is `floor(points x multiplier / 100)`.

- **Health** sets max HP: `54 + 7 x Health` (the level adds nothing since the pet pass), then the companion cost is taken off: `floor(maxHP x (100 - cost) / 100)`. Never below 1.
- **Strength** adds melee damage, more for heavier weapons.
- **Agility** adds to Evade against a slower-footed attacker, adds to Combo, and adds to thrown damage.
- **Speed** sets how much time a turn costs and who acts first.

Fight values, all whole percents. A held weapon adds its numbers to the base; skills add theirs. The cap applies to the final chance of a roll, after the attacker's Aim or Pierce is taken off.

| Value | Base | What it does | Cap |
|---|---|---|---|
| Evade | 10 | dodge a swing | 80 |
| Block | 5 | stop a swing | 75 |
| Aim | 5 | taken off the target's Evade | none |
| Pierce | 0 | taken off the target's Block | none |
| Intercept | 0 | hit the attacker first as it comes in | 75 |
| Riposte | 0 | hit back after being attacked | 80 |
| Combo | 0 | swing again | 80 |
| Disarm | 3 | knock the target's weapon away on a landed hit | 80 |
| Crit | 5 | x1.5 damage | 60 |
| Armor | 0 | share of melee damage removed | 60 |

## 2. Making a scrapper

- **Name.** Trimmed, inner spaces collapsed to one, then 3 to 14 characters of letters, digits, spaces and hyphens. The display keeps the player's capitals.
- **The name is the seed.** `seed = FNV-1a(realmSalt + ":" + lowercased cleaned name)`. The same name gives the same scrapper on every device: stats, starting perk, look and Route.
- **Look.** Shapes (build, head, hair, face, top, bottom, shoes, accessory) come from `(seed, lookSalt)`; colours (skin, hair colour, palette) from `(seed, colourSalt)`. The two reroll buttons each add 1 to one salt.
- **Stats.** Every stat starts at 2. Then 6 points are dealt one at a time, each to a random stat that is still below 5. Total 14. Level-1 HP is 68 to 89.
- **Starting perks.** Two. First one roll from the perk pool (section 3), rolled again until it is a weapon (any rarity, by the pool's weights). Every scrapper starts armed: a pet, a skill or a booster as the starting perk decided level-1 bouts by the name alone (8% to 98% wins), and left skill owners unarmed at level 3. Then a skill, from a stream of its own (`(seed, "start2")`, so every name keeps its weapon), rolled again until it is a skill that fits a kit of that weapon (section 3) and is not a booster, Snatch or Knock Loose (as starts they won 78% and about 90% of level-1 bouts: a level-1 kit has one weapon, and a disarm leaves fists for the rest of the bout), Quick Swap or Firm Grip (with one weapon and the sure first draw Quick Swap never showed at level 1, and Firm Grip in 20% of its owner's bouts). With the weapon alone every level-1 bout had no skill at all (round 2, section 9).
- **Random name.** A first part (120 of our own) and a second part (60 of our own), joined by a space. Every such name passes the name check.

## 3. Level-ups and the Route

**XP.** A win gives 2, a loss 1. A win over a rival two or more levels below gives 1 (no rival on the card can be, today). XP needed for the next level: `2 + level + floor(level / 2)`: 3, 5, 6, 8, 9, 11, 12, 14, 15, 17 for levels 1 to 10, and 32 at level 20. Extra XP carries over. A level-up is waiting while the XP held is at least the XP needed; taking it removes that much XP and adds one pick.

**The two cards.** Each level-up offers a stat card and a perk card, in a random left-right order.
- Stat card: +2 points in one random stat; +3 from the kit's 7th stat card taken, +4 from its 21st (round 2, second pass: with +2 on every card a player who always took the stat card won 36% at level 10 and 24% at level 30). The amount counts the kit's own stat cards, so it lifts the kit that takes them and not every rival of its level.
- Perk card: one roll from the perk pool. The perk card of a level-up to level 2 or 3, and the kit's 17th to 22nd perk card taken, also gives +1 point in one random stat, shown on the card (round 2: a player who always took the perk card won 41% at level 10 and 28% at level 30; section 9). If that perk is not allowed it is rolled again, up to 5 more times; only when all 6 rolls fail does the card become a split: +1 point in each of two different random stats. (With no reroll, 18% of perk cards were splits at level 10 and 38% at level 30; under 12% at level 30 with 3 rerolls, and 5 rerolls keep it there under the weapon cap of round 2.) The weapon share of a perk card's category roll falls with the weapons the kit owns (round 2): 44 with 0 to 2 weapons, 30 with 3, 15 with 4, none with 5. The other shares stay, so the roll is out of 56 plus the weapon share.

**The perk pool.** A category roll out of 100 (for a kit with 2 weapons or fewer; see the perk card above): weapon 0 to 43, skill 44 to 89, shield 90 to 95, companion 96 to 99 (content v2). Then one item inside the category, by weight:

| Rarity | Weight |
|---|---|
| Common | 400 |
| Uncommon | 150 |
| Rare | 50 |
| Epic | 12 |
| Mythic | 2 |

Companions use their own weights: Raccoon 90, Goose 5, Boar 5, Stray Dog 30, Crow 15, Alley Cat 15 (160 in all). So one given Common weapon is 44% x 400 / 6,028, about 2.9% of rolls; one given Common skill 46% x 400 / 5,838, about 3.2%; the Common shield (Bin Lid) 6% x 400 / 812, about 3.0%; the Raccoon 2.25%; the Mythic skill about 0.016%.

**A rolled perk is not allowed when:**
- it is already owned (the Raccoon may be owned twice);
- it is a companion past its limit or one its owner's companion rules out (Goose and Boar never together, Stray Dog and Alley Cat never together), or a fourth companion (three places at most);
- it is a shield and a shield is already owned (one at most);
- it is a booster and boosters are already owned: with one owned it passes 10% of the time, with two 3%, with three or more never (one extra roll);
- it is the Whistle or Pet Lover and no companion is owned;
- it is a weapon passive and no owned weapon works with it: Sharpening Stone needs a Blade weapon, Heavy Lifter a Heavy one, Trick Shot a Thrown one, Junk Collector two weapons, one of them not Thrown, and Pitcher, Firm Grip and Quick Swap any weapon;
- it is a weapon and 5 weapons are owned (round 2; the category roll already leaves weapons out then);
- it is Bare Knuckle and 3 or more weapons are owned (round 2: fists were 5% of swings at level 30).

**The Route** is a pure function of the seed and the list of picks. The cards of level-up k are drawn from a stream seeded with `(seed, "route", k, picks so far)`, and checked against the kit those picks built. Nothing is stored but the picks. The same picks always give the same later cards. (A rules change that changes the cards, like the pet pass, changes the kit of an existing scrapper on its next walk.)

## 4. Bouts per day and rivals

- 6 bouts a day per scrapper, 8 on the day it was made. The day key (`YYYY-MM-DD`, local) is passed in by the app; the core never reads a clock. A stored day older than today means a full day. A clock that moves back resets nothing.
- **Rivals.** `rivalSeed = hash(realmSalt, "rival", level, index)`. A rival is made from that seed by the same code as a player's scrapper, named from our lists, and levelled by walking its own Route: it takes the perk card (or the split that replaced it) 65% of the time. A level N rival has N - 1 picks. There are 240 rivals per level.
- **Tonight's Card.** 6 different rivals at the scrapper's level, drawn from `hash(seed, dayKey, bouts used today)`, so it changes after every bout and at day rollover. At levels 1 to 3 the last card is an easy rival: the same rival, armed, its own id, with 3 stat points fewer, each taken from its highest stat (the first in the order Health, Strength, Agility, Speed on a tie), never below 2. A random scrapper beats it about two times in three (round 2). It replaced 2 unarmed cards (the pet pass's rivals with their weapons left at home), which a random scrapper beat 96% of the time, in fist fights shown right after the rule that every scrapper starts with a weapon.
- **Bout seed** = `hash(fighter id, opponent id, the fighter's lifetime bout count)`.

## 5. The fight

A bout reads only two snapshots (name, look, level, stats, perk ids) and a seed. Boosters and the Plate Vest are already inside the snapshot's stats; the sim never applies them a second time. Mountain's late start and the Plate Vest's Armor are fight rules and are applied in the bout.

### Random streams

Each part of the rules draws from its own stream, seeded from the bout seed and the stream's name: `clock`, `tie`, `move`, `draw`, `throw`, `target`, `hit`, `disarm`, `damage`. Adding a roll to one system never shifts the numbers of another. The stage's cosmetic randomness is separate and never touches these.

### Actors and the clock

- The two scrappers are `a0` (the challenger, left) and `b0`. Companions take `a1` to `a3` and `b1` to `b3` in the order they stand in the owner's perks.
- Time is in beats. `bodyTempo = 40 + floor(1200 / (10 + Speed))`: 160 at Speed 0, 120 at 5, 100 at 10, 80 at 20, 60 at 50.
- A normal turn costs `floor(weapon Tempo x bodyTempo / 100) + roll(0..10)`. Companions use Tempo 80.
- Start clocks: a scrapper `roll(0..20) - 2 x Speed`, Head Start -150, Mountain +150. A companion: Raccoon 10, Goose 40, Boar 150, Stray Dog 30, Crow 20, Alley Cat 15, each `+ roll(0..10)`.
- A shield's `tempo` adds that percent to its owner's weapon Tempo (after Heavy Lifter): the Wooden Pallet 15, the Riot Shield 10.
- The lowest clock acts next. On a tie, an actor whose last action cost no time (a free Move, or a companion just called by a Whistle) goes first; then a seeded roll among the tied actors in id order.
- **A turn** is one actor taking its place: a scrapper turn, a companion turn, a Move, or a skipped snared turn. Turn counts (overtime, the stop, the length targets) count all of them.

### A scrapper's turn

1. **Snared?** It skips the turn. The skip costs one normal turn of time and writes nothing, so turn numbers jump. The last skip ends the snare and writes `free` with cause "timeout": a Tarp holds for 3 skips, a Grapple for 1. A Taunt counts down here: it is still on in the free action that follows it and ends at the start of the owner's turn after that.
2. **Move roll.** Skipped in the turn right after a weapon left the hand by a throw while a weapon waits in the bag: that turn is the sure redraw (step 3). Otherwise the owned Moves with uses left whose condition holds are listed; W is the sum of their weights. One roll from 0 to W + 5: below W picks a Move by weight, otherwise none fires. A Move is the whole turn and sets its own time cost. In the opening (turns 1 to 5) only the unarmed Moves (Body Slam, Grapple, Snatch) can be listed, and a scrapper whose last own turn was a Move rolls no Move this turn (round 2).
3. **Draw or swap.** Empty hands and weapons in the bag: draw with chance `S / (S + 6)` (Quick Swap: `S / (S + 2)`; Bare Knuckle: `S / (S + 12)`, Quick Swap wins when both are owned), S the sum of the bag's Draw weights, picked by weight. The first draw of a bout is certain (round 2), but a Bare Knuckle owner draws nothing in its first turn that is not a Move: it opens with fists (round 2, second and third pass); certain too is the draw right after a weapon left the hand by a throw (throw and replace, content v2). Unlike the redraw after a throw, the first draw does not skip the Move roll. Holding a weapon that has already attacked, with weapons in the bag: 30% to swap (Firm Grip 15%, Quick Swap 50%; Firm Grip wins when both are owned, round 2, third pass); the old weapon falls and is gone for the bout. A Firm Grip owner whose swap roll failed but would have passed at 30% kept its weapon because of Firm Grip: that turn's first swing or throw can carry the Firm Grip tag, once a bout. Drawing does not end the turn. A turn in which a Quick Swap owner drew or swapped costs 30% less time (round 2, second pass), and its first swing or throw can carry the Quick Swap tag, unless the draw was a certain one (the first of the bout, the one after a throw), which every scrapper makes (round 2, third pass).
4. **Throw or melee.** A Thrown weapon is always thrown and never used up. Any other held weapon that has already swung once is thrown 20% of the time while another weapon waits in the bag, 5% when it is the last one (Pitcher 35% either way; Junk Collector 35% while another weapon waits, round 2), and is then gone (Pitcher: back into the bag; Junk Collector: back into the bag 90% of the time). A weapon just drawn always gets its swing first.
5. **Target.** One random standing enemy, scrapper or companion. The enemy scrapper counts twice in the pick, each companion once (with one pet: the scrapper 2 in 3, the pet 1 in 3). Companions, Body Slam and a Trick Shot bounce pick the same way.
6. **Resolve** the attack.
7. **Pay the time.** The weapon whose Tempo counts is the one the turn was made with.
8. **Overtime.** From turn 50 a scrapper loses 8% of its max HP (at least 1) after each of its own turns, skipped ones included. Last Stand does not save from it.

### The opening

Turns 1 to 5 are the opening. In each of those turns a scrapper loses at most 10% of its max HP and a companion at most 50% of its own (rounded down, at least 1). A crit, a Haymaker swing, a Body Slam or a Grapple (a "big" hit) may take up to 25% of a scrapper's max HP in its turn instead (round 2). The opening never takes a scrapper below 40% of its max HP (rounded up). Moves other than the unarmed ones are not ready in the opening, so their hits are never cut. A hit or a Move hit that would take more is cut to what is left; once nothing is left for that turn (counted at the 10% allowance), the attacker's swings stop (no further combo, Stubborn, scratch or bounce at it, and no intercept or riposte against it). So no bout can end before turn 6, and a pet always lives through the first turn it is hit in. From turn 6 every hit lands in full.

### A melee attack

a. **Intercept.** If the defender is a standing, unsnared scrapper: chance `Intercept + 8 x (defender Reach - attacker Reach)`, 0 to 75. A Thrown weapon and a companion count as Reach 0. If it fires the defender makes one swing at the attacker (it can be evaded or blocked, it can crit and disarm, it cannot combo), and the attacker's turn ends; the attacker still pays the full time of the turn.

b. **Evade, then Block,** rolled for every swing.
   - Evade = `defender Evade + clamp(3 x (defender Agility - attacker Agility), -30, +30) - attacker Aim`, 0 to 80.
   - Block = `defender Block - attacker Pierce`, 0 to 75. Companions never block. A carried shield adds its Block.
   - A snared defender neither evades nor blocks.

c. **Damage.**
   - Melee `raw = base + floor(Strength x (base + 4) / 12)`.
   - `damage = floor(floor(raw x roll(85..115) / 100) x multiplier / 100)`. The multiplier is 100 plus the skill bonuses plus a carried shield's `damage` (a minus), doubled by Haymaker. A companion's multiplier is 100 plus its owner's Pet Lover bonus.
   - Crit (chance Crit, Haymaker +15, cap 60): `floor(damage x 3 / 2)`.
   - Armor: `damage - floor(damage x Armor / 100)`. Never below 1.
   - At Strength 3 with the first table: fists 7, Pocket Knife 8, Pipe 13, Hand Axe 19, Sledgehammer 36 (raw values).

d. **Disarm.** On a landed hit against a held weapon: chance = attacker Disarm, cut to 40% of itself (rounded down) when the defender's bag holds no weapon (the last weapon is held harder, round 2, second pass; a Body Slam still knocks it off). The weapon falls and is gone. Firm Grip resists 80% of the time (60% before round 2) and the disarm is written as resisted. A defender with a shield also loses it on a separate roll, on every swing that is not evaded: chance `floor(min(attacker Disarm, 80) x knock / 100)`, with the shield's own `knock` (the Car Door's 33 is the old one third). The shield lands on the floor and every number it gave ends. Neither roll is made when the hit already knocked the defender out.

e. **Combo.** Chance `Combo + Agility`, capped at 80 first, then halved after each success (80, 40, 20). At most 3 extra swings. Stubborn rolls before the combo roll: after a swing that was evaded or blocked, 95% to swing again at once, once per turn, and that extra swing can start a combo. The swings stop when the target falls.

f. **Riposte.** After the attacker's last swing, a standing, unsnared scrapper defender hits back once with chance Riposte (cap 80). After a block, a Parry owner's chance for that attack is 80. A riposte cannot be riposted or intercepted.

A Crow flies: no intercept and no riposte against its attacks. An Alley Cat's attack is always two swings (the second written as a combo swing), then the normal combo rolls.

**After a hit** the steps it causes follow it, in order: disarm, shield off, free (a snared target is freed by any hit), knockout. A scrapper's knockout ends the bout in the same turn.

### Throws

- Thrown `raw = base + floor((Strength + 2 x Agility) x (base + 4) / 36)`, then `x roll(95..125) / 100` and the multiplier.
- Evade and Block against a throw are halved; a shield's `thrownBlock` is added after the halving (cap 75). No intercept, no riposte. Armor does not apply. A throw can crit and disarm, and can combo while the weapon stays in the hand.
- Trick Shot: after a Thrown weapon lands (the weapon stays in the hand), 50% that it bounces on, once a turn: one more throw at a random standing enemy, written as a combo throw with the Trick Shot proc. The combo rolls go on after it.

### Companions

Separate actors with their own HP and clock. A scrapper has three companion places at most. The table holds level-1 values; HP grows with the owner's level `x (100 + 15 x (level - 1)) / 100` and Strength `x (100 + 60 x (level - 1)) / 100` (pet pass: a pet starts small and hits harder as its owner rises, so it is worth about the same at level 3 and at level 30). They make bare melee attacks on a random standing enemy with their own numbers and the melee formula, can combo and evade, never block, intercept or riposte, and a scrapper may intercept or riposte them. Tempo 80, Reach 0, Crit 5, Pierce 0, Armor 0. A knocked-out companion stays down; a companion scared off by an Air Horn leaves. A companion going down never ends a bout.

| | Raccoon | Goose | Boar | Stray Dog | Crow | Alley Cat |
|---|---|---|---|---|---|---|
| Role | small, cheap, quick | fast glass cannon | slow tank | all-rounder that grabs weapons | flies, pecks, hard to hit | fast, evasive, scratches twice |
| Rarity word | Uncommon | Epic | Epic | Uncommon | Rare | Rare |
| Weight | 90 | 5 | 5 | 30 | 15 | 15 |
| Limit | 2 | 1, never with a Boar | 1, never with a Goose | 1, never with a Cat | 1 | 1, never with a Dog |
| Owner max HP cost | 11% each | 20% | 22% | 17% | 26% | 25% |
| HP (level 1) | 3 | 6 | 7 | 4 | 3 | 4 |
| Strength (level 1) | 1 | 1 | 2 | 1 | 1 | 1 |
| HP / Strength at level 10 | 7 / 6 | 14 / 6 | 16 / 12 | 9 / 6 | 7 / 6 | 9 / 6 |
| HP / Strength at level 30 | 16 / 18 | 32 / 18 | 37 / 36 | 21 / 18 | 16 / 18 | 21 / 18 |
| Agility | 6 | 12 | 2 | 7 | 18 | 16 |
| Speed | 6 | 16 | 4 | 8 | 12 | 11 |
| Base damage | 1 | 1 | 2 | 1 | 1 | 1 |
| Combo | 20 | 30 | 0 | 15 | 30 | 20 |
| Evade | 10 | 25 | 0 | 10 | 25 | 25 |
| Aim | 5 | 5 | 20 | 5 | 15 | 10 |
| Disarm | 0 | 0 | 10 | 8 | 0 | 0 |
| Start clock | +10 | +40 | +150 | +30 | +20 | +15 |
| Swings per attack | 1 | 1 | 1 | 1 | 1 | 2 |
| Flies | no | no | no | no | yes | no |

Pet Lover: its owner's companions have 30% more HP (after the level scaling, rounded down) and a damage multiplier of 150.

### End of a bout

- A side loses when its scrapper reaches 0 HP.
- After turn 150 the bout stops: the higher share of max HP wins; a tie goes to the challenged side (b). Such an ending writes no knockout step.

## 6. Weapons

A weapon's numbers add to the scrapper's base values while it is held. Fists are the numbers of an empty hand. Reach 0 to 4; a Thrown weapon has no Reach and counts as 0. "Tempo" is the turn's time cost as a percent of fists; "Draw" the weight for being pulled from the bag.

| Weapon | Rarity | Tags | Clip | Tempo | Dmg | Reach | Draw | Aim | Pierce | Block | Evade | Riposte | Combo | Disarm | Crit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Fists | - | - | punch | 100 | 5 | 0 | - | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Pipe | Common | - | swing | 110 | 13 | 1 | 5 | 0 | 0 | 12 | 0 | 5 | 0 | 10 | 10 |
| Pocket Knife | Common | Light, Blade | flick | 60 | 7 | 0 | 5 | 25 | 0 | 0 | 5 | 0 | 35 | 0 | 15 |
| Broom | Common | Pole | thrust | 100 | 6 | 3 | 4 | 0 | 0 | 20 | 5 | 28 | 10 | 15 | 5 |
| Machete | Common | Blade | swing | 115 | 13 | 1 | 5 | 5 | 0 | 5 | 0 | 5 | 5 | 5 | 30 |
| Hand Axe | Common | Heavy, Blade | swing | 130 | 17 | 1 | 4 | 0 | 15 | -5 | 0 | 0 | 0 | 5 | 15 |
| Bat | Uncommon | - | swing | 120 | 12 | 2 | 5 | 0 | 10 | 5 | 0 | 18 | 0 | 5 | 15 |
| Pitchfork | Uncommon | Pole | thrust | 130 | 15 | 3 | 3 | 0 | 0 | 5 | 0 | 0 | 0 | 5 | 10 |
| Crowbar | Uncommon | Heavy | swing | 140 | 17 | 1 | 4 | -5 | 20 | 5 | 0 | 0 | 0 | 25 | 5 |
| Knuckle Dusters | Uncommon | Light | punch | 70 | 8 | 0 | 5 | 10 | 10 | 0 | 5 | 0 | 28 | 0 | 10 |
| Shovel | Uncommon | Heavy, Pole | smash | 150 | 16 | 2 | 3 | 0 | 10 | 18 | -5 | 5 | -10 | 10 | 5 |
| Sledgehammer | Uncommon | Heavy | smash | 160 | 34 | 1 | 5 | -20 | 30 | -20 | -20 | -20 | -40 | 10 | 10 |
| Darts | Uncommon | Thrown, Light | throw | 45 | 3 | - | 5 | 0 | 0 | -5 | 12 | 0 | 30 | 0 | 5 |
| Bike Chain | Rare | Pole | swing | 140 | 11 | 4 | 5 | 30 | -10 | -15 | 20 | -5 | 30 | 25 | 0 |
| Monkey Wrench | Rare | Heavy | swing | 135 | 13 | 1 | 2 | 0 | 10 | 10 | 0 | 0 | 0 | 60 | 5 |
| Pickaxe | Rare | Heavy | smash | 150 | 19 | 2 | 4 | 0 | 100 | -10 | -10 | 0 | -10 | 10 | 10 |
| Rebar | Rare | Heavy | swing | 160 | 23 | 2 | 5 | 20 | -10 | 5 | -15 | 0 | 0 | 10 | 10 |
| Screwdrivers | Rare | Light | flick | 70 | 7 | 0 | 3 | 10 | 0 | 5 | 5 | 0 | 10 | 45 | 5 |
| Garden Shears | Rare | Light, Blade | flick | 75 | 8 | 1 | 4 | 15 | 0 | 5 | 0 | 5 | 20 | 10 | 15 |
| Stop Sign | Rare | Pole, Heavy, Blade | smash | 175 | 23 | 3 | 3 | -15 | 0 | 10 | 0 | 0 | 5 | 10 | 5 |
| Boomerang | Rare | Thrown | throw | 75 | 6 | - | 4 | -5 | 0 | -5 | 10 | 0 | 15 | 10 | 10 |
| Anvil | Epic | Heavy | smash | 225 | 52 | 1 | 6 | -25 | 50 | -30 | -30 | -20 | -40 | 15 | 5 |
| Ball and Chain | Epic | Heavy | smash | 200 | 38 | 2 | 6 | -30 | 100 | -40 | -25 | 0 | 12 | -10 | 0 |
| Umbrella | Epic | Light | flick | 50 | 4 | 1 | 6 | 40 | 0 | -30 | 45 | 40 | 40 | -20 | 0 |
| Pool Cue | Epic | Pole, Light | thrust | 95 | 7 | 3 | 6 | 20 | 0 | 10 | 10 | 10 | 22 | 10 | 10 |
| Bricks | Epic | Thrown, Heavy | throw | 100 | 13 | - | 6 | -10 | 0 | -10 | 0 | 0 | 0 | 20 | 15 |
| Rubber Chicken | Mythic | Light | swing | 90 | 5 | 1 | 7 | 35 | 100 | -20 | 0 | 60 | 70 | 0 | 0 |
| Lawn Flamingo | Mythic | Pole | thrust | 120 | 13 | 4 | 7 | 20 | 0 | 0 | 30 | 30 | 20 | 30 | 35 |
| Frying Pan | Common | - | swing | 105 | 11 | 1 | 5 | 0 | 0 | 22 | 0 | 28 | -5 | 5 | 5 |
| Tyre Iron | Common | - | swing | 100 | 12 | 1 | 5 | 5 | 15 | 5 | 0 | 0 | 5 | 10 | 15 |
| Golf Club | Uncommon | - | swing | 125 | 15 | 2 | 4 | 5 | 0 | 0 | 0 | 5 | 0 | 5 | 30 |
| Hockey Stick | Uncommon | Pole | swing | 125 | 10 | 2 | 3 | 5 | 0 | 10 | 5 | 10 | 10 | 30 | 5 |
| Folding Chair | Uncommon | Heavy | smash | 160 | 22 | 1 | 4 | -10 | 15 | 20 | -10 | 0 | -15 | 15 | 5 |
| Cricket Bat | Rare | Heavy | swing | 160 | 17 | 2 | 4 | 5 | 10 | 12 | 0 | 20 | 0 | 10 | 15 |
| Wok | Rare | Heavy | swing | 135 | 16 | 1 | 4 | 0 | 10 | 30 | 0 | 20 | -10 | 10 | 10 |
| Plunger | Mythic | Light | thrust | 90 | 7 | 2 | 7 | 40 | 40 | 0 | 10 | 20 | 30 | 70 | 10 |
| Plastic Bottle | Common | Thrown, Light | throw | 75 | 6 | - | 5 | 5 | 0 | 0 | 10 | 0 | 15 | 0 | 5 |
| Rubber Ball | Common | Thrown, Light | throw | 85 | 6 | - | 5 | 10 | 30 | 0 | 5 | 0 | 25 | 0 | 5 |
| Paint Can | Uncommon | Thrown, Heavy | throw | 105 | 11 | - | 4 | -5 | 0 | -5 | 0 | 0 | 0 | 15 | 15 |
| Traffic Cone | Uncommon | Thrown | throw | 95 | 9 | - | 4 | 15 | 0 | 0 | 5 | 0 | 10 | 5 | 10 |
| Hubcap | Rare | Thrown | throw | 100 | 8 | - | 4 | 10 | 25 | -5 | 5 | 0 | 15 | 5 | 20 |
| Tyre | Epic | Thrown, Heavy | throw | 130 | 16 | - | 6 | 0 | 40 | -10 | -5 | 0 | 0 | 25 | 10 |

Roles of the content v2 weapons (our own, from our sim): Frying Pan the common parry tool (the Bin Lid's old place), Tyre Iron a quick club with Pierce, Golf Club the long crit swing, Hockey Stick the hooking stick (Disarm at Reach 2), Folding Chair a blocking smash, Cricket Bat the heavy hitter with an answer, Wok the highest Block of any weapon, Plunger the Mythic joke disarmer. Thrown: Plastic Bottle and Rubber Ball the cheap lobs (the ball's bounce gives Pierce), Paint Can and Tyre the heavy throws, Traffic Cone the aimed one, Hubcap the spinning disc that crits most.

## 6b. Shields (content v2)

A shield is carried on the back arm while the front hand keeps its weapon. At most one per scrapper. While it is on: Block, Armor and Riposte add to the scrapper's values, `thrownBlock` adds to Block against a throw only (after the halving), `damage` adds to the damage multiplier, `tempo` adds to the turn time. A block made while a shield is on writes the shield's id as a proc, and the stage raises it. It comes off by the roll in 5d or by a Body Slam, lands on the floor, and every number it gave ends.

| Shield | Rarity | Block | Block vs throws | Armor | Riposte | Own damage | Turn time | Knock | Role |
|---|---|---|---|---|---|---|---|---|---|
| Car Door | Uncommon | +32 | 0 | 0 | 0 | -20% | 0 | 33 | the first shield: big block, hits softer |
| Bin Lid | Common | +16 | 0 | 0 | +15 | -5% | 0 | 45 | light and cheap, a little riposte |
| Wooden Pallet | Uncommon | +30 | 0 | +6 | 0 | 0 | +15% | 25 | a wall: block and armor, slow |
| Ironing Board | Rare | +14 | +30 | 0 | 0 | -10% | 0 | 40 | long: the best cover against a throw |
| Skateboard | Rare | +10 | 0 | 0 | +30 | 0 | 0 | 50 | small block, then the answer |
| Riot Shield | Epic | +38 | +10 | +5 | 0 | -15% | +10% | 30 | the biggest cover |

## 7. Skills

**Boosters** change the stats for good when picked (points now, the multiplier for all points now and later). **Passives** are on for the whole bout. **Moves** fire by the Move roll and have limited uses per bout.

| Skill | Kind | Rarity | Effect |
|---|---|---|---|
| Big Heart | booster | Common | +2 Health points, Health multiplier +35 |
| Heavy Hands | booster | Common | +2 Strength points, Strength multiplier +50 |
| Light Feet | booster | Common | +2 Agility points, Agility multiplier +45 |
| Fast Twitch | booster | Common | +3 Speed points, Speed multiplier +40 |
| Glass Cannon | booster | Epic | Strength multiplier +100, Health multiplier -30 |
| Mountain | booster | Mythic | Health multiplier +150, Agility and Speed multipliers -20 each, start clock +150 |
| Padding | passive | Common | Armor +10 |
| Anticipation | passive | Common | Intercept +20 |
| Sharpening Stone | passive | Uncommon | melee damage with a Blade weapon +40%; offered only with a Blade weapon |
| Bare Knuckle | passive | Uncommon | opens the bout with fists (no draw in its first turn that is not a Move) and draws with `S / (S + 12)`; damage with fists +200%, Combo +20 while unarmed |
| Payback | passive | Uncommon | Riposte +25 |
| Flurry | passive | Uncommon | Combo +28 |
| Firm Grip | passive | Uncommon | 80% to resist a disarm or a Snatch; swap chance 15% instead of 30% (this wins over Quick Swap's 50%) |
| Head Start | passive | Uncommon | start clock -150 |
| Sharp Eye | passive | Uncommon | Aim +16, Pierce +16 |
| Parry | passive | Uncommon | Block +10; after a block, Riposte chance 80 for that attack |
| Heavy Lifter | passive | Rare | turns with a Heavy weapon cost 30% less time; Aim +10 while holding one; offered only with a Heavy weapon |
| Pitcher | passive | Rare | thrown damage +40%; a weapon that is not Thrown is thrown 35% of the time and goes back in the bag |
| Plate Vest | passive | Rare | Armor +22, Speed multiplier -15 |
| Knock Loose | passive | Rare | Disarm +40 |
| Last Stand | passive | Rare | once a bout, a hit or a Move that would leave 0 HP leaves 1 |
| Stubborn | passive | Rare | after an evaded or blocked swing, 95% to swing again at once, once a turn |
| Slippery | passive | Epic | Evade +25 |
| Quick Swap | passive | Common | the empty-hand draw is `S / (S + 2)` instead of `S / (S + 6)`; swaps a used weapon 50% of the time (30% without; Firm Grip's 15% wins over it); a turn in which it drew or swapped costs 30% less time |
| Pet Lover | passive | Uncommon | own companions: HP +30%, damage +50%; offered only with a companion |
| Junk Collector | passive | Uncommon | throws a used weapon 65% of the time while another waits in the bag (20% without it); a weapon it throws away goes back into the bag 90% of the time (Pitcher: always); offered only with two weapons, one not Thrown |
| Trick Shot | passive | Rare | a Thrown weapon that lands bounces on to a random standing enemy 50% of the time, once a turn; offered only with a Thrown weapon |

| Move | Rarity | Weight | Uses | Only when | Time | Effect |
|---|---|---|---|---|---|---|
| Haymaker | Uncommon | 5 | 1, plus 1 per 25 Strength | no boost is already waiting, and no Thrown weapon in the hand | 0 | the next melee swing (hit, evaded or blocked) has double damage and Crit +15; a throw or an intercepted turn does not use it |
| Energy Drink | Uncommon | 16 | 1 | own HP below 50% | 30 | heals `roll(25..40)`% of max HP |
| Tarp | Uncommon | 5 | 1 | an enemy that is not snared | 20% of a turn | snares a random free enemy companion if there is one, otherwise the scrapper |
| Whistle | Uncommon | 20 | 2 | an own companion standing and below 90% HP | 10 | heals it by 60% of its max HP and it acts next |
| Firecrackers | Rare | 4 | 2 | always | 50% of a turn | `roll(12..20)` to the enemy scrapper, 40% of max HP to each enemy companion; no evade, block or Armor |
| Snatch | Rare | 16 | 1 | own hands empty, the enemy scrapper holds a weapon | 0 | takes that weapon into the hand |
| Air Horn | Rare | 8 | 1 | an enemy stands | 20 | each enemy companion has 50% to run off; the enemy scrapper's clock +40, or +60 when it has no standing companion |
| Body Slam | Epic | 12 | 1 | own hands empty | one turn + 100 | `floor((19 + 4 x Strength) x roll(85..115) / 100)` to a random enemy, Armor applies; no evade, block or intercept; knocks off its weapon (Firm Grip can hold on) and its shield |
| Sand in the Eyes | Uncommon | 4 | 1 | the enemy scrapper stands and has no sand yet | 30% of a turn | the enemy scrapper's Aim -25 for the rest of the bout |
| Taunt | Uncommon | 4 | 1 | no Taunt is on | 0 | Riposte +40 through the free action that follows and until the start of the own turn after it |
| Second Wind | Rare | 16 | 1 | own HP below 50% | 0 | heals 15% of max HP |
| Grapple | Rare | 16 | 1 | own hands empty, the enemy scrapper stands and is not snared | one turn | `floor((8 + 2 x Strength) x roll(85..115) / 100)` to the enemy scrapper, Armor applies, no evade, block or intercept; then it is snared for 1 skipped turn (no tarp) |

"20% of a turn" and "50% of a turn" are shares of the user's turn cost without its random part.

### Skill tags on stage

A step can name the skill that mattered on it (`procs`). Rule skills write their tag (spacing aside, below): Last Stand on the hit it survives, Parry on the riposte it made possible and on a block its Block bonus decided, Stubborn on its extra swing, Firm Grip on the disarm or Snatch it resisted and on a turn its weapon was kept (step 3), a shield (its own id) on a block made while it is carried, Trick Shot on its bounce throw, Junk Collector on a throw whose weapon it brings back, Head Start on its owner's first action. Chance skills write their tag only when the roll passed because of their bonus (the same roll compared with the chance with and without it, no extra random number): Anticipation on an intercept, Payback on a riposte, Flurry on a combo swing, Slippery on an evade, Knock Loose on a disarm, Sharp Eye on a hit that would have been evaded or blocked without it (its Aim or its Pierce), Taunt on a riposte while its bonus is on, Sand in the Eyes on a swing that was evaded only because of the Aim the sand took (the tag is the thrower's), Quick Swap on the first swing or throw of a turn in which its owner drew or swapped.

Number skills write their tag on the step where their number changed the result (the same hit counted again without the skill's number, after the opening's cut; no extra random number): Padding and Plate Vest on a hit, Body Slam or Grapple that their Armor made smaller; Sharpening Stone on a Blade hit and Pitcher on a throw that they made bigger; Bare Knuckle on its owner's swings with fists (it opens with them on purpose); Pitcher also on a throw whose weapon it sends back to the bag; Pet Lover on a companion's hit that it made bigger (the tag is the owner's); Heavy Lifter on the first swing or throw of a turn made with a Heavy weapon (that turn costs 30% less time).

Boosters (round 2) write their tag once a bout, on the first step their stat is felt: Heavy Hands and Glass Cannon on their owner's first hit, Big Heart, Mountain and Glass Cannon on the first hit their owner takes, Light Feet on its owner's first evade, combo swing or landed throw (Agility adds to Thrown damage), Fast Twitch on its owner's first action. They used to have no fight moment at all, and Light Feet was the strongest Common perk.

**Once a bout, and spaced** (round 2; third pass 17 November 2026). The number skills, the chance passives (Anticipation, Payback, Flurry, Slippery, Knock Loose, Sharp Eye), Bare Knuckle, a shield, Quick Swap, Head Start and the boosters write their tag at most once a bout per owner. The rule skills (Last Stand, Parry, Stubborn, Firm Grip, Trick Shot, Junk Collector) and the Moves' own effects (Taunt's riposte, Sand in the Eyes' miss) can write theirs again. Tags are spaced by screen time: the sim keeps a clock of about how long the stage plays each step (a first swing 580 ms, a combo swing 420, a Move 550, a draw 200, plus 280 for each new turn; medians measured on stage), and after any tag or Move a tag that waits needs 1,600 ms of it before it shows. Who waits:
- never: Last Stand; the RARE group (the chance passives, Head Start, Bare Knuckle, Light Feet, Sharpening Stone, Heavy Lifter, Pitcher, Quick Swap), whose moment comes seldom; the first tag in a bout of Stubborn, Trick Shot, Junk Collector, Firm Grip, Parry, Taunt and Sand in the Eyes;
- waits: the OFTEN group (Padding, Plate Vest, Pet Lover, the other boosters, shields), whose moment comes again on most hits, and every repeat of a rule tag.

A RARE tag or a first rule tag that loses its step to another tag (one tag a step, below) is owed and shows on the next step of the same kind (the next combo swing for Flurry, the next riposte for Payback), even if the bonus did not decide that roll. (The first version waited 2 whole turns after any tag: at level 30 nearly every turn was inside the wait, and Flurry, Payback and Knock Loose showed in 6 to 8% of their owner's bouts. The second pass let the rare tags through and the median gap between skill moments fell to 1.37 s.) A block made with a shield whose tag has shown reads BLOCK on stage.

**At most one tag per step.** When several skills mattered on one step the sim keeps one: Last Stand first; then rule skills (Firm Grip, Parry, Stubborn, Trick Shot, Junk Collector, Head Start, a shield); then chance and number skills together (Anticipation, Payback, Flurry, Slippery, Knock Loose, Sharp Eye, Taunt, Sand in the Eyes, Bare Knuckle, Sharpening Stone, Heavy Lifter, Light Feet, Padding, Plate Vest, Pitcher, Pet Lover, Quick Swap); then the other boosters. Inside a group the tag first offered longest ago in this bout wins (so a skill offered from the first hit, a booster or Padding, cannot keep a later one out every time; round 2, third pass), then the earlier tier (rule, chance, number), the rarest, and the order of the perk list.

## 8. Choices the sim makes where the brief was silent

- A Haymaker cannot fire while its boost is still waiting: a second one would add nothing. It cannot fire while a Thrown weapon is in the hand either: a throw never uses the boost, so the charge would wait for a melee swing that may never come.
- After a hit that knocks the target out, no disarm or shield roll is made.
- A melee weapon is thrown only after its first swing, so a fresh draw is always seen in use before it flies (content v2).
- Junk Collector and Trick Shot roll on the `throw` stream; the Grapple's damage on the `damage` stream.
- When Firecrackers knock out companions and the scrapper together, the companions fall first, so every fallen actor gets its knockout before the bout ends.
- Firecrackers rolls its damage once for the enemy scrapper.
- A Whistle sets the companion's clock to its owner's clock before the owner pays the Move's time, and the companion wins a tie.
- The Snatch, Body Slam and Firecrackers roll on the `disarm`, `damage` and `move` streams like every other system of their kind.
- Taunt costs no time, so its owner acts again at once. Until the sim-feel pass the Taunt ended at the start of that very action, before any enemy could attack, and never did anything (0 Taunt tags in 500 bouts). It now holds through that free action and ends at the start of the owner's turn after it.
- The opening's cut is booked per actor and per turn; a cut hit still writes its real `damage` (what was taken), so the log needs no new field.

## 9. Balance pass

The first values came from the design brief. `pnpm balance` (`tools/balance-report.ts`) runs the two balance tests at levels 2, 3, 5, 10 and 30 (3 and 5 added by the pet pass, 2 by round 2; the first pass ran 10 and 30 only), and since round 2 a third test, the level-up policy:

- **Ownership:** 40,000 random pairs of same-level rivals per level. For each perk, the bouts where exactly one side owns it, and how often that side wins. Counted for perks with 1,000 or more such bouts: no Common or Uncommon perk and no Raccoon above 62%, no perk below 40%.
- **With and without:** 4,000 bouts per perk per level of a random rival against a copy of itself that also owns the perk, sides swapped every bout. No perk below 47%, and none above the upper limit of its rarity: Common and Uncommon 80%, Rare 82%, Epic 85%, Mythic 88%, and every companion 65% (pet pass; before it the test had no upper limit and pets at 85 to 93% passed). A perk is only added to a kit the Route could offer it to (section 3): Whistle and Pet Lover need a companion, a weapon passive a weapon it works with. The two weapon-count rules of round 2 (5 weapons at most, Bare Knuckle under 3 weapons) are left out here, or no weapon could be measured on a level-30 kit.
- **Level-up policy** (round 2): at levels 5, 10, 20 and 30, 2,000 player seeds that always take the perk card (or the split that replaced it), and 2,000 that always take the stat card, each against 3 rivals of the level pool. Each must win 45 to 55% (always-stat limited since the second pass; levels 5 and 20 added then). The rivals' own 65% policy is reported beside them, not limited.

The brief's numbers already passed both tests in this sim (report `balance-full-1`). Six weapons sat within 1.3 to 2.9 points of the 47% line at level 30 (Pipe 48.3, Sledgehammer 48.6, Bin Lid 48.8, Anvil 49.2, Machete 49.5, Pickaxe 49.9), about 2 standard deviations, so a small code change could tip one over; Sharp Eye's ownership share at level 30 was 60.9%, 1.1 points under its 62% cap. The brief also asks this pass to move the weapon rows further, by our own results and the roles only. The pass below did both. Every change is 30% or less of the number it changes.

| Row | Number | Was | Now | Why |
|---|---|---|---|---|
| Pipe | Dmg | 10 | 11 | weakest perk at level 30 (48.3% with-and-without) |
| Pipe | Block | 10 | 12 | all-rounder: a little more defence |
| Broom | Riposte | 25 | 28 | parry tool, weak at level 30 (50.2%) |
| Machete | Crit | 25 | 30 | crit weapon, weak at level 30 (49.5%) |
| Bat | Riposte | 15 | 18 | all-rounder, below Pipe's defence at level 30 |
| Crowbar | Dmg | 14 | 15 | weak at level 30 (50.2%) |
| Knuckle Dusters | Combo | 25 | 28 | fast multi-hitter, weak at level 30 (51.3%) |
| Bin Lid | Dmg | 7 | 8 | weak at both levels (48.8% at 30) |
| Bin Lid | Riposte | 30 | 35 | parry tool |
| Shovel | Block | 15 | 18 | mid heavy that guards, weak at level 30 |
| Sledgehammer | Tempo | 190 | 180 | slow big hit, weakest at level 30 with Pipe (48.6%) |
| Sledgehammer | Dmg | 28 | 31 | same |
| Darts | Evade | 10 | 12 | thrower that stays out of reach |
| Bike Chain | Dmg | 9 | 10 | reach weapon, weak at level 30 (51.4%) |
| Monkey Wrench | Dmg | 11 | 12 | disarmer, weak at level 30 (50.4%) |
| Pickaxe | Aim | -25 | -20 | block-breaker that missed too often (49.9% at level 30) |
| Pickaxe | Dmg | 18 | 19 | same |
| Rebar | Dmg | 24 | 22 | strong at level 10 (63.3%) |
| Stop Sign | Dmg | 22 | 23 | slowest reach weapon, middling at both levels |
| Boomerang | Dmg | 9 | 8 | strongest thrower at level 10 (67.2%) |
| Anvil | Aim | -40 | -35 | missed too often (49.2% at level 30) |
| Anvil | Dmg | 44 | 48 | slow big hit |
| Ball and Chain | Combo | 15 | 12 | strong at level 10 (61.4%) |
| Umbrella | Evade | 50 | 45 | evasion weapon, top Evade kept |
| Pool Cue | Combo | 25 | 22 | strong at level 10 (63.1%) |
| Bricks | Dmg | 14 | 13 | strong thrower at level 10 (64.3%) |
| Rubber Chicken | Aim | 30 | 35 | Mythic chase item whose owners lost more than they won (46.4% ownership at level 10) |
| Lawn Flamingo | Crit | 40 | 35 | strongest Mythic at level 10 (68.3%) |
| Sharp Eye | Aim | 20 | 16 | ownership share at level 30 near the Uncommon cap (60.9%) |
| Sharp Eye | Pierce | 20 | 16 | same |

Rows moved by the sim's balance pass: 23 of the 28 weapon rows, and 1 skill row. Rows not moved: Fists, Pocket Knife, Hand Axe, Pitchfork, Screwdrivers, Garden Shears (five of these were moved by the design review). The report after the pass is the gate's evidence; its numbers are in the work package handoff.

### Content v2 balance pass (owner amendment 13.8)

Content v2 added 14 weapons, 8 skills, 3 pets and 6 shields, and made throw-and-replace common (a melee weapon that has swung is thrown 20% of the time while a replacement waits in the bag, and the replacement is drawn for sure on the next turn). The new rows were tuned from our own sim results and their roles. The first run left level-30 bouts at a median of 22 turns (target 12 to 20): new pets, more Moves and fast, weak throws all add turns. Slower, harder-hitting new Thrown weapons, lighter shields, lower new-Move weights and a rule that a fresh weapon swings once before it can be thrown brought it to 18. Two full runs of `pnpm balance`: the first failed on Sledgehammer (46.7% with-and-without at level 30) and Light Feet (62.3% ownership at level 30); the second, after the changes below, passed with no limit broken (level 10 median 12 turns, level 30 median 18, overtime 0.1%).

Changes to numbers that existed before content v2 (each 30% or less of the brief's number):

| Row | Number | Was | Now | Why |
|---|---|---|---|---|
| Pipe | Dmg | 11 | 12 | melee weapons lose value now that they get thrown away (47.0% at level 30) |
| Pitchfork | Dmg | 13 | 14 | same (47.7%) |
| Crowbar | Dmg | 15 | 16 | same (47.9%) |
| Sledgehammer | Dmg | 31 | 33 | same (46.7%, below the line) |
| Light Feet | Agility multiplier | 40 | 35 | Agility now feeds many more throws (62.3% ownership at level 30) |
| Car Door | Block | 35 | 32 | now a shield beside a held weapon, and bouts ran long |
| Category roll | weapon / skill / shield / companion | 46 / 50 / - / 4 | 44 / 46 / 6 / 4 | room for the shield category |

### Sim-feel pass (15 November 2026)

A review of 500 rival-against-rival bouts (100 at each of levels 1, 5, 10, 20 and 30) found four problems: bouts that ended in 2 to 5 turns (a heavy weapon drawn and swung on turn 1, a crit, a combo with a riposte on top, against level-1 HP of 47 to 68), medians under the 12-turn target at levels 1 and 5, Moves that almost never fired, passives that changed a number but never showed, and pets that were knocked out before they acted (about one pet in five never acted). The changes are structural where a number could not do it, and each is written above where it applies:

- **The opening** (section 5): turns 1 to 5 take at most 10% of a scrapper's max HP and 50% of a companion's per turn. No bout can end before turn 6.
- **Target weight** (section 5, step 5): the enemy scrapper counts twice in the target pick.
- **Taunt** now lasts past the free action it buys (section 8); before, it never did anything.
- **Skill tags** (section 7): number skills write a tag where they changed the result; at most one tag per step.

Number changes. Some are larger than the 30% retune band of the brief; the owner's complaints ("short plain bouts", "proper use of skill is not it") asked for more than a retune, and the balance gate below still passes.

| Row | Number | Was | Now | Why |
|---|---|---|---|---|
| Max HP | base | 30 | 44 | low-level bouts were too short (median 10 to 11 at levels 1 to 5) |
| Max HP | per level | 3 | 1 | with the larger base, level-30 bouts ran past 20 turns |
| Companions | Tempo | 100 | 80 | a pet acted 2 times in a typical bout; target 3 or more |
| Companions | HP and Strength growth per level | 4% | 3% | pets with more base HP made level-30 bouts long |
| Raccoon | HP | 14 | 16 | pets fell before they acted |
| Goose | HP | 22 | 28 | same |
| Boar | HP | 80 | 104 | same |
| Crow | HP | 10 | 13 | same |
| Alley Cat | HP | 15 | 19 | same |
| Stray Dog | Strength | 6 | 5 | ownership 67.5% at level 10 after the pet changes (cap 62%) |
| Stray Dog | owner max HP cost | 14% | 16% | same |
| Energy Drink | weight | 10 | 16 | fired in 62% of the bouts of its owners |
| Whistle | condition | pet below 60% HP | pet below 90% HP | a pet was usually knocked out from full before it was ever below 60%; fired in 29% |
| Whistle | weight | 6 | 20 | same |
| Snatch | weight | 8 | 28 | its window (own hands empty, enemy armed) is short; fired in 48% |
| Body Slam | weight | 3 | 12 | needs empty hands; fired in 41% |
| Grapple | weight | 4 | 12 | needs empty hands; fired in 46% |
| Second Wind | condition | below 40% HP | below 50% HP | fired in 43% |
| Second Wind | weight | 6 | 16 | same |
| Machete | Dmg | 10 | 11 | with-and-without 46.4% at level 30 (the opening cuts burst weapons) |
| Sledgehammer | Dmg | 33 | 34 | 47.5% at level 30, too near the line |
| Anvil | Aim | -35 | -30 | ownership 39.6% at level 30 (floor 40%) |

Move conditions that need empty hands (Snatch, Body Slam, Grapple) were kept: the log contract checks that a Snatch is made with an empty hand, and the three are unarmed moves. Their weights carry the fix instead.

Results, same 500-bout review before and after (rivals and seeds from one fixed stream; "condition held" counts the bouts where the Move's condition was true at the start of one of its owner's turns):

| | Before | After |
|---|---|---|
| Median / shortest bout, level 1 | 11 / 5 | 15 / 8 |
| Median / shortest bout, level 5 | 10 / 4 | 14 / 7 |
| Median / shortest bout, level 10 | 13 / 5 | 14 / 8 |
| Median / shortest bout, level 20 | 17 / 6 | 16 / 10 |
| Median / shortest bout, level 30 | 17 / 7 | 18 / 7 |
| Bouts under 6 turns, 2,000 per level | 143, 106, 71, 19, 16 | 0 at every level |
| Bouts under 6 turns, 30,000 at random levels 1 to 30 | (3.3% in 10,000) | 0; medians 13 to 18 at every level |
| Pet actions per bout, owner sides (median) | 2 | 4 |
| Pets knocked out before they acted (6,000 bouts) | 20.3% | 1.6% |

Move firing, 2,000 bouts per level, share of owner bouts where the condition held: Haymaker 84% to 83%, Energy Drink 74% to 78%, Tarp 83% to 83%, Whistle 51% to 84%, Firecrackers 73% to 72%, Snatch 60% to 81%, Air Horn 70% to 80%, Body Slam 41% to 73%, Sand in the Eyes 79% to 78%, Taunt 80% to 80%, Second Wind 57% to 79%, Grapple 46% to 70%. `test/feel.test.ts` holds every Move at 60% or more.

Balance gate after the pass (`pnpm balance`, full sample): PASS, no limit broken; level 10 median 14 turns, level 30 median 18, overtime 0.0%. Nearest to a limit: Raccoon 59.5% and Stray Dog 59.6% ownership at level 10 (cap 62%); at level 30 Machete 47.8%, Anvil 47.8%, Pickaxe 47.9%, Ball and Chain 47.9%, Body Slam 47.9% and Sledgehammer 48.0% with-and-without (line 47%). The opening cuts big early hits, so the burst weapons sit near the line; a later change that weakens them further needs this gate run again.

### Pet pass (15 November 2026)

The full review of 15 November found pets far too strong (with-and-without 85 to 93% at level 3, and still 66 to 73% at level 30), a gate that could not see it (no upper limit), a starting perk that decided level-1 bouts by the name alone (8% to 98% wins), perk cards turning into splits more often as a scrapper levelled, perks offered where they could never work, and a few smaller rule gaps. The structural changes, each written above where it applies:

- **Pets grow with their owner** (section 5): level-1 HP and Strength are small and grow 15% (HP) and 60% (Strength) of that value per level, so a pet is worth about the same at every level. With the old 3% growth no number set could hold a pet near 60% at both level 3 and level 30.
- **Every scrapper starts with a weapon** (section 2). The easy cards of levels 1 to 3 are now rivals with their weapons left at home (section 4, start pass below).
- **A rejected perk card is rolled again** up to 3 times before it becomes a split (section 3).
- **Offer only what can work** (section 3): Pet Lover needs a companion like the Whistle; Sharpening Stone, Heavy Lifter, Trick Shot, Junk Collector, Pitcher, Firm Grip and Quick Swap need a weapon they work with.
- **Air Horn** fires with no enemy pet and then pushes the enemy scrapper 60 beats (section 7).
- **Haymaker** is not called while a Thrown weapon is in the hand (section 8).
- **The sure redraw**: no Move roll in the turn right after a throw while a weapon waits in the bag (section 5, step 2). Before, a Move took that turn about 10% of the time.
- **The gate** runs at levels 3, 5, 10 and 30 and has an upper limit per rarity and 65% for every pet (above).
- **Sim version**: `SIM_VERSION` (packages/core/src/sim/version.ts) is 2 (3 after the start pass below). The golden digests are tied to it, so a sim change cannot ship without a bump, and the app replays a bout with no stored log only when the rebuilt result equals the stored one.

Number changes:

| Row | Number | Was | Now | Why |
|---|---|---|---|---|
| Max HP | base / per level | 44 / 1 | 54 / 0 | weapon starts shortened level-1 bouts to a median of 12; stronger level-30 pets lengthened level-30 bouts to 22 |
| Companions | HP / Strength growth per level | 3% / 3% | 15% / 60% | see above |
| Raccoon | cost, HP, Strength, damage | 8, 16, 4, 3 | 11, 3, 1, 1 | with-and-without 81% at level 3 |
| Goose | cost, HP, Strength, damage, combo | 20, 28, 8, 3, 50 | 22, 6, 1, 1, 30 | 93% at level 3 |
| Boar | cost, HP, Strength, damage, Speed, start clock | 30, 104, 16, 6, 2, 250 | 25, 7, 2, 2, 4, 150 | 92% at level 3, and the slowest start made it weak at level 30 once tuned |
| Stray Dog | cost, HP, Strength, damage, Disarm | 16, 18, 5, 3, 15 | 17, 4, 1, 1, 8 | 85% at level 3 |
| Crow | cost, HP, Strength, damage, Evade | 12, 13, 5, 3, 40 | 26, 3, 1, 1, 25 | 92% at level 3, 73% at level 30; still the highest pet Evade (its role) |
| Alley Cat | cost, HP, Strength, damage, Evade | 14, 19, 5, 3, 30 | 25, 4, 1, 1, 25 | 92% at level 3 |
| Pet Lover | pet damage | +25% | +50% | +25% of a 1 or 2 damage peck rounded to nothing |
| Junk Collector | return chance | 60% | 90% | ownership 37.6% at level 3 (floor 40%) |
| Big Heart | Health multiplier | +40 | +30 | ownership 62.3% at level 3 with weapon starts (cap 62%) |
| Body Slam | base | 16 | 18 | ownership 42% and with-and-without 47.3% at level 30 |
| Grapple | weight | 12 | 16 | needs empty hands, which weapon starts made rarer: fired in 59.5% of the bouts it could (test floor 60%) |
| Air Horn | clock push with no enemy pet | (could not fire) | 60 | fired in 11 to 13% of owner bouts |
| Epic weapons | Draw | 4 to 5 | 6 | Mythic and Epic finds were the least drawn (finding 50) |
| Mythic weapons | Draw | 3 | 7 | same |
| Paint Can | Tempo, Dmg | 95, 15 | 105, 14 | ownership 71.7% at level 3 (cap 62%) |
| Traffic Cone | Dmg | 12 | 11 | ownership 69.5% at level 3 |
| Hockey Stick | Combo | 15 | 10 | ownership 68.8% at level 3 |
| Hand Axe | Dmg | 15 | 16 | with-and-without 46.7% at level 10 |
| Pickaxe | Aim | -20 | -15 | ownership 39.4% at level 3 |
| Golf Club | Dmg | 14 | 15 | 48.0% at level 30 |
| Rebar | Dmg | 22 | 23 | 48.1% at level 30 |
| Anvil | Dmg | 48 | 50 | 48.4% at level 30 |

The other thrown commons (bottle, ball) needed no number: weapon starts brought their level-3 ownership from 67-68% to 57-59%.

Results, full gate (`pnpm balance`, 4,000 bouts per perk, 40,000 pairs per level). Pets, with-and-without % (ownership % in brackets):

| Pet | Level 3 before / after | Level 5 | Level 10 | Level 30 |
|---|---|---|---|---|
| Raccoon | 80.9 (61.5) / 59.3 (50.0) | 76.5 / 57.5 | 68.1 / 60.4 | 58.8 / 56.0 |
| Goose | 93.3 (82.4) / 57.5 (36.6) | 90.3 / 57.9 | 84.8 / 57.8 | 67.2 / 56.5 |
| Boar | 91.8 (87.9) / 58.9 (47.5) | 88.2 / 60.1 | 81.6 / 56.3 | 66.5 / 53.8 |
| Stray Dog | 85.3 (67.8) / 60.5 (54.0) | 77.8 / 58.3 | 70.6 / 57.5 | 55.3 / 54.4 |
| Crow | 91.5 (79.5) / 57.5 (47.8) | 86.2 / 60.2 | 85.2 / 60.1 | 73.0 / 60.1 |
| Alley Cat | 92.4 (83.3) / 58.8 (48.6) | 90.3 / 60.8 | 84.1 / 63.0 | 69.1 / 61.0 |

Gate verdict: before, at levels 3, 5, 10 and 30 with the old limits, 18 limits broken (all at levels 3 and 5) and every pet row "ok"; after, with the new limits, PASS. Median turns: level 1 15 to 13, level 3 13 to 13, level 5 13 to 13, level 10 14 to 14, level 30 18 to 16; overtime 0.0%; no bout under 6 turns. Level-1 win rate by starting perk (300 or more bouts): 15.2% (Junk Collector) to 80.5% (Traffic Cone) before, 37.5% (Pickaxe) to 76.9% (Screwdrivers) after. Pet Lover and Junk Collector still own under 40% at level 3, on samples under the 1,000-bout limit (few level-3 kits qualify); both pass every limit from level 5 up.

Changing the Route and the starting perk changes the kit of every existing scrapper on its next walk (only picks are stored).

### Start pass (15 November 2026)

The pet pass lowered every number but left the gap between starting weapons: at level 1 a Common throw won 58.8 to 62.6% and a Common melee start 37.7 to 52.8%, and the spread of all starts with 300 or more bouts was 37.5 to 76.9%. Throws skip intercept and riposte and halve evade and block, so they were cut, and the weakest melee starts were raised. Numbers from `pnpm balance`, full sample; the weapon table in section 6 holds the new rows.

| Weapon | Changed | Was | Now | Level-1 start win %, before / after |
|---|---|---|---|---|
| Plastic Bottle | Dmg, Combo | 7, 25 | 6, 15 | 62.6 / 51.3 |
| Rubber Ball | Dmg | 7 | 6 | 58.8 / 49.7 |
| Paint Can | Dmg | 14 | 11 | 64.2 / 53.7 |
| Traffic Cone | Dmg | 11 | 9 | 62.3 / 53.1 |
| Hubcap | Dmg | 14 | 9 | 73.3 / 56.7 |
| Tyre | Tempo, Dmg | 120, 25 | 130, 16 | 77.1 / 68.7 (83 bouts) |
| Boomerang | Dmg, Aim, Combo | 8, 0, 20 | 6, -5, 15 | 70.4 / 60.1 |
| Screwdrivers | Tempo, Dmg, Aim, Block, Combo | 65, 6, 20, 15, 35 | 70, 5, 10, 5, 10 | 76.9 / 60.4 |
| Monkey Wrench | Tempo, Dmg | 130, 12 | 140, 10 | 64.7 / 57.1 |
| Hockey Stick | Tempo, Dmg, Aim | 115, 11, 10 | 125, 9, 5 | 64.2 / 57.7 |
| Cricket Bat | Tempo, Dmg | 140, 19 | 150, 17 | 65.1 / 56.6 |
| Pool Cue | Tempo, Dmg | 85, 8 | 95, 7 | 66.2 / 59.7 (77 bouts) |
| Pocket Knife | Tempo, Dmg, Crit | 65, 6, 10 | 60, 7, 15 | 37.7 / 47.5 |
| Pipe | Dmg | 12 | 13 | 46.0 / 47.8 |
| Machete | Dmg | 11 | 13 | 41.2 / 48.0 |
| Hand Axe | Tempo, Dmg | 145, 16 | 130, 17 | 40.0 / 47.1 |
| Pitchfork | Dmg | 14 | 15 | 45.1 / 46.2 |
| Knuckle Dusters | Dmg | 7 | 8 | 40.4 / 49.2 |
| Shovel | Dmg, Aim | 15, -10 | 16, 0 | 41.5 / 48.1 |
| Sledgehammer | Tempo, Aim | 180, -30 | 160, -20 | 38.4 / 51.2 |
| Pickaxe | Tempo, Aim | 160, -15 | 150, 0 | 37.5 / 47.5 |
| Rebar | Tempo, Aim | 170, 10 | 160, 20 | 41.7 / 45.5 |
| Stop Sign | Aim | -30 | -15 | 38.7 / 47.4 |
| Anvil | Tempo | 240 | 225 | 47.8 / 54.3 (92 bouts) |
| Ball and Chain | Tempo | 215 | 200 | 44.7 / 40.8 (76 bouts) |

Results:

- **Level 1, starts with 300 or more bouts**: 45.5% (Rebar) to 60.4% (Screwdrivers), was 37.5 to 76.9%. Common starts 47.1 to 51.8%, was 37.7 to 62.6%; the Common throws (51.3, 49.7) sit inside the Common melee range (47.1 to 51.8). Epic and Mythic starts are under 100 bouts each and are not read.
- **Level 3 ownership**: Common throws 49.9 and 51.8%, Common melee 48.2 to 50.4%; Uncommon throws 51.8 and 53.3%, Uncommon melee 48.0 to 54.5%; Hubcap 54.4% (was 67.0), Tyre 59.3% on 280 bouts (was 67.9).
- **Gate**: PASS at levels 3, 5, 10 and 30. Median turns 13, 13, 13, 14 and 17 at levels 1, 3, 5, 10 and 30; overtime 0.0%.
- **Easy cards** (section 4): the last 2 cards at levels 1 to 3 are rivals with their weapons left at home, so the frozen rule of `tonightsCard` ("at least 2 of them own no weapon") holds again as written. A random scrapper beats them about 96% of the time.
- **Sim version 3**: the golden digests changed with the weapon rows.

Open for the owner (not decided here): every start is still a weapon (the pet pass's design change); saved scrappers get a new start and kit on their next walk with no migration and no notice, and `rulesVersion` stays 1; a replay with no stored log is still re-simulated by result equality only, as no bout carries its sim version.

### Round 2 (16 November 2026)

The owner said the skills were "not even identifiable" and "the effects aren't there". The round-2 review ran `pnpm balance` and about 120,000 seeded bouts of its own and found the sim itself hid them: no skill at all at level 1, the opening cutting every big hit to a jab, Moves used up in the first seconds, a tag every second at level 30, boosters that never showed, and a level-up where the new item was the losing card. Each rule is written above where it applies. Numbers are from 4,000 pool bouts per level unless a sample is named.

**The starting-weapon rule of 15 November: kept, and a skill added** (section 2). This was the owner's open question. Without the rule (the old "any perk that fits" start, on today's tables) the level-1 result is a lottery of the name: start-perk win rates spread 63 points (Padding 12%, Traffic Cone 75%), fists make 70% of swings, comebacks fall to 8%. With it level 1 is fair (an 18-point spread) but every level-1 bout was two weapons and no skill. So the weapon stays and a second starting perk is added: a skill from a stream of its own, so every name keeps its weapon. Not a booster, Snatch or Knock Loose (78% and about 90% wins as a start), Quick Swap or Firm Grip (they could not show with a level-1 kit).

**What changed, and why:**

- **The opening** (section 5): a crit, a Haymaker swing, a Body Slam or a Grapple may take 25% of max HP in its turn (10% for a plain hit), never below 40% of max HP in the opening. A level-1 crit of 20 used to land as 7, the size of a plain hit.
- **Moves wait for the end of the opening** (section 5, step 2), but for the unarmed ones (Body Slam, Grapple, Snatch: empty hands are a thing of the first turn). Slack 12 to 6, and no Move on the own turn right after a Move. Moves fired on the owner's turn 1 to 3, where their damage was cut, and then nothing happened for the rest of the bout.
- **The first draw of a bout is certain** (section 5, step 3). A third of level-1 swings were fists although every scrapper starts with a weapon.
- **Tags** (section 7): the number skills, the chance passives, shields, Quick Swap, Head Start and boosters show once a bout per owner, and a once-a-bout tag waits 2 turns after the last tag or Move. Boosters now have a tag at all: Light Feet was the strongest Common perk (71.5% with-and-without at level 10) and never showed. Head Start keeps its tag, once, on the first action: it is the only sign of a skill a level-1 scrapper can start with.
- **Weapons in a kit** (section 3): 5 at most, and the weapon share of a perk card falls from 44 to 30 and 15 with the 4th and 5th. Level-30 kits owned 9.7 weapons and drew 2.4 a bout; 46% of late perk cards were weapons that changed nothing on screen. Bare Knuckle is not offered to a kit with 3 or more weapons.
- **The perk card** of the first three level-ups carries +1 point in a random stat (section 3). The stat card stays +2.
- **Tonight's Card** (section 4): the 2 unarmed cards of levels 1 to 3 are gone; the last card is an easy rival, armed, 3 stat points fewer.
- **The gate** also runs level 2 and a level-up policy test (above).
- **Sim version 4.** The golden digests changed.

| Row | Number | Was | Now | Why |
|---|---|---|---|---|
| Snatch | weight, uses | 28, 2 | 10, 1 | owners won 75.5% at level 2 and with-and-without was 82.9% (limit 82): every rival holds a weapon to take. Weight 9 gave 74.3% at level 2 but fired in 59.5% of the bouts it could (test floor 60%) |
| Anticipation | Intercept | 12 | 20 | its tag showed in 28% of its owner's bouts at level 30 |
| Firm Grip | resist | 60% | 80% | showed in 22% of its owner's bouts at level 30, 13% at level 3 |
| Junk Collector | throw chance while a weapon waits | 20% | 35% | its tag needs a melee throw: 24% of its owner's bouts at level 30 |
| Hockey Stick | Dmg, Draw | 9, 4 | 7, 3 | a 63.7% start at level 1 on 982 bouts with Dmg 9 once every scrapper draws on turn 1 (58.8% now); then weak as a late weapon, see Draw below |
| Monkey Wrench | Draw | 4 | 2 | a disarm is worth little against a bag of 5: 45.4% with-and-without at level 30 as a kit's 5th weapon (line 47%), 47.5% now. A Dmg rise would lift its level-1 start (67.8% on 329 bouts) |
| Screwdrivers | Draw | 5 | 3 | the same: 46.6% at level 30, 47.5% now |
| Move slack | | 12 | 6 | Moves are ready for fewer turns now |
| Perk rerolls | | 3 | 5 | the weapon cap turns more rolls away; splits stay under 3% of offers at levels 21 to 30 |

**Results** (before / after):

| | Before | After |
|---|---|---|
| Level-1 bouts with no skill moment | 100% | 15.9% |
| Level-3 bouts with no skill moment | 53.4% | 6.6% |
| A crit in turns 1 to 5, mean damage, level 1 / level 10 (a plain hit there: 7.1 / 8.8) | 7.3 / about 9 | 16.8 / 20.2 |
| Moves of the damage and control kind fired in turns 1 to 5 | 46 to 88% | 0% (the unarmed ones: 74 to 94%) |
| Fists, share of scrapper swings, level 1 / level 3 | 33.5% / 25.6% | 24.0% / 16.8% |
| Tags per bout at level 30 (Moves per bout) | 10.7 (2.7) | 7.8 (3.3) |
| Skill moments per minute at level 30, median; gap between two, median | 32.8; 1.00 s | 26.2; 1.71 s |
| Boosters: owner bouts with their tag | 0% | 64 to 100% (Light Feet 64 to 76%, the others 95% or more) |
| Owner bouts with the tag at level 30: Firm Grip, Junk Collector, Anticipation | 22%, 24%, 28% | 27%, 30%, 25% (at level 3: Firm Grip 13% to 27%, Anticipation 40%; Junk Collector 40% at level 10) |
| Weapons owned at level 30 (drawn per bout) | 9.7 (2.4) | 5.0 (2.1) |
| Always the perk card, win % against the pool, level 10 / level 30 | 41.3 / 27.5 | 51.3 / 47.7 |
| Always the stat card, the same | 43.0 / 41.6 | 36.3 / 23.6 |
| A random scrapper against the easy card, levels 1 to 3 | 96% (2 cards) | about 60% (1 card) |
| Snatch at level 2: owner wins / with-and-without | 75.5% / 82.9% | 67.5% / 75.2% (level 3: 63.7% / 71.5%) |
| Median turns, levels 1, 3, 10, 30; shortest bout | 13, 13, 13, 17; 6 | 13, 12, 14, 19; 6 |

Gate (`pnpm balance`, full sample, levels 2, 3, 5, 10 and 30): PASS, no limit broken. Median turns 13, 13, 13, 14 and 19; overtime 0.0%. Level-up policy: always-perk 51.3% at level 10 and 47.7% at level 30 (band 45 to 55). Nearest to a limit: at level 30 Anvil 47.4%, Screwdrivers 47.5%, Hockey Stick 47.6% and Monkey Wrench 47.6% with-and-without (line 47%); at level 2 Ball and Chain 47.0% and Whistle 47.1%, and at the top Plunger 81.2% (Mythic, limit 88) and Knock Loose 80.2% (Rare, limit 82). The report's sample streams are seeded, so the same code gives the same numbers; a later change to these rows needs the gate run again. On a kit with 5 weapons the report measures a weapon as the 5th, with the kit's last weapon left at home.

Open, not decided here:
- A player who always takes the stat card now loses badly at level 30 (23.6%): such a kit holds its two starting perks against 20. The cards are a choice between two things that need each other; a mix wins.
- Knock Loose is the strongest early Rare (with-and-without 80.2% at level 2, limit 82%): a level-2 kit has one or two weapons, and a disarm leaves fists.
- Level-30 bouts are a little longer (median 19 turns, 17 before; about 25 s at 1x).
- Head Start and Fast Twitch tag the first action; the review asked to drop Head Start's tag.
- Firm Grip, Junk Collector, Anticipation and Sharpening Stone still show in under a third of their owner's level-30 bouts (the table above): a once-a-bout tag shares 19 turns with 20 other perks. Bare Knuckle is no longer offered to a kit with 3 weapons, but a kit that already holds it shows it in 1% of level-30 bouts.
- Level-1 win rate by starting weapon, starts with 300 or more bouts: 41.9% (Sledgehammer) to 67.8% (Monkey Wrench), a 26-point spread; it was 18 points before this round. The Common and Uncommon starts run from 41.9% to 59.7%; six Rare starts sit at 62 to 68% (Bike Chain, Screwdrivers, Cricket Bat, Hubcap, Boomerang, Monkey Wrench). Every scrapper now draws on turn 1, so the weapon counts from the first swing, and a disarm of a level-1 scrapper's only weapon leaves fists for the bout. By starting skill the spread is 12 points (Stubborn 43.8% to Pitcher 56.0%). A rule that returns a scrapper's last weapon to its bag after a disarm would narrow this; it changes the log contract and was not done here.
- For the stage: boosters have a tag and no lasting body effect; a Body Slam at a pet behind its owner runs the attacker past the owner (find-bout level 30 n 2), and a pet's dodge hop leaves the bout frame in find-bout level 10 n 36.
- Saved scrappers get their starting skill and new cards on their next walk, with no migration (as after the pet pass).
