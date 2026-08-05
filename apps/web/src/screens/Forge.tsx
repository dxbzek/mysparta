/** Two steps to a hunter: type a name, then make them look like you want. */
import { useMemo, useState } from "react";
import { STAT_LABEL, createChampion, omen, type Champion } from "@agoge/core";
import { decodeSave, type SaveV1 } from "../save.js";
import { PixIcon } from "../pixelIcons.js";
import { AURAS, AuraSparks, FighterBust, FighterFig, lookFor } from "../fighters.js";
import {
  BEARDS,
  BUILDS,
  CLOTH_COLORS,
  EYE_COLORS,
  FEET,
  HAIRS,
  HAIR_COLORS,
  HEADS,
  LEGS,
  SKINS,
  TORSOS,
  normaliseLook,
  randomLook,
  torsosFor,
  type Look,
  type Part,
  type Tone,
} from "../paperdoll.js";


export function Forge({
  onForge,
  onRestore,
}: {
  onForge: (c: Champion, look: Look, aura: number) => void;
  /** A pasted rescue code checked out as a full save (save.ts). */
  onRestore: (save: SaveV1) => void;
}) {
  const [name, setName] = useState("");
  const [champ, setChamp] = useState<Champion | null>(null);
  const [look, setLook] = useState<Look | null>(null);
  const [aura, setAura] = useState(0);
  const [previewPose, setPreviewPose] = useState<"idle" | "attack1">("idle");
  const [tab, setTab] = useState<CreatorTab>("body");
  const [restoring, setRestoring] = useState(false);
  const [code, setCode] = useState("");
  const [codeBad, setCodeBad] = useState(false);
  const preview = useMemo(() => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return null;
    try {
      return createChampion(trimmed);
    } catch {
      return null;
    }
  }, [name]);

  if (!champ) {
    return (
      <div className="forge">
        <h1 className="forge-title">Enter your name.</h1>
        <p className="forge-sub">Every name awakens a different hunter — same name, same hunter, always.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (preview) {
              setChamp(preview);
              setLook(lookFor(preview.displayName));
            }
          }}
        >
          <input
            className="forge-input"
            value={name}
            maxLength={24}
            placeholder="e.g. Kassia"
            autoFocus
            onChange={(e) => setName(e.target.value)}
            aria-label="Champion name"
          />
          {preview && (
            <div className="forge-preview card">
              <FighterBust look={lookFor(preview.displayName)} size={72} />
              <div>
                <div className="champ-name">
                  {preview.displayName} <span className="epithet">{preview.epithet}</span>
                </div>
                <div className="muted">{omen(preview.omen).name}</div>
                <div className="statline">
                  {STAT_LABEL.might} {preview.stats.might} · {STAT_LABEL.grace} {preview.stats.grace} ·{" "}
                  {STAT_LABEL.tempo} {preview.stats.tempo} · {STAT_LABEL.grit} {preview.stats.grit}
                </div>
              </div>
            </div>
          )}
          <button className="btn primary big" type="submit" disabled={!preview}>
            Awaken my Hunter
          </button>
        </form>
        <p className="fineprint">Next: make them look like you want. Weapons, stats and skills are all found as you level.</p>
        {/* The way back for a hunter carried from another browser. */}
        {!restoring ? (
          <button className="btn ghost tiny restore-toggle" onClick={() => setRestoring(true)}>
            Have a rescue code?
          </button>
        ) : (
          <form
            className="restore-row"
            onSubmit={(e) => {
              e.preventDefault();
              const saved = decodeSave(code);
              if (saved) onRestore(saved);
              else setCodeBad(true);
            }}
          >
            <input
              className="forge-input small"
              value={code}
              placeholder="paste your rescue code"
              aria-label="Rescue code"
              aria-invalid={codeBad}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeBad(false);
              }}
            />
            <button className="btn" type="submit" disabled={!code.trim()}>
              Restore
            </button>
            {codeBad && <p className="muted small error-note">That code doesn't read as a hunter. Copy it again, whole.</p>}
          </form>
        )}
      </div>
    );
  }

  const me = normaliseLook(look ?? lookFor(champ.displayName));
  const c2 = champ;
  const set = (patch: Partial<Look>) => setLook(normaliseLook({ ...me, ...patch }));

  const tone = (label: string, tones: Tone[], value: number, key: keyof Look) => (
    <div className="picker swatch-picker">
      <span className="picker-label">
        {label}
        <em>{tones[value]!.name}</em>
      </span>
      <div className="swatches">
        {tones.map((t, i) => (
          <button
            key={t.name}
            className={`swatch ${value === i ? "picked" : ""}`}
            style={{ background: t.css }}
            onClick={() => set({ [key]: i } as Partial<Look>)}
            aria-label={`${t.name} ${label.toLowerCase()}`}
            title={t.name}
          />
        ))}
      </div>
    </div>
  );

  const part = (
    label: string,
    parts: Array<{ name: string }>,
    value: number,
    key: keyof Look,
    allowed?: number[],
  ) => (
    <PartPicker
      label={label}
      parts={parts}
      value={value}
      allowed={allowed}
      onPick={(i) => set({ [key]: i } as Partial<Look>)}
    />
  );

  return (
    <div className="forge">
      <h1 className="forge-title">Make them yours.</h1>
      <p className="forge-sub">
        {c2.displayName} <span className="epithet">{c2.epithet}</span> — this is just how you look.
        Weapons, stats and skills are found in the Rift as you level.
      </p>
      <div className="styler">
        <div
          className="styler-stage"
          onPointerDown={() => setPreviewPose("attack1")}
          onPointerUp={() => setPreviewPose("idle")}
          onPointerLeave={() => setPreviewPose("idle")}
          title="Hold to see the attack"
        >
          <AuraSparks aura={aura} />
          <FighterFig look={me} height={170} anim={previewPose} aura={aura} />
          <div className="hero-caption">
            <b>{BUILDS[me.build]!.name} · {HEADS[me.head]!.name}</b>
            <span className="muted small">
              {BUILDS[me.build]!.blurb} <em>(hold to preview the attack)</em>
            </span>
          </div>
        </div>

        <div className="card creator">
          {/* One category at a time, the way a console creator does it — the
              whole sheet used to be on screen at once and read as a wall. */}
          <div className="tabs" role="tablist">
            {CREATOR_TABS.map(([id, name]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={`tab ${tab === id ? "on" : ""}`}
                onClick={() => setTab(id)}
              >
                {name}
              </button>
            ))}
          </div>

          {tab === "body" && (
            <>
              {part("Build", BUILDS, me.build, "build")}
              {tone("Skin", SKINS, me.skin, "skin")}
            </>
          )}
          {tab === "face" && (
            <>
              {part("Shape", HEADS, me.head, "head")}
              {part("Facial hair", BEARDS, me.beard, "beard")}
              {tone("Eyes", EYE_COLORS, me.eyes, "eyes")}
            </>
          )}
          {tab === "hair" && (
            <>
              {part("Style", HAIRS, me.hair, "hair")}
              {tone("Colour", HAIR_COLORS, me.hairColor, "hairColor")}
            </>
          )}
          {tab === "clothes" && (
            <>
              {part("Top", TORSOS, me.torso, "torso", torsosFor(me.build))}
              {tone("Top colour", CLOTH_COLORS, me.torsoColor, "torsoColor")}
              {part("Legs", LEGS, me.legs, "legs")}
              {tone("Leg colour", CLOTH_COLORS, me.legsColor, "legsColor")}
              {part("Feet", FEET, me.feet, "feet")}
              {tone("Feet colour", CLOTH_COLORS, me.feetColor, "feetColor")}
            </>
          )}
          {tab === "aura" && (
            <div className="picker swatch-picker">
              <span className="picker-label">
                Glow<em>{AURAS[aura]!.name}</em>
              </span>
              <div className="swatches">
                {AURAS.map((a, i) => (
                  <button
                    key={a.name}
                    className={`swatch ${aura === i ? "picked" : ""}`}
                    style={{ background: a.color, boxShadow: `0 0 10px ${a.color}88` }}
                    onClick={() => setAura(i)}
                    aria-label={`${a.name} aura`}
                    title={a.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="actions">
          <button
            className="btn big"
            onClick={() => {
              setLook(randomLook(Math.random));
              setAura(Math.floor(Math.random() * AURAS.length));
            }}
          >
            <PixIcon name="dice" size={14} /> Randomize
          </button>
          <button className="btn primary big" onClick={() => onForge(c2, me, aura)}>
            Start Hunting
          </button>
        </div>
      </div>
    </div>
  );
}

const CREATOR_TABS = [
  ["body", "Body"],
  ["face", "Face"],
  ["hair", "Hair"],
  ["clothes", "Clothes"],
  ["aura", "Aura"],
] as const;

type CreatorTab = (typeof CREATOR_TABS)[number][0];

/**
 * A long list of parts, browsed the way console creators do it: arrows to
 * step one at a time, a list to jump straight to one. Two dozen options fit
 * on a single row instead of filling the screen with chips.
 */
function PartPicker({
  label,
  parts,
  value,
  allowed,
  onPick,
}: {
  label: string;
  parts: Array<{ name: string }>;
  value: number;
  allowed?: number[];
  onPick: (i: number) => void;
}) {
  const list = allowed ?? parts.map((_, i) => i);
  const at = Math.max(0, list.indexOf(value));
  const step = (d: number) => onPick(list[(at + d + list.length) % list.length]!);
  return (
    <div className="picker">
      <span className="picker-label">
        {label}
        <em>{parts[value]!.name}</em>
      </span>
      <div className="picker-ctl">
        <button className="nudge" onClick={() => step(-1)} aria-label={`Previous ${label}`}>
          <PixIcon name="arrowLeft" size={9} />
        </button>
        <select
          value={value}
          onChange={(e) => onPick(Number(e.target.value))}
          aria-label={label}
        >
          {list.map((i) => (
            <option key={parts[i]!.name} value={i}>
              {parts[i]!.name}
            </option>
          ))}
        </select>
        <button className="nudge flip" onClick={() => step(1)} aria-label={`Next ${label}`}>
          <PixIcon name="arrowLeft" size={9} />
        </button>
        <span className="picker-count">
          {at + 1}/{list.length}
        </span>
      </div>
    </div>
  );
}


/** Poses the champion can hold for their portrait. */
