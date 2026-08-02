/**
 * UI icons, drawn as pixel art on a grid.
 *
 * The interface shares the game's pixel language instead of borrowing emoji,
 * which never match each other (or the art) across platforms. Each icon is an
 * ASCII grid: '#' is a filled cell, anything else is empty.
 */

const px = (rows: string[]) => rows;

export const ICONS = {
  /** Vigor — one fight's worth of energy. */
  bolt: px([
    "...##",
    "..##.",
    ".###.",
    "####.",
    ".####",
    "..##.",
    ".##..",
    "##...",
  ]),
  /** Sound on. */
  speaker: px([
    "....##....",
    "...###....",
    "..####.#..",
    "######..#.",
    "######..#.",
    "..####.#..",
    "...###....",
    "....##....",
  ]),
  /** Sound off. */
  speakerOff: px([
    "....##....",
    "...###....",
    "..#####.#.",
    "######.#..",
    "#######.#.",
    "..####....",
    "...###....",
    "....##....",
  ]),
  /** Fight. */
  swords: px([
    "#.......#",
    ".#.....#.",
    "..#...#..",
    "...#.#...",
    "....#....",
    "...#.#...",
    "..#...#..",
    ".##...##.",
    "##.....##",
  ]),
  /** Task complete. */
  check: px([
    "......##",
    ".....##.",
    "#...##..",
    "##.##...",
    ".####...",
    "..##....",
  ]),
  /** Reroll the look. */
  dice: px([
    "#######",
    "#.....#",
    "#.#.#.#",
    "#..#..#",
    "#.#.#.#",
    "#.....#",
    "#######",
  ]),
  /** Rating / rank. */
  star: px([
    "...#...",
    "..###..",
    "#######",
    ".#####.",
    "..###..",
    ".##.##.",
    "##...##",
  ]),
  /** Back. */
  arrowLeft: px([
    "..#....",
    ".##....",
    "##.....",
    "#######",
    "##.....",
    ".##....",
    "..#....",
  ]),
  chevronUp: px([
    "...#...",
    "..###..",
    ".##.##.",
    "##...##",
  ]),
  chevronDown: px([
    "##...##",
    ".##.##.",
    "..###..",
    "...#...",
  ]),
  /** Gear found. */
  loot: px([
    ".#####.",
    "#######",
    "#.###.#",
    "#######",
    "#..#..#",
    "#..#..#",
    "#######",
  ]),
} as const;

export type IconName = keyof typeof ICONS;

/** Render a pixel-grid icon at any size — cells stay square and crisp. */
export function PixIcon({
  name,
  size = 14,
  className,
}: {
  name: IconName;
  /** height of one grid cell in px (the icon scales from it) */
  size?: number;
  className?: string;
}) {
  const grid = ICONS[name];
  const h = grid.length;
  const w = grid[0]!.length;
  const cells: React.ReactNode[] = [];
  grid.forEach((row, y) => {
    // merge runs of filled cells into one rect — fewer nodes, same pixels
    let run = 0;
    for (let x = 0; x <= w; x++) {
      if (row[x] === "#") {
        run++;
        continue;
      }
      if (run > 0) {
        cells.push(<rect key={`${y}-${x}`} x={x - run} y={y} width={run} height={1} />);
        run = 0;
      }
    }
  });
  return (
    <svg
      className={`pix-icon ${className ?? ""}`}
      viewBox={`0 0 ${w} ${h}`}
      width={(size * w) / h}
      height={size}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden
      focusable="false"
    >
      {cells}
    </svg>
  );
}
