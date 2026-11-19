/**
 * The Locker (home) as a props-only view (brief 3.11 B). It holds no state and reads no store:
 * the debug route shows it with fixture props, and the app lane wraps it and feeds it from the
 * save. A change to this view is a request to the fight-screen lane.
 *
 * Phone, top to bottom: header (roster + settings), hero (240 px mini stage, name sticker, level,
 * XP bar), stats, the energy bar (content v3), ONE primary button, kit strip (6 icons then "+N"),
 * last 3 bouts, tab bar.
 */
import type { CompanionId, GearId, GearSlot, HeldId, Look, PerkId, ShieldId, StatKey } from "@rankzero/core";
import { ActorStage } from "./ActorStage";
import { Button } from "./Button";
import { EnergyBar, clockOf } from "./EnergyBar";
import { Panel } from "./Panel";
import { PerkIcon } from "./PerkIcon";
import { Portrait } from "./Portrait";
import { StatBar } from "./StatBar";
import { Sticker } from "./Sticker";
import { TabBar } from "./TabBar";
import css from "./LockerView.module.css";

export type LockerTab = "home" | "kit" | "inventory" | "history";
/** The bottom tabs, in order (owner, 15 November 2026: an Inventory to see what is unlocked). */
export const MAIN_TABS: readonly LockerTab[] = ["home", "kit", "inventory", "history"];
export type LockerPrimary =
  | { kind: "levelup" }
  | { kind: "fight"; energy: number }
  /** Out of energy: `backIn` is the countdown to the next point ("12:04"). */
  | { kind: "done"; backIn: string };
/** The energy bar's numbers (content v3). */
export interface LockerEnergy { value: number; max: number; nextMs: number | null }

export interface LockerBout { id: string; won: boolean; opponent: string; line: string; xp: number }

export interface LockerText {
  settings: string; addScrapper: string; level(n: number): string; xp: string; maxHp: string;
  levelUp: string; fight(energy: number): string; done(backIn: string): string;
  energy: string; energyFull: string; energyNext(clock: string): string;
  kit: string; seeAll: string; more(n: number): string; lastBouts: string; allBouts: string; noBouts: string;
  win: string; loss: string; replay(opponent: string): string; xpGained(n: number): string;
  tabs: Record<LockerTab, string>; hero(name: string): string;
}

/** Default English. The app lane may pass its own `text/ui.ts` strings instead. */
export const LOCKER_TEXT: LockerText = {
  settings: "Settings",
  addScrapper: "New scrapper",
  level: (n) => `Level ${n}`,
  xp: "XP",
  maxHp: "Max HP",
  levelUp: "Level up!",
  fight: () => "Fight",
  done: (backIn) => `Out of energy. +1 in ${backIn}.`,
  energy: "Energy",
  energyFull: "Full",
  energyNext: (c) => `+1 in ${c}`,
  kit: "Kit",
  seeAll: "See all",
  more: (n) => `+${n}`,
  lastBouts: "Last bouts",
  allBouts: "All bouts",
  noBouts: "No bouts yet. Tap Fight to pick a rival.",
  win: "W",
  loss: "L",
  replay: (o) => `Replay the bout with ${o}`,
  xpGained: (n) => `+${n} XP`,
  tabs: { home: "Home", kit: "Kit", inventory: "Inventory", history: "History" },
  hero: (name) => `${name} waiting in the Yard`,
};

