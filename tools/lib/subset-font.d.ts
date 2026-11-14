/**
 * The one call the tools make into `subset-font` (BSD-3-Clause), which ships no types.
 * It cuts a font down to the given glyphs and returns the bytes in the asked format.
 */
declare module "subset-font" {
  export interface SubsetOptions {
    targetFormat?: "sfnt" | "woff" | "woff2" | "truetype";
    preserveNameIds?: number[];
    variationAxes?: Record<string, number | { min: number; max: number; default?: number }>;
  }
  export default function subsetFont(font: Uint8Array, text: string, options?: SubsetOptions): Promise<Buffer>;
}
