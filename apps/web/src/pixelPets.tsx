/**
 * Pets, drawn as pixel sprites.
 *
 * The beasts used to be vector shapes, which read as a different game sitting
 * next to the sprite fighters. Each one is now an ASCII grid on the same pixel
 * language as the rest of the art: '#' body, 'o' outline, '*' accent (mane,
 * wing, shell), 'e' eye, '.' empty. Sprites face right; the stage mirrors the
 * right-hand side.
 */

interface PetArt {
  grid: string[];
  body: string;
  dark: string;
  accent: string;
  /** size multiplier — a tortoise should not loom like a boar */
  scale: number;
}

const PETS: Record<string, PetArt> = {
  // Ōkami — lean wolf, pricked ears, plumed tail
  lykos: {
    grid: [
      "..............o.",
      "..*.........oo#o",
      ".***.......o###o",
      ".***ooooooo####o",
      "..**###########o",
      "...o#########e#o",
      "...o###########o",
      "....o########oo.",
      "....#o#..#o#....",
      "....#.#..#.#....",
      "....o.o..o.o....",
      "................",
    ],
    body: "#8e8a7d", dark: "#3b3833", accent: "#b9b3a2", scale: 1,
  },
  // Karasu — crow mid-hop, folded wing, long beak
  stymphal_shrike: {
    grid: [
      "................",
      "..........ooo...",
      ".......ooo###o..",
      "....ooo######e#o",
      "..oo####*#####oo",
      ".o###**##*###o..",
      ".o##**###*##o...",
      "..o**#####o.....",
      "...oo####o......",
      ".....o#o#o......",
      ".....o.o.o......",
      "................",
    ],
    body: "#3a3f52", dark: "#191c26", accent: "#5d6478", scale: 0.9,
  },
  // Inoshishi — heavy boar, tusks, bristled spine
  kalydon_boar: {
    grid: [
      "................",
      "....*..*..*.....",
      "..o*#**#**#o....",
      ".o############o.",
      "o##############o",
      "o#############e#",
      "o##############o",
      ".o###########ooo",
      "..o#######o.o*o.",
      "..#o#..#o#......",
      "..o.o..o.o......",
      "................",
    ],
    body: "#6b5342", dark: "#2f251d", accent: "#a08a6d", scale: 1.05,
  },
  // Komainu — stocky shrine lion, heavy mane
  nemean_cub: {
    grid: [
      "................",
      "..........**....",
      ".......o**##**o.",
      "....ooo*#####*#o",
      "..oo####*###e##o",
      ".o#######*#####o",
      ".o########*###oo",
      "..o#########*o..",
      "...#o#...#o#....",
      "...#.#...#.#....",
      "...o.o...o.o....",
      "................",
    ],
    body: "#c69a52", dark: "#4a361a", accent: "#f0c878", scale: 1,
  },
  // Kitsune — slim fox, huge brush of a tail
  ember_fox: {
    grid: [
      "..**..........o.",
      ".*****......oo#o",
      ".******....o###o",
      "..*****oooo####o",
      "...***#########o",
      "....o########e#o",
      "....o##########o",
      ".....o#######ooo",
      ".....#o#..#o#...",
      ".....#.#..#.#...",
      ".....o.o..o.o...",
      "................",
    ],
    body: "#d4722e", dark: "#4a2410", accent: "#f2a552", scale: 0.95,
  },
  // Fukurō — perched owl, wide face, tufted brows
  bronze_owl: {
    grid: [
      "................",
      "....o*....*o....",
      "...o##****##o...",
      "...o#e#**#e#o...",
      "...o###**###o...",
      "..o####**####o..",
      "..o##*#**#*##o..",
      "..o#*##**##*#o..",
      "...o##****##o...",
      "....oo####oo....",
      ".....o#..#o.....",
      "................",
    ],
    body: "#9a7b3f", dark: "#3a2c14", accent: "#d8b264", scale: 0.92,
  },
  // Oni Pup — twin-headed hound, one horn apiece
  kerberos_pup: {
    grid: [
      "..........o...o.",
      "..*......o#o.o#o",
      ".***....o###o##o",
      ".***ooooo##e#e#o",
      "..**###########o",
      "...o###########o",
      "...o##########oo",
      "....o########o..",
      "....#o#..#o#....",
      "....#.#..#.#....",
      "....o.o..o.o....",
      "................",
    ],
    body: "#5b3a52", dark: "#241621", accent: "#a05f86", scale: 1,
  },
  // Kame — domed shell, slow and patient
  marble_tortoise: {
    grid: [
      "................",
      "................",
      "......oooo......",
      "....oo****oo....",
      "..oo**####**oo..",
      ".o**##****##**o.",
      "o#**########**#o",
      "o##############o",
      ".oo##########oo.",
      "..o#o..o..o#o.o.",
      "..o.o..o..o.o...",
      "................",
    ],
    body: "#7d8a6a", dark: "#2c3323", accent: "#b3c095", scale: 0.9,
  },
};

const FALLBACK = PETS.lykos!;

/** A pet on the stage or in a chip — same grid, any size. */
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
  const art = PETS[beastId] ?? FALLBACK;
  const grid = art.grid;
  const h = grid.length;
  const w = grid[0]!.length;
  const colours: Record<string, string> = {
    "#": art.body,
    o: art.dark,
    "*": art.accent,
    e: "#fdf6dd",
  };

  const cells: React.ReactNode[] = [];
  grid.forEach((row, y) => {
    let run = 0;
    let ch = "";
    for (let x = 0; x <= w; x++) {
      const c = row[x] ?? ".";
      if (c === ch && c !== ".") {
        run++;
        continue;
      }
      if (run > 0 && ch !== ".") {
        cells.push(
          <rect key={`${y}-${x}-${ch}`} x={x - run} y={y} width={run} height={1} fill={colours[ch] ?? art.body} />,
        );
      }
      ch = c;
      run = c === "." ? 0 : 1;
    }
  });

  const px = Math.round(size * art.scale);
  return (
    <svg
      className="pet-sprite"
      viewBox={`0 0 ${w} ${h}`}
      width={px}
      height={Math.round((px * h) / w)}
      shapeRendering="crispEdges"
      aria-hidden
      focusable="false"
      style={{
        transform: `${mirror ? "scaleX(-1) " : ""}${down ? "rotate(78deg)" : ""}`,
        filter: down ? "grayscale(0.85) brightness(0.8)" : undefined,
      }}
    >
      {cells}
    </svg>
  );
}
