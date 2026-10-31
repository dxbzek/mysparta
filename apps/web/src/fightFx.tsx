/**
 * What a skill looks like.
 *
 * Every trump and technique in the game shared one picture: a gold flare over
 * the caster and their name in a caption. Thirty skills, one effect — so
 * Wrath of Herakles, Gorgon's Glare and Bronte's Bolt were the same event with
 * different words, and the most dramatic thing a fighter can do read as a
 * subtitle. Each skill picks an effect from this vocabulary and a place to
 * play it: on the caster, or on the fighter it happens to.
 *
 * Drawn in the game's own palette, on a 64x64 box centred on the fighter, and
 * every one of them is a single SVG with CSS-driven motion — no per-frame JS,
 * so a skill firing costs a compositor pass and nothing else.
 */

export type FxKind =
  | "bolt"
  | "flame"
  | "dome"
  | "roar"
  | "chains"
  | "leap"
  | "speed"
  | "fear"
  | "rage"
  | "quake"
  | "blades"
  | "guard"
  | "thread";

/** Where the effect plays: on whoever used it, or on whoever it happened to. */
export type FxAt = "self" | "foe";

interface Spell {
  fx: FxKind;
  at: FxAt;
}

/**
 * Skill -> effect. The mapping is by what the skill DOES, not by its tier, so
 * the picture teaches the rule: anything that heals blooms, anything that
 * strikes at range throws something, anything that guards closes a shell.
 */
export const SKILL_FX: Record<string, Spell> = {
  /* trumps — the big ones */
  wrath_of_herakles: { fx: "rage", at: "self" },
  aegis_of_dawn: { fx: "dome", at: "self" },
  gorgons_glare: { fx: "fear", at: "foe" },
  chirons_mending: { fx: "guard", at: "self" },
  hermes_rush: { fx: "speed", at: "self" },
  brontes_bolt: { fx: "bolt", at: "foe" },
  cast_down: { fx: "quake", at: "foe" },
  moiras_thread: { fx: "thread", at: "self" },

  /* techniques */
  whirl_of_bronze: { fx: "blades", at: "self" },
  shield_slam: { fx: "quake", at: "foe" },
  perfect_riposte: { fx: "blades", at: "self" },
  hamstring: { fx: "chains", at: "foe" },
  second_breath: { fx: "guard", at: "self" },
  rope_and_net: { fx: "chains", at: "foe" },
  skyfall: { fx: "leap", at: "foe" },
  twin_fangs: { fx: "blades", at: "foe" },
  beasts_fury: { fx: "roar", at: "self" },
  stone_wall: { fx: "dome", at: "self" },

  /* boons that announce themselves when they fire */
  pankration: { fx: "rage", at: "self" },
  titan_grip: { fx: "guard", at: "self" },
  hoplite_drill: { fx: "dome", at: "self" },
  serpent_reflex: { fx: "speed", at: "self" },
  keen_edge: { fx: "blades", at: "self" },
  eagle_eye: { fx: "speed", at: "self" },
  winged_heels: { fx: "speed", at: "self" },
  bronze_hide: { fx: "guard", at: "self" },
  iron_wrists: { fx: "guard", at: "self" },
  marathon_lungs: { fx: "guard", at: "self" },
  beast_bond: { fx: "roar", at: "self" },
  endless_quiver: { fx: "blades", at: "self" },
};

/** A skill with no entry still gets something — never a silent trump. */
export function fxFor(skillId: string | undefined): Spell {
  return (skillId && SKILL_FX[skillId]) || { fx: "flame", at: "self" };
}

const GOLD = "#f3b64e";
const RED = "#d95f43";
const BLUE = "#7fc4f2";
const GREEN = "#8fe08a";
const VIOLET = "#b98bf0";

/**
 * The drawing. `kind` picks the shape; the CSS class `fx-<kind>` drives the
 * motion (styles.css, "skill effects"). Rendered inside the fighter's slot so
 * it travels with them.
 */
