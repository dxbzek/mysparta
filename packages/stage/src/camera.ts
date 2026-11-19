/**
 * The stage camera (calm camera, owner 15 Nov 2026: "I'm getting dizzy watching it").
 *
 * The camera of fight screen v2 followed every lunge, flinch and companion run with a smoothed
 * pan and zoom and pushed in on every crit: up to 557% zoom per second and 1314 px/s of pan on a
 * phone, with hundreds of reversals in one bout. It now holds ONE frame for the whole bout: the
 * frame that fits both scrappers' home marks (plus room for a knockback, a lean and a heavy
 * flinch) and every companion's mark, with the fighters as large as that allows. Nothing that
 * happens in the bout moves it.
 *
 * The one exception is the knockout. A knocked-out scrapper falls on its back, away from the
 * fight, and lies about a body length behind its mark: outside the bout's frame. From the
 * knockout on the camera makes ONE eased reframe (never turning back) to the outro frame and
 * stays there. The outro frame is built round what the last shot is about: the winner where it
 * stands for the outro (over the body, `koFocus.stand`, choreo/fall.ts) and the body on the
 * floor. When a tall phone cannot hold both, the winner stays whole and the far end of the body
 * is cut (review round 2: on the 390 x 467 phone canvas the old frame, built from both home marks
 * and the body, kept the body and cut the winner while "X WINS" showed). The reframe takes
 * `koMoveMs` (was 2.6 s: the fall outran it and the body left the frame on the way down).
 *
 * Like everything in the stage it is a pure function of `t` and the built tracks.
 * Reduced motion: the bout's frame from start to end; the camera never moves (a fallen body may
 * lie partly outside it).
 */
import type { Tracks } from "./model";
import type { CompanionId } from "@rankzero/core";
import { FLOOR_Y, PET_FRAME_REACH, SCRAPPER_REACH, STAGE_H, STAGE_W } from "./layout";
import { basePos, facingAt } from "./track";
import { FRAMING } from "./tuning";

/** Every number of the camera, in stage units and ms at 1x. */
export const CAMERA = {
  /** Half the width kept around a scrapper's home mark: its body, a knockback, a heavy lean back.
   *  A thing that goes further (a pet running off) leaves the frame; the frame does not chase it. */
  scrapperExtent: 40,
  /** Round a place a scrapper stands at away from its mark the frame keeps this much (its body
   *  without the back arm's shield), and it follows a place at most `excursionMax` from the mark. */
  excursion: 18,
  excursionMax: 70,
  /** Room kept round a pet's drawn box at its mark (layout.PET_MARKS: pets stand beside their
   *  owner, on his back side), for its idle breathing. */
  companionMargin: 3,
  /** The camera never shows less height than this, so a scrapper (about 80 units) fills at most
   *  about 65% of the canvas and numbers keep some air above the heads. */
  minVisibleH: 122,
  /** Space under the scrappers' floor line, and under a companion's (which stands nearer). */
  under: 13,
  underCompanion: 7,
  /** How far behind its mark a knocked-out body reaches, lying on its back (head and arms), when
   *  the timeline has not measured it (`koFocus.reach`, review finding 22: 92 cut a hand off). */
  bodyLength: 92,
  /** Room kept past the far end of the measured body. */
  bodyMargin: 6,
  /** The knockout reframe: eased over this long, from the start of the fall. Its fastest zoom is
   *  1.5 x ln(k0 / k1) / 1.6 s, inside the calm limits (test/lib/calm.ts), once per bout. */
  koMoveMs: 1600,
  /** The width kept behind the winner's outro place (away from the body: its back, layout
   *  SCRAPPER_REACH.back, and a little air) and in front of it (toward the body). */
  winnerBack: 34,
  winnerFront: 30,
  /** The outro frame keeps this much of the canvas (CSS px) clear above the standing heads, for
   *  the winner's banner in the top band (draw.ts: the 52 px band, a margin, a sticker of a 24 px
   *  text and a gap). Review finding 52: on the app's 390 x 260 phone canvas the reframe held the
   *  heads 80 px down, inside the banner. */
  bannerRoomPx: 98,
  /** A standing scrapper's head top over the floor line, with room for the win pose (units). */
  headTop: 110,
  /** The fight screen is the stage only (owner, 19 Nov 2026): the canvas fills the screen in
   *  portrait and in landscape, and the host's HUD (names, levels, HP bars: 52 px, labels.TOP_BAND)
   *  lies over its top. The bout frame keeps the standing heads this far down (the HUD and a skill
   *  tag's height over a head), and its floor room this far up from the bottom edge. */
  hudRoomPx: 84,
  lowRoomPx: 8,
  /** A tall canvas (portrait) opens no wider than this for the pets at the far ends, so the
   *  fighters stay large; the scrappers' own room (`must`) is always in. The choreography keeps
   *  every place it uses inside this width (FRAMING.viewMin). */
  tallViewW: FRAMING.viewMin,
  /** On a tall canvas the height left over goes this share above the fighters and the rest below,
   *  where the host's control bar and result card lie; the stage's 240 units are always whole
   *  then, and the canvas beyond them is the dark the stage is drawn in (draw.ts). */
  tallSpareAbove: 0.4,
  /** The outro keeps the standing feet and the body on the floor this many CSS px clear of the
   *  bottom, for the host's result card, on a tall and on a wide canvas (the web fight screen's
   *  card: at most 170 px tall upright, one 76 px row turned); the floor room under the feet may
   *  lie under the card. */
  resultRoomPx: { tall: 176, wide: 80 },
} as const;

