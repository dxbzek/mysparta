# Rules of Rank Zero

This is how the game works, written for the people who build and tune it. The code in `packages/core` is the authority; this file says the same thing in words. Every number here is the number the code uses today. A number that the balance pass moved away from its first value is listed in the last section with its old value and the reason.

All rule maths is whole numbers. Division rounds down. A chance is a whole percent and passes when a roll from 0 to 99 is below it. `roll(a..b)` is a whole number from a to b, both included.

## 1. Stats

A scrapper has four stats: Health, Strength, Agility and Speed. Each has points and a multiplier (a whole percent, 100 at the start). The value used everywhere is `floor(points x multiplier / 100)`.

- **Health** sets max HP: `30 + 7 x Health + 3 x level`, then the companion cost is taken off: `floor(maxHP x (100 - cost) / 100)`. Never below 1.
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
- **Stats.** Every stat starts at 2. Then 6 points are dealt one at a time, each to a random stat that is still below 5. Total 14. Level-1 HP is 47 to 68 before the starting perk.
- **Starting perk.** One roll from the perk pool (section 3), rolled again until it is allowed on an empty kit. A starting booster changes the stats at once, like a picked one.
- **Random name.** A first part (120 of our own) and a second part (60 of our own), joined by a space. Every such name passes the name check.

## 3. Level-ups and the Route

**XP.** A win gives 2, a loss 1. A win over a rival two or more levels below gives 1 (no rival on the card can be, today). XP needed for the next level: `2 + level + floor(level / 2)`: 3, 5, 6, 8, 9, 11, 12, 14, 15, 17 for levels 1 to 10, and 32 at level 20. Extra XP carries over. A level-up is waiting while the XP held is at least the XP needed; taking it removes that much XP and adds one pick.

**The two cards.** Each level-up offers a stat card and a perk card, in a random left-right order.
- Stat card: +2 points in one random stat.
- Perk card: one roll from the perk pool. If that perk is not allowed, the card becomes a split: +1 point in each of two different random stats.

**The perk pool.** A category roll out of 100: weapon 0 to 45, skill 46 to 95, companion 96 to 99. Then one item inside the category, by weight:

| Rarity | Weight |
|---|---|
| Common | 400 |
| Uncommon | 150 |
| Rare | 50 |
| Epic | 12 |
| Mythic | 2 |

Companions use their own weights: Raccoon 90, Goose 5, Boar 5. So one given Common weapon is 46% x 400 / 3,664, about 5.0% of rolls; one given Common skill 50% x 400 / 4,838, about 4.1%; the Raccoon 3.6%; the Mythic skill about 0.02%.

**A rolled perk is not allowed when:**
- it is already owned (the Raccoon may be owned twice);
- it is a companion past its limit or one its owner's companion rules out (Goose and Boar never together);
- it is a booster and boosters are already owned: with one owned it passes 10% of the time, with two 3%, with three or more never (one extra roll);
- it is the Whistle and no companion is owned.

**The Route** is a pure function of the seed and the list of picks. The cards of level-up k are drawn from a stream seeded with `(seed, "route", k, picks so far)`, and checked against the kit those picks built. Nothing is stored but the picks. The same picks always give the same later cards.

## 4. Bouts per day and rivals

- 6 bouts a day per scrapper, 8 on the day it was made. The day key (`YYYY-MM-DD`, local) is passed in by the app; the core never reads a clock. A stored day older than today means a full day. A clock that moves back resets nothing.
- **Rivals.** `rivalSeed = hash(realmSalt, "rival", level, index)`. A rival is made from that seed by the same code as a player's scrapper, named from our lists, and levelled by walking its own Route: it takes the perk card (or the split that replaced it) 65% of the time. A level N rival has N - 1 picks. There are 240 rivals per level.
- **Tonight's Card.** 6 different rivals at the scrapper's level, drawn from `hash(seed, dayKey, bouts used today)`, so it changes after every bout and at day rollover. At levels 1 to 3 the card always holds at least 2 rivals with no weapon: the last armed cards are drawn again from the pool until it does.
- **Bout seed** = `hash(fighter id, opponent id, the fighter's lifetime bout count)`.

## 5. The fight

A bout reads only two snapshots (name, look, level, stats, perk ids) and a seed. Boosters and the Plate Vest are already inside the snapshot's stats; the sim never applies them a second time. Mountain's late start and the Plate Vest's Armor are fight rules and are applied in the bout.

### Random streams

