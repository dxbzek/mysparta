import type { OmenDef } from "../types.js";

/** The six Omens (02-gdd-core.md §3.2): +6 spread over the 6/6/6/6 base. */
export const OMENS: OmenDef[] = [
  {
    id: "doru",
    name: "Omen of the Doru",
    epithet: "the Patient",
    startingWeapons: ["doru"],
    bonus: { might: 2, grace: 1, tempo: 1, grit: 2 },
  },
  {
    id: "xiphos",
    name: "Omen of the Xiphos",
    epithet: "the Poised",
    startingWeapons: ["xiphos"],
    bonus: { might: 2, grace: 2, tempo: 1, grit: 1 },
  },
  {
    id: "cestus",
    name: "Omen of the Cestus",
    epithet: "the Restless",
    startingWeapons: ["cestus"],
    bonus: { might: 1, grace: 2, tempo: 2, grit: 1 },
  },
  {
    id: "labrys",
    name: "Omen of the Labrys",
    epithet: "the Thunderous",
    startingWeapons: ["olive_root_club"],
    bonus: { might: 3, grace: 1, tempo: 1, grit: 1 },
  },
  {
    id: "akontia",
    name: "Omen of the Akontia",
    epithet: "the Far-Sighted",
    startingWeapons: ["akontion"],
    bonus: { might: 1, grace: 3, tempo: 1, grit: 1 },
  },
  {
    id: "aspis",
    name: "Omen of the Aspis",
    epithet: "the Unbroken",
    startingWeapons: ["pelte", "xiphos"],
    bonus: { might: 1, grace: 1, tempo: 1, grit: 3 },
  },
];

export function omen(id: string): OmenDef {
  const o = OMENS.find((x) => x.id === id);
  if (!o) throw new Error(`Unknown omen: ${id}`);
  return o;
}
