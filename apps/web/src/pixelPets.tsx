/**
 * The beasts, hand-drawn and rigged (beastArt.tsx). The CC0 Dungeon Crawl
 * tiles stay wired as the fallback so an unmapped id is never a blank square,
 * but all eight shipped beasts are drawn.
 *
 * The sprite carries its gait and its own clock as data attributes and CSS
 * variables; every actual movement lives in styles.css against the `.bp-*`
 * part groups, so a wolf's head can dip while its tail keeps swinging.
 */
import { beastTile } from "./tileArt.js";
import { beastMotion, drawBeast, hasBeastArt } from "./beastArt.js";

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
  const m = beastMotion(beastId);
  // Facing and felled live on a wrapper, never on the sprite itself. CSS
  // animations beat inline styles, so a transform on the sprite would be
  // silently eaten by the idle loop.
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
          data-gait={m.gait}
          data-beast={beastId}
          style={
            {
              "--idle": m.idle,
              "--sway": m.sway,
              "--reach": `${m.reach}px`,
            } as React.CSSProperties
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
}
