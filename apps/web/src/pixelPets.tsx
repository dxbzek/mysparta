/**
 * The beasts, as 32px CC0 creature tiles from Dungeon Crawl Stone Soup (see
 * docs/CREDITS.md, src/tileArt.ts). They stand next to LPC paper dolls on the
 * fight stage, which is exactly why they are real tiles now rather than the
 * hand-drawn grids that used to live here.
 */
import { beastTile } from "./tileArt.js";

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
  // 32px tiles only scale by whole numbers; snap to the nearest one so a
  // caller asking for 54 gets a crisp 64 rather than a smeared 54.
  const px = 32 * Math.max(1, Math.round(size / 32));
  // Facing and felled live on a wrapper, never on the sprite itself. CSS
  // animations beat inline styles, so the breathing loop was silently eating
  // `scaleX(-1)` and every beast on the right faced the wrong way.
  return (
    <span
      className="pet-holder"
      style={{
        width: px,
        height: px,
        transform: `${mirror ? "scaleX(-1) " : ""}${down ? "rotate(78deg)" : ""}`,
        filter: down ? "grayscale(0.85) brightness(0.8)" : undefined,
      }}
    >
      <img
        className="pet-sprite tile-art"
        src={beastTile(beastId)}
        width={px}
        height={px}
        alt=""
        aria-hidden
        draggable={false}
      />
    </span>
  );
}
