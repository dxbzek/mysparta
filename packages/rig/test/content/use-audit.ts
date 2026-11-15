/**
 * Weapon use, measured (owner, 15 Nov 2026: "Lots of unrealistic arms or usage of weapons").
 * Shared by `use.test.ts` and the audit print (`npx tsx packages/rig/test/content/use-audit.ts`).
 *
 * For every held item and every clip a scrapper can play while holding it, every 60 fps frame,
 * every build at size 1 and 1.15, and (for an attack clip) aimed at a head and a body: the back
 * arm's reach (shoulder to wrist over the arm's length, drawn) and how far the drawn back grip is
 * from the weapon's `grip2`. Read from the same maths the picture is drawn with.
 */
import type { HeldId } from "@rankzero/core";
import { WEAPON_IDS, WEAPON_META } from "@rankzero/core";
import type { Aim, Dress, Pose, Rig } from "../../src/contracts";
import { inspectOf } from "../../src/engine/createRig";
import { BUILDS } from "../../src/gate/skeleton";

export const HOME = { x: 0, y: 0, facing: 1 as const };
export const LOOK = (build: number): Dress["look"] => ({ build, head: 0, hair: 0, face: 0, top: 0, bottom: 0, shoes: 0, accessory: 0, skin: 0, hairColor: 0, palette: 0 });

/** Every clip a scrapper plays while it holds something (the attack clip by name). */
export const HELD_CLIPS = ["idle", "enter", "dash", "backpedal", "brace", "draw", "hit-light", "hit-heavy", "block", "block-shield",
  "evade", "snared", "power-up", "ko-fall", "win"] as const;
/** The attack clips an item can play: its own, and a throw (any weapon can be thrown and replaced). */
export function attackClips(id: HeldId): string[] {
  const own = WEAPON_META[id].clip;
  return id === "fists" ? [own] : own === "throw" ? ["throw"] : [own, "throw"];
}
export const ALL_HELD: readonly HeldId[] = ["fists", ...WEAPON_IDS] as HeldId[];
export function twoHand(rig: Rig, id: HeldId): boolean {
  void rig;
  return WEAPON_META[id].hands === 2 && WEAPON_META[id].pair !== true;
}

function frameTimes(rig: Rig, clip: string): number[] {
  const d = rig.clipInfo("scrapper", clip).durationMs;
  const n = Math.max(1, Math.round((d * 60) / 1000));
  return Array.from({ length: n + 1 }, (_, i) => (i * d) / n);
}

export interface Row { id: HeldId; clip: string; reach: number; reachAt: string; pinErr: number; frames: number;
  /** The reach the back arm would need to put its hand on grip2 (over 1: it cannot). */
  want: number; wantAt: string }

/** Back-arm reach and back-grip pin error of a two-hand item in one clip (worst frame). */
export function measureClip(rig: Rig, id: HeldId, clip: string): Row {
  const ins = inspectOf(rig);
  const info = rig.clipInfo("scrapper", clip);
  const attack = info.events.some((e) => e.name === "contact");
  const row: Row = { id, clip, reach: 0, reachAt: "", pinErr: 0, frames: 0, want: 0, wantAt: "" };
  for (let b = 0; b < BUILDS.length; b++) for (const scale of [1, 1.15]) {
    const dress: Dress = { look: LOOK(b), held: id, shield: null, scale };
    const target: Dress = { look: LOOK(0), held: null, shield: null, scale: 1 };
    const aims: (Aim | undefined)[] = attack
      ? [undefined, { y: rig.hitPoint("scrapper", target, "head").y, dress }, { y: rig.hitPoint("scrapper", target, "body").y, dress }]
      : [undefined];
    for (const aim of aims) for (const t of frameTimes(rig, clip)) {
      const p: Pose = rig.samplePose("scrapper", clip, t, aim);
      const r = ins.backReach(p, dress);
      if (r !== null && r.drawn > row.reach) { row.reach = r.drawn; row.reachAt = `t${Math.round(t)} b${b} s${scale}${aim ? " aimed" : ""}`; }
      if (r !== null && r.want > row.want) { row.want = r.want; row.wantAt = `t${Math.round(t)} b${b} s${scale}${aim ? " aimed" : ""}`; }
      const err = ins.backPinError(p, dress);
      if (err > row.pinErr) row.pinErr = err;
      row.frames++;
    }
  }
  return row;
}

