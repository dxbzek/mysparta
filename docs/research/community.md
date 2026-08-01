# MyBrute / La Brute — Addiction, Virality, Monetisation, Decline & Revival
### Research report: retention psychology and community feedback (for an original successor design)

**Scope note:** Reddit (including the r/gamedev "13 years later – MyBrute" thread) is inaccessible to this research environment — reddit.com blocks the crawler and the egress proxy denies direct fetches. Reddit-specific claims below are therefore reconstructed from equivalent, verifiable community sources (AnandTech, TeamLiquid, Smashboards, Eternaltwin forums, blogs, dev interviews) and flagged where second-hand.

---

## 1. Timeline at a glance

| Date | Event |
|---|---|
| 25 Jun 2008 | **La Brute** launches in French (labrute.fr), built in Haxe/Flash by Motion Twin (Bordeaux worker co-op, equal pay, no hierarchy) |
| Mar 2009 | English **MyBrute** (mybrute.com) launches; global viral explosion |
| Mid-2009 | ~1.7M daily visits worldwide; ~70M brutes created; Motion Twin network reaches 10M registered users across 15 games |
| Jul–Aug 2009 | iOS ports by Bulkypix: paid app (€3.99/$4.99) + free "My Brute Lite" limited to 3 fights/day |
| Jun 2010 (FR) / May 2011 (EN/ES) | **MyBrute 2.0** on the Muxxu portal — referral system removed, paid extras added |
| ~2011→ | Content stagnation; scripted pupil-farming rampant and unmoderated; players drift away |
| ~2015 | Motion Twin pivots to premium; web-game market "dried up"; mobile attempts flop; studio nearly disbands before betting on Dead Cells (2017–18) |
| 27 Mar 2020 | Motion Twin announces end of support for its Flash web games (Flash EOL Dec 2020); fans found **Eternaltwin** the same month |
| Aug 2022 | Motion Twin (via "Skool") publishes source code for most of its Twinoid-era games to support fan recreations |
| 2 Nov 2023 | Twinoid and all Motion Twin web games — including official MyBrute — shut down for good |
| 2020–present | **LaBrute** revival on Eternaltwin (brute.eternaltwin.org / labrute.eternaltwin.org), still in beta, patch notes as recent as Nov 2025 |

---

## 2. Virality mechanics: the pupil/master referral loop

**The loop.** Every brute had a personal, human-readable URL of the form `brutename.mybrute.com`. Anyone clicking that link was invited to type a name and instantly create their own brute — which then *fought the link-owner's brute* and became that brute's **pupil**. The master earned **+1 XP per new pupil, and +1 XP every time any pupil gained a level** (My Brute Wiki: "Pupil", "Master"). Pupils appeared in your **dojo/cell**, so recruits were also a visible trophy collection.

**Why it worked so well in 2009:**

- **The invite was a challenge, not an ask.** "Fight my brute" is a playable dare, not a referral link. The recruit got immediate entertainment (an auto-battle) before any commitment; the recruiter got permanent, compounding XP. Incentives were perfectly aligned on both sides of the link.
- **Zero-friction conversion.** Creating a brute required only a unique name — a password was optional and *no email was needed* (endlessbob review, 2009). The distance from "clicked a friend's link" to "owns a character with its own shareable URL" was ~10 seconds. Every converted visitor instantly became a new broadcaster.
- **Perfect fit for 2009 distribution channels.** The URL was cheap to paste into forum signatures, MSN statuses, school computer labs and office chats. Contemporary evidence: multi-year forum megathreads on AnandTech ("Latest addicting flash game", "Silly webgame I check out at work" — pages of users posting `name.mybrute.com` links), TeamLiquid (26+ pages), Smashboards, CivFanatics, MTG Salvation ("Wanna Fight MyBrute?"), egosoft, boards.ie (an entire "MyBrute Pupil Swap" thread where strangers traded clicks). French coverage describes it "flooding forums" and being a school phenomenon (fr.wikipedia; jeuxvideo.com).
- **Anti-abuse was built in but leaky.** IP tracking meant only the *first* pupil per IP granted the master bonus XP (My Brute Wiki: Tips & Tricks) — yet proxy scripts defeated this trivially (documented "Infinite EXP using Proxy" cheats), which later became a decline factor (see §5).

