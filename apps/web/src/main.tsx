/**
 * SEAM FILE (work package 0). Only the Lead edits it, at integration points.
 *   G0 (now): a placeholder page that draws the capsule rig through the two seam files.
 *   I1: mounts the debug routes.  I2: mounts app/App.tsx.
 */
import { StrictMode, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { makeDrawEnv } from "./seams/canvas";
import { rig } from "./seams/rig";

const STAGE_W = 360;
const STAGE_H = 240;

/** Two capsule figures idling on the Yard. It proves the rig seam in a browser and nothing more. */
function Preview() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round((canvas.clientWidth * dpr * STAGE_H) / STAGE_W);
    const env = makeDrawEnv(context);
    const started = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const t = now - started;
      try {
        context.setTransform(canvas.width / STAGE_W, 0, 0, canvas.width / STAGE_W, 0, 0);
        rig.drawYard(env, "back", 0);
        rig.drawYard(env, "floor", 0);
        rig.drawActor(env, rig.samplePose("scrapper", "idle", t), { held: "pipe", door: false, scale: 1 }, { x: 70, y: 195, facing: 1 });
        rig.drawActor(env, rig.samplePose("scrapper", "idle", t + 500), { held: null, door: false, scale: 1 }, { x: 290, y: 195, facing: -1 });
      } catch (error) {
        console.warn("placeholder preview failed", error);
        return;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ width: "100%", maxWidth: 390, aspectRatio: "3 / 2", border: "3px solid #14152B", borderRadius: 14, background: "#262A57" }}
    />
  );
}

function Placeholder() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeContent: "center",
        justifyItems: "center",
        gap: 12,
        padding: 16,
        textAlign: "center",
        background: "#1B1E3F",
        color: "#F4F5FA",
        font: "600 16px/1.4 system-ui, sans-serif",
      }}
    >
      <h1 style={{ margin: 0, font: "900 44px/1 system-ui, sans-serif", letterSpacing: "0.04em" }}>RANK ZERO</h1>
      <p style={{ margin: 0 }}>Name a scrapper. Watch them fight.</p>
      <Preview />
      <p style={{ margin: 0, color: "#C9CCE0", fontWeight: 400 }}>The Yard is being rebuilt. Nothing to play yet.</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Placeholder />
  </StrictMode>,
);
