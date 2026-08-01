# MyBrute / LaBrute — Definitive Mechanical Teardown

Research report for an original browser RPG inspired by (not cloning) MyBrute (Motion Twin, 2009) and its Eternaltwin revival "LaBrute" (labrute.eternaltwin.org / brute.eternaltwin.org / mybrute.eternaltwin.org).

**Lineage note.** There are three generations with slightly different rules: (1) the original **MyBrute / labrute.fr** (Flash, March 2009); (2) **"La Brute" V2 on Muxxu** (French March 2010; English/Spanish "MyBrute V2.0" May 2011) which added Talents, clans and the two-choice level-up; (3) the **Eternaltwin remake by Zenoo** (TypeScript, first playable v1.0.0 August 2022, open source), which recreates the V2 ruleset and keeps adding features (destiny tree UI, ranks, achievements, clan wars, bosses). Where rules differ below, the generation is flagged.

---

## 1. Core gameplay loop — radical onboarding, tiny sessions

- **Creation = typing a name.** On the homepage you enter a name; the game instantly generates a brute. Appearance (gender, hair, skin, clothing, accessories) can be tweaked/re-rolled from a random generator, but *starting stats, starting weapons, skills and even a pet are randomly rolled from the name/seed*. No tutorial, no account required up front — the brute exists in seconds.
- **Daily fight ration.** Original: **3 arena fights per 24h** (with ~6–7 free fights on creation day) — explicitly designed to force daily logins. Muxxu V2: up to **10 fights/day or 3 losses**, whichever comes first (20 fights for a €0.25 micropayment). Eternaltwin LaBrute: **6 fights/day**, extendable to **8** via the Regeneration skill.
- **Session flow (2–5 minutes).** Log in → cell page → arena → pick opponents → watch 3–6 automated fights of ~30–60 seconds each → maybe a level-up reveal → done. Reviewers in 2009 specifically praised that it "required little time investment"; the fight ration is the session length. There is nothing else to grind — scarcity *is* the retention mechanic.
- **Everything is a URL.** Every brute lives at `brutename.mybrute.com`; appending `/cellule` shows anyone's cell (stats, weapons, pets). Fight replays are deterministic and shareable by URL. This made scouting and bragging frictionless and fueled virality.

## 2. Combat resolution — fully automated, stat-driven

Combat is 100% AI-resolved; the only player input is choosing the opponent. Under the hood:

- **Initiative** (hidden stat) decides who acts first; it is seeded by Speed and modified by skills (**First Strike ±200 initiative; Reconnaissance shifts it ~200 the other way**) and by weapons (a drawn heavy weapon worsens initiative — the Bear pet "usually takes 2 to 3 rounds before it even starts attacking" because of terrible initiative).
- **Interval/tempo**: each actor has an attack interval (base value modified by weapon in hand and Speed). Fast weapons = low interval = more turns; the Trombone has "the highest Interval in the game". Turn order is effectively a race of interval counters, not strict alternation — a fast brute simply attacks more often.

### The four visible stats

| Stat | Effect |
|---|---|
| **Endurance (HP)** | HP = **50 base + 6 per Endurance point + 1.5 per level** (min 51). Pets *deduct* Endurance (see §5). |
| **Strength** | Damage per hit for melee weapons and fists; minor contribution to thrown damage. |
| **Agility** | Dodge/Evasion rate, Combo rate, Accuracy, and the **primary damage stat for thrown weapons** (Shuriken, Piopio, Noodle Bowl). |
| **Speed** | Shortens attack interval / raises chance of extra attacks; light weapons (Sai, Fan, Knife) scale with Speed much more than heavy ones (Axe, Bumps, Morning Star). |

### The hidden combat stats

The engine tracks per-fighter (base + weapon + skill modifiers): **Initiative, Interval, Counter Rate, Combo Rate, Evasion, Reversal Rate, Block Rate, Accuracy, Precision, Armor, Disarm Rate, Damage**.

### Defensive/offensive events (how a hit resolves)

- **Dodge/Evade** — Agility-based; avoids all damage.
- **Block** — weapon/shield chance to negate all damage; attacker Accuracy is rolled *against* defender Block.
- **Counter** — reach-based: a *longer* weapon gets a chance to strike an enemy as they close in (Whip = highest Counter rate in game).
- **Counter-attack / riposte** — a free attack after blocking (the Counter-Attack skill grants this plus +10% Block; in the original, the "Pugnacious" special boosted it).
- **Combo** — chance to chain extra hits in one turn (Agility + weapon Combo rate; Fists of Fury +20%).
- **Disarm** — knocks the opponent's weapon out of hand (Sai has ~100% disarm rate; Shock +50%, Iron Head +30% when *you* are hit).
- **Reversal** — turning an opponent's attack back on them (own hidden rate).
- **Throw** — brutes can hurl their held weapon "in rage" for bonus damage (any weapon can be thrown once; dedicated thrown weapons re-throw repeatedly).
- **Armor** — flat/percent damage reduction; notably *bypassed* by thrown attacks (Bomb, thrown weapons).

