/**
 * For the session check (tools/session.mjs, content v3 batch 2): picks for the scrapper named on the
 * command line that walk into a kit with two weapons or more, a shield and a piece of gear, so the
 * session can choose a loadout and equip gear on the real screens. Prints `{ picks, gear, weapons,
 * shield }` as JSON. Pure: the same name always gives the same picks.
 */
import { GEAR_IDS, REALM_SALT, combineSeed, fighterSeed, isShieldId, isWeaponId, makeRng } from "../../packages/core/src/index.ts";
import { walk } from "../../packages/core/src/progress/route.ts";

const name = process.argv[2] ?? "Marla";
const seed = fighterSeed(REALM_SALT, name);
const rng = makeRng(combineSeed("session-kit", name));
for (let i = 0; i < 20000; i++) {
  const picks = Array.from({ length: 9 }, () => (rng.int(2) === 0 ? "L" : "R") as "L" | "R");
  const kit = walk(seed, picks);
  const weapons = kit.perks.filter((p) => isWeaponId(p));
  const gear = kit.perks.filter((p) => (GEAR_IDS as readonly string[]).includes(p));
  const shield = kit.perks.find((p) => isShieldId(p)) ?? null;
  if (weapons.length >= 2 && gear.length >= 1 && shield !== null) {
    console.log(JSON.stringify({ picks, gear, weapons, shield }));
    process.exit(0);
  }
}
console.error("no kit found");
process.exit(1);
