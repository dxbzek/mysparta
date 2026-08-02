/**
 * Pack LPC weapon art into the same 32-frame strip layout the characters use,
 * so a weapon can be laid straight over a fighter and share its animation.
 *
 * Strip layout (identical to extract-lpc.mjs):
 *   0-1 idle  2-3 stance  4-11 run  12-17 slash  18-25 thrust  26-31 hurt
 *
 * Two source layouts exist in LPC:
 *   - 46-row "universal" sheets, which carry every row the body has
 *   - 21-row classic sheets (thrust 4-7, walk 8-11, slash 12-15, hurt 20),
 *     whose east-facing rows 7/15/20 line up exactly with ours. They have no
 *     idle or run of their own, so the walk cycle stands in for the run and
 *     its first frame becomes the held pose.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const REPO = "/tmp/claude-0/-home-user-mysparta/ee275a2c-cc9b-5016-98bb-8db832edd178/scratchpad/lpc";
const OUT = "/home/user/mysparta/apps/web/src/assets/lpc";
const F = 64;

/** Rows for a full 46-row universal sheet — matches the body exactly. */
const PLAN_46 = [
  { row: 25, frames: [0, 1, 2, 3] },
  { row: 37, frames: [0, 1, 2, 3, 4, 5, 6, 7] },
  { row: 15, frames: [0, 1, 2, 3, 4, 5] },
  { row: 7, frames: [0, 1, 2, 3, 4, 5, 6, 7] },
  { row: 20, frames: [0, 1, 2, 3, 4, 5] },
];

/** Rows for a 21-row classic sheet. */
const PLAN_21 = [
  { row: 11, frames: [0, 0] }, // idle — stood with the weapon in hand
  { row: 7, frames: [0, 0] }, // stance — drawn back, ready
  { row: 11, frames: [1, 2, 3, 4, 5, 6, 7, 8] }, // run borrows the walk cycle
  { row: 15, frames: [0, 1, 2, 3, 4, 5] }, // slash
  { row: 7, frames: [0, 1, 2, 3, 4, 5, 6, 7] }, // thrust
  { row: 20, frames: [0, 1, 2, 3, 4, 5] }, // hurt / fall
];

const TOTAL = 32;

