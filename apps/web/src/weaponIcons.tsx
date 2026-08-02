/**
 * Weapon icons drawn as proper little pixel weapons — steel edge, dark
 * outline, wooden haft — rather than a flat silhouette. '#' is the blade or
 * head, 'o' its outline, '*' the highlight, 'h' the haft.
 */

const ART: Record<string, string[]> = {
  // Upright silhouettes: a diagonal blade smears into a smudge at 16px.
  xiphos: [
    ".......oo.......",
    "......o##o......",
    "......o#*o......",
    "......o#*o......",
    "......o#*o......",
    "......o#*o......",
    "......o#*o......",
    "......o#*o......",
    "......o##o......",
    "....oo####oo....",
    "....oohhhhoo....",
    "......ohho......",
    "......ohho......",
    "......ohho......",
    ".....oo##oo.....",
    "................",
  ],
  doru: [
    ".......oo.......",
    "......o##o......",
    ".....o#**#o.....",
    ".....o#**#o.....",
    "......o##o......",
    "......ohho......",
    "......ohho......",
    "......ohho......",
    "......ohho......",
    "......ohho......",
    "......ohho......",
    "......ohho......",
    "......ohho......",
    "......ohho......",
    "......oooo......",
    "................",
  ],
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
  cestus: [
    "................",
    ".....oooo.......",
    "....o####oo.....",
    "...o##*###*#o...",
    "..o####o####o...",
    ".o##*##o##*##o..",
    ".o#####o#####o..",
    ".ohhhhhhhhhhho..",
    ".o###########o..",
    ".ohhhhhhhhhhho..",
    ".o##*#####*##o..",
    "..o#########o...",
    "...ooooooooo....",
    "................",
    "................",
    "................",
  ],
  akontia: [
    ".......oo.......",
    "......o##o......",
    "......o#*o......",
    "......o##o......",
    ".......oo.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......hh.......",
    ".......oo.......",
    "................",
  ],
  aspis: [
    "....oooooooo....",
    "..oo########oo..",
    ".o##########o#o.",
    "o###oo####oo###o",
    "o##o##oo##o##o#o",
    "o#o#o#**#o#o#o#o",
    "o#o#o*##*o#o#o#o",
    "o#o#o*##*o#o#o#o",
    "o#o#o#**#o#o#o#o",
    "o##o##oo##o##o#o",
    "o###oo####oo###o",
    ".o##########o#o.",
    "..oo########oo..",
    "....oooooooo....",
    "................",
    "................",
  ],
};

ART.fists = ART.cestus!;

const TONES: Record<string, { body: string; dark: string; light: string; haft: string }> = {
  steel: { body: "#8d95a6", dark: "#2f2a22", light: "#dfe6f0", haft: "#8a5a2e" },
  bronze: { body: "#b07f34", dark: "#241c14", light: "#f4d68e", haft: "#6b3f1c" },
  leather: { body: "#96652f", dark: "#241c14", light: "#e0b878", haft: "#5a3418" },
};

const TONE_FOR: Record<string, keyof typeof TONES> = {
  xiphos: "steel",
  doru: "steel",
  labrys: "steel",
  akontia: "bronze",
  aspis: "bronze",
  cestus: "leather",
  fists: "leather",
};

export type Discipline = "xiphos" | "doru" | "cestus" | "labrys" | "akontia" | "aspis";

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
