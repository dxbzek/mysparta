/**
 * Talent node icons (content v3, batch 3): every node has its own icon in the content pack, a frame
 * (a hex nut in its branch tone, a yellow burst for a capstone) and a pictogram, and `rig.icon`
 * draws it instead of the plain ring of a missing icon. No two nodes share a drawing.
 */
import { describe, expect, it } from "vitest";
import { TALENT_IDS, TALENT_META } from "@rankzero/core";
import { createRig } from "../../src/engine/createRig";
import { contentPack } from "../../src/content/pack";
import { gatePack } from "../../src/gate/pack";
import { BRANCH_TONE, FRAME_PARTS } from "../../src/content/icons";

describe("talent icons", () => {
  const rig = createRig(gatePack, contentPack);
  it("every node has a framed icon in its branch tone, and every drawing is its own", () => {
    const seen = new Set<string>();
    for (const id of TALENT_IDS) {
      const art = contentPack.icons[`talent:${id}`];
      expect(art, id).toBeDefined();
      expect(art.shapes.length, id).toBeGreaterThan(FRAME_PARTS);
      const tone = TALENT_META[id].tier === 3 ? "yellow" : BRANCH_TONE[TALENT_META[id].branch];
      expect(art.shapes[0]!.slot, id).toBe(tone);
      const pic = JSON.stringify(art.shapes.slice(FRAME_PARTS));
      expect(seen.has(pic), id).toBe(false);
      seen.add(pic);
    }
  });
  it("rig.icon draws a talent, not the plain ring of a missing icon", () => {
    const ring = JSON.stringify(rig.icon("ui:nothing" as never));
    for (const id of TALENT_IDS) expect(JSON.stringify(rig.icon(`talent:${id}`)), id).not.toBe(ring);
  });
});