Each part of the rules draws from its own stream, seeded from the bout seed and the stream's name: `clock`, `tie`, `move`, `draw`, `throw`, `target`, `hit`, `disarm`, `damage`. Adding a roll to one system never shifts the numbers of another. The stage's cosmetic randomness is separate and never touches these.

### Actors and the clock

- The two scrappers are `a0` (the challenger, left) and `b0`. Companions take `a1` to `a3` and `b1` to `b3` in the order they stand in the owner's perks.
- Time is in beats. `bodyTempo = 40 + floor(1200 / (10 + Speed))`: 160 at Speed 0, 120 at 5, 100 at 10, 80 at 20, 60 at 50.
- A normal turn costs `floor(weapon Tempo x bodyTempo / 100) + roll(0..10)`. Companions use Tempo 100.
- Start clocks: a scrapper `roll(0..20) - 2 x Speed`, Head Start -150, Mountain +150. A companion: Raccoon 10, Goose 40, Boar 250, each `+ roll(0..10)`.
- The lowest clock acts next. On a tie, an actor whose last action cost no time (a free Move, or a companion just called by a Whistle) goes first; then a seeded roll among the tied actors in id order.
- **A turn** is one actor taking its place: a scrapper turn, a companion turn, a Move, or a skipped snared turn. Turn counts (overtime, the stop, the length targets) count all of them.

### A scrapper's turn

1. **Snared?** It skips the turn. The skip costs one normal turn of time and writes nothing, so turn numbers jump. The third skip ends the snare and writes `free` with cause "timeout".
2. **Move roll.** The owned Moves with uses left whose condition holds are listed; W is the sum of their weights. One roll from 0 to W + 11: below W picks a Move by weight, otherwise none fires. A Move is the whole turn and sets its own time cost.
3. **Draw or swap.** Empty hands and weapons in the bag: draw with chance `S / (S + 6)`, S the sum of the bag's Draw weights, picked by weight. Holding a weapon that has already attacked, with weapons in the bag: 30% to swap (Firm Grip 15%); the old weapon falls and is gone for the bout. Drawing does not end the turn.
4. **Throw or melee.** A Thrown weapon is always thrown and never used up. Any other held weapon is thrown 5% of the time (Pitcher 35%) and is then gone (Pitcher: back into the bag).
5. **Target.** One random standing enemy, scrapper or companion.
6. **Resolve** the attack.
7. **Pay the time.** The weapon whose Tempo counts is the one the turn was made with.
8. **Overtime.** From turn 50 a scrapper loses 8% of its max HP (at least 1) after each of its own turns, skipped ones included. Last Stand does not save from it.

### A melee attack

a. **Intercept.** If the defender is a standing, unsnared scrapper: chance `Intercept + 8 x (defender Reach - attacker Reach)`, 0 to 75. A Thrown weapon and a companion count as Reach 0. If it fires the defender makes one swing at the attacker (it can be evaded or blocked, it can crit and disarm, it cannot combo), and the attacker's turn ends; the attacker still pays the full time of the turn.

b. **Evade, then Block,** rolled for every swing.
   - Evade = `defender Evade + clamp(3 x (defender Agility - attacker Agility), -30, +30) - attacker Aim`, 0 to 80.
   - Block = `defender Block - attacker Pierce`, 0 to 75. Companions never block.
   - A snared defender neither evades nor blocks.

c. **Damage.**
   - Melee `raw = base + floor(Strength x (base + 4) / 12)`.
   - `damage = floor(floor(raw x roll(85..115) / 100) x multiplier / 100)`. The multiplier is 100 plus the skill bonuses, doubled by Haymaker.
   - Crit (chance Crit, Haymaker +15, cap 60): `floor(damage x 3 / 2)`.
   - Armor: `damage - floor(damage x Armor / 100)`. Never below 1.
   - At Strength 3 with the first table: fists 7, Pocket Knife 8, Pipe 13, Hand Axe 19, Sledgehammer 36 (raw values).

d. **Disarm.** On a landed hit against a held weapon: chance = attacker Disarm. The weapon falls and is gone. Firm Grip resists 60% of the time and the disarm is written as resisted. A defender with a Car Door also loses the door on a separate roll at one third of the attacker's Disarm, on every swing that is not evaded. Neither roll is made when the hit already knocked the defender out.

e. **Combo.** Chance `Combo + Agility`, capped at 80 first, then halved after each success (80, 40, 20). At most 3 extra swings. Stubborn rolls before the combo roll: after a swing that was evaded or blocked, 50% to swing again at once, once per turn, and that extra swing can start a combo. The swings stop when the target falls.

