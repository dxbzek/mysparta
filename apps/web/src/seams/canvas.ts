/**
 * SEAM FILE (work package 0). Only the Lead edits it.
 * The browser side of `DrawEnv`: it hands the rig a real 2D context and builds one `Path2D`
 * per path string. The rig and the stage never touch a browser type; this file is where the
 * browser's context is checked against the contract's `Ctx2D` subset by the compiler.
 */
import type { Ctx2D, DrawEnv } from "@rankzero/rig";

export function makeDrawEnv(context: CanvasRenderingContext2D): DrawEnv {
  const ctx: Ctx2D = context;
  const cache = new Map<string, Path2D>();
  return {
    ctx,
    path(d: string): Path2D {
      let p = cache.get(d);
      if (p === undefined) {
        p = new Path2D(d);
        cache.set(d, p);
      }
      return p;
    },
  };
}
