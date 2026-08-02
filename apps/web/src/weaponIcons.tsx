/**
 * One drawn icon per weapon — not per discipline.
 *
 * Twenty-five weapons sharing six pictures meant the Doru, the Sarissa, the
 * Trident and the Boar Spear were the same object with different words next
 * to it. Each weapon now has its own silhouette: the Sarissa is a pike, the
 * Kopis curves forward, the Pelte has its crescent, the Tower of Dikte is a
 * wall. Discipline keys are kept as a fallback so nothing can render blank.
 *
 * Every grid is 16x16. Characters pick a colour:
 *   #  body     o  outline     *  highlight     h  haft/wood     l  binding
 */

const ART: Record<string, string[]> = {
  /* ------------------------------- spears -------------------------------- */
  doru: [
    ".......oo.......",
    "......o##o......",
    ".....o#**#o.....",
    ".....o#**#o.....",
    ".....o#**#o.....",
    "......o##o......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    "......o##o......",
    ".......##.......",
    ".......oo.......",
  ],
  // A pike, not a spear: a needle of a head on a shaft that never ends.
  sarissa: [
    ".......oo.......",
    ".......##.......",
    ".......##.......",
    ".......hh.......",
    ".......hh.......",
    "......oooo......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    "......oooo......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    "......o##o......",
  ],
  trident: [
    "..#....##....#..",
    "..#....##....#..",
    "..#....##....#..",
    "..#....##....#..",
    "..#....##....#..",
    "..#....##....#..",
    "..##...##...##..",
    "...##########...",
    "...oooooooooo...",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    "......o##o......",
  ],
  boar_spear: [
    ".......oo.......",
    "......o##o......",
    ".....o#**#o.....",
    ".....o#**#o.....",
    "......o##o......",
    ".......hh.......",
    "..oo...hh...oo..",
    ".o##ooo##ooo##o.",
    "..oo...hh...oo..",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    "......o##o......",
    "................",
  ],

  /* ------------------------------- blades -------------------------------- */
  xiphos: [
    ".......oo.......",
    "......o##o......",
    "......o##o......",
    ".....o#**#o.....",
    ".....o#**#o.....",
    ".....o#**#o.....",
    ".....o#**#o.....",
    ".....o#**#o.....",
    "......o##o......",
    "....oo####oo....",
    "....oohhhhoo....",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    "......o##o......",
    "................",
  ],
  // Forward-curving chopper: the spine stays straight, the edge bellies out.
  kopis: [
    ".........oo.....",
    "........o#o.....",
    ".......o##o.....",
    "......o###o.....",
    ".....o####o.....",
    ".....o####o.....",
    "....o#####o.....",
    "....o#####o.....",
    ".....o####o.....",
    "......o###o.....",
    ".......o##o.....",
    ".......ohho.....",
    ".......ohho.....",
    ".......ohho.....",
    ".......oooo.....",
    "................",
  ],
  makhaira: [
    "......oo........",
    "......o#o.......",
    "......o#o.......",
    "......o#*o......",
    "......o#*o......",
    "......o#*o......",
    "......o#*o......",
    "......o#*o......",
    "......o#*o......",
    ".....oo##oo.....",
    ".....oohhoo.....",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    "......o##o......",
    "................",
  ],
  twin_xiphoi: [
    "oo............oo",
    "o#o..........o#o",
    ".o#o........o#o.",
    "..o#o......o#o..",
    "...o#o....o#o...",
    "....o#o..o#o....",
    ".....o#oo#o.....",
    "......o##o......",
    ".....o#oo#o.....",
    "....o#o..o#o....",
    "...ohh....hho...",
    "..ohh......hho..",
    ".ohh........hho.",
    ".oo..........oo.",
    "................",
    "................",
  ],

  /* -------------------------------- fists -------------------------------- */
  fists: [
    "................",
    "...oo.oo.oo.oo..",
    "..ollollollollo.",
    "..olllllllllllo.",
    ".olllllllllllllo",
    ".olollollollollo",
    ".olllllllllllllo",
    ".olllllllllllllo",
    "ollollllllllllo.",
    "olllolllllllllo.",
    "ollllllllllllo..",
    ".olllllllllllo..",
    "..ollllllllllo..",
    "...oooooooooo...",
    "................",
    "................",
  ],
  cestus: [
    "................",
    "...oo.oo.oo.oo..",
    "..ollollollollo.",
    "..olllllllllllo.",
    ".ooooooooooooooo",
    ".olllllllllllllo",
    ".ooooooooooooooo",
    ".olllllllllllllo",
    "ollollllllllllo.",
    "ooooooooooooooo.",
    "ollllllllllllo..",
    ".ooooooooooooo..",
    "..ollllllllllo..",
    "...oooooooooo...",
    "................",
    "................",
  ],
  iron_cestus: [
    "................",
    "...oo.oo.oo.oo..",
    "..ollollollollo.",
    "..o***o***o***o.",
    ".olllllllllllllo",
    ".o*o*o*o*o*o*o*o",
    ".olllllllllllllo",
    ".o*o*o*o*o*o*o*o",
    "ollollllllllllo.",
    "olllllllllllllo.",
    "ollll*****lllo..",
    "ollll*****lllo..",
    ".olllllllllllo..",
    "..ollllllllllo..",
    "...oooooooooo...",
    "................",
  ],
  // Weighted balls swinging off the wraps.
  sphairai: [
    "................",
    "....oo....oo....",
    "...o##o..o##o...",
    "..o#**#oo#**#o..",
    "..o####oo####o..",
    "...o##o..o##o...",
    "....oo....oo....",
    ".....l....l.....",
    "......l..l......",
    ".......ll.......",
    "....########....",
    "...#llllllll#...",
    "...#llllllll#...",
    "....########....",
    "................",
    "................",
  ],
  // Thongs wound the whole way up the forearm.
  himantes: [
    "................",
    "....########....",
    "...#llllllll#...",
    "...#oooooooo#...",
    "...#llllllll#...",
    "...#oooooooo#...",
    "...#llllllll#...",
    "...#oooooooo#...",
    "...#llllllll#...",
    "...#oooooooo#...",
    "...#llllllll#...",
    "....########....",
    ".....l....l.....",
    "....l......l....",
    "...l........l...",
    "................",
  ],

  /* --------------------------------- axes -------------------------------- */
  labrys: [
    "...oo......oo...",
    "..o##oo..oo##o..",
    ".o#*##o..o##*#o.",
    "o#*###o..o###*#o",
    "o#*###ohho###*#o",
    "o#*###ohho###*#o",
    ".o#*##ohho##*#o.",
    "..o##oohhoo##o..",
    "...oo..ohho..oo.",
    ".......ohho.....",
    ".......ohho.....",
    ".......ohho.....",
    ".......ohho.....",
    ".......ohho.....",
    ".......oooo.....",
    "................",
  ],
  // One enormous slab instead of two blades.
  minoan_crusher: [
    "................",
    ".##############.",
    "#**##########**#",
    "#**##########**#",
    "#**##########**#",
    "#**##########**#",
    "#**##########**#",
    ".##############.",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    "......o##o......",
    "................",
  ],
  // The light twin: narrow blades, quick haft.
  bipennis: [
    "................",
    ".oo..........oo.",
    "o##o........o##o",
    "o#*#o......o#*#o",
    "o#*#oo.hh.oo#*#o",
    "o#*#oo.hh.oo#*#o",
    "o#*#o..hh..o#*#o",
    ".o#o...hh...o#o.",
    "..o....hh....o..",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    "......o##o......",
    "................",
  ],
  // No metal on it anywhere.
  olive_root_club: [
    "....######......",
    "...########.....",
    "..###o#####.....",
    "..######o##.....",
    "..#o#######.....",
    "..#####o###.....",
    "...#######......",
    "....#####.......",
    ".....###........",
    ".....###........",
    ".....###........",
    ".....###........",
    ".....###........",
    "....#####.......",
    "....#####.......",
    "................",
  ],

  /* -------------------------------- thrown ------------------------------- */
  // The loop is the whole point of an akontion.
  akontion: [
    ".......oo.......",
    "......o##o......",
    "......o##o......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    "....ooohh.......",
    "...o..ohh.......",
    "...o..ohh.......",
    "....ooohh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    "......o##o......",
  ],
  kestros: [
    ".......oo.......",
    "......o##o......",
    "......o##o......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    "....oo.hh.oo....",
    "...o#o.hh.o#o...",
    "..o#o..hh..o#o..",
    "..o#...hh...#o..",
    ".......hh.......",
    "................",
  ],
  discus: [
    "................",
    "................",
    "................",
    "................",
    "...oooooooooo...",
    ".oo##########oo.",
    "o##**********##o",
    "o#*############o",
    "o##**********##o",
    ".oo##########oo.",
    "...oooooooooo...",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  peltast_blades: [
    "..o.....o.....o.",
    ".o#o...o#o...o#o",
    ".o#o...o#o...o#o",
    ".o#o...o#o...o#o",
    ".o#o...o#o...o#o",
    ".o#o...o#o...o#o",
    ".o#o...o#o...o#o",
    ".o#o...o#o...o#o",
    ".o#o...o#o...o#o",
    ".oho...oho...oho",
    ".oho...oho...oho",
    ".oho...oho...oho",
    ".oho...oho...oho",
    ".ooo...ooo...ooo",
    "................",
    "................",
  ],

  /* ------------------------------- shields ------------------------------- */
  aspis: [
    "................",
    ".....oooooo.....",
    "...oo######oo...",
    "..o##########o..",
    ".o############o.",
    "o######**######o",
    "o#####**#**####o",
    "o####**###**###o",
    "o###**#####**##o",
    "o##**#######**#o",
    "o##############o",
    ".o############o.",
    "..o##########o..",
    "...oo######oo...",
    ".....oooooo.....",
    "................",
  ],
  // The crescent is what makes a pelte a pelte.
  pelte: [
    "................",
    ".o##o......o##o.",
    "o####o....o####o",
    "o#####o..o#####o",
    "o######oo######o",
    "o##############o",
    "o####******####o",
    "o##############o",
    "o##############o",
    ".o############o.",
    "..o##########o..",
    "...o########o...",
    "....o######o....",
    ".....oo##oo.....",
    "................",
    "................",
  ],
  tower_of_dikte: [
    "..############..",
    "..#####**#####..",
    "..#####**#####..",
    "..#####**#####..",
    "..#####**#####..",
    "..#####**#####..",
    "..#####**#####..",
    "..#####**#####..",
    "..#####**#####..",
    "..#####**#####..",
    "..#####**#####..",
    "..#####**#####..",
    "..#####**#####..",
    "..############..",
    "................",
    "................",
  ],
  spiked_aspis: [
    "..o....oo....o..",
    "...o...##...o...",
    "...oo######oo...",
    "..o##########o..",
    "o.o##########o.o",
    ".o####****####o.",
    "oo###*####*###oo",
    ".o###*####*###o.",
    ".o####****####o.",
    "o.o##########o.o",
    "..o##########o..",
    "...oo######oo...",
    "...o...##...o...",
    "..o....oo....o..",
    "................",
    "................",
  ],
};

/* Discipline keys keep older call sites working. */
ART["cestus"] = ART["fists"]!;
ART["akontia"] = ART["akontion"]!;

const TONES: Record<string, { body: string; dark: string; light: string; haft: string; wrap: string }> = {
  steel: { body: "#8d95a6", dark: "#2f2a22", light: "#dfe6f0", haft: "#8a5a2e", wrap: "#96652f" },
  bronze: { body: "#b07f34", dark: "#241c14", light: "#f4d68e", haft: "#6b3f1c", wrap: "#96652f" },
  leather: { body: "#241c14", dark: "#241c14", light: "#f0cd95", haft: "#5a3418", wrap: "#d09a55" },
  wood: { body: "#c89058", dark: "#2b1a0c", light: "#e8bd84", haft: "#c89058", wrap: "#96652f" },
};

/** Metal is not uniform: bronze for the thrown and the shields, steel for the
 *  edged, leather for the fists, and the club is only ever wood. */
const TONE_FOR: Record<string, keyof typeof TONES> = {
  doru: "steel", sarissa: "steel", trident: "bronze", boar_spear: "steel",
  xiphos: "steel", kopis: "steel", makhaira: "steel", twin_xiphoi: "steel",
  fists: "leather", cestus: "leather", iron_cestus: "steel", sphairai: "bronze", himantes: "leather",
  labrys: "steel", minoan_crusher: "bronze", bipennis: "steel", olive_root_club: "wood",
  akontion: "bronze", kestros: "bronze", discus: "bronze", peltast_blades: "steel",
  aspis: "bronze", pelte: "bronze", tower_of_dikte: "steel", spiked_aspis: "bronze",
  akontia: "bronze",
};

export type Discipline = "xiphos" | "doru" | "cestus" | "labrys" | "akontia" | "aspis";

/** `d` takes a weapon id first, then a discipline. */
export function WeaponIcon({
  d,
  size = 18,
  className,
}: {
  d: Discipline | "fists" | string;
  size?: number;
  className?: string;
}) {
  const grid = ART[d] ?? ART.xiphos!;
  const tone = TONES[TONE_FOR[d] ?? "steel"]!;
  const colours: Record<string, string> = {
    "#": tone.body,
    o: tone.dark,
    "*": tone.light,
    h: tone.haft,
    l: tone.wrap,
  };
  const h = grid.length;
  const w = grid[0]!.length;
  const cells: React.ReactNode[] = [];
  grid.forEach((row, y) => {
    let run = 0;
    let ch = "";
    for (let x = 0; x <= w; x++) {
      const c = row[x] ?? ".";
      if (c === ch && colours[c]) {
        run++;
        continue;
      }
      if (run > 0 && colours[ch]) {
        cells.push(<rect key={`${y}-${x}-${ch}`} x={x - run} y={y} width={run} height={1} fill={colours[ch]} />);
      }
      ch = c;
      run = colours[c] ? 1 : 0;
    }
  });
  return (
    <svg
      className={`weapon-icon ${className ?? ""}`}
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden
      focusable="false"
    >
      {cells}
    </svg>
  );
}