function blob(p) {
  return execFileSync("git", ["cat-file", "blob", `HEAD:spritesheets/${p}`], {
    cwd: REPO,
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * LPC splits a weapon across a background and a foreground sheet — for the
 * east-facing rows the blade is often entirely in the background one, which
 * is why a fg-only extract goes blank mid-swing. Both are merged here so the
 * weapon is always visible; it rides over the fighter rather than through it.
 */
/**
 * Some weapons keep their swing in a separate attack sheet rather than in the
 * classic rows — the axe is one. `slash` names that sheet and the east-facing
 * row inside it, which is grafted over frames 12-17 after the base pack.
 */
async function strip(srcPaths, outName, slash) {
  const bufs = srcPaths
    .map((p) => {
      try {
        return blob(p);
      } catch {
        return null; // optional companion layer
      }
    })
    .filter(Boolean);
  const buf = bufs[0];
  const meta = await sharp(buf).metadata();
  const rows = meta.height / F;
  const plan = rows >= 46 ? PLAN_46 : PLAN_21;
  if (rows < 21) throw new Error(`${srcPath} has only ${rows} rows`);

  const parts = [];
  let x = 0;
  for (const { row, frames } of plan) {
    for (const col of frames) {
      for (const b of bufs) {
        const cell = await sharp(b)
          .extract({ left: col * F, top: row * F, width: F, height: F })
          .toBuffer();
        parts.push({ input: cell, left: x * F, top: 0 });
      }
      x++;
    }
  }
  if (x !== TOTAL) throw new Error(`${outName}: packed ${x} frames, expected ${TOTAL}`);

  let sheetBuf = await sharp({
    create: { width: TOTAL * F, height: F, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(parts)
    .png()
    .toBuffer();

  // Not every weapon is drawn for every action (a spear has no slash art at
  // all). Any range that came out empty borrows from one that did, so the
  // weapon is never missing from a fighter's hand mid-fight.
  const RANGES = { idle: [0, 2], stance: [2, 4], run: [4, 12], slash: [12, 18], thrust: [18, 26], hurt: [26, 32] };
  // ordered fallbacks — the first range that actually has art wins
  const DONORS = {
    slash: ["thrust", "run", "stance", "idle"],
    thrust: ["slash", "run", "stance", "idle"],
    stance: ["idle", "thrust", "run"],
    idle: ["stance", "run", "thrust"],
    run: ["stance", "idle", "thrust"],
    hurt: ["stance", "idle", "run"],
  };
  // The swing is grafted before anything is measured, so the donor pass
  // below sees the finished sheet instead of the gap it is about to fill.
  if (slash) {
    const graftParts = [];
    const sbufs = slash.paths
      .map((p) => {
        try {
          return blob(p);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    // Oversize sheets store 192px frames, so the cell that lines up with the
    // character is every third column — 1, 4, 7 and so on.
    const cols = slash.cols ?? [0, 1, 2, 3, 4, 5];
    for (let i = 0; i < cols.length; i++) {
      for (const b of sbufs) {
        graftParts.push({
          input: await sharp(b)
            .extract({ left: cols[i] * F, top: slash.row * F, width: F, height: F })
            .toBuffer(),
          left: (12 + i) * F,
          top: 0,
        });
      }
    }
    sheetBuf = await sharp(sheetBuf).composite(graftParts).png().toBuffer();
    console.log(`  ${outName}: slash grafted from ${slash.paths[0]} row ${slash.row}`);
  }

  const raw = await sharp(sheetBuf).ensureAlpha().raw().toBuffer();
  // One stray frame is not an animation: a range only counts as drawn when
  // most of its frames carry art, otherwise the weapon flickers through it.
  const drawn = (f) => {
    for (let y = 0; y < F; y++)
      for (let x = 0; x < F; x++)
        if (raw[((y * TOTAL * F) + (f * F + x)) * 4 + 3] > 40) return true;
    return false;
  };
  const filled = (a, b) => {
    for (let f = a; f < b; f++) if (drawn(f)) return true;
    return false;
  };
  const fixes = [];
  for (const [name, [a, b]] of Object.entries(RANGES)) {
    if (filled(a, b)) {
      // Partly drawn: hold the nearest drawn frame over the gaps so the
      // weapon never blinks out for a frame or two mid-action.
      let last = -1;
      for (let f = a; f < b; f++) if (drawn(f)) { last = f; break; }
      if (last < 0) continue;
      for (let f = a; f < b; f++) {
        if (drawn(f)) { last = f; continue; }
        fixes.push({
          input: await sharp(sheetBuf).extract({ left: last * F, top: 0, width: F, height: F }).toBuffer(),
          left: f * F,
          top: 0,
        });
      }
      continue;
    }
    const pick = (DONORS[name] || []).find((d) => RANGES[d] && filled(RANGES[d][0], RANGES[d][1]));
    if (!pick) continue;
    const donor = RANGES[pick];
    const span = donor[1] - donor[0];
    for (let i = 0; i < b - a; i++) {
      const src = donor[0] + (i % span);
      const cell = await sharp(sheetBuf).extract({ left: src * F, top: 0, width: F, height: F }).toBuffer();
      fixes.push({ input: cell, left: (a + i) * F, top: 0 });
    }
    console.log(`  ${outName}: ${name} borrowed from ${pick}`);
  }

  if (fixes.length) sheetBuf = await sharp(sheetBuf).composite(fixes).png().toBuffer();

  const out = path.join(OUT, `${outName}.webp`);
  mkdirSync(path.dirname(out), { recursive: true });
  await sharp(sheetBuf).webp({ lossless: true, effort: 6 }).toFile(out);
  console.log(`${outName}: ${rows}-row source -> 32 frames`);
}

const JOBS = [
  [["weapon/sword/dagger/behind/dagger.png", "weapon/sword/dagger/dagger.png"], "wpn-sword"],
  [["weapon/polearm/spear/background.png", "weapon/polearm/spear/foreground.png"], "wpn-spear"],
  [
    // A labrys is an axe: the waraxe silhouette reads correctly at 3x, where
    // the mace head just looked like a rock in the fighter's hand.
    ["weapon/blunt/waraxe/behind/waraxe.png", "weapon/blunt/waraxe/waraxe.png"],
    "wpn-mace",
    // No mace graft: borrowing the mace's swing put a different weapon in the
    // hand mid-attack, so an axe visibly became a mace. The axe now stays an
    // axe for every frame — the body supplies the swing, the weapon rides it.
  ],
  [["weapon/sword/dagger/behind/dagger.png", "weapon/sword/dagger/dagger.png"], "wpn-dagger"],
  [["shield/male/spartan.png"], "wpn-shield"],
];

for (const [srcs, name, slash] of JOBS) await strip(srcs, name, slash);
console.log("done");
