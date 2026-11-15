/**
 * G. History (brief 3.11 G): the last 50 bouts, grouped by day. W or L tag, opponent, level, the
 * one-line result, XP, a replay button. A bout not yet watched shows "Watch" and no result.
 */
import { useDoc, useGame } from "../../app/context";
import { dayKeyOf } from "../../state/day";
import { HISTORY_LOGS } from "../../state/schema";
import { resultLine } from "../../text/results";
import { LOCKER_WORDS, UI } from "../../text/ui";
import { Button } from "../../ui/Button";
import { MAIN_TABS, ReplayGlyph } from "../../ui/LockerView";
import { Panel } from "../../ui/Panel";
import { Portrait } from "../../ui/Portrait";
import { TabBar } from "../../ui/TabBar";
import { tabRoute } from "../Locker/Locker";
import { BackGlyph } from "../parts/Glyphs";
import common from "../common.module.css";
import css from "./Bouts.module.css";

function dayTitle(key: string, today: string): string {
  if (key === today) return UI.history.today;
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

export function BoutsScreen() {
  const { go, clock } = useGame();
  const doc = useDoc();
  const rows = doc.history.slice(0, HISTORY_LOGS);
  const groups: { key: string; rows: typeof rows }[] = [];
  for (const b of rows) {
    const key = dayKeyOf(b.at);
    const g = groups[groups.length - 1];
    if (g && g.key === key) g.rows.push(b);
    else groups.push({ key, rows: [b] });
  }
  const today = clock.today();
  return (
    <div className={`${common.screen} ${common.wide}`}>
      <header className={common.top}>
        <Button square onClick={() => go({ name: "locker" })} aria-label={UI.back}><BackGlyph /></Button>
        <div className={common.titles}>
          <span className={common.kicker}>{UI.history.count(rows.length)}</span>
          <h1 className={common.h1}>{UI.history.title}</h1>
        </div>
        <span />
      </header>
      <main className={common.body}>
        {rows.length === 0 ? <Panel><p className={css.empty}>{UI.history.empty}</p></Panel> : null}
        {groups.map((g) => (
          <section key={g.key} aria-label={dayTitle(g.key, today)}>
            <h2 className={css.day}>{dayTitle(g.key, today)}</h2>
            <ul className={css.list}>
              {g.rows.map((b) => {
                const won = b.result.winner === "a";
                return (
                  <li key={b.id} className={css.row}>
                    {b.watched ? (
                      <span className={`${css.wl} ${won ? css.win : css.loss}`} aria-label={won ? "Win" : "Loss"}>{won ? LOCKER_WORDS.win : LOCKER_WORDS.loss}</span>
                    ) : <span className={`${css.wl} ${css.new}`} aria-hidden="true">?</span>}
                    <Portrait look={b.snapshotB.look} size={40} label="" />
                    <span className={css.text}>
                      <span className={css.opp}>{UI.history.vs(b.snapshotB.name, b.snapshotB.level)}</span>
                      <span className={css.line}>{b.watched ? resultLine(b.lineId, won, b.snapshotA.name, b.snapshotB.name) : UI.locker.lastBoutLine(b.snapshotA.name, b.snapshotB.name)}</span>
                    </span>
                    {b.watched ? <span className={css.xp}>{UI.history.xp(b.xp)}</span> : null}
                    {b.watched ? (
                      <Button square onClick={() => go({ name: "replay", id: b.id })} aria-label={UI.history.replay(b.snapshotB.name)}><ReplayGlyph /></Button>
                    ) : (
                      <Button variant="hazard" onClick={() => go({ name: "bout", id: b.id })}>{UI.history.watch}</Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
      <div className={common.tabs}>
        <TabBar tabs={MAIN_TABS.map((k) => ({ key: k, label: LOCKER_WORDS.tabs[k] }))} active="history" onSelect={(k) => go(tabRoute(k))} />
      </div>
    </div>
  );
}