f. **Riposte.** After the attacker's last swing, a standing, unsnared scrapper defender hits back once with chance Riposte (cap 80). After a block, a Parry owner's chance for that attack is 80. A riposte cannot be riposted or intercepted.

**After a hit** the steps it causes follow it, in order: disarm, door off, free (a snared target is freed by any hit), knockout. A scrapper's knockout ends the bout in the same turn.

### Throws

- Thrown `raw = base + floor((Strength + 2 x Agility) x (base + 4) / 36)`, then `x roll(95..125) / 100` and the multiplier.
- Evade and Block against a throw are halved. No intercept, no riposte. Armor does not apply. A throw can crit and disarm, and can combo while the weapon stays in the hand.

### Companions

Separate actors with their own HP and clock. HP and Strength grow with the owner's level: `x (100 + 4 x (level - 1)) / 100`. They make bare melee attacks on a random standing enemy with their own numbers and the melee formula, can combo and evade, never block, intercept or riposte, and a scrapper may intercept or riposte them. Tempo 100, Reach 0, Crit 5, Pierce 0, Armor 0. A knocked-out companion stays down; a companion scared off by an Air Horn leaves. A companion going down never ends a bout.

| | Raccoon | Goose | Boar |
|---|---|---|---|
| Rarity word | Uncommon | Epic | Epic |
| Weight | 90 | 5 | 5 |
| Limit | 2 | 1, never with a Boar | 1, never with a Goose |
| Owner max HP cost | 8% each | 20% | 30% |
| HP | 14 | 22 | 80 |
| Strength | 4 | 8 | 16 |
| Agility | 6 | 12 | 2 |
| Speed | 6 | 16 | 2 |
| Base damage | 3 | 3 | 6 |
| Combo | 20 | 50 | 0 |
| Evade | 10 | 25 | 0 |
| Aim | 5 | 5 | 20 |
| Disarm | 0 | 0 | 10 |
| Start clock | +10 | +40 | +250 |

### End of a bout

- A side loses when its scrapper reaches 0 HP.
- After turn 150 the bout stops: the higher share of max HP wins; a tie goes to the challenged side (b). Such an ending writes no knockout step.

## 6. Weapons

A weapon's numbers add to the scrapper's base values while it is held. Fists are the numbers of an empty hand. Reach 0 to 4; a Thrown weapon has no Reach and counts as 0. "Tempo" is the turn's time cost as a percent of fists; "Draw" the weight for being pulled from the bag.