/** The part of the stage in view: its left and top edge in stage units, and stage units to CSS px. */
export interface CameraView { x0: number; y0: number; k: number }

/** The span to keep in view. On a canvas too narrow for all of it (a tall phone shows at most
 *  240 x w / h stage units across), `must` stays in view: the scrappers' marks and room, and in
 *  the outro the knocked-out body; the pets at the far ends are the ones cut. When even `must`
 *  does not fit, the body's far end (`keepAt`, on the `keep` side) stays in. */
interface Span { x0: number; x1: number; bottom: number; must?: { x0: number; x1: number }; keep?: "x0" | "x1"; keepAt?: number;
  /** The outro: keep `CAMERA.bannerRoomPx` clear above the heads. */
  banner?: boolean }

/**
 * The fixed frame of a bout: the stage span to keep in view and the lowest floor line. `must`
 * holds the scrappers' marks and room, and every place a scrapper stands at before the knockout
 * with `CAMERA.excursion` round it (review round 2: with a long weapon on a pet a fighter stood
 * 38 units behind its mark, cut in half by the phone's edge, to swing). The choreography keeps
 * those places near the marks (timeline.ts `targetGives`, FRAMING); what is left over, the frame
 * holds. It is still one fixed frame for the whole bout.
 */
export function frameSpan(tr: Pick<Tracks, "actors"> & { koFocus?: Tracks["koFocus"]; nudges?: Tracks["nudges"] }): Span {
  const hit = spans.get(tr.actors);
  if (hit !== undefined) return hit;
  const s = homeSpan(tr);
  if (s.must !== undefined) {
    const until = tr.koFocus?.at ?? Infinity;
    let { x0, x1 } = s.must;
    for (const a of tr.actors) {
      if (a.rig !== "scrapper") continue;
      const r = CAMERA.excursion * (a.reach.back / SCRAPPER_REACH.back);
      // (a way back toward the mark only comes nearer: the ends of the moves are the extremes)
      for (const m of a.moves) {
        if (m.from >= until || m.from < a.showFrom) continue;
        const lim = CAMERA.excursionMax;
        const x = Math.min(a.home.x + lim, Math.max(a.home.x - lim, m.x1));
        x0 = Math.min(x0, x - r);
        x1 = Math.max(x1, x + r);
      }
      // and where a nudge (a knockback, a slide, a hop) carries it from there, at its farthest
      // (content v3 batch 2: a long weapon's stop near the frame's edge, then a flinch, took a
      // fighter's middle 1.5 units past the short phone's view in 2 of 400 level-30 bouts)
      for (const n of tr.nudges ?? []) {
        if (n.actor !== a.id || n.from >= until || n.from < a.showFrom) continue;
        const t = n.from + n.outMs;
        const x = basePos(a, t).x + facingAt(a, t) * n.dx;
        const lim = CAMERA.excursionMax;
        const c = Math.min(a.home.x + lim, Math.max(a.home.x - lim, x));
        x0 = Math.min(x0, c - r);
        x1 = Math.max(x1, c + r);
      }
    }
    x0 = Math.max(0, x0);
    x1 = Math.min(STAGE_W, x1);
    s.must = { x0, x1 };
    s.x0 = Math.min(s.x0, x0);
    s.x1 = Math.max(s.x1, x1);
  }
  spans.set(tr.actors, s);
  return s;
}
const spans = new WeakMap<object, Span>();

