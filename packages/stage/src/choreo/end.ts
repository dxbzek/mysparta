/**
 * The end. On a cap ending nobody was knocked out, so the loser plays hit-heavy, then its fall,
 * here. Then the outro: the winner's pose loop, the "NAME WINS" banner at +400, 40 pieces of
 * ticket tape for 2200 ms, the result card at +1600.
 */
import type { StepOf } from "@rankzero/core";
import { scrapperOf } from "@rankzero/core";
import { INK } from "../palette";
import type { Builder } from "../timeline";
import { fallFocus } from "./fall";
import { OUTRO } from "../tuning";
import type { Placed } from "./index";

export function end(b: Builder, step: StepOf<"end">, i: number): Placed {
  const s = b.cursor;
  const winner = scrapperOf(step.winner);
  const loser = scrapperOf(step.winner === "a" ? "b" : "a");
  // the outro waits for everyone walking home
  let outro = s;
  for (const tr of b.actors) for (const m of tr.moves) if (m.to > outro && m.to !== Infinity && b.status.get(tr.id) === "up") outro = m.to;
  if (step.reason === "cap" && b.has(loser) && b.status.get(loser) === "up") {
    const tr = b.track(loser);
    const f = outro;
    b.play(loser, "hit-heavy", f, { until: f + OUTRO.capFlinchMs });
    // the flinch steps back with its shove (Builder.knockStep), away from the winner
    if (b.has(winner)) b.knockStep(loser, f, true, b.place(winner, f).x < b.place(loser, f).x ? 1 : -1);
    const fall = b.info(tr.rig, "ko-fall");
    b.play(loser, "ko-fall", f + OUTRO.capFlinchMs, { hold: true });
    const land = fall.events.find((e) => e.name === "land")?.t ?? fall.durationMs;
    b.cue(f + OUTRO.capFlinchMs + land, i, "landing");
    b.status.set(loser, "ko");
    b.koFocus = fallFocus(b, loser, f + OUTRO.capFlinchMs, "ko-fall");
    outro = f + OUTRO.capFlinchMs + fall.durationMs;
    // the winner shuffles over to stand over the body as it falls (choreo/fall.ts)
    if (b.has(winner)) for (const m of b.track(winner).moves) if (m.to !== Infinity && m.to > outro) outro = m.to;
  }
  if (b.has(winner) && b.status.get(winner) === "up") {
    const tr = b.track(winner);
    b.face(winner, outro, tr.homeFacing);
    b.play(winner, "win", outro, { until: Infinity, busy: false });
  }
  const name = b.snaps[step.winner].name;
  // in the top band of the view, above the heads and the winner's raised fists (review finding 52)
  b.tags.push({ from: outro + OUTRO.bannerAt, to: Infinity, text: b.opts.text.wins(name), colour: "#FFD23F", ink: INK,
    actor: null, x: 180, y: OUTRO.bannerY, size: OUTRO.bannerSize, kind: "banner", band: "top" });
  // side a is the one who started the bout: the player in a live bout
  b.cue(outro + OUTRO.bannerAt, i, step.winner === "a" ? "win" : "loss");
  if (b.motion.tape) b.tape = { from: outro, to: outro + OUTRO.tapeMs };
  b.outroAt = outro;
  b.winner = step.winner;
  b.resultAt = outro + OUTRO.resultAt;
  b.durationMs = b.resultAt + OUTRO.resultFillMs;
  b.cursor = b.durationMs;
  return { at: s, apply: outro };
}
