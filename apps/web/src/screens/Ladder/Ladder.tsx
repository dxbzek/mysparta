/**
 * The rank ladder (plan 13.10 item 1). Ten rungs, Rank 1 at the top down to Rank 10 at the bottom,
 * with the player's own rung (Rank Zero under the bottom one) marked. Each rung shows its boss's
 * portrait, name, rank and street name, the level gate, and its state: Beaten, Ready or Locked. A tap
 * opens the boss's card: the boss standing, its taunt, its numbers against the player's, and Fight
 * when it can be fought (one energy, like a bout).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CompanionId, FighterSnapshot, GearId, GearSlot, HeldId, ShieldId } from "@rankzero/core";
import { LADDER_RUNGS, gearSlot, isCompanionId, isGearId, isShieldId, perkKind } from "@rankzero/core";
import type { CoreApi } from "@rankzero/core";
import { activeRecord } from "../../app/guards";
import { useDoc, useGame } from "../../app/context";
import { shownRecord, unwatchedOf } from "../../state/actions";
import { BOSS_LINES, LADDER_WORDS, RUNG_TITLE, rankLabel, rankTitle, rungRank } from "../../text/ladder";
import { UI } from "../../text/ui";
import { ActorStage } from "../../ui/ActorStage";
import { Button } from "../../ui/Button";
import { Panel } from "../../ui/Panel";
import { Portrait } from "../../ui/Portrait";
import { Sheet } from "../../ui/Sheet";
import { Sticker } from "../../ui/Sticker";
import { EnergyMeter, useTick } from "../parts/EnergyMeter";
import { BackGlyph } from "../parts/Glyphs";
import { CompareStat } from "../parts/MiniStats";
import common from "../common.module.css";
import css from "./Ladder.module.css";

/** What a snapshot wears and holds on a stage: its first weapon, its shield, its gear, its pets. */
export function dressOf(s: FighterSnapshot): { held: HeldId | null; shield: ShieldId | null; gear: Partial<Record<GearSlot, GearId>>; pets: CompanionId[] } {
  const gear: Partial<Record<GearSlot, GearId>> = {};
  for (const p of s.perks) if (isGearId(p)) gear[gearSlot(p)] = p;
  return {
    held: (s.perks.find((p) => perkKind(p) === "weapon") ?? null) as HeldId | null,
    shield: s.perks.find((p): p is ShieldId => isShieldId(p)) ?? null,
    gear,
    pets: s.perks.filter((p): p is CompanionId => isCompanionId(p)),
  };
}

export type RungState = "beaten" | "ready" | "locked";
export function rungState(core: CoreApi, rank: number, level: number, rung: number): RungState {
  if (rung <= rank) return "beaten";
  return rung === rank + 1 && level >= core.bossGate(rung) ? "ready" : "locked";
}