Damage skill multipliers documented by the wiki: **Weapons Master ×1.50 (sharp weapons), Martial Arts ×2.00 (bare hands)**; Fierce Brute ×2 on the next connecting hit.

## 3. Weapons — 26 in the classic roster, tradeoffs by class

Weapon classes and signature examples (each weapon carries its own hidden stat block):

| Class | Character | Examples & notable tradeoffs |
|---|---|---|
| **Fast** | Small/light, low interval, high Combo, Speed-scaling | **Knife** (low damage, low interval, high combo), **Sai** (low damage but ~100% Disarm + very high Block/Combo), **Fan** |
| **Sharp** | Blade weapons; benefit from Weapons Master (+50% dmg); generally high Block | **Sword** (high damage, mid-high interval, decent Counter but *lowers* Evasion and Accuracy), Broadsword, Sabre, Scimitar, **Halbard** (long reach) |
| **Heavy** | Big/blunt; huge single-hit damage; low Accuracy & Combo; barely scale with Speed | **Trombone** (high damage, highest Interval in game), Stone Hammer ("HUGE damage but doesn't hit often"), Bumps, Mammoth Bone, Morning Star, Baton |
| **Long** | Reach → Counter chances | **Whip** (mid damage, highest Counter rate in game, high Combo/Disarm/Precision — but poor Accuracy so it's easily blocked), Lance |
| **Thrown** | Damage from Agility (some Strength); re-thrown each turn; ignore Armor | **Shuriken** (lowest damage & lowest interval in the whole game), Piopio, Noodle Bowl |
| **Shield** | Held item granting large Block; is a "weapon slot" and can be disarmed | Shield (paired with the Shield skill) |

Design takeaway: every weapon is a bundle of ~10 dials (damage, interval, accuracy, block, counter, combo, disarm, precision, evasion modifier, initiative modifier), so "which weapon your brute happens to draw this turn" creates fight texture without any player input. Brutes with multiple weapons draw a random one during the fight; bare hands remain a real "weapon" (buffed by Martial Arts).

## 4. Skills — 42 total in the LaBrute lineage (21 passive)

### Supers (activated randomly in-fight, limited uses)

| Super | Effect |
|---|---|
| **Fierce Brute** | Once per fight: next attack that connects deals **double damage** (also doubles Hammer). |
| **Hammer** | Throws own weapon, then piledrives for **unavoidable damage**; +100% with Fierce Brute. |
| **Net** | Once per fight: immobilizes an opponent (or pet); trapped target takes guaranteed hits until freed. |
| **Bomb** | **15–25 damage to every enemy including all pets**; counts as thrown so Armor/Toughened Skin don't reduce it. |
| **Flash Flood** | Hurls ~**half your weapon inventory** (rounded down) at the enemy brute; always hits, ignores pets; damage scales with Agility, reduced by Armor. |
| **Thief** | Steals the weapon in the opponent's hand; **max 2 uses per fight**. |
| **Tragic Potion** | Once per fight: heals **25–50% of HP lost**. |
| **Cry of the Damned** | **50% chance per pet** to make opponent's pets flee; can re-trigger on remaining pets. |
| **Hypnosis** | Once per fight: opponent's pets **defect to your side**. |
| **Tamer** | Eat a downed pet to heal: **Dog 20% / Panther 30% / Bear 50%** of total health. |

### Stat boosters (the build-defining picks)

Boosters give **+3 to the stat, +50% of current stat, and +50% on every future level-up of that stat**: **Herculean Strength** (Str), **Feline Agility** (Agi), **Lightning Bolt** (Spd), **Vitality** (End, +50%). **Immortality** is the extreme: **+250% Endurance and +250% on future End gains, but −25% to all other stats and their future gains**. **Reconnaissance** is a Speed mega-booster that wrecks your initiative in exchange.

### Passives / specials (selection with documented numbers)

- **Toughened Skin**: +2 Armor. **Armor**: +5 Armor but −10% Speed. **Lead Skeleton**: −30% damage from blunt weapons.
- **Shield**: grants a shield (big Block bonus); the only passive that can be *removed* by a disarm.
- **Untouchable**: +30% Evasion. **6th Sense**: +10% Counter. **Counter-Attack**: +10% Block + riposte after each successful block. **Shock**: +50% Disarm. **Iron Head**: +30% Disarm-on-being-hit.
- **Determination**: 70% chance to immediately attack again after a miss/blocked attack. **First Strike**: +200 Initiative. **Survival**: a killing blow leaves you at 1 HP instead.
- **Weapons Master**: +50% Sharp-weapon damage. **Martial Arts**: +100% unarmed damage. **Fists of Fury**: +20% Combo. **Bodybuilder**: −25% Interval with Heavy weapons. **Ballet Shoes**: evasion-type passive that fires at a predetermined fight moment. **Hostility**: boosts Reversal. **Master of Arms** (original-era special): +50–100% melee weapon damage.
- **Backup** (Muxxu/LaBrute Talent, activated in your cell for a daily cost): one of your *other* brutes jumps into fights for ~2–3 attacks; only helps brutes of higher level than itself. In LaBrute clans, clanmates can similarly show up to help.
- **Regeneration** (Eternaltwin LaBrute): +2 arena fights per day (6→8).
- Community tier lists for the Eternaltwin remake also rank newer additions (e.g. Vampirism, Haste, Treat, Repulse, Fast Metabolism, Hideaway, Chef) — effects not documented in accessible sources; verify against the open-source repo before borrowing.

## 5. Pets — HP bought with your own Endurance

Pets fight alongside you but *permanently tax your Endurance*, and boosters multiply the tax:

| Pet | Combat profile | Endurance cost | Limits |
|---|---|---|---|
| **Dog** | 14 HP, 5 Str, 5 Agi, 20 Spd — fast chip damage | −2 End (−3 with Vitality, −7 with Immortality, −8 with both) | Up to **3 dogs** |
| **Panther** (Wolf in the 2009 English version) | Mid HP, high agility/speed, good damage | −6 End (−9 Vitality, −15 Immortality, −22 both) | 1 max; **can't coexist with Bear**; stacks with dogs |
| **Bear** | **110 HP, 18–27 damage per swipe** (≈ a 40-Strength brute) but awful initiative (sits out the first 2–3 rounds) | −6 End (−12 Vitality, −28 Immortality, −42 both) | 1 max; excludes Panther |

The exclusivity rules (3 dogs + one of wolf/bear) and the End tax make pets a real build decision instead of a free power-up. Anti-pet supers (Bomb, Cry of the Damned, Hypnosis, Tamer, Net) exist as counters.

## 6. Level-ups — the slot-machine and the destiny tree

- **XP**: arena win = 2 XP, loss = 1 XP (only vs opponents within ~2 levels; beating far lower levels gives 1). Tournament fights give **no XP**. XP curve starts ~1, 3, 4, 6… and grows; there is effectively **no level cap** (theoretical limit 99999).
- **The reveal**: on level-up you get a **choice of exactly two randomly drawn options** (V2/LaBrute; the 2009 original offered one). Options are drawn from: **+3 to one stat**, **+2/+1 split**, a **new weapon**, a **new skill/super**, or a **pet**. At least one option is always a stat boost, so you can never brick — but you *can* be offered two things you don't want. Presented with a slot-machine flourish, it is the game's single dopamine moment and its entire "build" interface.
- **Builds from randomness**: because boosters multiply all *future* gains of a stat, an early Herculean Strength or Immortality bends the whole trajectory; players talk about "god rolls" at low level. Strategy = which of two dice you keep, ~daily.
- **Destiny (Eternaltwin LaBrute)**: the pair offered at each level is **deterministic per brute** — a decision tree ("Destiny") seeded at creation. The `/destiny` page visualizes the whole tree including paths not taken.
- **Rank up / reset (LaBrute)**: from the cell you can "rank up": the brute **returns to level 1 at the next Rank** (ranks carry named tiers/stars in the ranking ladder, e.g. "Padawan"), keeping its old destiny tracked — you can re-run the same choices or branch differently. This is the prestige loop.
- **Sacrifice (LaBrute)**: destroying a brute (level 10+) converts it to currency — **~100 gold per 10 levels** (a level-10 brute = 100 "SacriPoints") — spent on **extra brute slots**. Tournament wins also pay out. (Original monetization: extra slots for Muxxu tokens ≈ 100 tokens/brute via PayPal etc.)

## 7. Social systems — the growth engine

- **Master/pupil**: anyone who creates a brute through your brute's URL becomes your **pupil**; you (the master) get **+1 XP per new pupil and +1 XP every time a pupil levels up**. With a 3-fight daily cap this was the only way to level fast, so every player became a recruiter — the loop that produced **70 million brutes and ~1.7M daily visits by mid-2009**. (Muxxu V2 dropped the referral system; Eternaltwin restored pupil XP.)
- **Daily tournaments**: register daily via a **Sign Up button in your cell**; single-elimination bracket, matchups and fights fully automatic, rounds firing hourly through the day (registration opens after the ~4:00–6:40 France-time maintenance; finals ~late morning). Free to enter, no XP — pure bragging rights (and in LaBrute, gold/achievements).
- **Clans**: cosmetic "power display" in Muxxu V2; the Eternaltwin remake made them mechanical — clanmates occasionally **assist in your fights**; **clan war**: opt-in checkbox, clans paired, **7 brutes/day chosen by each side, first to 4 battle wins (without exhausting their roster) takes the war**, with real strategy in picking which brutes fight (bait-and-starve tactics are a thing); clans share a hidden matchmaking rating; and clans raid the megaboss **Goldclaw ("Goldenclaw"), millions of HP, damage persisted across days**.

## 8. What the Eternaltwin LaBrute revival changed/added

- Full **TypeScript/React open-source remake** (Zenoo, taken over summer 2022; v1.0.0 on 10 Aug 2022 after ~3 weeks decrypting Motion Twin's Flash assets; repo on GitLab `eternaltwin/labrute` / GitHub `Zenoo/labrute`); multiple language instances (labrute/brute/mybrute.eternaltwin.org).
- **6 fights/day** baseline (vs 3 original), +2 via Regeneration; win 2 XP / lose 1 XP.
- **Destiny tree page** making the level-up decision tree explicit and replayable; **rank-up prestige resets**; **sacrifice→gold→brute slots** economy; **achievements & titles pages** per brute; **ranking ladders** per rank tier.
- **Clan combat content** (assists, wars, Goldclaw boss), plus ongoing balance patches and new skills — all inspectable in the open-source combat engine (a uniquely good reference: the *entire* fight algorithm is public).

## 9. UI/UX presentation

- **The fight**: side-view 2D Flash (now HTML) arena; two chibi brutes (plus pets) whale on each other with slapstick animation, grunts and crowd noise, floating damage numbers, weapon-draw moments, and finisher poses. No controls — it plays like a ~45-second cartoon; deterministic and replayable by URL.
- **The cell** (`/cellule`): the brute's home page — big character portrait, level & XP bar, 4 stat bars, weapons hung on the wall as icons, skill icons, pets standing around, master/pupil list, clan, fight log, tournament sign-up button and your shareable recruit link. It doubles as your public profile — the whole social object of the game.
- **The arena**: shows **6 candidate opponents near your level**; you may scout any of them via their cell URL before spending a fight.
- **Session choreography**: cell → arena → fight → (level-up two-card reveal) → back to cell. Every screen is one click from every other; the loop closes in minutes.

## Design lessons worth stealing (not the content)

1. Name-only creation + seed-generated character = zero-friction onboarding with instant identity.
2. Hard daily fight ration turns a shallow loop into a durable habit; sessions stay 2–5 min by construction.
3. Hide the simulation depth (12 hidden stats, per-weapon dials) behind 4 visible bars.
4. Level-up as "pick 1 of 2 random cards, with compounding boosters" produces emergent builds without a skill tree UI.
5. Pets that cost max-HP, exclusivity rules, and dedicated counter-skills keep a rock-paper-scissors meta.
6. Make referral a *mechanical* progression path (master/pupil XP), and every profile/fight a shareable URL.
7. Deterministic fights + visible destiny tree (LaBrute) convert RNG frustration into theorycrafting.

---

## Sources

- My Brute Wiki (Fandom, original game): Statistics — https://mybrute.fandom.com/wiki/Statistics ; Combat Effects — https://mybrute.fandom.com/wiki/Combat_Effects ; Effects — https://mybrute.fandom.com/wiki/Effects ; Weapons — https://mybrute.fandom.com/wiki/Weapons ; Table of weapons — https://mybrute.fandom.com/wiki/Table_of_weapons ; Pupil — https://mybrute.fandom.com/wiki/Pupil ; Experience — https://mybrute.fandom.com/wiki/Experience ; Newbie Guide — https://mybrute.fandom.com/wiki/Newbie_Guide ; Tips and Tricks — https://mybrute.fandom.com/wiki/Tips_and_Tricks ; Tournament — https://mybrute.fandom.com/wiki/Tournament ; MyBrute (by Muxxu) — https://mybrute.fandom.com/wiki/MyBrute_(by_Muxxu)
- Mybrute (Muxxu) Wiki (Fandom, V2/LaBrute ruleset): Stats — https://mybrutemuxxu.fandom.com/wiki/Stats ; Hidden Stats — https://mybrutemuxxu.fandom.com/wiki/Hidden_Stats ; Skills — https://mybrutemuxxu.fandom.com/wiki/Skills ; Supers — https://mybrutemuxxu.fandom.com/wiki/Supers ; Passive Skills — https://mybrutemuxxu.fandom.com/wiki/Passive_Skills ; Stat Boosters — https://mybrutemuxxu.fandom.com/wiki/Stat_Boosters ; Weapons — https://mybrutemuxxu.fandom.com/wiki/Weapons ; Fast/Sharp/Heavy weapons category pages; individual pages: Knife, Sword, Whip, Sai, Shuriken, Trombone, Halbard; Pets — https://mybrutemuxxu.fandom.com/wiki/Pets ; Bear — https://mybrutemuxxu.fandom.com/wiki/Bear ; Panther — https://mybrutemuxxu.fandom.com/wiki/Panther ; Dogs — https://mybrutemuxxu.fandom.com/wiki/Dogs ; Endurance — https://mybrutemuxxu.fandom.com/wiki/Endurance ; Levels — https://mybrutemuxxu.fandom.com/wiki/Levels ; Initiative — https://mybrutemuxxu.fandom.com/wiki/Initiative ; Backup — https://mybrutemuxxu.fandom.com/wiki/Backup ; Vitality, Immortality, Feline Agility, Herculean Strength, Toughened Skin, Iron Head, 6th Sense, Counter-Attack, Untouchable, Shock, Determination, Survival, Lead Skeleton, Weapons Master, Martial Arts, Fists of Fury, Tamer, Thief, Tragic Potion, Cry of the Damned, Flash Flood, Bomb, Hammer, Net, Fierce Brute pages (same wiki)
- Wikipedia: My Brute — https://en.wikipedia.org/wiki/My_Brute
- Grokipedia: My Brute — https://grokipedia.com/page/my_brute
- Eternaltwin: platform — https://eternaltwin.org/ ; Zenoo interview — https://eternaltwin.org/docs/interviews/01-zenoo ; forum threads "MyBrute Sacripoints" — https://eternaltwin.org/forum/threads/6e9571b1-1ac4-4098-b108-01d386948895 , "What is Rank Advancement" — https://eternaltwin.org/forum/threads/fd2a9b03-1512-4f82-b01a-bc7c62392fcd
- LaBrute instances: https://labrute.eternaltwin.org/ , https://brute.eternaltwin.org/ , ranking — https://brute.eternaltwin.org/labrute/ranking , destiny pages — https://labrute.eternaltwin.org/<name>/destiny
- LaBrute source: GitHub — https://github.com/Zenoo/labrute ; GitLab — https://gitlab.com/eternaltwin/labrute (not cloned; referenced as public pages)
- Chasing Dings! blog: "La Brute: You should totally join my clan" (2024) — https://chasingdings.com/2024/08/17/la-brute-you-should-totally-join-my-clan/ ; "La Brute: Battles Royale and Warring Guilds" (2025) — https://chasingdings.com/2025/08/06/la-brute-battles-royale-and-warring-guilds/
- MyBrute Forumotion: "A guide for all the Weapons, Supers, Specialities, and Pets" — https://mybrute.forumotion.com/t2-a-guide-for-all-the-weapons-supers-specialities-and-pets-in-the-game ; Tournament & level-table threads — https://mybrute.forumotion.com/t6828-mybrute-level-up-table-level-1-101000
- BestBrute Wiki: Tournament — https://bestbrute.fandom.com/wiki/Tournament ; Cheatsheet — https://bestbrute.fandom.com/wiki/Cheatsheet ; Pet — https://bestbrute.fandom.com/wiki/Pet
- Smashboards: "MyBrute — A Comprehensive Guide/Explanation" — https://smashboards.com/threads/mybrute-a-comprehensive-guide-explanation.267956/
- Atma Xplorer: "Definitive MyBrute Guide" (2009) — https://www.atmaxplorer.com/2009/05/mybrute-guide/
- endlessbob blog review (2009) — https://endlessbob.wordpress.com/2009/09/19/game-review-free-online-mybrute-com/

*Access note: direct fetching of fandom.com/web.archive.org was blocked by the research environment's proxy; page content above was extracted via search-engine retrieval of those pages. Numbers marked "≈/~" or flagged as unverified should be double-checked against the open-source LaBrute engine before reuse.*
