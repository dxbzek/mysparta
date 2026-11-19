/**
 * Bodies on the floor (round-2 close, owner on the recorded fights find-bout level 30 n 70 and
 * level 30 n 6276): a knocked-out pet lay between the fighters for the rest of the bout with
 * their shoes on it, a raccoon under the winner's front shoe, a dead goose half off the frame,
 * and the loser's body and hammer past the stage's edge under "X WINS". Measured on built bouts
 * with the real art, every 100 ms:
 *  - no downed pet's lying box meets a standing fighter's feet (his floor line within 10 units
 *    of the pet's, his place within 14 units of the box);
 *  - every downed pet lies inside the bout's frame, every downed fighter inside the stage;
 *  - an owner who gives room for a blow at his pinned pet ends up past the pet, not between it
 *    and the attacker.
 */
import { describe, expect, it } from "vitest";
import type { BoutLog, FighterSnapshot } from "@rankzero/core";
import { REALM_SALT, combineSeed, rivalSnapshot, simulateFight } from "@rankzero/core";
import { contentPack, createRig, gatePack } from "@rankzero/rig";
import { drawnBox } from "../src/bounds";
import { homeSpan } from "../src/camera";
import type { StagePlayer } from "../src/createFightPlayer";
import { BODY_GAP, SCRAPPER_REACH, STAGE_W } from "../src/layout";
import { playerFor } from "./lib/setup";

const FULL = createRig(gatePack, contentPack);
function found(level: number, n: number): { name: string; log: BoutLog; a: FighterSnapshot; b: FighterSnapshot } {
  const a = rivalSnapshot(REALM_SALT, level, 2 * n);
  const b = rivalSnapshot(REALM_SALT, level, 2 * n + 1);
  return { name: `level ${level} n ${n}`, log: simulateFight(combineSeed("find-bout", n), a, b, 1), a, b };
}
const BOUTS = [found(30, 70), found(30, 6276), found(30, 0), found(30, 2), found(10, 124), found(30, 25)];

describe("downed bodies lie clear of the feet and inside the frame (real art)", () => {
  for (const b of BOUTS) {
    it(`${b.name}`, () => {
      const p: StagePlayer = playerFor(b.log, b.a, b.b, FULL);
      const span = homeSpan(p.tracks);
      let downed = 0;
      for (let t = 0; t < p.timeline.durationMs; t += 100) {
        const f = p.frame(t);
        // (standing, not on the way somewhere: a fighter walking to a pinned pet on a back row passes
        // across a downed one's floor line)
        const standing = f.actors.filter((a) => a.rig === "scrapper" && !a.clip.startsWith("ko") && !["shuffle", "brake", "dash", "dash-push", "backpedal"].includes(a.clip));
        for (const a of f.actors) {
          if (!a.clip.startsWith("ko") || a.seg === null || t < a.seg.from + 700) continue;
          const box = drawnBox(FULL, FULL.samplePose(a.rig, a.clip, a.clipT, a.aim), a.dress, a.place);
          if (a.rig === "scrapper") {
            expect(box.x0, `${b.name}: ${a.id} down at ${t}`).toBeGreaterThanOrEqual(0);
            expect(box.x1, `${b.name}: ${a.id} down at ${t}`).toBeLessThanOrEqual(STAGE_W);
            continue;
          }
          downed++;
          expect(box.x0, `${b.name}: ${a.id} down at ${t}, frame from ${span.x0}`).toBeGreaterThanOrEqual(span.x0 - 0.5);
          expect(box.x1, `${b.name}: ${a.id} down at ${t}, frame to ${span.x1}`).toBeLessThanOrEqual(span.x1 + 0.5);
          for (const s of standing) {
            const under = Math.abs(s.floorY - a.floorY) < 10 && s.place.x > box.x0 - 14 && s.place.x < box.x1 + 14;
            expect(under, `${b.name}: ${s.id}'s feet on the downed ${a.id} at ${t}`).toBe(false);
          }
        }
      }
      void downed;
    }, 120_000);
  }
  it("the bouts have downed pets to check", () => {
    const any = BOUTS.some((b) => b.log.steps.some((s) => s.t === "ko" && s.actor !== "a0" && s.actor !== "b0"));
    expect(any).toBe(true);
  });
});

describe("a blow at a pinned pet behind its owner (real art)", () => {
  // level 30 n 70 under sim version 7 (a sledgehammer at a pinned goose); the same scene under sim
  // version 8 is level 30 n 66, and under version 10 (content v3 batch 3) level 30 n 168
  it("level 30 n 168: the owner gives room past his pinned pet, not between it and the attacker", () => {
    const b = found(30, 168);
    const p = playerFor(b.log, b.a, b.b, FULL);
    // every blow at a pinned pet: at its contact the two fighters are a body gap and a body apart
    let checked = 0;
    b.log.steps.forEach((s, i) => {
      if (s.t !== "attack" || s.target === "a0" || s.target === "b0") return;
      const pinned = b.log.steps.slice(0, i).some((q, k) => q.t === "snare" && q.target === s.target
        && !b.log.steps.slice(k, i).some((r) => r.t === "free" && r.actor === s.target));
      if (!pinned) return;
      const c = p.timeline.contacts.find((m) => m.step === i)!;
      const f = p.frame(c.at);
      const [x0, x1] = ["a0", "b0"].map((id) => f.actors.find((a) => a.id === id)!.place.x);
      expect(Math.abs(x0! - x1!), `step ${i} at ${c.at}`).toBeGreaterThanOrEqual(BODY_GAP.body + SCRAPPER_REACH.front);
      checked++;
    });
    expect(checked).toBeGreaterThan(0);
  }, 120_000);
});
