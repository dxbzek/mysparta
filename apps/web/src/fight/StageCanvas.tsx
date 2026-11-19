/**
 * The stage canvas: the whole fight screen inside the safe areas (the stage only, owner 19 Nov
 * 2026), held upright or turned; the stage camera fits the fighters to its shape. It paints `player.draw(t)` for the
 * `t` it is given, in a layout effect, so the picture and the DOM around it always show the same
 * time. Backing store = CSS size x min(devicePixelRatio, 2).
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import type { DrawEnv } from "@rankzero/rig";
import type { FightPlayer } from "@rankzero/stage";
import { makeDrawEnv } from "../seams/canvas";
import css from "./fight.module.css";

export function StageCanvas({ player, t, label }: { player: FightPlayer; t: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const envRef = useRef<DrawEnv | null>(null);
  const size = useMemo(() => ({ w: 0, h: 0 }), []);
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (envRef.current === null) {
      const context = canvas.getContext("2d");
      if (!context) return;
      envRef.current = makeDrawEnv(context);
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (size.w !== w || size.h !== h || canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      size.w = w;
      size.h = h;
    }
    try {
      player.draw(envRef.current, t, { w, h, dpr });
    } catch (error) {
      console.warn("stage: draw failed", error);
    }
  });
  return (
    <div className={css.stageWrap}>
      <canvas ref={ref} className={css.stage} role="img" aria-label={label} />
    </div>
  );
}
