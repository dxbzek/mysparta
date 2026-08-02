/**
 * Modular paper-doll characters.
 *
 * Every hunter is built from stacked hand-drawn layers — body, legs, shoes,
 * outfit, head shape, eyes, facial hair, hairstyle — exactly the way MyBrute
 * builds its brutes. Choosing a different head or hairstyle changes the
 * actual pixels and silhouette, not just the palette.
 *
 * Art: the LPC (Liberated Pixel Cup) universal character set, drawn by many
 * hands over the years and released under CC-BY-SA 3.0 / GPL 3.0. Each part
 * ships as a 32-frame side-view strip (see scratchpad/extract-lpc.mjs):
 *
 *   frames  0-1   relaxed idle      2-3   combat stance
 *           4-11  run              12-17  slash (attack 1)
 *          18-25  thrust (attack 2) 26-31 hurt / fall
 *
 * Layers are composited onto one canvas per look and cached, so a hunter
 * costs a single image no matter how many pieces they wear.
 */

const SHEETS = import.meta.glob("./assets/lpc/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function sheet(name: string): string {
  const url = SHEETS[`./assets/lpc/${name}.webp`];
  if (!url) throw new Error(`missing sprite layer: ${name}`);
  return url;
}

/** One frame is 64x64; the packed strip is 32 frames wide. */
export const FRAME = 64;
export const STRIP_FRAMES = 32;

/** Where the character sits inside the 64px frame (measured from the art). */
export const CHAR = { cx: 32, w: 24, h: 48, groundOff: 2 };

export type Anim = "idle" | "stance" | "run" | "attack1" | "attack2" | "hit" | "death";

export const ANIMS: Record<Anim, { from: number; count: number; dur: number; loop: boolean }> = {
  idle: { from: 0, count: 2, dur: 1.1, loop: true },
  stance: { from: 2, count: 2, dur: 0.8, loop: true },
  run: { from: 4, count: 8, dur: 0.62, loop: true },
  attack1: { from: 12, count: 6, dur: 0.5, loop: false },
  attack2: { from: 18, count: 8, dur: 0.62, loop: false },
  hit: { from: 26, count: 3, dur: 0.3, loop: false },
  death: { from: 26, count: 6, dur: 0.75, loop: false },
};

/* ================= colour palettes ================= */

export interface Tone {
  name: string;
  /** target hue 0-360 */
  h: number;
  /** target saturation 0-1 */
  s: number;
  /** luminance multiplier applied to the hand-drawn shading ramp */
  l: number;
  /** swatch colour for the picker */
  css: string;
}

const tone = (name: string, h: number, s: number, l: number, css: string): Tone => ({ name, h, s, l, css });

export const SKINS: Tone[] = [
  tone("Porcelain", 28, 0.34, 1.04, "#f6ddc4"),
  tone("Fair", 26, 0.42, 0.96, "#efc9a2"),
  tone("Olive", 32, 0.4, 0.82, "#d3a875"),
  tone("Amber", 27, 0.48, 0.74, "#c39058"),
  tone("Bronze", 24, 0.5, 0.62, "#a3703f"),
  tone("Umber", 22, 0.48, 0.5, "#7f5630"),
  tone("Deep", 20, 0.45, 0.38, "#5e3f24"),
  tone("Ebony", 18, 0.38, 0.28, "#432d1a"),
  tone("Ashen", 250, 0.08, 0.8, "#b9b7c4"),
  tone("Verdant", 110, 0.34, 0.62, "#7d9a55"),
  tone("Tidal", 195, 0.34, 0.66, "#6fa2b0"),
  tone("Ember", 8, 0.5, 0.6, "#b3624a"),
];

export const HAIR_COLORS: Tone[] = [
  tone("Jet", 20, 0.14, 0.24, "#2e2823"),
  tone("Raven", 260, 0.14, 0.3, "#3b3648"),
  tone("Chestnut", 22, 0.5, 0.42, "#6f4527"),
  tone("Auburn", 12, 0.6, 0.46, "#8a3f24"),
  tone("Ginger", 26, 0.72, 0.6, "#c9722a"),
  tone("Honey", 38, 0.62, 0.74, "#d3a24f"),
  tone("Blonde", 46, 0.68, 0.86, "#e8c56b"),
  tone("Platinum", 44, 0.16, 1.0, "#ece2cd"),
  tone("Silver", 230, 0.08, 0.92, "#cfd2dc"),
  tone("Crimson", 352, 0.66, 0.5, "#a8283f"),
  tone("Rose", 335, 0.6, 0.76, "#e2799b"),
  tone("Violet", 275, 0.5, 0.62, "#9268c0"),
  tone("Azure", 210, 0.62, 0.66, "#4b93cf"),
  tone("Teal", 176, 0.55, 0.6, "#3f9f97"),
  tone("Emerald", 142, 0.5, 0.56, "#3f9f63"),
  tone("Snow", 40, 0.06, 1.06, "#f2efe6"),
];