| Weapon | Rarity | Tags | Clip | Tempo | Dmg | Reach | Draw | Aim | Pierce | Block | Evade | Riposte | Combo | Disarm | Crit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Fists | - | - | punch | 100 | 5 | 0 | - | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Pipe | Common | - | swing | 110 | 11 | 1 | 5 | 0 | 0 | 12 | 0 | 5 | 0 | 10 | 10 |
| Pocket Knife | Common | Light, Blade | flick | 65 | 6 | 0 | 5 | 25 | 0 | 0 | 5 | 0 | 35 | 0 | 10 |
| Broom | Common | Pole | thrust | 100 | 6 | 3 | 4 | 0 | 0 | 20 | 5 | 28 | 10 | 15 | 5 |
| Machete | Common | Blade | swing | 115 | 10 | 1 | 5 | 5 | 0 | 5 | 0 | 5 | 5 | 5 | 30 |
| Hand Axe | Common | Heavy, Blade | swing | 145 | 15 | 1 | 4 | 0 | 15 | -5 | 0 | 0 | 0 | 5 | 15 |
| Bat | Uncommon | - | swing | 120 | 12 | 2 | 5 | 0 | 10 | 5 | 0 | 18 | 0 | 5 | 15 |
| Pitchfork | Uncommon | Pole | thrust | 130 | 13 | 3 | 3 | 0 | 0 | 5 | 0 | 0 | 0 | 5 | 10 |
| Crowbar | Uncommon | Heavy | swing | 140 | 15 | 1 | 4 | -10 | 20 | 5 | 0 | 0 | 0 | 25 | 5 |
| Knuckle Dusters | Uncommon | Light | punch | 70 | 7 | 0 | 5 | 10 | 10 | 0 | 5 | 0 | 28 | 0 | 10 |
| Bin Lid | Uncommon | - | swing | 100 | 8 | 0 | 3 | 0 | 0 | 40 | 0 | 35 | -10 | 0 | 0 |
| Shovel | Uncommon | Heavy, Pole | smash | 150 | 15 | 2 | 3 | -10 | 10 | 18 | -5 | 5 | -10 | 10 | 5 |
| Sledgehammer | Uncommon | Heavy | smash | 180 | 31 | 1 | 5 | -30 | 30 | -20 | -20 | -20 | -40 | 10 | 10 |
| Darts | Uncommon | Thrown, Light | throw | 45 | 3 | - | 5 | 0 | 0 | -5 | 12 | 0 | 30 | 0 | 5 |
| Bike Chain | Rare | Pole | swing | 140 | 10 | 4 | 5 | 30 | -10 | -15 | 20 | -5 | 30 | 25 | 0 |
| Monkey Wrench | Rare | Heavy | swing | 130 | 12 | 1 | 4 | 0 | 10 | 10 | 0 | 0 | 0 | 60 | 5 |
| Pickaxe | Rare | Heavy | smash | 160 | 19 | 2 | 4 | -20 | 100 | -10 | -10 | 0 | -10 | 10 | 10 |
| Rebar | Rare | Heavy | swing | 170 | 22 | 2 | 5 | 10 | -10 | 5 | -15 | 0 | 0 | 10 | 10 |
| Screwdrivers | Rare | Light | flick | 65 | 6 | 0 | 5 | 20 | 0 | 15 | 5 | 0 | 35 | 45 | 5 |
| Garden Shears | Rare | Light, Blade | flick | 75 | 8 | 1 | 4 | 15 | 0 | 5 | 0 | 5 | 20 | 10 | 15 |
| Stop Sign | Rare | Pole, Heavy, Blade | smash | 175 | 23 | 3 | 3 | -30 | 0 | 10 | 0 | 0 | 5 | 10 | 5 |
| Boomerang | Rare | Thrown | throw | 70 | 8 | - | 4 | 0 | 0 | -5 | 10 | 0 | 20 | 10 | 10 |
| Anvil | Epic | Heavy | smash | 240 | 48 | 1 | 5 | -35 | 50 | -30 | -30 | -20 | -40 | 15 | 5 |
| Ball and Chain | Epic | Heavy | smash | 215 | 34 | 2 | 5 | -30 | 100 | -40 | -25 | 0 | 12 | -10 | 0 |
| Umbrella | Epic | Light | flick | 50 | 4 | 1 | 5 | 40 | 0 | -30 | 45 | 40 | 40 | -20 | 0 |
| Pool Cue | Epic | Pole, Light | thrust | 85 | 8 | 3 | 4 | 20 | 0 | 10 | 10 | 10 | 22 | 10 | 10 |
| Bricks | Epic | Thrown, Heavy | throw | 100 | 13 | - | 4 | -10 | 0 | -10 | 0 | 0 | 0 | 20 | 15 |
| Rubber Chicken | Mythic | Light | swing | 90 | 5 | 1 | 3 | 35 | 100 | -20 | 0 | 60 | 70 | 0 | 0 |
| Lawn Flamingo | Mythic | Pole | thrust | 120 | 13 | 4 | 3 | 20 | 0 | 0 | 30 | 30 | 20 | 30 | 35 |

## 7. Skills

**Boosters** change the stats for good when picked (points now, the multiplier for all points now and later). **Passives** are on for the whole bout. **Moves** fire by the Move roll and have limited uses per bout.

| Skill | Kind | Rarity | Effect |
|---|---|---|---|
| Big Heart | booster | Common | +3 Health points, Health multiplier +40 |
| Heavy Hands | booster | Common | +3 Strength points, Strength multiplier +40 |
| Light Feet | booster | Common | +3 Agility points, Agility multiplier +40 |
| Fast Twitch | booster | Common | +3 Speed points, Speed multiplier +40 |
| Glass Cannon | booster | Epic | Strength multiplier +100, Health multiplier -30 |
| Mountain | booster | Mythic | Health multiplier +150, Agility and Speed multipliers -20 each, start clock +150 |
| Padding | passive | Common | Armor +10 |
| Anticipation | passive | Common | Intercept +12 |
| Sharpening Stone | passive | Uncommon | melee damage with a Blade weapon +40% |
| Bare Knuckle | passive | Uncommon | damage with fists +100%, Combo +10 while unarmed |
| Payback | passive | Uncommon | Riposte +25 |
| Flurry | passive | Uncommon | Combo +20 |
| Car Door | passive | Uncommon | carries a door: Block +35 and own damage -20% while it holds; it can be knocked off |
| Firm Grip | passive | Uncommon | 60% to resist a disarm or a Snatch; swap chance 15% instead of 30% |
| Head Start | passive | Uncommon | start clock -150 |
| Sharp Eye | passive | Uncommon | Aim +16, Pierce +16 |
| Parry | passive | Uncommon | Block +10; after a block, Riposte chance 80 for that attack |
| Heavy Lifter | passive | Rare | turns with a Heavy weapon cost 30% less time; Aim +10 while holding one |
| Pitcher | passive | Rare | thrown damage +40%; a weapon that is not Thrown is thrown 35% of the time and goes back in the bag |
| Plate Vest | passive | Rare | Armor +22, Speed multiplier -15 |
| Knock Loose | passive | Rare | Disarm +40 |
| Last Stand | passive | Rare | once a bout, a hit or a Move that would leave 0 HP leaves 1 |
| Stubborn | passive | Rare | after an evaded or blocked swing, 50% to swing again at once, once a turn |
| Slippery | passive | Epic | Evade +25 |