Notably, **MyBrute 2.0 removed the referral system entirely** (Wikipedia) — and never recaptured V1's growth. The referral loop *was* the game's growth engine.

---

## 3. Retention psychology

**Appointment mechanics.** A brute got **3 arena fights per day (6 on day one)**, resetting at a fixed daily time (BestBrute wiki: reset at 6PM GMT-5). Fights lasted ~30 seconds and were fully automated — "sit back, pray and hope for the best" (Smashboards guide). A whole session was under five minutes; the endlessbob review called it "a fun distraction… a five-minute daily interlude." Progress was deliberately slow — winning vs an equal-level brute gave 2 XP, losing gave 1, so an average player reaching **level 11 took about two months** — which stretched a shallow game across a long calendar. A blogger's summary of the appeal: "There was no need to play for hours: a few fights a day were enough. However, you always wanted to see what would happen the next day."

**Variable-reward slot machine.** Each level-up presented a **choice between two randomly drawn rewards** — always at least one +3 main-stat option, sometimes +2/+1 splits, or a random new weapon, one of **28 skills**, or a pet (up to 3 dogs, plus a wolf/panther or a bear). The player's only agency was picking between two dice rolls — a textbook variable-ratio reinforcement schedule. The daily hope of "the better-than-average skill or weapon as a reward when leveling" (endlessbob) was the core dopamine hook. Rare jackpots (bear pet, Hammer skill) were status symbols shared in threads.

**Hidden determinism as metagame.** The community discovered each brute's entire fate was seeded at creation — "MyBrute is a LUCK based game, set in stone as soon as the button 'Validate' is pressed" (Smashboards). This spawned an entire secondary hobby: rerolling name-seeds hunting "god brutes," name-list sharing, and guide sites (AtmaXplorer's "Definitive MyBrute Guide", mybruteguide.wordpress.com, forumotion threads like "Brute stats [Is it really all that random?]").

**Collection & spectacle.** Weapons/skills/pets served completionism; the daily automated **tournament** (brief registration window, no XP, ranking titles like "Brutal Legend" for finalists) provided a second daily appointment and a spectator loop — you could watch fights you weren't even in.

**Onboarding as retention.** No install, no signup, playable in seconds, and your first day gave 6 fights (a doubled taste of the loop) before throttling to 3.

---

## 4. Monetisation history

- **V1 (2008–2010) was effectively 100% free** — no premium tier, no in-game store. It functioned as a colossal funnel/advertisement for Motion Twin's wider portal network (10M registered users by 2009), which monetised other games via micropayment points.
- **Mobile (2009):** Bulkypix's iOS port was a **paid app at €3.99/$4.99**, with a free "My Brute Lite" capped at the browser game's 3 fights/day — an early "pay to remove the appointment limit" experiment. Reviews were decent (Pocket Gamer 8/10 Silver Award).
- **MyBrute 2.0 on Muxxu (2010/2011)** introduced direct monetisation: **10 fights per day, extendable to 20 for €0.25**, or until 3 losses; extra brute slots ("recruit a brute") purchasable for ~**100 Muxxu Tokens** via PayPal/Allopass-style payment services; **Sacripoints** (earned by sacrificing brutes — a level-10 brute converted to 100 points — and by winning tournaments) gated new brute slots for non-payers.
- **Player sentiment:** V2's pay-for-fights was tolerated more than loved; what players actively resented in V1 was not payment but **unpoliced cheating** — "it seems the site's owners aren't doing anything to remove or prevent this activity" (endlessbob, 2009). The most-cited V2 upside in forums was that removing referrals "made the game fair" by killing script-levelling.
- **Post-mortem constraint:** Motion Twin's licence to Eternaltwin **forbids any monetisation of the revival, including ads** — an Eternaltwin forum request for "unlimited fights by watching an ad" was rejected on exactly those grounds.

---

## 5. Why it declined

