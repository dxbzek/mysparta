/**
 * A skill as a plaque: a coloured bevel by kind, with a 32px CC0 tile from
 * Dungeon Crawl Stone Soup inside it (see docs/CREDITS.md, src/tileArt.ts).
 * The bevel colour is the game's own — olive boons, amber techniques, gold
 * trumps — so the kind still reads before the picture does.
 */
import { skillTile } from "./tileArt.js";

export type SkillKind = "boon" | "technique" | "trump";

export function SkillIcon({
  id,
  kind,
  size = 32,
  title,
}: {
  id: string;
  kind: SkillKind;
  size?: number;
  title?: string;
}) {
  // The plaque takes whatever size the caller asked for; the art inside can
  // only ever be a whole multiple of its own 32px, so it snaps and centres.
  const art = size >= 56 ? 64 : 32;
  return (
    <span className={`skill-tile tile-${kind}`} style={{ width: size, height: size }} title={title}>
      <img
        className="tile-art"
        src={skillTile(id)}
        width={art}
        height={art}
        alt=""
        aria-hidden
        draggable={false}
      />
    </span>
  );
}
