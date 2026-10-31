/**
 * The beasts on the stage and in the UI.
 *
 * Three sources, in order: the generated art (beastImages.ts — one coherent
 * set produced in ComfyUI from a single approved reference), the hand-drawn
 * vector rig (beastArt.tsx) for anything not generated, and the CC0 tile as
 * the last resort so an unmapped id is never a blank square.
 *
 * The generated art is a flat image, so the per-part rig cannot drive it.
 * It gets the whole-sprite idle instead, still on the beast's own clock from
 * BEAST_MOTION, so three beasts on a stage do not move as one object.
 */
import type React from "react";
import { beastTile } from "./tileArt.js";
import { beastMotion, drawBeast, hasBeastArt } from "./beastArt.js";
import { beastImage, hasBeastImage } from "./beastImages.js";

export function PetSprite({
  beastId,
  size,
  mirror = false,
  down = false,
}: {
  beastId: string;
  size: number;
  mirror?: boolean;
  /** felled: greyed and tipped over */
  down?: boolean;
}) {
  const m = beastMotion(beastId);
  const art = hasBeastImage(beastId);
  const drawn = !art && hasBeastArt(beastId);
  // A tile only scales by whole numbers; art and drawings take any size.
  const px = art || drawn ? size : 32 * Math.max(1, Math.round(size / 32));

  const holder = (
    <span
      className="pet-holder"
      style={{
        width: px,
        height: px,
        transform: `${mirror ? "scaleX(-1) " : ""}${down ? "rotate(78deg)" : ""}`,
        filter: down ? "grayscale(0.85) brightness(0.8)" : undefined,
      }}
    >
      {art ? (
        <img
          className="pet-sprite pet-art"
          data-gait={m.gait}
          data-beast={beastId}
          style={{ "--idle": m.idle, "--sway": m.sway } as React.CSSProperties}
          src={beastImage(beastId)}
          width={px}
          height={px}
          alt=""
          aria-hidden
          draggable={false}
        />
      ) : drawn ? (
        <svg
          className="pet-sprite cartoon-art"
          data-gait={m.gait}
          data-beast={beastId}
          style={
            { "--idle": m.idle, "--sway": m.sway, "--reach": `${m.reach}px` } as React.CSSProperties
          }
          viewBox="0 0 32 32"
          width={px}
          height={px}
          aria-hidden
          focusable="false"
        >
          {drawBeast(beastId)}
        </svg>
      ) : (
        <img
          className="pet-sprite tile-art"
          src={beastTile(beastId)}
          width={px}
          height={px}
          alt=""
          aria-hidden
          draggable={false}
        />
      )}
    </span>
  );

  return holder;
}