export const CLOTH_COLORS: Tone[] = [
  tone("Bone", 40, 0.16, 1.0, "#e8ddc6"),
  tone("Ash", 240, 0.06, 0.62, "#918f99"),
  tone("Charcoal", 250, 0.1, 0.3, "#3f3d47"),
  tone("Ink", 235, 0.28, 0.2, "#242a3d"),
  tone("Crimson", 354, 0.62, 0.48, "#9e2c40"),
  tone("Rust", 18, 0.62, 0.5, "#a85a2a"),
  tone("Amber", 34, 0.68, 0.68, "#c98f36"),
  tone("Gold", 46, 0.66, 0.78, "#dcb14b"),
  tone("Moss", 96, 0.4, 0.48, "#5f7a3c"),
  tone("Emerald", 148, 0.5, 0.5, "#3d8f5c"),
  tone("Teal", 178, 0.5, 0.52, "#3a8f89"),
  tone("Azure", 208, 0.55, 0.56, "#3f83bb"),
  tone("Indigo", 244, 0.44, 0.44, "#4a4c9c"),
  tone("Violet", 278, 0.44, 0.54, "#7f5ab0"),
  tone("Plum", 312, 0.4, 0.42, "#8b4076"),
  tone("Rose", 338, 0.5, 0.72, "#d3819c"),
  tone("Sand", 36, 0.4, 0.86, "#dcc08d"),
  tone("Leather", 24, 0.48, 0.44, "#7d5330"),
];

export const EYE_COLORS: Tone[] = [
  tone("Brown", 26, 0.6, 0.6, "#8b5a2b"),
  tone("Amber", 40, 0.75, 0.68, "#c9902f"),
  tone("Azure", 210, 0.7, 0.7, "#4a9ad6"),
  tone("Teal", 180, 0.6, 0.62, "#3fa39b"),
  tone("Emerald", 140, 0.6, 0.6, "#3f9f63"),
  tone("Violet", 272, 0.55, 0.66, "#9068c8"),
  tone("Crimson", 354, 0.7, 0.58, "#b8324a"),
  tone("Slate", 220, 0.14, 0.6, "#77808f"),
];

/* ================= part catalogs ================= */

export interface Part {
  name: string;
  /** sheet base name; `%` is replaced by the build suffix (m / f) */
  file: string;
}

export const BUILDS = [
  { name: "Broad", suffix: "m", blurb: "Heavy shoulders, planted stance." },
  { name: "Lithe", suffix: "f", blurb: "Light on the feet, quick to turn." },
];

export const HEADS: Part[] = [
  { name: "Square", file: "head-m-square" },
  { name: "Gaunt", file: "head-m-gaunt" },
  { name: "Heavy", file: "head-m-plump" },
  { name: "Fine", file: "head-m-small" },
  { name: "Weathered", file: "head-m-elder" },
  { name: "Oval", file: "head-f-oval" },
  { name: "Petite", file: "head-f-small" },
  { name: "Elder", file: "head-f-elder" },
  { name: "Tusked", file: "head-orc" },
  { name: "Ogress", file: "head-orc-f" },
  { name: "Goblin", file: "head-goblin" },
  { name: "Draken", file: "head-lizard" },
  { name: "Nosferatu", file: "head-vampire" },
  { name: "Troll", file: "head-troll" },
  { name: "Starborn", file: "head-alien" },
  { name: "Boar", file: "head-boarman" },
];