export function LadderScreen() {
  const { core, clock, actions, go, toast } = useGame();
  const doc = useDoc();
  const rec = activeRecord(doc);
  const shown = rec ? shownRecord(doc, rec) : null;
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useTick(clock, shown !== null && core.energyNextMs(shown, clock.now()) !== null);
  const nextRef = useRef<HTMLLIElement>(null);
  const info = useMemo(() => {
    if (!shown) return null;
    const sheet = core.sheetOf(shown);
    const me = core.snapshotOf(shown);
    const ss = core.snapshotSheet(me);
    return { sheet, me, ss, ladder: core.ladderOf(shown) };
  }, [core, shown]);
  // the next rung up in view once the page is laid out (fonts in), never past the header on a tall screen
  useEffect(() => {
    let live = true;
    const go = (): void => { if (live) nextRef.current?.scrollIntoView?.({ block: "nearest" }); };
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    if (fonts) void fonts.ready.then(() => requestAnimationFrame(go));
    else requestAnimationFrame(go);
    // and once more after the portraits and the route have settled
    const again = window.setTimeout(go, 400);
    return () => { live = false; window.clearTimeout(again); };
  }, []);
  if (!rec || !shown || !info) return null;
  const { ladder, sheet } = info;
  const level = sheet.level;
  const energy = core.energyNow(shown, now);
  const rungs = Array.from({ length: LADDER_RUNGS }, (_, i) => LADDER_RUNGS - i);

  const fight = async (rung: number): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await actions.startBoss(rec.id, rung);
      if (r.ok) go({ name: "bout", id: r.value.id });
      else {
        toast(LADDER_WORDS.refused[r.error] ?? r.error);
        setBusy(false);
      }
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  };

  const boss = open !== null ? core.bossSnapshot(open) : null;
  const bossSheet = boss ? core.snapshotSheet(boss) : null;
  const state = open !== null ? rungState(core, ladder.rank, level, open) : null;
  // why Fight is off, when it is
  const why = open === null ? null
    : state === "beaten" ? null
    : state === "locked" ? (open === ladder.rank + 1 ? LADDER_WORDS.needLevel(core.bossGate(open)) : LADDER_WORDS.needRank)
    : sheet.levelUpWaiting ? LADDER_WORDS.refused["level-up-waiting"]
    : ladder.prizeWaiting ? LADDER_WORDS.refused["prize-waiting"]
    : unwatchedOf(doc) ? LADDER_WORDS.refused["unwatched-bout"]
    : energy <= 0 ? LADDER_WORDS.refused["no-energy"] : null;
  const count = (x: FighterSnapshot, kind: string): number => x.perks.filter((p) => perkKind(p) === kind).length;

  return (
    <div className={common.screen}>
      <header className={common.top}>
        <Button square onClick={() => go({ name: "locker" })} aria-label={UI.back}><BackGlyph /></Button>
        <div className={common.titles}>
          <span className={common.kicker}>{LADDER_WORDS.title}</span>
          <h1 className={common.h1}>{LADDER_WORDS.heading}</h1>
        </div>
        <div className={css.energy}><EnergyMeter rec={shown} compact /></div>
      </header>
      <main className={common.body}>
        <Panel tone="dark" className={css.me}>
          <Portrait look={info.me.look} size={52} label={info.me.name} />
          <span className={css.meText}>
            <span className={css.meName}>{info.me.name}</span>
            <span className={css.meRank} data-testid="ladder-rank">{rankLabel(ladder.rank)} · {rankTitle(ladder.rank)}</span>
          </span>
          <span className={css.meLevel}>{UI.lv(level)}</span>
        </Panel>
        <ol className={css.ladder} aria-label={LADDER_WORDS.heading}>
          {rungs.map((rung) => {
            const b = core.bossSnapshot(rung);
            const st = rungState(core, ladder.rank, level, rung);
            const stateWord = st === "beaten" ? LADDER_WORDS.beaten : st === "ready" ? LADDER_WORDS.ready : LADDER_WORDS.locked;
            const isNext = rung === ladder.rank + 1;
            return (
              <li key={rung} className={css.rungItem} ref={isNext ? nextRef : undefined}>
                <button type="button" className={`${css.rung} ${css[st]}`} data-rung={rung} data-state={st} onClick={() => setOpen(rung)}
                  aria-label={LADDER_WORDS.bossLabel(b.name, rungRank(rung), RUNG_TITLE[rung] ?? "", `${stateWord}. ${LADDER_WORDS.gate(core.bossGate(rung))}.`)}>
                  <span className={css.rankBadge}><b>{LADDER_RUNGS + 1 - rung}</b><span>{LADDER_WORDS.gateShort}</span></span>
                  <span className={css.face}><Portrait look={b.look} size={56} label="" /></span>
                  <span className={css.rungText}>
                    <span className={css.bossName}>{b.name}</span>
                    <span className={css.rungTitle}>{RUNG_TITLE[rung]}</span>
                    <span className={css.gate}>{LADDER_WORDS.gate(core.bossGate(rung))}</span>
                  </span>
                  <span className={`${css.state} ${css[`state-${st}`]}`}>{stateWord}</span>
                </button>
                {rung === ladder.rank && ladder.rank > 0 ? <span className={css.here}>{LADDER_WORDS.you(rankLabel(ladder.rank))}</span> : null}
              </li>
            );
          })}
          <li className={css.rungItem}>
            <div className={`${css.rung} ${css.zero}`} aria-label={rankLabel(0)}>
              <span className={css.rankBadge}><b>0</b><span>{LADDER_WORDS.gateShort}</span></span>
              <span className={css.rungText}>
                <span className={css.bossName}>{rankLabel(0)}</span>
                <span className={css.rungTitle}>{rankTitle(0)}</span>
              </span>
            </div>
            {ladder.rank === 0 ? <span className={css.here}>{LADDER_WORDS.you(rankLabel(0))}</span> : null}
          </li>
        </ol>
      </main>
      <Sheet open={open !== null} title={LADDER_WORDS.boss} onClose={() => setOpen(null)} closeLabel={UI.back} height={0.72}>
        {open !== null && boss && bossSheet ? (
          <div className={css.card} data-testid="taunt-card">
            <div className={css.cardStage}>
              <ActorStage look={boss.look} {...dressOf(boss)} companions={dressOf(boss).pets} facing={-1} height={190} floorAt={0.88} window={{ w: 190, h: 130 }} label={boss.name} clip="flick" restMs={1800} />
              <div className={css.cardTags}>
                <Sticker tilt={-2}>{boss.name}</Sticker>
                <span className={css.cardRank}>{rungRank(open)} · {RUNG_TITLE[open]}</span>
              </div>
            </div>
            <blockquote className={css.taunt}>
              <span className="rz-visually-hidden">{LADDER_WORDS.says(boss.name)}: </span>
              {state === "beaten" ? BOSS_LINES[open]?.beaten : BOSS_LINES[open]?.taunt}
            </blockquote>
            <div className={css.compare}>
              <CompareStat label="LV" mine={level} theirs={boss.level} max={Math.max(level, boss.level)} />
              <CompareStat label={UI.hp} mine={info.ss.maxHp} theirs={bossSheet.maxHp} max={Math.max(info.ss.maxHp, bossSheet.maxHp)} />
              <CompareStat label={UI.card.weapons} mine={count(info.me, "weapon")} theirs={count(boss, "weapon")} max={Math.max(1, count(info.me, "weapon"), count(boss, "weapon"))} />
              <CompareStat label={UI.card.skills} mine={count(info.me, "skill")} theirs={count(boss, "skill")} max={Math.max(1, count(info.me, "skill"), count(boss, "skill"))} />
              <CompareStat label={LADDER_WORDS.gear} mine={count(info.me, "gear")} theirs={count(boss, "gear")} max={Math.max(1, count(info.me, "gear"), count(boss, "gear"))} />
            </div>
            {state === "beaten" ? (
              <p className={css.note}>{LADDER_WORDS.beaten}</p>
            ) : (
              <>
                {why !== null ? <p className={css.note} data-testid="fight-why">{why}</p> : <p className={css.note}>{LADDER_WORDS.cost}</p>}
                <Button variant="primary" onClick={() => void fight(open)} disabled={why !== null || busy}>{LADDER_WORDS.fight}</Button>
              </>
            )}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
