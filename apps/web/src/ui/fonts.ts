/**
 * The two self-hosted fonts (public/fonts, built by tools/subset-fonts.mjs, OFL 1.1 licence
 * files beside them). Loaded through the FontFace API so the path follows the site's base path,
 * and so the canvas can wait for them before it paints a banner.
 */
export const FONT_DISPLAY = "RZ Display";
export const FONT_BODY = "RZ Body";

/** The canvas font stacks the stage paints with (PlayerOpts.fonts). */
export const STAGE_FONTS = {
  display: `"${FONT_DISPLAY}", Impact, "Arial Narrow", sans-serif`,
  body: `"${FONT_BODY}", system-ui, sans-serif`,
} as const;

let loading: Promise<void> | null = null;

export function loadFonts(base: string = import.meta.env.BASE_URL ?? "./"): Promise<void> {
  if (loading) return loading;
  const root = base.endsWith("/") ? base : `${base}/`;
  const fonts = (globalThis as { document?: Document }).document?.fonts;
  if (!fonts || typeof FontFace === "undefined") return (loading = Promise.resolve());
  const faces = [
    new FontFace(FONT_DISPLAY, `url(${root}fonts/display.woff2) format("woff2")`, { weight: "900", display: "swap" }),
    new FontFace(FONT_BODY, `url(${root}fonts/body.woff2) format("woff2")`, { weight: "400 700", display: "swap" }),
  ];
  loading = Promise.all(
    faces.map((f) =>
      f.load().then(
        (done) => { fonts.add(done); },
        (error: unknown) => { console.warn(`fonts: ${f.family} did not load`, error); },
      ),
    ),
  ).then(() => undefined);
  return loading;
}