export const HAIRS: Part[] = [
  { name: "Shaved", file: "" },
  { name: "Buzzcut", file: "hair-buzz" },
  { name: "Balding", file: "hair-balding" },
  { name: "Cowlick", file: "hair-cowlick" },
  { name: "Flat top", file: "hair-flattop" },
  { name: "Fade", file: "hair-fade" },
  { name: "Cornrows", file: "hair-cornrows" },
  { name: "Twists", file: "hair-twists" },
  { name: "Dreads", file: "hair-dreads" },
  { name: "Afro", file: "hair-jewfro" },
  { name: "Curls", file: "hair-curly" },
  { name: "Ringlets", file: "hair-curly2" },
  { name: "Natural", file: "hair-natural" },
  { name: "Bob", file: "hair-bob" },
  { name: "Side bob", file: "hair-bobside" },
  { name: "Page", file: "hair-page" },
  { name: "Parted", file: "hair-parted" },
  { name: "Side bangs", file: "hair-sidebangs" },
  { name: "Long bangs", file: "hair-sidebangs2" },
  { name: "Bun", file: "hair-bangsbun" },
  { name: "Ponytail", file: "hair-ponytail" },
  { name: "Cropped", file: "hair-relmshort" },
  { name: "Swoop", file: "hair-swoop" },
  { name: "Idol", file: "hair-idol" },
];

export const BEARDS: Part[] = [
  { name: "Clean", file: "" },
  { name: "Stubble", file: "beard-shadow" },
  { name: "Trimmed", file: "beard-trimmed" },
  { name: "Medium", file: "beard-medium" },
  { name: "Full", file: "beard-full" },
  { name: "Winter", file: "beard-winter" },
  { name: "Moustache", file: "beard-mustache" },
  { name: "Walrus", file: "beard-bigstache" },
  { name: "Horseshoe", file: "beard-horseshoe" },
  { name: "French", file: "beard-french" },
  { name: "Handlebar", file: "beard-handlebar" },
];

/** Outfits. Some pieces are cut for one build only — filtered per build. */
export const TORSOS: Part[] = [
  { name: "Bare", file: "" },
  { name: "Plate", file: "torso-plate-%" },
  { name: "Legion", file: "torso-legion-%" },
  { name: "Overalls", file: "torso-overalls-%" },
  { name: "Suspenders", file: "torso-suspenders-%" },
  { name: "Tunic", file: "torso-tshirt-f" },
  { name: "V-neck", file: "torso-tshirtv-f" },
  { name: "Collar", file: "torso-polo-f" },
  { name: "Longsleeve", file: "torso-longsleeve-f" },
  { name: "Cardigan", file: "torso-cardigan-f" },
  { name: "Sleeveless", file: "torso-sleeveless-f" },
];

export const LEGS: Part[] = [
  { name: "Bare", file: "" },
  { name: "Trousers", file: "legs-pants-%" },
  { name: "Shorts", file: "legs-shorts-%" },
  { name: "Leggings", file: "legs-leggings-%" },
  { name: "Formal", file: "legs-formal-%" },
  { name: "Pantaloons", file: "legs-pantaloons-%" },
  { name: "Cuffed", file: "legs-cuffed-%" },
  { name: "Hose", file: "legs-hose-%" },
];

export const FEET: Part[] = [
  { name: "Barefoot", file: "" },
  { name: "Boots", file: "feet-boots-%" },
  { name: "Shoes", file: "feet-shoes-%" },
  { name: "Wraps", file: "feet-wraps-%" },
];

/** Pieces cut only for the lithe frame read badly on the broad one. */
export function torsosFor(build: number): number[] {
  return TORSOS.map((_, i) => i).filter((i) => build === 1 || !TORSOS[i]!.file.endsWith("-f"));
}

/** Helmets — full 46-row LPC sheets, so they track the body exactly. */
export const HELMS: Part[] = [
  { name: "Barbute", file: "helm-barbuta" },
  { name: "Armet", file: "helm-armet" },
  { name: "Horned Helm", file: "helm-horned" },
  { name: "Spangenhelm", file: "helm-spangen" },
  { name: "Kettle Helm", file: "helm-kettle" },
];

/** Capes hang from the shoulders; the sheet is cut per build. */
export const CAPES: Part[] = [{ name: "Mantle", file: "cape-%" }];

export interface Look {
  build: number;
  skin: number;
  head: number;
  eyes: number;
  hair: number;
  hairColor: number;
  beard: number;
  torso: number;
  torsoColor: number;
  legs: number;
  legsColor: number;
  feet: number;
  feetColor: number;
  /** Worn gear, painted on top of the outfit. -1 is bare. */
  helm?: number;
  cape?: number;
  capeColor?: number;
}

export const DEFAULT_LOOK: Look = {
  build: 0,
  skin: 1,
  head: 0,
  eyes: 0,
  hair: 3,
  hairColor: 0,
  beard: 0,
  torso: 1,
  torsoColor: 1,
  legs: 1,
  legsColor: 2,
  feet: 1,
  feetColor: 17,
};

