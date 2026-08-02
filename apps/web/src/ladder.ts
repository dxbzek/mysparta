/**
 * The ladder — a standings table the champion actually sits inside.
 *
 * Every hunter on it is generated from the realm seed, so the board is the
 * same for everyone on this realm and stable from day to day: climbing past
 * a name means something, because that name does not move on its own.
 */

import { combineSeed, makeRng } from "@agoge/core";

export interface LadderEntry {
  rank: number;
  name: string;
  level: number;
  rating: number;
  /** true for the row that is the player */
  you?: boolean;
}

const NAMES = [
  "Nearchos", "Kallikrates", "Lysimachos", "Demophon", "Nikandros", "Straton",
  "Myrrine", "Ianthe", "Berenike", "Thaleia", "Kassandra", "Chrysanthe",
  "Orestes", "Sostratos", "Rhode", "Xanthippe", "Alkaios", "Hegesias",
  "Praxilla", "Timon", "Melite", "Andriskos", "Phaedra", "Kleitos",
  "Zenobia", "Hieron", "Aglaia", "Nikaia", "Diokles", "Erasto",
];

/** The realm's standing order, with the champion slotted in by rating. */
export function ladder(playerName: string, playerLevel: number, playerRating: number): LadderEntry[] {
  const rng = makeRng(combineSeed("ladder", "realm:proto-1"));
  const rows: LadderEntry[] = [];
  for (const name of NAMES) {
    if (name.toLowerCase() === playerName.trim().toLowerCase()) continue;
    // Ratings fan out from the floor; a handful of names sit far above.
    const tier = rng.int(100);
    const rating =
      tier > 92 ? 1900 + rng.int(120)
      : tier > 78 ? 1740 + rng.int(150)
      : tier > 55 ? 1610 + rng.int(130)
      : tier > 30 ? 1520 + rng.int(90)
      : 1440 + rng.int(80);
    rows.push({ rank: 0, name, level: Math.max(1, Math.round((rating - 1400) / 40) + rng.int(3)), rating });
  }
  rows.push({ rank: 0, name: playerName, level: playerLevel, rating: playerRating, you: true });
  rows.sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

/** Where the champion stands, and who is directly ahead of them. */
export function standing(rows: LadderEntry[]): { rank: number; of: number; ahead?: LadderEntry } {
  const i = rows.findIndex((r) => r.you);
  return { rank: i + 1, of: rows.length, ahead: i > 0 ? rows[i - 1] : undefined };
}
