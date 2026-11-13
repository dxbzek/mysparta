/**
 * Dev-only pose sheet for the puppet sample: every clip side by side, frozen
 * at `?t=` (0-1 of each clip). Served by `vite` at /puppet-lab.html; not part
 * of the build (vite builds index.html only). Used to look at each pose
 * before it goes on the stage.
 */
import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_LOOK, type Look } from "./paperdoll.js";
import { PuppetFig } from "./puppet.js";
import { CLIP_MS, type PuppetClip } from "./puppetClips.js";

const q = new URLSearchParams(location.search);
const t = Number(q.get("t") ?? "0");
const weapon = q.get("w") ?? "xiphos";
const disc = q.get("d") ?? "xiphos";
const size = Number(q.get("h") ?? "180");
const clips = (q.get("c") ?? "idle,run,chop,thrust,jab,throw,ready,cast,hit,dodge,duck,block,ko,win").split(",") as PuppetClip[];
const look: Look = { ...DEFAULT_LOOK, ...(q.get("look") ? JSON.parse(q.get("look")!) : {}) };
const dur: Record<string, number> = {
  idle: CLIP_MS.idle, run: CLIP_MS.enter, chop: CLIP_MS.strike, thrust: CLIP_MS.strike, jab: CLIP_MS.riposte,
  throw: CLIP_MS.throw, ready: CLIP_MS.ready, cast: CLIP_MS.cast, hit: CLIP_MS.hurt, dodge: CLIP_MS.dodge,
  duck: CLIP_MS.dodge, block: CLIP_MS.block, ko: CLIP_MS.ko, win: CLIP_MS.win,
};

function Lab() {
  useEffect(() => {
    const id = window.setTimeout(() => {
      for (const a of document.getAnimations()) {
        a.pause();
        const tm = a.effect!.getComputedTiming();
        const d = Number(tm.duration);
        a.currentTime = Math.min(d - 0.01, t * d);
      }
      document.body.dataset.ready = "1";
    }, 300);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 8, ["--spd" as string]: 1 }}>
      {clips.map((c) => (
        <div key={c} style={{ width: size * 0.9, height: size + 24, position: "relative", outline: "1px dashed #b49c6c" }}>
          <div style={{ font: "12px sans-serif", position: "absolute", top: 2, left: 4 }}>{c}</div>
          <div style={{ position: "absolute", bottom: 4, left: size * 0.2 }}>
            <PuppetFig
              look={look}
              weaponId={weapon}
              discipline={disc}
              height={size}
              mirror={q.get("m") === "1"}
              plan={{ clip: c, durMs: dur[c] ?? 600, delayMs: 0 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Lab />);
