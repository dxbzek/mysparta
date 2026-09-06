/**
 * The beasts, hand-drawn in the arsenal's idiom (beastArt.tsx). The CC0
 * Dungeon Crawl tiles stay wired as the fallback so an unmapped id is never a
 * blank square, but all eight shipped beasts are drawn now.
 */
import { beastTile } from "./tileArt.js";
import { drawBeast, hasBeastArt } from "./beastArt.js";

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
  const drawn = hasBeastArt(beastId);
  // Tiles only scale by whole numbers; the drawings take any size. Snap only
  // when we are actually showing a tile.
  const px = drawn ? size : 32 * Math.max(1, Math.round(size / 32));
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
      {drawn ? (
        <svg
          className="pet-sprite cartoon-art"
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
}