const wrap = (n: number, len: number) => ((n % len) + len) % len;

/** Keep every index inside its catalog, and outfits inside the build's set. */
export function normaliseLook(l: Look): Look {
  const build = wrap(l.build, BUILDS.length);
  const allowed = torsosFor(build);
  const torso = allowed.includes(wrap(l.torso, TORSOS.length))
    ? wrap(l.torso, TORSOS.length)
    : allowed[wrap(l.torso, allowed.length)]!;
  return {
    build,
    skin: wrap(l.skin, SKINS.length),
    head: wrap(l.head, HEADS.length),
    eyes: wrap(l.eyes, EYE_COLORS.length),
    hair: wrap(l.hair, HAIRS.length),
    hairColor: wrap(l.hairColor, HAIR_COLORS.length),
    beard: wrap(l.beard, BEARDS.length),
    torso,
    torsoColor: wrap(l.torsoColor, CLOTH_COLORS.length),
    legs: wrap(l.legs, LEGS.length),
    legsColor: wrap(l.legsColor, CLOTH_COLORS.length),
    feet: wrap(l.feet, FEET.length),
    feetColor: wrap(l.feetColor, CLOTH_COLORS.length),
    // gear slots pass through untouched — -1/undefined simply means bare
    helm: l.helm != null && l.helm >= 0 ? wrap(l.helm, HELMS.length) : undefined,
    cape: l.cape != null && l.cape >= 0 ? wrap(l.cape, CAPES.length) : undefined,
    capeColor: l.capeColor != null ? wrap(l.capeColor, CLOTH_COLORS.length) : undefined,
  };
}

/** A fully random hunter — the "roll the dice" button and the rival roster. */
export function randomLook(rand: () => number): Look {
  const build = Math.floor(rand() * BUILDS.length);
  const allowed = torsosFor(build);
  return normaliseLook({
    build,
    skin: Math.floor(rand() * SKINS.length),
    head: Math.floor(rand() * HEADS.length),
    eyes: Math.floor(rand() * EYE_COLORS.length),
    hair: Math.floor(rand() * HAIRS.length),
    hairColor: Math.floor(rand() * HAIR_COLORS.length),
    // clean-shaven most of the time; whiskers should feel like a choice
    beard: rand() < 0.55 ? 0 : Math.floor(rand() * BEARDS.length),
    // never spawn bare-chested: a hunter always turns up wearing something
    torso: allowed.filter((i) => i !== 0)[Math.floor(rand() * (allowed.length - 1))]!,
    torsoColor: Math.floor(rand() * CLOTH_COLORS.length),
    legs: 1 + Math.floor(rand() * (LEGS.length - 1)),
    legsColor: Math.floor(rand() * CLOTH_COLORS.length),
    feet: 1 + Math.floor(rand() * (FEET.length - 1)),
    feetColor: Math.floor(rand() * CLOTH_COLORS.length),
  });
}

export function lookKey(l: Look): string {
  return [
    l.build, l.skin, l.head, l.eyes, l.hair, l.hairColor, l.beard,
    l.torso, l.torsoColor, l.legs, l.legsColor, l.feet, l.feetColor,
  ].join(".");
}

/* ================= compositing ================= */

interface LayerJob {
  file: string;
  tone: Tone;
  /** only recolour pixels inside this hue window (used to spare eye whites) */
  hueWindow?: [number, number];
}

function partFile(part: Part, build: number): string {
  if (!part.file) return "";
  return part.file.replace("%", BUILDS[build]!.suffix);
}

function layersOf(l: Look): LayerJob[] {
  const skin = SKINS[l.skin]!;
  const hair = HAIR_COLORS[l.hairColor]!;
  const jobs: LayerJob[] = [{ file: `body-${BUILDS[l.build]!.suffix}`, tone: skin }];
  const push = (file: string, tone: Tone, hueWindow?: [number, number]) => {
    if (file) jobs.push({ file, tone, hueWindow });
  };
  push(partFile(LEGS[l.legs]!, l.build), CLOTH_COLORS[l.legsColor]!);
  push(partFile(FEET[l.feet]!, l.build), CLOTH_COLORS[l.feetColor]!);
  push(partFile(TORSOS[l.torso]!, l.build), CLOTH_COLORS[l.torsoColor]!);
  push(HEADS[l.head]!.file, skin);
  push("eyes", EYE_COLORS[l.eyes]!, [170, 265]);
  push(BEARDS[l.beard]!.file, hair);
  push(HAIRS[l.hair]!.file, hair);
  // worn gear sits above what it covers: a cape over the outfit, a helm
  // over the hair it would flatten
  if (l.cape != null && CAPES[l.cape]) {
    jobs.splice(4, 0, {
      file: partFile(CAPES[l.cape]!, l.build),
      tone: CLOTH_COLORS[l.capeColor ?? 0]!,
    });
  }
  if (l.helm != null && HELMS[l.helm]) {
    jobs.push({ file: HELMS[l.helm]!.file, tone: CLOTH_COLORS[1]! });
  }
  return jobs;
}

