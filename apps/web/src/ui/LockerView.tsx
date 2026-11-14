/**
 * The Locker (home) as a props-only view (brief 3.11 B). It holds no state and reads no store:
 * the debug route shows it with fixture props, and the app lane wraps it and feeds it from the
 * save. A change to this view is a request to the fight-screen lane.
 *
 * Phone, top to bottom: header (roster + settings), hero (240 px mini stage, name sticker, level,
 * XP bar), stats, ONE primary button, kit strip (6 icons then "+N"), last 3 bouts, tab bar.
 */
import type { CompanionId, HeldId, Look, PerkId, StatKey } from "@rankzero/core";
import { ActorStage } from "./ActorStage";
import { Button } from "./Button";
import { Panel } from "./Panel";
import { PerkIcon } from "./PerkIcon";
import { Portrait } from "./Portrait";
import { StatBar } from "./StatBar";
import { Sticker } from "./Sticker";
import { TabBar } from "./TabBar";
import css from "./LockerView.module.css";

export type LockerTab = "home" | "kit" | "history";
export type LockerPrimary =
  | { kind: "levelup" }
  | { kind: "fight"; boutsLeft: number }
  | { kind: "done"; backIn: string };

export interface LockerBout { id: string; won: boolean; opponent: string; line: string; xp: number }

export interface LockerText {
  settings: string; addScrapper: string; level(n: number): string; xp: string; maxHp: string;
  levelUp: string; fight(boutsLeft: number): string; done(backIn: string): string;
  kit: string; seeAll: string; more(n: number): string; lastBouts: string; allBouts: string;
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
  fight: (n) => `Fight (${n} ${n === 1 ? "bout" : "bouts"} left)`,
  done: (backIn) => `Done for tonight. Back in ${backIn}.`,
  kit: "Kit",
  seeAll: "See all",
  more: (n) => `+${n}`,
  lastBouts: "Last bouts",
  allBouts: "All bouts",
  win: "W",
  loss: "L",
  replay: (o) => `Replay the bout with ${o}`,
  xpGained: (n) => `+${n} XP`,
  tabs: { home: "Home", kit: "Kit", history: "History" },
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
  xp: number;
  xpToNext: number;
  maxHp: number;
  stats: Readonly<Record<Exclude<StatKey, "health">, number>>;
  /** The value that fills a stat bar; the app lane picks it (for example the roster's highest). */
  statScale: number;
  primary: LockerPrimary;
  kit: readonly PerkId[];
  bouts: readonly LockerBout[];
  tab: LockerTab;
  text?: LockerText;
  /** Fixed hero time, for screenshots. */
  heroT?: number;
  onSelect(id: string): void;
  onAdd(): void;
  onSettings(): void;
  onPrimary(): void;
  onKitItem(id: PerkId): void;
  onSeeAllKit(): void;
  onReplay(id: string): void;
  onAllBouts(): void;
  onTab(tab: LockerTab): void;
}

const KIT_SHOWN = 6;

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
            <ActorStage look={p.look} held={p.held ?? null} companions={p.companions ?? []} height={234} floorAt={0.78} label={t.hero(p.name)} t={p.heroT} />
          </div>
          <div className={css.heroTop}>
            <Sticker tilt={-2}>{p.name}</Sticker>
            <Sticker tone="hazard" tilt={1.5}>{t.level(p.level)}</Sticker>
          </div>
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
          <StatBar stat="strength" value={p.stats.strength} max={p.statScale} />
          <StatBar stat="agility" value={p.stats.agility} max={p.statScale} />
          <StatBar stat="speed" value={p.stats.speed} max={p.statScale} />
        </Panel>

        {p.primary.kind === "done" ? (
          <Panel tone="raised"><p className={css.doneNote}>{t.done(p.primary.backIn)}</p></Panel>
        ) : (
          <Button variant="primary" onClick={p.onPrimary}>
            {p.primary.kind === "levelup" ? t.levelUp : t.fight(p.primary.boutsLeft)}
          </Button>
        )}

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
            <button type="button" className={css.link} onClick={p.onAllBouts}>{t.allBouts}</button>
          </div>
          <ul className={css.bouts}>
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
        <TabBar tabs={(["home", "kit", "history"] as const).map((k) => ({ key: k, label: t.tabs[k] }))} active={p.tab} onSelect={p.onTab} />
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
