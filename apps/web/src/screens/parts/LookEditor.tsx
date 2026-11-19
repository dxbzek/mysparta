/**
 * The pick-your-look editor (content v3 batch 4, plan 13.12): every look part the player can choose,
 * a row each. Shape parts (build, head, hair, face, top, bottoms, shoes, extra) step with a previous
 * and a next button round the part's name; colours (skin, hair colour, outfit colours) are swatch
 * strips. Every control is a 44 px tap target, and the rows fit a 320 px wide phone. The live
 * preview is the caller's (the Create stage, the Look screen's stage): the same rig the fight uses.
 * Looks are cosmetic: nothing here touches stats.
 */
import { useLayoutEffect, useRef } from "react";
import type { Look } from "@rankzero/core";
import { LOOK_SPACE } from "@rankzero/core";
import { LOOK_SWATCHES } from "@rankzero/rig";
import type { ColourKey, ShapeKey } from "../../text/looks";
import { COLOUR_KEYS, LOOK_NAMES, LOOK_PART, LOOK_WORDS, SHAPE_KEYS } from "../../text/looks";
import css from "./LookEditor.module.css";

export interface LookEditorProps {
  look: Look;
  onChange(look: Look): void;
  /** An id prefix, so two editors on a page never share ids. */
  id?: string;
}

const step = (look: Look, key: ShapeKey, by: number): Look => {
  const n = LOOK_SPACE[key];
  return { ...look, [key]: (((look[key] + by) % n) + n) % n };
};

function swatchFill(key: ColourKey, i: number): { a: string; b?: string; c?: string } {
  if (key === "skin") return { a: LOOK_SWATCHES.skin[i % LOOK_SWATCHES.skin.length]! };
  if (key === "hairColor") return { a: LOOK_SWATCHES.hairColor[i % LOOK_SWATCHES.hairColor.length]! };
  const p = LOOK_SWATCHES.palettes[i % LOOK_SWATCHES.palettes.length]!;
  return { a: p.top, b: p.bottom, c: p.accent };
}

export function LookEditor({ look, onChange, id = "look" }: LookEditorProps) {
  // each swatch strip keeps its picked swatch in view (a die can pick one past the strip's edge)
  const strips = useRef<Partial<Record<ColourKey, HTMLDivElement | null>>>({});
  useLayoutEffect(() => {
    for (const key of COLOUR_KEYS) {
      const strip = strips.current[key];
      const on = strip?.querySelector<HTMLElement>("[aria-checked=true]");
      if (!strip || !on) continue;
      const left = on.offsetLeft - strip.offsetLeft;
      if (left < strip.scrollLeft || left + on.offsetWidth > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = Math.max(0, left - (strip.clientWidth - on.offsetWidth) / 2);
    }
  }, [look.skin, look.hairColor, look.palette]);
  return (
    <div className={css.editor} data-testid="look-editor">
      <ul className={css.rows}>
        {SHAPE_KEYS.map((key) => {
          const part = LOOK_PART[key];
          const name = LOOK_NAMES[key][look[key]] ?? `${look[key] + 1}`;
          return (
            <li key={key} className={css.row} data-part={key}>
              <span className={css.label} id={`${id}-${key}`}>{part}</span>
              <button type="button" className={css.step} aria-label={LOOK_WORDS.prev(part)} onClick={() => onChange(step(look, key, -1))}>
                <Chevron dir={-1} />
              </button>
              <span className={css.value} aria-live="polite" aria-labelledby={`${id}-${key}`} data-testid={`look-${key}`} data-index={look[key]}>
                <span className={css.name}>{name}</span>
                <span className={css.count}>{LOOK_WORDS.count(look[key] + 1, LOOK_SPACE[key])}</span>
              </span>
              <button type="button" className={css.step} aria-label={LOOK_WORDS.next(part)} onClick={() => onChange(step(look, key, 1))}>
                <Chevron dir={1} />
              </button>
            </li>
          );
        })}
      </ul>
      {COLOUR_KEYS.map((key) => {
        const part = LOOK_PART[key];
        const n = LOOK_SPACE[key];
        return (
          <section key={key} className={css.colours} aria-labelledby={`${id}-${key}`} data-part={key}>
            <h3 className={css.colourTitle} id={`${id}-${key}`}>{part} <span className={css.count}>{LOOK_WORDS.count(look[key] + 1, n)}</span></h3>
            <div className={css.strip} role="radiogroup" aria-labelledby={`${id}-${key}`} ref={(el) => { strips.current[key] = el; }}>
              {Array.from({ length: n }, (_, i) => {
                const f = swatchFill(key, i);
                const on = look[key] === i;
                return (
                  <button key={i} type="button" role="radio" aria-checked={on} aria-label={LOOK_WORDS.swatch(part, i + 1, n)}
                    className={`${css.swatch} ${on ? css.on : ""}`} data-testid={`look-${key}-${i}`} onClick={() => onChange({ ...look, [key]: i })}>
                    <span className={css.chip} style={{ background: f.b === undefined ? f.a : `linear-gradient(180deg, ${f.a} 0 55%, ${f.b} 55% 82%, ${f.c} 82%)` }} />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      <p className={css.note}>{LOOK_WORDS.cosmetic}</p>
    </div>
  );
}

function Chevron({ dir }: { dir: 1 | -1 }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d={dir === 1 ? "M9 4l8 8l-8 8" : "M15 4l-8 8l8 8"} fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The shape parts of `from` over `to` (the Shape die), or its colours (the Colours die). */
export function takeParts(to: Look, from: Look, which: "shape" | "colour"): Look {
  const keys: readonly (keyof Look)[] = which === "shape" ? SHAPE_KEYS : COLOUR_KEYS;
  const out: Record<string, number> = { ...to };
  for (const k of keys) out[k] = from[k];
  return out as unknown as Look;
}
