/**
 * Extract compact side-view combat strips from the LPC universal sheets.
 *
 * The source sheets are 832x2944 (13 cols x 46 rows of 64px frames) covering
 * every animation in four facings. A side-on brawler only needs the EAST
 * facing, so we crop one row per animation and pack them into a single
 * 32-frame strip (2048x64) per part — roughly 2% of the source bytes.
 *
 * Strip layout (frame indices):
 *   0-3   idle       (row 25: 0,1 = relaxed breath; 2,3 = combat stance)
 *   4-11  run        (row 37)
 *   12-17 slash      (row 15)  -> attack1
 *   18-25 thrust     (row 7)   -> attack2
 *   26-31 hurt/fall  (row 20)  -> hit (first 3) + death (all 6)
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const REPO = "/tmp/claude-0/-home-user-mysparta/ee275a2c-cc9b-5016-98bb-8db832edd178/scratchpad/lpc";
const OUT = "/home/user/mysparta/apps/web/src/assets/lpc";
const F = 64;

const PLAN = [
  { row: 25, frames: [0, 1, 2, 3] },
  { row: 37, frames: [0, 1, 2, 3, 4, 5, 6, 7] },
  { row: 15, frames: [0, 1, 2, 3, 4, 5] },
  { row: 7, frames: [0, 1, 2, 3, 4, 5, 6, 7] },
  { row: 20, frames: [0, 1, 2, 3, 4, 5] },
];
const TOTAL = PLAN.reduce((n, p) => n + p.frames.length, 0);

function blob(p) {
  return execFileSync("git", ["cat-file", "blob", `HEAD:spritesheets/${p}`], {
    cwd: REPO,
    maxBuffer: 64 * 1024 * 1024,
  });
}

async function strip(srcPath, outName) {
  const buf = blob(srcPath);
  const meta = await sharp(buf).metadata();
  if (meta.height < 46 * F) throw new Error(`${srcPath} has only ${meta.height / F} rows`);
  const parts = [];
  let x = 0;
  for (const { row, frames } of PLAN) {
    for (const col of frames) {
      const cell = await sharp(buf)
        .extract({ left: col * F, top: row * F, width: F, height: F })
        .toBuffer();
      parts.push({ input: cell, left: x * F, top: 0 });
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
  return statSync(out).size;
}

// name -> [source dir, base variant]
const JOBS = [];
const add = (name, dir, variant) => JOBS.push({ name, src: `${dir}${variant}.png` });

// Bodies (skin recoloured at runtime from the neutral 'light' ramp)
add("body-m", "body/bodies/male/", "light");
add("body-f", "body/bodies/female/", "light");

// Head shapes — the biggest driver of a distinct face
const HEADS = {
  "head-m-square": "head/heads/human/male/",
  "head-m-gaunt": "head/heads/human/male_gaunt/",
  "head-m-plump": "head/heads/human/male_plump/",
  "head-m-small": "head/heads/human/male_small/",
  "head-m-elder": "head/heads/human/male_elderly/",
  "head-f-oval": "head/heads/human/female/",
  "head-f-small": "head/heads/human/female_small/",
  "head-f-elder": "head/heads/human/female_elderly/",
  "head-orc": "head/heads/orc/male/",
  "head-orc-f": "head/heads/orc/female/",
  "head-goblin": "head/heads/goblin/adult/",
  "head-lizard": "head/heads/lizard/male/",
  "head-vampire": "head/heads/vampire/adult/",
  "head-troll": "head/heads/troll/adult/",
  "head-alien": "head/heads/alien/adult/",
  "head-boarman": "head/heads/boarman/adult/",
};
for (const [n, d] of Object.entries(HEADS)) add(n, d, "light");

add("eyes", "eyes/human/adult/", "blue");

const HAIR = {
  "hair-buzz": "hair/buzzcut/adult/",
  "hair-bob": "hair/bob/adult/",
  "hair-bobside": "hair/bob_side_part/adult/",
  "hair-cornrows": "hair/cornrows/adult/",
  "hair-cowlick": "hair/cowlick/adult/",
  "hair-curly": "hair/curly_short/adult/",
  "hair-curly2": "hair/curly_short2/adult/",
  "hair-dreads": "hair/dreadlocks_short/adult/",
  "hair-fade": "hair/flat_top_fade/adult/",
  "hair-flattop": "hair/flat_top_straight/adult/",
  "hair-idol": "hair/idol/adult/",
  "hair-jewfro": "hair/jewfro/adult/",
  "hair-natural": "hair/natural/adult/",
  "hair-page": "hair/page2/adult/",
  "hair-parted": "hair/parted3/adult/",
  "hair-sidebangs": "hair/parted_side_bangs/adult/",
  "hair-ponytail": "hair/relm_ponytail/adult/mg/",
  "hair-relmshort": "hair/relm_short/adult/",
  "hair-swoop": "hair/swoop_side/adult/",
  "hair-sidebangs2": "hair/parted_side_bangs2/adult/",
  "hair-bangsbun": "hair/bangs_bun/adult/",
  "hair-twists": "hair/twists_straight/adult/",
  "hair-balding": "hair/balding/adult/",
};
for (const [n, d] of Object.entries(HAIR)) add(n, d, "platinum");

const BEARDS = {
  "beard-shadow": "beards/beard/5oclock_shadow/",
  "beard-full": "beards/beard/basic/",
  "beard-medium": "beards/beard/medium/",
  "beard-trimmed": "beards/beard/trimmed/",
  "beard-winter": "beards/beard/winter/male/",
  "beard-mustache": "beards/mustache/basic/",
  "beard-bigstache": "beards/mustache/bigstache/",
  "beard-horseshoe": "beards/mustache/horseshoe/",
  "beard-french": "beards/mustache/french/",
  "beard-handlebar": "beards/mustache/handlebar/",
};
for (const [n, d] of Object.entries(BEARDS)) add(n, d, "platinum");

// Wardrobe — every piece extracted per build that supports it.
const TORSO = {
  plate: ["torso/armour/plate/male/", "torso/armour/plate/female/", "steel"],
  legion: ["torso/armour/legion/male/", "torso/armour/legion/female/", "steel"],
  overalls: ["torso/aprons/overalls/male/", "torso/aprons/overalls/female/", "white"],
  suspenders: ["torso/aprons/suspenders/male/", "torso/aprons/suspenders/female/", "white"],
  tshirt: [null, "torso/clothes/shortsleeve/tshirt/female/", "white"],
  tshirtv: [null, "torso/clothes/shortsleeve/tshirt_vneck/female/", "white"],
  polo: [null, "torso/clothes/shortsleeve/shortsleeve_polo/female/", "white"],
  longsleeve: [null, "torso/clothes/longsleeve/longsleeve2/female/", "white"],
  cardigan: [null, "torso/clothes/longsleeve/longsleeve2_cardigan/female/", "white"],
  sleeveless: [null, "torso/clothes/sleeveless/sleeveless2/female/", "white"],
};
for (const [n, [m, f, v]] of Object.entries(TORSO)) {
  if (m) add(`torso-${n}-m`, m, v);
  if (f) add(`torso-${n}-f`, f, v);
}

const LEGS = {
  pants: ["legs/pants/male/", "legs/pants/thin/"],
  shorts: ["legs/shorts/shorts/male/", "legs/shorts/shorts/thin/"],
  leggings: ["legs/leggings/male/", "legs/leggings/thin/"],
  formal: ["legs/formal/male/", "legs/formal/thin/"],
  pantaloons: ["legs/pantaloons/male/", "legs/pantaloons/thin/"],
  cuffed: ["legs/cuffed/male/", "legs/cuffed/thin/"],
  hose: ["legs/hose/male/", "legs/hose/thin/"],
};
for (const [n, [m, f]] of Object.entries(LEGS)) {
  add(`legs-${n}-m`, m, "white");
  add(`legs-${n}-f`, f, "white");
}

const FEET = {
  boots: ["feet/boots2/male/", "feet/boots2/thin/"],
  shoes: ["feet/shoes2/male/", "feet/shoes2/thin/"],
  wraps: ["feet/socks/high/male/", "feet/socks/high/thin/"],
};
for (const [n, [m, f]] of Object.entries(FEET)) {
  add(`feet-${n}-m`, m, "white");
  add(`feet-${n}-f`, f, "white");
}

let total = 0;
const failed = [];
for (const job of JOBS) {
  try {
    const size = await strip(job.src, job.name);
    total += size;
    process.stdout.write(`${job.name} ${(size / 1024).toFixed(1)}K  `);
  } catch (e) {
    failed.push(`${job.name} <- ${job.src}: ${String(e.message).slice(0, 90)}`);
  }
}
console.log(`\n\nwrote ${JOBS.length - failed.length}/${JOBS.length} strips, ${(total / 1024).toFixed(0)} KB total`);
if (failed.length) console.log("FAILED:\n" + failed.join("\n"));