function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return [(h + 360) % 360, d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), l];
}

function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/**
 * Recolour one layer in place: the hue and saturation become the chosen
 * tone's while the artist's luminance ramp — every shadow and highlight —
 * is preserved and simply scaled.
 */
function recolor(px: Uint8ClampedArray, t: Tone, hueWindow?: [number, number]): void {
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3]! < 12) continue;
    const [h, s, l] = rgb2hsl(px[i]!, px[i + 1]!, px[i + 2]!);
    if (hueWindow && (s < 0.16 || h < hueWindow[0] || h > hueWindow[1])) continue;
    const nl = Math.max(0.02, Math.min(0.98, l * t.l));
    // near-grey source pixels (outlines, whites) keep a hint of their neutrality
    const ns = s < 0.12 ? t.s * 0.55 : t.s;
    const [r, g, b] = hsl2rgb(t.h, ns, nl);
    px[i] = r; px[i + 1] = g; px[i + 2] = b;
  }
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`failed to load ${src}`));
      img.src = src;
    });
    imageCache.set(src, p);
  }
  return p;
}

const stripCache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

/** Composite a look into one 32-frame strip, cached by look. */
export function lookStrip(look: Look): Promise<string> {
  const l = normaliseLook(look);
  const key = lookKey(l);
  const hit = stripCache.get(key);
  if (hit) return Promise.resolve(hit);
  const inflight = pending.get(key);
  if (inflight) return inflight;

  const job = (async () => {
    const canvas = document.createElement("canvas");
    canvas.width = STRIP_FRAMES * FRAME;
    canvas.height = FRAME;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("2d canvas unavailable");
    const layer = document.createElement("canvas");
    layer.width = canvas.width;
    layer.height = canvas.height;
    const lctx = layer.getContext("2d", { willReadFrequently: true })!;

    for (const { file, tone, hueWindow } of layersOf(l)) {
      const img = await loadImage(sheet(file));
      lctx.clearRect(0, 0, layer.width, layer.height);
      lctx.drawImage(img, 0, 0);
      const data = lctx.getImageData(0, 0, layer.width, layer.height);
      recolor(data.data, tone, hueWindow);
      lctx.putImageData(data, 0, 0);
      ctx.drawImage(layer, 0, 0);
    }
    const url = canvas.toDataURL("image/png");
    stripCache.set(key, url);
    return url;
  })().finally(() => pending.delete(key));

  pending.set(key, job);
  return job;
}

/** Synchronous peek — lets already-built looks render without a flash. */
export function cachedStrip(look: Look): string | undefined {
  return stripCache.get(lookKey(normaliseLook(look)));
}

/* ================= weapons in hand ================= */

/** Weapon art keyed by discipline family (see extract-weapons.mjs). */
export type WeaponArt = "sword" | "spear" | "mace" | "dagger" | "shield";

const WEAPON_SHEETS: Record<WeaponArt, string> = {
  sword: "wpn-sword",
  spear: "wpn-spear",
  mace: "wpn-mace",
  dagger: "wpn-dagger",
  shield: "wpn-shield",
};

/** Strip URL for a weapon, drawn over the fighter on the same 32-frame grid. */
export function weaponStrip(art: WeaponArt): string {
  return sheet(WEAPON_SHEETS[art]);
}

/** Which art a weapon discipline is drawn with. */
export function weaponArtFor(discipline: string): WeaponArt | undefined {
  switch (discipline) {
    case "xiphos":
      return "sword";
    case "doru":
    case "akontia":
      return "spear";
    case "labrys":
      return "mace";
    case "aspis":
      return "shield";
    default:
      return undefined; // cestus fights bare-handed
  }
}