1. **"Release, update a bit, drop."** Sébastien Bénard (deepnight), a long-time Motion Twin co-op member, later described the studio's web-era pattern in exactly those words, adding that Dead Cells' success led Motion Twin to "ignore all of its past web-era player base" (deepnight.net blog; PCGamesN, 2024). MyBrute got no meaningful content cadence after launch; the level-up pool and endgame never grew.
2. **Shallow endgame.** Once the novelty of the slot machine wore off, there was nothing to *do* — no builds to pilot, no active play, tournaments gave no XP. Forum threads that ran 26 pages in April 2009 petered out within months.
3. **RNG resentment.** "Fights seemed completely random and had nothing to do with stats"; a brute could be permanently crippled by bad rolls, and the community's only remedy was "create a new brute" (AnandTech/forumotion threads). The seed system meant a bad brute was *irredeemably* bad — the same determinism that fuelled the metagame poisoned long-term attachment.
4. **Industrialised cheating.** Scripted pupil farms ("tens of thousands of pupils… created automatically with a script" — endlessbob) put 100+-level brutes atop every ladder while moderation did nothing, hollowing out competitive legitimacy.
5. **V2 fragmentation.** MyBrute 2.0 split the player base onto Muxxu, deleted the viral referral engine, and asked money for what had been free.
6. **Platform death and studio pivot.** The web-game market "dried up," Motion Twin's mobile attempts had "little success," the studio "briefly considered disbanding" and bet everything on one last premium project — Dead Cells (MCV "When We Made Dead Cells"). Flash EOL (Dec 2020) killed the client; Twinoid servers were finally switched off on **2 November 2023**.

**On the r/gamedev "13 years later" thread:** inaccessible directly (see scope note), but every theme reported from it is independently corroborated above — devs admiring the elegance of the 30-second-a-day loop, name-seeded characters and the fight-my-brute referral; and identifying the killers as zero post-launch content, pure-RNG progression with no player agency, cheating, and Motion Twin's abandonment of the web portfolio.

---

## 6. The Eternaltwin revival (2020–present)

- **Origin & governance:** founded March 2020, days after Motion Twin's Flash end-of-life notice, "to save those games… and the corresponding online communities"; led by Demurgos (technical) and Patate404 (organisational); explicitly approved by Motion Twin, which published most Twinoid-era sources in Aug 2022. Non-commercial by licence; funded by donations via Open Collective.
- **Scale:** the Eternaltwin Discord has ~**14,000 members**; LaBrute runs multiple language mirrors (brute/labrute/mybrute/elbruto.eternaltwin.org). It is a rewrite (LaBrute React, on GitLab), still labelled **beta**, with active patch notes (latest observed: 19 Nov 2025).
- **What the revival added** (addressing old complaints): the **dojo/pupil link is back** with milestone medals (multi-accounting bannable); an **achievement system** with daily and weekly missions; **clan wars** ("battles royale": 7 brutes/day per clan, first to 4 battle wins, hidden clan MMR); **rank advancement** — a prestige reset to level 1 where "you still have the old **destiny** tracked so you can choose a different path to optimize your brute," converting the old hidden seed into a visible, partially navigable **destiny tree**.
- **What players praise:** faithful feel, clan/guild strategy depth (Chasing Dings blog series, 2024–25, describes genuinely tactical clan-war lineup play), the games being free forever.
- **What players complain about:** beta bugs; the daily fight ceiling with no legitimate way to buy/earn more (the rejected watch-an-ad thread); level-up rewards still uncontrollable ("you can keep making new brutes until you get the sort of level-up bonuses you want" remains the meta).

---

## 7. What a modern successor must fix (community wish synthesis)