/** Every two-hand item (both hands on one shaft) in every clip it can play. */
export function twoHandAudit(rig: Rig): Row[] {
  const rows: Row[] = [];
  for (const id of ALL_HELD) {
    if (!twoHand(rig, id)) continue;
    for (const clip of [...attackClips(id), ...HELD_CLIPS]) rows.push(measureClip(rig, id, clip));
  }
  return rows;
}

async function main(): Promise<void> {
  const { createRig } = await import("../../src/engine/createRig");
  const { gatePack } = await import("../../src/gate/pack");
  const { contentPack } = await import("../../src/content/pack");
  const rig = createRig(gatePack, contentPack);
  const rows = twoHandAudit(rig);
  const bad = rows.filter((r) => r.reach > 0.95 + 1e-3 || r.pinErr > 1);
  const worst = new Map<string, Row>();
  for (const r of rows) { const k = r.id; const w = worst.get(k); if (w === undefined || r.want > w.want) worst.set(k, r); }
  console.log("worst needed back-arm reach per weapon:");
  for (const r of [...worst.values()].sort((a, b) => b.want - a.want)) console.log(`  ${r.id.padEnd(16)} ${r.want.toFixed(2)} in ${r.clip} (${r.wantAt}), pin off by up to ${Math.max(...rows.filter((q) => q.id === r.id).map((q) => q.pinErr)).toFixed(1)}`);
  console.log(`two-hand rows: ${rows.length}, over the line: ${bad.length}`);
  for (const r of rows.sort((a, b) => b.want - a.want)) {
    if (process.argv.includes("--all") || (process.argv.includes("--rows") && (r.reach > 0.95 + 1e-3 || r.pinErr > 1 || r.want > 0.95 + 1e-3))) {
      console.log(`${r.id.padEnd(16)} ${r.clip.padEnd(13)} reach ${r.reach.toFixed(2)} needs ${r.want.toFixed(2)} (${r.wantAt})  pin ${r.pinErr.toFixed(2)}`);
    }
  }
}
if (process.argv[1] !== undefined && /use-audit\.ts$/.test(process.argv[1])) main().catch((e: unknown) => { console.error(e); process.exit(1); });

// ------------------------------------------------------------------------------ anatomy lint
import { measure, report } from "../gate/anatomy";
import type { Report } from "../gate/anatomy";

/** The anatomy report of a clip as drawn for an item (the two-hand solve and the lead swap
 *  included), over every 60 fps frame, plain and aimed at a head and a body. */
export function anatomyOf(rig: Rig, id: HeldId, clip: string, build = 0, scale = 1): Report & { name: string } {
  const ins = inspectOf(rig);
  const dress: Dress = { look: LOOK(build), held: id, shield: null, scale };
  const target: Dress = { look: LOOK(0), held: null, shield: null, scale: 1 };
  const info = rig.clipInfo("scrapper", clip);
  const attack = info.events.some((e) => e.name === "contact");
  const aims: (Aim | undefined)[] = attack
    ? [undefined, { y: rig.hitPoint("scrapper", target, "head").y, dress }, { y: rig.hitPoint("scrapper", target, "body").y, dress }]
    : [{ y: 0, dress }];
  const worst: Report = report([]);
  for (const aim of aims) {
    const fs = frameTimes(rig, clip).map((t) => {
      const p = rig.samplePose("scrapper", clip, t, aim);
      return measure({ ...p, rot: ins.figureRot(p, dress) });
    });
    const r = report(fs);
    for (const k of Object.keys(r) as (keyof Report)[]) {
      const v = r[k];
      if (k === "wristWorst" || k === "shoulderWorst") { if (Math.abs(v) > Math.abs(worst[k])) worst[k] = v; } else if (v > worst[k]) worst[k] = v;
    }
  }
  return { ...worst, name: `${clip} / ${id}` };
}