/** The frame from the home marks alone: the part of the stage every canvas shows whatever the
 *  bout does. The choreography keeps the fighters inside it while it is being built. */
export function homeSpan(tr: Pick<Tracks, "actors">): Span {
  let x0 = Infinity;
  let x1 = -Infinity;
  let c0 = Infinity;
  let c1 = -Infinity;
  let bottom = FLOOR_Y + CAMERA.under;
  for (const a of tr.actors) {
    const scrapper = a.rig === "scrapper";
    if (scrapper) {
      c0 = Math.min(c0, a.home.x - CAMERA.scrapperExtent);
      c1 = Math.max(c1, a.home.x + CAMERA.scrapperExtent);
      x0 = Math.min(x0, c0);
      x1 = Math.max(x1, c1);
    } else {
      // the pet's whole drawn box at its mark, facing the fight
      const m = CAMERA.companionMargin;
      const fr = PET_FRAME_REACH[a.rig as CompanionId] ?? a.reach;
      const [l, r] = a.homeFacing === 1 ? [fr.back, fr.front] : [fr.front, fr.back];
      x0 = Math.min(x0, a.home.x - l - m);
      x1 = Math.max(x1, a.home.x + r + m);
    }
    bottom = Math.max(bottom, a.home.y + (scrapper ? CAMERA.under : CAMERA.underCompanion));
  }
  if (x0 === Infinity) { x0 = 0; x1 = STAGE_W; }
  const s: Span = { x0, x1, bottom: Math.min(STAGE_H, bottom) };
  if (c0 !== Infinity) s.must = { x0: c0, x1: c1 };
  return s;
}

/** The outro frame: the winner where it stands for the outro and the knocked-out body on the
 *  floor must be in it (the rest of the bout's frame, the pets, where it fits); when even those two
 *  do not fit, the winner stays whole. */
export function outroSpan(tr: Tracks): Span {
  const s = { ...frameSpan(tr) };
  const f = tr.koFocus;
  if (f === null) return s;
  // the body as the rig draws it lying there (choreo/fall.ts), and a little room past the hand
  const far = Math.max(0, Math.min(STAGE_W, f.x + f.back * ((f.reach ?? CAMERA.bodyLength) + CAMERA.bodyMargin)));
  if (f.stand === undefined) {
    // nobody left standing to win over the body: the bout's frame and the body
    const must = s.must ?? { x0: s.x0, x1: s.x1 };
    return { x0: Math.min(s.x0, far), x1: Math.max(s.x1, far), bottom: s.bottom, keep: f.back === 1 ? "x1" : "x0", keepAt: far, banner: true,
      must: { x0: Math.min(must.x0, far), x1: Math.max(must.x1, far) } };
  }
  // the winner faces the body: its back is on the side away from it
  // (as wide as the win pose is drawn there, when the timeline measured it)
  const w0 = f.stand - (f.standBox?.l ?? (f.back === 1 ? CAMERA.winnerBack : CAMERA.winnerFront));
  const w1 = f.stand + (f.standBox?.r ?? (f.back === 1 ? CAMERA.winnerFront : CAMERA.winnerBack));
  const must = { x0: Math.min(w0, f.x, far), x1: Math.max(w1, f.x, far) };
  return { x0: Math.min(s.x0, must.x0), x1: Math.max(s.x1, must.x1), bottom: s.bottom, banner: true, must,
    // the winner stands on the fight side of the body: that end is kept
    keep: f.back === 1 ? "x0" : "x1", keepAt: f.back === 1 ? w0 : w1 };
}

/** How far the knockout reframe has gone at `t`, 0 to 1 (eased; 0 until the knockout). */
export function reframeAt(tr: Tracks, t: number): number {
  const f = tr.koFocus;
  if (f === null) return 0;
  const u = (t - f.at) / CAMERA.koMoveMs;
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return u * u * (3 - 2 * u);
}