| Move | Rarity | Weight | Uses | Only when | Time | Effect |
|---|---|---|---|---|---|---|
| Haymaker | Uncommon | 5 | 1, plus 1 per 25 Strength | no boost is already waiting | 0 | the next melee swing (hit, evaded or blocked) has double damage and Crit +15; a throw or an intercepted turn does not use it |
| Energy Drink | Uncommon | 10 | 1 | own HP below 50% | 30 | heals `roll(25..40)`% of max HP |
| Tarp | Uncommon | 5 | 1 | an enemy that is not snared | 20% of a turn | snares a random free enemy companion if there is one, otherwise the scrapper |
| Whistle | Uncommon | 6 | 2 | an own companion standing and below 60% HP | 20 | heals it by 50% of its max HP and it acts next |
| Firecrackers | Rare | 3 | 2 | always | 50% of a turn | `roll(12..20)` to the enemy scrapper, 40% of max HP to each enemy companion; no evade, block or Armor |
| Snatch | Rare | 8 | 2 | own hands empty, the enemy scrapper holds a weapon | 0 | takes that weapon into the hand |
| Air Horn | Rare | 8 | 1 | an enemy companion is standing | 20 | each enemy companion has 50% to run off; the enemy scrapper's clock +40 |
| Body Slam | Epic | 3 | 1 | own hands empty | one turn + 100 | `floor((16 + 3 x Strength) x roll(85..115) / 100)` to a random enemy, Armor applies; no evade, block or intercept; knocks off its weapon (Firm Grip can hold on) and its door |

"20% of a turn" and "50% of a turn" are shares of the user's turn cost without its random part.

### Skill tags on stage

A step can name a skill that decided it (`procs`), rarest skill first. Rule skills always write their tag: Last Stand on the hit it survives, Parry on the riposte it made possible, Stubborn on its extra swing, Firm Grip on the disarm or Snatch it resisted, Car Door on a block made while the door holds, Head Start on its owner's first action. Chance skills write their tag only when the roll passed because of their bonus (the same roll compared with the chance with and without it, no extra random number): Anticipation on an intercept, Payback on a riposte, Flurry on a combo swing, Slippery on an evade, Knock Loose on a disarm, Sharp Eye on a hit that would have been evaded or blocked without it.

## 8. Choices the sim makes where the brief was silent

- A Haymaker cannot fire while its boost is still waiting: a second one would add nothing.
- After a hit that knocks the target out, no disarm or door roll is made.
- When Firecrackers knock out companions and the scrapper together, the companions fall first, so every fallen actor gets its knockout before the bout ends.
- Firecrackers rolls its damage once for the enemy scrapper.
- A Whistle sets the companion's clock to its owner's clock before the owner pays the Move's time, and the companion wins a tie.
- The Snatch, Body Slam and Firecrackers roll on the `disarm`, `damage` and `move` streams like every other system of their kind.

## 9. Balance pass

The first values came from the design brief. `pnpm balance` (`tools/balance-report.ts`) runs the two balance tests at levels 10 and 30:

- **Ownership:** 40,000 random pairs of same-level rivals per level. For each perk, the bouts where exactly one side owns it, and how often that side wins. Counted for perks with 1,000 or more such bouts: no Common or Uncommon perk and no Raccoon above 62%, no perk below 40%.
- **With and without:** 4,000 bouts per perk per level of a random rival against a copy of itself that also owns the perk, sides swapped every bout. No perk below 47%. Whistle is tested only on rivals that own a companion.

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
