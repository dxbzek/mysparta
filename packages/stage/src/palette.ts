/**
 * The few colours the stage paints itself (numbers, stickers, banners). Named after the brief's
 * colour words. The rig owns the colours of everything it draws; when the rig seam exports a
 * palette, these should be read from it instead (see the WP3 handoff).
 */
export const INK = "#14152B";          // Night Ink: every outline
export const WHITE = "#FFFFFF";
export const PAPER = "#F4F5FA";
export const VOLT = "#FFD23F";         // Volt Yellow: crits, the Haymaker
export const TEAL = "#22D3B6";         // the Whistle's rings
export const GREEN = "#5BD66F";        // heals: the number, the ring, Second Wind's breath
export const CORAL = "#FF5A4E";        // the HP trail, overtime
export const SKY = "#7FB7FF";          // skill tags
/** Each Move's signature colour on the stage (sigs.ts): no two the same. */
export const SIG_COLOUR = {
  haymaker: "#FFD23F", "energy-drink": "#B6F24A", tarp: "#4FA3FF", whistle: "#22D3B6", firecrackers: "#FF7A2E",
  snatch: "#FFF07A", "air-horn": "#FFFFFF", "body-slam": "#E0603A", "sand-in-the-eyes": "#D8B26E", taunt: "#FF4D6D",
  "second-wind": "#5BD66F", grapple: "#C77DFF",
} as const;