export interface LockerViewProps {
  roster: readonly { id: string; name: string; look: Look }[];
  activeId: string;
  canAdd: boolean;
  name: string;
  level: number;
  look: Look;
  held?: HeldId | null;
  companions?: readonly CompanionId[];
  /** The loadout's shield and gear (content v3 batch 2), drawn on the hero. */
  shield?: ShieldId | null;
  gear?: Partial<Record<GearSlot, GearId>>;
  xp: number;
  xpToNext: number;
  maxHp: number;
  /** All six stats (review r2: Health is a level-up pick, so the home screen shows it too). */
  stats: Readonly<Record<StatKey, number>>;
  /** The value that fills a stat bar; the app lane picks it (for example the roster's highest). */
  statScale: number;
  primary: LockerPrimary;
  energy: LockerEnergy;
  /** Unspent talent points (content v3 batch 3): a prompt under the main button and a badge on Kit. */
  talentsDue?: number;
  talentText?: { prompt(n: number): string; sub: string };
  onTalents?(): void;
  kit: readonly PerkId[];
  bouts: readonly LockerBout[];
  tab: LockerTab;
  text?: LockerText;
  /** Fixed hero time, for screenshots. */
  heroT?: number;
  /** The clip the hero plays between rests (default "flick"), so the home fighter is not only idling. */
  heroClip?: string;
  onSelect(id: string): void;
  onAdd(): void;
  onSettings(): void;
  onPrimary(): void;
  onKitItem(id: PerkId): void;
  onSeeAllKit(): void;
  onReplay(id: string): void;
  onAllBouts(): void;
  onTab(tab: LockerTab): void;
  /** The look editor (content v3 batch 4): a "Change look" button on the hero. */
  onLook?(): void;
  lookLabel?: string;
}

const KIT_SHOWN = 6;
export { clockOf };

