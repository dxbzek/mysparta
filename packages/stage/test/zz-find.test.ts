import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { REALM_SALT, combineSeed, rivalSnapshot, simulateFight } from "@rankzero/core";
import { contentPack, createRig, gatePack } from "@rankzero/rig";
import { buildPlayer } from "../src/createFightPlayer";
import { optsFor } from "./lib/setup";
import { slides } from "./lib/feet";

const rig = createRig(gatePack, contentPack);
const LEVEL = Number(process.env.F_LEVEL ?? 30);
const N1 = Number(process.env.F_TO ?? 300);
it("find", () => {
  const rows: string[] = [];
  for (let n = 0; n < N1; n++) {
    const a = rivalSnapshot(REALM_SALT, LEVEL, 2 * n);
    const b = rivalSnapshot(REALM_SALT, LEVEL, 2 * n + 1);
    const log = simulateFight(combineSeed("find-bout", n), a, b, 1);
    const p = buildPlayer(log, a, b, rig, optsFor(log, false, log.seed));
    const moves = [...new Set(log.steps.filter((s) => s.t === "move").map((s) => (s as { move: string }).move))];
    const pets = log.init.actors.filter((x) => x.kind !== "scrapper").length;
    const kinds = new Map(log.init.actors.map((x) => [x.id, x.kind]));
    const slamF = log.steps.some((s) => s.t === "move" && s.move === "body-slam" && s.target?.endsWith("0"));
    const slamP = log.steps.some((s) => s.t === "move" && s.move === "body-slam" && s.target !== undefined && !s.target.endsWith("0"));
    const flee = log.steps.filter((s) => s.t === "flee").length;
    const tarpPet = log.steps.some((s, i) => s.t === "snare" && kinds.get(s.target) !== "scrapper" && log.steps[i - 1]?.t === "move");
    const tarpF = log.steps.some((s, i) => s.t === "snare" && kinds.get(s.target) === "scrapper" && (log.steps[i - 1] as { move?: string })?.move === "tarp");
    // a swing at a snared pet
    const snared = new Set<string>();
    let snaredHit = -1;
    log.steps.forEach((s, i) => {
      if (s.t === "snare") snared.add(s.target);
      if (s.t === "free" || s.t === "ko") snared.delete(s.actor);
      if (s.t === "attack" && snared.has(s.target) && kinds.get(s.target) !== "scrapper" && s.actor.endsWith("0") && snaredHit < 0) snaredHit = i;
    });
    const clips = new Set(p.tracks.actors.flatMap((tr) => (tr.rig === "scrapper" ? tr.segs.map((g) => g.clip) : [])));
    const hops = p.tracks.nudges.filter((x) => x.key === "hop" && p.tracks.byId.get(x.actor)!.rig !== "scrapper").length;
    const fl = slides(p, rig, 1, { only: new Set(["hit-light", "hit-heavy"]) }).length;
    const fw = slides(p, rig).length;
    const flinches = p.tracks.actors.reduce((k, tr) => k + (tr.rig === "scrapper" ? tr.segs.filter((g) => g.clip === "hit-light" || g.clip === "hit-heavy").length : 0), 0);
    const shieldBlock = clips.has("block-shield");
    rows.push(JSON.stringify({ n, moves, pets, slamF, slamP, flee, tarpPet, tarpF, snaredHit, hops, fl, fw, flinches, shuffle: clips.has("shuffle"), slip: clips.has("slip"),
      evade: clips.has("evade"), dash: clips.has("dash-push"), block: clips.has("block"), shieldBlock, taunt: moves.includes("taunt") }));
  }
  writeFileSync(`C:/Users/Zek/AppData/Local/Temp/claude/ccc07f7da6cf2c21/4f594771-2a5f-4bad-87e3-cb112ab4c594/scratchpad/v3g/find-L${LEVEL}.jsonl`, rows.join("\n"));
}, 900_000);
