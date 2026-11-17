import { contentPack, createRig, gatePack } from "@rankzero/rig";
import { homeSpan } from "./src/camera";
import { drawnBox } from "./src/bounds";
import { found30, slamPlayer } from "./test/lib/slam";
const R = createRig(gatePack, contentPack);
const f = found30(70); const p = slamPlayer(f, R);
const span = homeSpan(p.tracks);
for (let t = 17500; t < 23500; t += 500) { const fr = p.frame(t); const e = fr.fx.find((x) => x.fx === "tarp"); const b2 = fr.actors.find((a) => a.id === "b2")!;
  console.log(t, "b2", b2.place.x.toFixed(1), e ? `tarp ${e.at.x.toFixed(1)} p${e.progress.toFixed(2)} size ${JSON.stringify(e.size)}` : "", "span", span.x0, span.x1); }