export function SkillFx({ kind }: { kind: FxKind }) {
  return (
    <span className={`skill-fx fx-${kind}`} aria-hidden>
      <svg viewBox="0 0 64 64" width="100%" height="100%">
        {kind === "bolt" && (
          <>
            <path d="M38 2 L20 30 H32 L24 62 L46 28 H33 Z" fill={GOLD} stroke="#7a4a08" strokeWidth={2} strokeLinejoin="round" />
            <path d="M36 8 L26 28 H33 L29 48" fill="none" stroke="#fff6d8" strokeWidth={2.4} strokeLinecap="round" />
          </>
        )}
        {kind === "flame" && (
          <>
            <path d="M32 6 Q44 22 40 36 Q38 48 32 58 Q26 48 24 36 Q20 22 32 6 Z" fill={RED} opacity={0.9} />
            <path d="M32 18 Q38 28 35 38 Q34 45 32 52 Q30 45 29 38 Q26 28 32 18 Z" fill={GOLD} />
          </>
        )}
        {kind === "dome" && (
          <>
            <path d="M4 50 A28 28 0 0 1 60 50 Z" fill={BLUE} opacity={0.22} />
            <path d="M4 50 A28 28 0 0 1 60 50" fill="none" stroke={BLUE} strokeWidth={3.5} />
            <path d="M14 50 A18 18 0 0 1 50 50" fill="none" stroke="#e8f6ff" strokeWidth={1.8} opacity={0.8} />
          </>
        )}
        {kind === "roar" && (
          <>
            {[14, 21, 28].map((r, i) => (
              <circle key={r} cx={32} cy={32} r={r} fill="none" stroke={GOLD} strokeWidth={3.2 - i * 0.7} opacity={0.9 - i * 0.22} />
            ))}
          </>
        )}
        {kind === "chains" && (
          <>
            {[0, 1, 2, 3].map((i) => (
              <ellipse key={i} cx={14 + i * 12} cy={40 + (i % 2 ? -7 : 7)} rx={7} ry={4.6} fill="none" stroke="#a9b2ba" strokeWidth={3.4} />
            ))}
          </>
        )}
        {kind === "leap" && (
          <>
            <path d="M32 4 L44 26 H36 L40 44 L20 22 H29 Z" fill={GOLD} stroke="#7a4a08" strokeWidth={2} strokeLinejoin="round" />
            <path d="M12 56 Q32 46 52 56" fill="none" stroke="#fff6d8" strokeWidth={3} strokeLinecap="round" opacity={0.85} />
          </>
        )}
        {kind === "speed" && (
          <>
            {[16, 28, 40, 52].map((y, i) => (
              <line key={y} x1={4 + i * 3} y1={y} x2={40 + i * 4} y2={y} stroke={BLUE} strokeWidth={4 - i * 0.5} strokeLinecap="round" opacity={0.9 - i * 0.12} />
            ))}
          </>
        )}
        {kind === "fear" && (
          <>
            <circle cx={32} cy={30} r={20} fill={VIOLET} opacity={0.2} />
            <path d="M20 24 Q26 18 32 24 Q38 18 44 24" fill="none" stroke={VIOLET} strokeWidth={3.4} strokeLinecap="round" />
            <path d="M20 42 Q32 34 44 42" fill="none" stroke={VIOLET} strokeWidth={3.4} strokeLinecap="round" />
          </>
        )}
        {kind === "rage" && (
          <>
            <circle cx={32} cy={32} r={22} fill={RED} opacity={0.22} />
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <line
                key={a}
                x1={32 + Math.cos((a * Math.PI) / 180) * 15}
                y1={32 + Math.sin((a * Math.PI) / 180) * 15}
                x2={32 + Math.cos((a * Math.PI) / 180) * 29}
                y2={32 + Math.sin((a * Math.PI) / 180) * 29}
                stroke={RED}
                strokeWidth={4}
                strokeLinecap="round"
              />
            ))}
          </>
        )}
        {kind === "quake" && (
          <>
            <path d="M2 52 L16 44 L24 54 L34 42 L44 54 L52 46 L62 52" fill="none" stroke="#8a6a44" strokeWidth={4} strokeLinejoin="round" />
            <path d="M18 56 L24 62 M40 56 L46 62" stroke="#8a6a44" strokeWidth={3} strokeLinecap="round" />
          </>
        )}
        {kind === "blades" && (
          <>
            {[-28, 0, 28].map((a) => (
              <path
                key={a}
                d="M32 6 Q40 22 32 34 Q24 22 32 6 Z"
                fill="#e6eef3"
                stroke="#3c4750"
                strokeWidth={1.8}
                transform={`rotate(${a} 32 32)`}
              />
            ))}
          </>
        )}
        {kind === "guard" && (
          <>
            <circle cx={32} cy={32} r={21} fill={GREEN} opacity={0.18} />
            <circle cx={32} cy={32} r={21} fill="none" stroke={GREEN} strokeWidth={3.4} strokeDasharray="7 5" />
          </>
        )}
        {kind === "thread" && (
          <>
            <path d="M8 52 Q20 20 32 36 Q44 52 56 14" fill="none" stroke={VIOLET} strokeWidth={3} strokeLinecap="round" />
            <circle cx={32} cy={36} r={4} fill={VIOLET} />
          </>
        )}
      </svg>
    </span>
  );
}
