/**
 * The ladder's words (plan 13.10 item 1): the rank names, each boss's lines, and the screen text.
 * Ours, written for this game. Rung 1 is the Rank 10 boss at the bottom, rung 10 the Rank 1 boss.
 */
import { LADDER_RUNGS } from "@rankzero/core";

/** The rank a scrapper holds with `beaten` bosses beaten: Rank Zero, then Rank 10 up to Rank 1. */
export const rankLabel = (beaten: number): string => (beaten <= 0 ? "Rank Zero" : `Rank ${LADDER_RUNGS + 1 - Math.min(beaten, LADDER_RUNGS)}`);
/** The rank that beating the boss of `rung` gives. */
export const rungRank = (rung: number): string => `Rank ${LADDER_RUNGS + 1 - rung}`;

/** Each rung's street name, bottom up. */
export const RUNG_TITLE: Readonly<Record<number, string>> = {
  1: "Gutter", 2: "Back Alley", 3: "Loading Dock", 4: "Scrapyard", 5: "Overpass",
  6: "Rail Yard", 7: "Boiler Room", 8: "Rooftops", 9: "Neon Strip", 10: "Top of the Block",
};
/** The name under a rank: the title of the rung it came from; Rank Zero has its own. */
export const rankTitle = (beaten: number): string => (beaten <= 0 ? "Unranked" : RUNG_TITLE[Math.min(beaten, LADDER_RUNGS)] ?? "");

/** A boss's three lines: before the bout, after the player wins, after the player loses. */
export interface BossLines { taunt: string; beaten: string; gloat: string }
export const BOSS_LINES: Readonly<Record<number, BossLines>> = {
  1: { taunt: "Everybody starts in the gutter. Most stay there.",
    beaten: "Fine. The gutter's yours. Mind the rats.",
    gloat: "Back down the drain with you." },
  2: { taunt: "I've thrown out bigger things than you. Today, even.",
    beaten: "Huh. Didn't think you'd fit through the lid.",
    gloat: "Bin day. You're the rubbish." },
  3: { taunt: "I lift pallets all night. You're lighter than a pallet.",
    beaten: "Shift's over. Take the dock.",
    gloat: "Stacked and wrapped. Next!" },
  4: { taunt: "Everything shiny ends up in my pile. You're next.",
    beaten: "Keep it. I've got plenty of junk.",
    gloat: "Another trinket for the heap." },
  5: { taunt: "You hear that hum? That's the last thing you'll hear.",
    beaten: "Signal lost. The overpass is yours.",
    gloat: "Tune out, kid." },
  6: { taunt: "Trains don't stop for anyone. Neither do I.",
    beaten: "Derailed. Didn't see that coming.",
    gloat: "Wrong side of the tracks." },
  7: { taunt: "It's hot down here. You'll boil before you bruise me.",
    beaten: "Pressure's off. Go on up.",
    gloat: "Let off some steam, then go home." },
  8: { taunt: "Long way down from up here. Want to see?",
    beaten: "Wind's on your side tonight.",
    gloat: "Gravity always wins. So do I." },
  9: { taunt: "Darling, this strip has a dress code. You're not on it.",
    beaten: "Well. You can stay. This once.",
    gloat: "Mind the door on your way out." },
  10: { taunt: "Every one of them wanted the top. I'm still here.",
    beaten: "The block is yours. Don't get comfortable.",
    gloat: "Come back when you've earned the climb." },
};

export const LADDER_WORDS = {
  title: "Ladder",
  heading: "Climb the ranks",
  open: "Ladder",
  openSub: (rank: string, next: string | null) => (next === null ? `${rank}. Top of the block.` : `${rank}. Next: ${next}`),
  you: (rank: string) => `You: ${rank}`,
  gate: (level: number) => `Level ${level}`,
  locked: "Locked",
  beaten: "Beaten",
  ready: "Ready",
  needLevel: (level: number) => `Reach level ${level} to fight`,
  needRank: "Beat the boss below first",
  fight: "Fight",
  cost: "Costs 1 energy. Lose and you can try again.",
  boss: "Boss",
  gateShort: "Rank",
  gear: "Gear",
  bossLabel: (name: string, rank: string, title: string, state: string) => `${name}, ${rank}, ${title}. ${state}`,
  says: (name: string) => `${name} says`,
  prize: "Claim prize",
  prizeHeading: "Boss prize",
  prizePick: "Pick one",
  prizeTake: "Take it",
  prizeTaken: "Taken",
  prizeNotTaken: "Not taken",
  prizeDone: "To the Locker",
  prizeNone: "No prize waits.",
  rankUp: "Rank up!",
  rankedUp: (rank: string, title: string) => `${rank}: ${title}`,
  refused: {
    "level-up-waiting": "Take your level-up first.",
    "no-energy": "Out of energy. Come back when a point is back.",
    "unwatched-bout": "Watch or skip your last bout first.",
    "prize-waiting": "Claim your boss prize first.",
    beaten: "Already beaten.",
    rank: "Beat the boss below first.",
    level: "Not high enough level yet.",
  } as Record<string, string>,
  energyNeed: "No energy left",
  top: "Top of the block. Nobody left to beat.",
};
