/**
 * The canvases the app gives the stage since the fight screen became the stage only (owner,
 * 19 Nov 2026: "I dont want the ui below honestly"): the whole screen inside the safe areas, a
 * phone held upright, a phone turned, a desktop. They replace the old phone band canvases
 * (390 x 467, and 390 x 351 once the screen capped the stage at 9:10).
 */
export interface Canvas { w: number; h: number }

/** Phones held upright: a tall phone, a small Android, the 320 px phone. */
export const PORTRAIT: readonly Canvas[] = [{ w: 390, h: 844 }, { w: 360, h: 740 }, { w: 320, h: 568 }];
/** Phones turned, and desktops. */
export const LANDSCAPE: readonly Canvas[] = [{ w: 844, h: 390 }, { w: 740, h: 360 }, { w: 1280, h: 720 }, { w: 1920, h: 1080 }];
export const CANVASES: readonly Canvas[] = [...PORTRAIT, ...LANDSCAPE];

/** The tall phone and the turned phone: the two the per-frame checks use where all seven cost too
 *  much (the tall canvas is the narrowest view; the turned one the shortest). */
export const PHONE_TALL: Canvas = PORTRAIT[0]!;
export const PHONE_TURNED: Canvas = LANDSCAPE[0]!;

export const isTall = (c: Canvas): boolean => c.h > c.w;
export const label = (c: Canvas): string => `${c.w}x${c.h}`;