export function LockerView(p: LockerViewProps) {
  const t = p.text ?? LOCKER_TEXT;
  const xpPct = p.xpToNext > 0 ? Math.min(1, p.xp / p.xpToNext) : 0;
  const shown = p.kit.slice(0, KIT_SHOWN);
  const extra = p.kit.length - shown.length;
  return (
    <div className={css.screen}>
      <header className={css.header}>
        <div className={css.roster}>
          {p.roster.map((r) => (
            <button key={r.id} type="button" className={css.slot} onClick={() => p.onSelect(r.id)} aria-pressed={r.id === p.activeId} aria-label={r.name}>
              <Portrait look={r.look} size={36} label={r.name} active={r.id === p.activeId} />
            </button>
          ))}
          {p.canAdd ? <Button square onClick={p.onAdd} aria-label={t.addScrapper}>+</Button> : null}
        </div>
        <Button square variant="dark" onClick={p.onSettings} aria-label={t.settings}>
          <GearGlyph />
        </Button>
      </header>
      <main className={css.body}>
        <Panel tone="dark" flush className={css.hero}>
          <div className={css.heroStage}>
            <ActorStage look={p.look} held={p.held ?? null} companions={p.companions ?? []} shield={p.shield ?? null} {...(p.gear !== undefined ? { gear: p.gear } : {})} height={234} floorAt={0.78} label={t.hero(p.name)} t={p.heroT} clip={p.heroClip ?? "flick"} restMs={2600} />
          </div>
          <div className={css.heroTop}>
            <Sticker tilt={-2}>{p.name}</Sticker>
            <Sticker tone="hazard" tilt={1.5}>{t.level(p.level)}</Sticker>
          </div>
          {p.onLook !== undefined ? (
            <button type="button" className={css.lookButton} onClick={p.onLook} data-testid="change-look">{p.lookLabel ?? "Change look"}</button>
          ) : null}
          <div className={css.xp}>
              <span className={css.xpLabel}>{t.xp}</span>
              <span className={css.xpTrack} role="progressbar" aria-label={t.xp} aria-valuemin={0} aria-valuemax={p.xpToNext} aria-valuenow={p.xp}>
                <span className={css.xpFill} style={{ width: `${(xpPct * 100).toFixed(1)}%` }} />
              </span>
              <span>{p.xp} / {p.xpToNext}</span>
          </div>
        </Panel>

        <Panel className={css.stats} aria-label="Stats">
          <div className={css.hpRow}>
            <span className={css.hpLabel}>{t.maxHp}</span>
            <span className={css.hpValue}>{p.maxHp}</span>
          </div>
          <StatBar stat="health" value={p.stats.health} max={p.statScale} />
          <StatBar stat="strength" value={p.stats.strength} max={p.statScale} />
          <StatBar stat="agility" value={p.stats.agility} max={p.statScale} />
          <StatBar stat="speed" value={p.stats.speed} max={p.statScale} />
          <StatBar stat="toughness" value={p.stats.toughness} max={p.statScale} />
          <StatBar stat="precision" value={p.stats.precision} max={p.statScale} />
        </Panel>

        <Panel tone="raised" className={css.energy} aria-label={t.energy}>
          <EnergyBar value={p.energy.value} max={p.energy.max} nextMs={p.energy.nextMs} label={t.energy}
            text={{ full: t.energyFull, next: t.energyNext }} />
        </Panel>

        {p.primary.kind === "done" ? (
          <Panel tone="raised"><p className={css.doneNote}>{t.done(p.primary.backIn)}</p></Panel>
        ) : (
          <Button variant="primary" onClick={p.onPrimary} data-primary={p.primary.kind}>
            {p.primary.kind === "levelup" ? t.levelUp : t.fight(p.primary.energy)}
          </Button>
        )}

        {(p.talentsDue ?? 0) > 0 && p.talentText !== undefined ? (
          <button type="button" className={css.talentPrompt} onClick={p.onTalents} data-testid="talent-prompt">
            <span className={css.talentN}>{p.talentsDue}</span>
            <span className={css.talentWords}>
              <span className={css.talentLine}>{p.talentText.prompt(p.talentsDue ?? 0)}</span>
              <span className={css.talentSub}>{p.talentText.sub}</span>
            </span>
          </button>
        ) : null}

        <Panel aria-label={t.kit}>
          <div className={css.kitHead}>
            <h2 className={css.sectionTitle}>{t.kit}</h2>
            <button type="button" className={css.link} onClick={p.onSeeAllKit}>{t.seeAll}</button>
          </div>
          <div className={css.kit}>
            {shown.map((id) => (
              <button key={id} type="button" className={css.kitButton} onClick={() => p.onKitItem(id)}>
                <PerkIcon id={id} size={44} rarity />
              </button>
            ))}
            {extra > 0 ? <button type="button" className={css.more} onClick={p.onSeeAllKit} aria-label={`${t.seeAll} (${extra} more)`}>{t.more(extra)}</button> : null}
          </div>
        </Panel>

        <Panel aria-label={t.lastBouts}>
          <div className={css.boutsHead}>
            <h2 className={css.sectionTitle}>{t.lastBouts}</h2>
            {p.bouts.length > 0 ? <button type="button" className={css.link} onClick={p.onAllBouts}>{t.allBouts}</button> : null}
          </div>
          {p.bouts.length === 0 ? <p className={css.noBouts}>{t.noBouts}</p> : null}
          <ul className={css.bouts} hidden={p.bouts.length === 0}>
            {p.bouts.slice(0, 3).map((b) => (
              <li key={b.id} className={css.bout}>
                <span className={`${css.wl} ${b.won ? css.win : css.loss}`} aria-label={b.won ? "Win" : "Loss"}>{b.won ? t.win : t.loss}</span>
                <span className={css.boutText}>
                  <span className={css.opponent}>{b.opponent}</span>
                  <span className={css.line}>{b.line}</span>
                </span>
                <span className={css.boutXp}>{t.xpGained(b.xp)}</span>
                <Button square onClick={() => p.onReplay(b.id)} aria-label={t.replay(b.opponent)}><ReplayGlyph /></Button>
              </li>
            ))}
          </ul>
        </Panel>
      </main>
      <div className={css.tabs}>
        <TabBar tabs={MAIN_TABS.map((k) => ({ key: k, label: t.tabs[k],
          ...(k === "kit" && (p.talentsDue ?? 0) > 0 && p.talentText !== undefined ? { badge: { n: p.talentsDue ?? 0, label: p.talentText.prompt(p.talentsDue ?? 0) } } : {}) }))}
          active={p.tab} onSelect={p.onTab} />
      </div>
    </div>
  );
}

/** Tiny UI glyphs until the rig's ui:* icons land; currentColor so they follow the text token. */
export function GearGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
export function ReplayGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d="M5 12a7 7 0 1 0 2.2-5.1" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M4 3.5v5h5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
