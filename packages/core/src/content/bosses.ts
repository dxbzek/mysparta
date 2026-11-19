/**
 * The ladder's bosses (plan 13.10 item 1), written by hand for this game. One per rung, bottom up:
 * rung 1 is the Rank 10 boss, rung 10 the Rank 1 boss. Each is a fixed scrapper: a name (14
 * characters at most, like every name), a look, a level, stat points, the perks it takes into the
 * bout (in kit order: weapons, then skills, shield, pets and gear), and the talent branch its points
 * go down (`branchBuild`, the rivals' own rule). Nothing here rolls: progress/ladder.ts turns a row
 * into the same snapshot on every call.
 *
 * The stat points are tuned with `pnpm ladder` (tools/ladder-report.ts): a typical scrapper at the
 * rung's gate wins about 30 to 45%, two levels later about 55 to 70%. The perks follow the rules a
 * kit lives by (`fits`, one piece of gear per slot), and a test holds that.
 */
import type { Look, StatKey } from "../contracts/fighter";
import type { PerkId, TalentBranch } from "../contracts/ids";

export interface BossDef {
  /** 1 to LADDER_RUNGS, bottom up. */
  rung: number;
  name: string;
  look: Look;
  level: number;
  /** Stat points before boosters, gear and stat talents (those are added as for any scrapper). */
  points: Readonly<Record<StatKey, number>>;
  perks: readonly PerkId[];
  branch: TalentBranch;
}

const look = (build: number, head: number, hair: number, face: number, top: number, bottom: number, shoes: number,
  accessory: number, skin: number, hairColor: number, palette: number): Look =>
  ({ build, head, hair, face, top, bottom, shoes, accessory, skin, hairColor, palette });
const pts = (health: number, strength: number, agility: number, speed: number, toughness: number, precision: number) =>
  ({ health, strength, agility, speed, toughness, precision });

/** Looks: build 0 lean, 1 stocky, 2 tall, 3 heavy, 4 wiry; accessory 7 beanie, 11 neck tattoo, and
 *  so on (apps/web text/looks.ts names every index). Heads, builds and hats differ rung to rung so
 *  the ten read apart on the ladder and on the stage. */
export const BOSSES: readonly BossDef[] = [
  { rung: 1, name: "Ratcatcher", level: 4, branch: "arsenal",
    look: look(4, 4, 3, 2, 11, 2, 1, 11, 2, 4, 3),
    points: pts(6, 5, 2, 2, 4, 3),
    perks: ["pocket-knife", "bike-chain", "stubborn", "beanie"] },
  { rung: 2, name: "Big Dumpster", level: 7, branch: "brawler",
    look: look(3, 5, 2, 1, 12, 4, 0, 1, 6, 1, 7),
    points: pts(8, 6, 2, 2, 5, 2),
    perks: ["bat", "bricks", "heavy-hands", "stubborn", "work-gloves"] },
  { rung: 3, name: "Forklift", level: 10, branch: "iron-wall",
    look: look(1, 1, 3, 9, 0, 4, 5, 3, 4, 2, 11),
    points: pts(7, 7, 3, 3, 6, 3),
    perks: ["crowbar", "monkey-wrench", "body-slam", "padding", "wooden-pallet", "hard-hat", "hi-vis-vest"] },
  { rung: 4, name: "Magpie", level: 13, branch: "thrower",
    look: look(0, 2, 4, 6, 10, 7, 2, 13, 1, 9, 14),
    points: pts(8, 7, 3, 4, 5, 4),
    perks: ["tyre-iron", "hubcap", "pitcher", "padding", "crow", "goggles"] },
  { rung: 5, name: "Static", level: 16, branch: "pack",
    look: look(2, 7, 15, 9, 13, 2, 4, 10, 8, 5, 18),
    points: pts(8, 7, 3, 3, 6, 4),
    perks: ["hockey-stick", "plastic-bottle", "rubber-ball", "flurry", "sand-in-the-eyes", "big-heart", "alley-cat",
      "fingerless-gloves", "skate-shoes"] },
  { rung: 6, name: "Sleeper", level: 19, branch: "iron-wall",
    look: look(3, 8, 17, 4, 5, 9, 5, 2, 3, 10, 20),
    points: pts(8, 7, 2, 2, 6, 2),
    perks: ["sledgehammer", "rebar", "mountain", "stubborn", "car-door", "welding-mask",
      "overalls", "steel-toe-boots"] },
  { rung: 7, name: "Kettle", level: 22, branch: "pack",
    look: look(4, 3, 16, 12, 3, 6, 6, 12, 5, 0, 9),
    points: pts(12, 11, 5, 5, 9, 6),
    perks: ["machete", "garden-shears", "screwdrivers", "parry", "payback", "sharpening-stone", "second-wind", "stubborn",
      "stray-dog", "taped-fists", "track-pants", "bandana"] },
  { rung: 8, name: "Gull", level: 25, branch: "thrower",
    look: look(0, 9, 11, 13, 14, 8, 1, 9, 7, 2, 22),
    points: pts(13, 12, 6, 5, 10, 8),
    perks: ["golf-club", "boomerang", "paint-can", "trick-shot", "pitcher", "stubborn", "whistle", "goose",
      "work-vest", "rain-boots"] },
  { rung: 9, name: "Duchess", level: 28, branch: "arsenal",
    look: look(2, 0, 10, 13, 6, 6, 7, 8, 9, 11, 16),
    points: pts(12, 12, 5, 5, 10, 7),
    perks: ["pool-cue", "umbrella", "cricket-bat", "folding-chair", "padding", "firm-grip", "quick-swap", "taunt", "parry",
      "flurry", "riot-shield", "boar", "leather-jacket", "rubber-gloves", "cargo-pants"] },
  { rung: 10, name: "Old Iron", level: 31, branch: "brawler",
    look: look(3, 6, 2, 7, 6, 4, 0, 3, 0, 3, 0),
    points: pts(16, 16, 6, 6, 13, 8),
    perks: ["sledgehammer", "cricket-bat", "crowbar", "grapple", "second-wind", "stubborn", "big-heart",
      "plate-vest", "padded-jacket", "welding-gloves", "knee-pads", "motorbike-helmet"] },
];