| Pain point (2009 & today) | Design implication |
|---|---|
| Zero agency: fate sealed at creation, only 2-option level-ups | Keep variable rewards, but add pilotable builds (visible destiny trees, respec, pick-order draft) |
| Bad RNG permanently ruins a character | Bounded RNG / pity systems; make "bad" brutes salvageable or convertible (V2's Sacripoints sacrifice was a crude version) |
| No endgame beyond the ladder | Clans, wars, seasonal prestige resets — the revival's clan wars and rank-ups are validated demand |
| Cheating/multi-accounting destroyed ladders | Referral rewards must be abuse-resistant (first-per-IP was not enough); reward engagement of recruits, not raw signups |
| Referral loop deleted in V2 killed growth | Keep the "fight my character" challenge-link as the core viral object; it is the single most-proven mechanic in the franchise |
| Daily limit frustrates but also retains | Preserve the 5-minute appointment; sell convenience (cosmetics, extra *non-ranked* fights) rather than power |
| Dev abandonment | Players explicitly cite content cadence as the life/death variable; plan a live-ops drip of weapons/skills/events |

---

## 8. Motion Twin's own reflections

- On F2P craft: "When you make a free-to-play game you really think about the lifetime of the game. When you make a PC game it's more about the quality and good gameplay… rather than… the tools to make people pay" — Dead Cells team, MCV/80.lv interviews; they credited their web-era engagement expertise for Dead Cells' "hook."
- On the era's end: web market dried up → failed mobile pivot → near-disbandment → "one last chance" (Dead Cells) (MCV "When We Made Dead Cells").
- On their treatment of web players: "release, update a bit, drop"; post-Dead Cells, Motion Twin "ignored all of its past web-era player base" — Sébastien Bénard, deepnight.net (2024), acknowledging "his share of disillusion" as a co-op member.
- Their concrete amends: free asset/source releases (Aug 2022) and blessing Eternaltwin on the condition it stays 100% non-commercial.

---

## Sources

- https://en.wikipedia.org/wiki/My_Brute (release dates, ports, V2 changes, 10M users)
- https://fr.wikipedia.org/wiki/La_Brute_(jeu_vid%C3%A9o) (25 Jun 2008 launch, Haxe/Flash)
- https://grokipedia.com/page/my_brute (1.7M daily visits, 70M brutes, shutdown chronology — use with caution, AI-generated)
- https://mybrute.fandom.com/wiki/Pupil, /wiki/Master, /wiki/Tips_and_Tricks, /wiki/Experience, /wiki/Pets, /wiki/Ranking (pupil XP rules, IP limits, 28 skills, pets, tournaments)
- https://bestbrute.fandom.com/wiki/Cheatsheet, /wiki/Tournament (3 fights/day, 6 first day, reset time, no tournament XP)
- https://endlessbob.wordpress.com/2009/09/19/game-review-free-online-mybrute-com/ (no-email signup, XP rates, level 11 ≈ 2 months, scripted-pupil cheating, moderation absence)
- https://smashboards.com/threads/mybrute-a-comprehensive-guide-explanation.267956/ ("LUCK based… set in stone as soon as Validate is pressed"; automated combat)
- https://www.atmaxplorer.com/2009/05/mybrute-guide/ and https://mybrute.forumotion.com/t2293-brute-stats-is-it-really-all-that-random (seed metagame)
- https://forums.anandtech.com/threads/latest-addicting-flash-game.282355/ and /threads/silly-webgame-i-check-out-at-work.281776/ (2009 virality, RNG complaints)
- https://tl.net/forum/games/90771-mybrute-flash-game ; https://www.boards.ie/discussion/2055542872/mybrute-pupil-swap ; https://www.mtgsalvation.com/forums/retired-forums/retired-forums/entertainment-archive/453914-wanna-fight-mybrute (forum-spread evidence)
- https://www.pocketgamer.com/my-brute/my-brute-lite-hits-the-iphone/ (iOS pricing/Lite)
- https://mybrute.fandom.com/wiki/MyBrute_(by_Muxxu) (V2: 10/20 fights, €0.25, tokens, referral removal)
- https://mcvuk.com/development-news/when-we-made-dead-cells/ (market dried up, near-disbandment, F2P quote)
- https://www.pcgamesn.com/dead-cells/former-designer-blog-post and https://deepnight.net/blog/regarding-dead-cells-termination/ ("release, update a bit, drop"; ignored web-era players)
- https://eternaltwin.org/ ; https://wiki.eternal-twin.net/closure ; https://eternaltwin.org/docs/tmiet/2022-08 (project origin, MT approval, source release)
- https://eternaltwin.org/forum/threads/14452f7e-c4cc-4bd5-a789-28ef4297aa0a (no-ads licence condition) ; /threads/fd2a9b03-1512-4f82-b01a-bc7c62392fcd (rank advancement/destiny)
- https://brute.eternaltwin.org/patch-notes (dojo return, achievements, beta status)
- https://chasingdings.com/2025/08/06/la-brute-battles-royale-and-warring-guilds/ and https://chasingdings.com/2024/08/17/la-brute-you-should-totally-join-my-clan/ (revival clan wars)
- https://en.wikipedia.org/wiki/Die2Nite ; https://en.wikipedia.org/wiki/Motion_Twin (2 Nov 2023 shutdown, co-op structure)