/** The view that fits a span on a canvas of `w x h` (any shape: a phone held upright or turned,
 *  a desktop screen).
 *  - Across: the whole span where the canvas can open that wide; a tall canvas opens at most
 *    `tallViewW` (the scrappers' room always). A wide canvas whose height cannot hold the column
 *    at that width shows more than the stage, with the night beside it.
 *  - Up and down: the column from the standing heads (`headTop`) to the floor room (`bottom`) sits
 *    between the HUD's room at the top (the outro: the banner's) and the floor's room at the bottom
 *    (the outro: the feet, over the result card). A canvas taller than the stage shows all 240 units and the dark
 *    beyond them; a shorter one stays inside the stage. */
function fit(s: Span, w: number, h: number): CameraView {
  const tall = h > w;
  const m = s.must ?? s;
  const colTop = FLOOR_Y - CAMERA.headTop;
  const outro = s.banner === true;
  // (in the outro the card may cover the floor under the feet: the column ends at the floor line)
  const colH = Math.max(1, (outro ? FLOOR_Y : s.bottom) - colTop);
  const top = outro ? CAMERA.bannerRoomPx : CAMERA.hudRoomPx;
  const low = outro ? (tall ? CAMERA.resultRoomPx.tall : CAMERA.resultRoomPx.wide) : CAMERA.lowRoomPx;
  const spanW = Math.max(1, s.x1 - s.x0);
  const wantW = tall ? Math.max(m.x1 - m.x0, Math.min(spanW, CAMERA.tallViewW)) : spanW;
  const k = Math.min(w / wantW, h / CAMERA.minVisibleH, Math.max(1, h - top - low) / colH);
  const vw = w / k;
  let x0 = (s.x0 + s.x1) / 2 - vw / 2;
  // a tall canvas cannot always open wide enough: the scrappers (and a fallen body) stay in;
  // when even they do not fit, the fallen body's far end does
  if (vw < s.x1 - s.x0) {
    x0 = vw >= m.x1 - m.x0 ? Math.min(m.x0, Math.max(m.x1 - vw, x0))
      : s.keepAt === undefined ? (m.x0 + m.x1 - vw) / 2 : s.keep === "x1" ? s.keepAt - vw : s.keepAt;
  }
  const spare = Math.max(0, h - top - low - colH * k);
  const above = top + spare * (tall ? CAMERA.tallSpareAbove : 0.5);
  return clampView({ x0, y0: colTop - above / k, k }, w, h);
}

/** The camera at `t` for a canvas of `view.w x view.h` CSS px. */
export function cameraAt(tr: Tracks, t: number, view: { w: number; h: number }, reduced: boolean): CameraView {
  const w = view.w > 0 ? view.w : STAGE_W;
  const h = view.h > 0 ? view.h : STAGE_H;
  const start = fit(frameSpan(tr), w, h);
  if (reduced) return start;
  const u = reframeAt(tr, t);
  if (u === 0) return start;
  const end = fit(outroSpan(tr), w, h);
  // the scale moves geometrically and the centre with the same easing, so the reframe is one
  // smooth move with no turn in it
  const k = start.k * Math.pow(end.k / start.k, u);
  const cx = start.x0 + w / start.k / 2 + (end.x0 + w / end.k / 2 - (start.x0 + w / start.k / 2)) * u;
  const by = start.y0 + h / start.k + (end.y0 + h / end.k - (start.y0 + h / start.k)) * u;
  // (not clamped on the way: both ends are, and a clamp that starts to bite half way would put a
  // kink in the move; on the way the view may show a little of the night past the stage's edge)
  return { x0: cx - w / k / 2, y0: by - h / k, k };
}

/** Inside the stage across when the view is narrower than it, the whole stage when wider; the
 *  stage's top always in or above the view, the floor going on past its bottom when the view needs
 *  it (the night and the floor beyond the stage: draw.ts EDGE). */
function clampView(c: CameraView, w: number, h: number): CameraView {
  const vw = w / c.k;
  const vh = h / c.k;
  const within = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
  const x0 = vw <= STAGE_W ? within(c.x0, 0, STAGE_W - vw) : within(c.x0, STAGE_W - vw, 0);
  // (a short view may go past the stage's bottom: the floor goes on there, draw.ts EDGE)
  const y0 = vh <= STAGE_H ? Math.max(0, c.y0) : within(c.y0, STAGE_H - vh, 0);
  return { x0, y0, k: c.k };
}
