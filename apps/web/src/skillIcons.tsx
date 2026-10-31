/**
 * A skill as a plaque: a coloured bevel by kind — olive boons, amber
 * techniques, gold trumps — with the skill's own drawing inside it
 * (skillArt.tsx, drawn in the arsenal's hand). The bevel colour means the
 * kind reads before the picture does.
 *
 * The CC0 Dungeon Crawl tile stays wired as the fallback so a skill we have
 * not drawn is never a blank plaque.
 */
import { skillTile } from "./tileArt.js";
import { drawSkill, hasSkillArt } from "./skillArt.js";

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
  const drawn = hasSkillArt(id);
  // A tile can only be a whole multiple of its own 32px, so it snaps; the
  // drawing takes whatever the plaque gives it, less a little breathing room.
  const art = drawn ? Math.round(size * 0.82) : size >= 56 ? 64 : 32;
  return (
    <span className={`skill-tile tile-${kind}`} style={{ width: size, height: size }} title={title}>
      {drawn ? (
        <svg
          className="skill-art cartoon-art"
          viewBox="0 0 32 32"
          width={art}
          height={art}
          aria-hidden
          focusable="false"
        >
          {drawSkill(id)}
        </svg>
      ) : (
        <img
          className="tile-art"
          src={skillTile(id)}
          width={art}
          height={art}
          alt=""
          aria-hidden
          draggable={false}
        />
      )}
    </span>
  );
}
