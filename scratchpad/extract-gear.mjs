/**
 * Pack wearable gear (helmets, capes) into the 32-frame character strip, and
 * probe the dedicated attack_slash sheets for the axe's missing swing.
 *
 * Helmets ship as full 46-row universal sheets, so they line up with the body
 * frame for frame. Capes are 21-row classic sheets, handled like the weapons.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const REPO = "/tmp/claude-0/-home-user-mysparta/ee275a2c-cc9b-5016-98bb-8db832edd178/scratchpad/lpc";
const OUT = "/home/user/mysparta/apps/web/src/assets/lpc";
const F = 64;
const TOTAL = 32;

const PLAN_46 = [
  { row: 25, frames: [0, 1, 2, 3] },
  { row: 37, frames: [0, 1, 2, 3, 4, 5, 6, 7] },
  { row: 15, frames: [0, 1, 2, 3, 4, 5] },
  { row: 7, frames: [0, 1, 2, 3, 4, 5, 6, 7] },
  { row: 20, frames: [0, 1, 2, 3, 4, 5] },
];
const PLAN_21 = [
  { row: 11, frames: [0, 0] },
  { row: 7, frames: [0, 0] },
  { row: 11, frames: [1, 2, 3, 4, 5, 6, 7, 8] },
  { row: 15, frames: [0, 1, 2, 3, 4, 5] },
  { row: 7, frames: [0, 1, 2, 3, 4, 5, 6, 7] },
  { row: 20, frames: [0, 1, 2, 3, 4, 5] },
];

const blob = (p) =>
  execFileSync("git", ["cat-file", "blob", `HEAD:spritesheets/${p}`], {
    cwd: REPO,
    maxBuffer: 64 * 1024 * 1024,
  });

async function strip(srcPaths, outName) {
  const bufs = srcPaths
    .map((p) => {
      try {
        return blob(p);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  if (!bufs.length) throw new Error(`${outName}: no source`);
  const rows = (await sharp(bufs[0]).metadata()).height / F;
  const plan = rows >= 46 ? PLAN_46 : PLAN_21;

  const parts = [];
  let x = 0;
  for (const { row, frames } of plan) {
    for (const col of frames) {
      for (const b of bufs) {
        parts.push({
          input: await sharp(b).extract({ left: col * F, top: row * F, width: F, height: F }).toBuffer(),
          left: x * F,
          top: 0,
        });
      }
      x++;
    }
  }
  const out = path.join(OUT, `${outName}.webp`);
  mkdirSync(path.dirname(out), { recursive: true });
  await sharp({
    create: { width: TOTAL * F, height: F, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(parts)
    .webp({ lossless: true, effort: 6 })
    .toFile(out);
  console.log(`${outName}: ${rows}-row source`);
}

const JOBS = [
  [["hat/helmet/barbuta/male/steel.png"], "helm-barbuta"],
  [["hat/helmet/armet/adult/steel.png"], "helm-armet"],
  [["hat/helmet/barbarian_viking/adult/steel.png"], "helm-horned"],
  [["hat/helmet/spangenhelm/adult/steel.png"], "helm-spangen"],
  [["hat/helmet/kettle/adult/steel.png"], "helm-kettle"],
  [["cape/solid/male/white.png"], "cape-m"],
  [["cape/solid/female/white.png"], "cape-f"],
];
for (const [srcs, name] of JOBS) await strip(srcs, name);

// Which row of the dedicated slash sheet faces east? Probe every row.
const probe = blob("weapon/blunt/mace/attack_slash/mace.png");
const meta = await sharp(probe).metadata();
console.log(`\nmace attack_slash: ${meta.height / F} rows x ${meta.width / F} cols`);
for (let r = 0; r < meta.height / F; r++) {
  let filled = 0;
  for (let c = 0; c < meta.width / F; c++) {
    const raw = await sharp(probe)
      .extract({ left: c * F, top: r * F, width: F, height: F })
      .ensureAlpha()
      .raw()
      .toBuffer();
    let px = 0;
    for (let i = 3; i < raw.length; i += 4) if (raw[i] > 40) px++;
    if (px > 0) filled++;
  }
  console.log(`  row ${r}: ${filled}/${meta.width / F} frames drawn`);
}
console.log("done");
