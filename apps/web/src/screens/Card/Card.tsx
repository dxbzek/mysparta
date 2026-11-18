/**
 * C. Tonight's Card (brief 3.10, 3.11 C): six rivals at the player's level, a strip with the
 * player's own numbers, and a face-off sheet with compared stats and the "Fight" button. A rival
 * card shows look, name, level, max HP, three stat bars, pets beside it and COUNTS of weapons and
 * skills, never which ones: scouting stays a guess.
 */
import { useEffect, useMemo, useState } from "react";
import { EnergyMeter } from "../parts/EnergyMeter";
import type { CompanionId, FighterSnapshot, HeldId } from "@rankzero/core";
import { perkKind } from "@rankzero/core";
import { activeRecord } from "../../app/guards";
import { useDoc, useGame } from "../../app/context";
import { shownRecord } from "../../state/actions";
import { NAMES } from "../../text/names";
import { UI } from "../../text/ui";
import { ActorStage } from "../../ui/ActorStage";
import { Button } from "../../ui/Button";
import { Panel } from "../../ui/Panel";
import { Portrait } from "../../ui/Portrait";
import { Sheet } from "../../ui/Sheet";
import { Sticker } from "../../ui/Sticker";
import { BackGlyph, HeartGlyph, SkillGlyph, WeaponGlyph } from "../parts/Glyphs";
import { CompareStat, MiniStat } from "../parts/MiniStats";
import common from "../common.module.css";
import css from "./Card.module.css";

export interface RivalInfo { snap: FighterSnapshot; maxHp: number; str: number; agi: number; spd: number; tou: number; pre: number;
  weapons: number; skills: number; pets: CompanionId[] }

export function rivalInfo(core: ReturnType<typeof useGame>["core"], snap: FighterSnapshot): RivalInfo {
  const s = core.snapshotSheet(snap);
  return {
    snap, maxHp: s.maxHp, str: s.effective.strength, agi: s.effective.agility, spd: s.effective.speed,
    tou: s.effective.toughness, pre: s.effective.precision,
    weapons: snap.perks.filter((p) => perkKind(p) === "weapon").length,
    skills: snap.perks.filter((p) => perkKind(p) === "skill").length,
    pets: snap.perks.filter((p) => perkKind(p) === "companion") as CompanionId[],
  };
}

export function CardScreen() {
  const { core, clock, opponents, actions, go, toast } = useGame();
  const doc = useDoc();
  const rec = activeRecord(doc);
  const shown = rec ? shownRecord(doc, rec) : null;
  const today = clock.today();
  const [hand, setHand] = useState<FighterSnapshot[] | null>(null);
  const [pick, setPick] = useState<RivalInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const handKey = shown ? `${shown.id}:${shown.picks.length}:${shown.lifetimeBouts}:${today}` : "";
  useEffect(() => {
    if (!shown) return;
    let live = true;
    void opponents.hand(shown, today).then((h) => {
      if (live) setHand(h);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handKey, opponents]);
  const me = useMemo(() => (shown ? rivalInfo(core, core.snapshotOf(shown)) : null), [core, shown?.id, shown?.picks.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const rivals = useMemo(() => (hand ?? []).map((s) => rivalInfo(core, s)), [hand, core]);
  if (!rec || !shown || !me) return null;
  const scale = Math.max(10, me.str, me.agi, me.spd, me.tou, me.pre, ...rivals.flatMap((r) => [r.str, r.agi, r.spd, r.tou, r.pre]));
  const held = (me.snap.perks.find((p) => perkKind(p) === "weapon") ?? null) as HeldId | null;

  const fight = async (): Promise<void> => {
    if (!pick || busy) return;
    setBusy(true);
    try {
      const r = await actions.startBout(rec.id, pick.snap);
      if (r.ok) go({ name: "bout", id: r.value.id });
      else {
        toast(UI.card.refused[r.error]);
        go({ name: "locker" });
      }
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className={`${common.screen} ${common.wide}`}>
      <header className={common.top}>
        <Button square onClick={() => go({ name: "locker" })} aria-label={UI.back}><BackGlyph /></Button>
        <div className={common.titles}>
          <span className={common.kicker}>{UI.card.title}</span>
          <h1 className={common.h1}>{UI.card.heading}</h1>
        </div>
        <div className={css.energy}><EnergyMeter rec={shown} compact /></div>
      </header>
      <main className={`${common.body} ${css.layout}`}>
        <aside className={css.me}>
          <Panel tone="dark" className={css.meStrip} aria-label={UI.card.you}>
            <Portrait look={me.snap.look} size={52} label={me.snap.name} />
            <div className={css.meText}>
              <span className={css.meName}>{me.snap.name}</span>
              <span className={css.meLevel}>{UI.lv(me.snap.level)} · {UI.maxHp} {me.maxHp}</span>
            </div>
            <div className={css.meNums}>
              <span>STR <b>{me.str}</b></span><span>AGI <b>{me.agi}</b></span><span>SPD <b>{me.spd}</b></span>
              <span>TOU <b>{me.tou}</b></span><span>PRE <b>{me.pre}</b></span>
            </div>
          </Panel>
          <Panel tone="dark" flush className={css.meStage}>
            <ActorStage look={me.snap.look} held={held} companions={me.pets} height={240} floorAt={0.82} label={me.snap.name} />
          </Panel>
        </aside>
        <section aria-label={UI.card.heading}>
          <div className={css.grid}>
            {rivals.map((r) => (
              <button key={r.snap.id} type="button" className={css.rival} onClick={() => setPick(r)} aria-label={UI.card.cardLabel(r.snap.name, r.snap.level)}>
                <span className={css.rivalTop}>
                  <Portrait look={r.snap.look} size={52} label="" />
                  <span className={css.rivalId}>
                    <span className={css.rivalName}>{r.snap.name}</span>
                    <span className={css.rivalLevel}>{UI.lv(r.snap.level)}</span>
                  </span>
                </span>
                <span className={css.hp}><HeartGlyph size={16} /><b>{r.maxHp}</b><span>{UI.maxHp}</span></span>
                <span className={css.bars}>
                  <MiniStat stat="strength" value={r.str} max={scale} />
                  <MiniStat stat="agility" value={r.agi} max={scale} />
                  <MiniStat stat="speed" value={r.spd} max={scale} />
                  <MiniStat stat="toughness" value={r.tou} max={scale} />
                  <MiniStat stat="precision" value={r.pre} max={scale} />
                </span>
                <span className={css.counts}>
                  <span className={css.count} aria-label={`${r.weapons} ${UI.card.weapons}`}><WeaponGlyph />{r.weapons}</span>
                  <span className={css.count} aria-label={`${r.skills} ${UI.card.skills}`}><SkillGlyph />{r.skills}</span>
                  {r.pets.map((p, i) => <Portrait key={`${p}${i}`} companion={p} size={26} label={NAMES[p]} />)}
                </span>
              </button>
            ))}
          </div>
          <p className={css.hint}>{UI.card.hidden}</p>
        </section>
      </main>
      <Sheet open={pick !== null} title={UI.card.faceOff} onClose={() => setPick(null)} closeLabel={UI.back} height={0.6}>
        {pick ? (
          <div className={css.faceoff}>
            <div className={css.stages}>
              <div className={css.side}>
                <ActorStage look={me.snap.look} held={held} companions={me.pets} height={150} floorAt={0.86} window={{ w: 150, h: 112 }} label={me.snap.name} />
                <Sticker size="small" tilt={-2}>{me.snap.name}</Sticker>
              </div>
              <span className={css.vs}>{UI.card.vs}</span>
              <div className={css.side}>
                <ActorStage look={pick.snap.look} facing={-1} companions={pick.pets} height={150} floorAt={0.86} window={{ w: 150, h: 112 }} label={pick.snap.name} />
                <Sticker size="small" tilt={2}>{pick.snap.name}</Sticker>
              </div>
            </div>
            <div className={css.compare}>
              <CompareStat label={UI.hp} mine={me.maxHp} theirs={pick.maxHp} max={Math.max(me.maxHp, pick.maxHp)} />
              <CompareStat label="STR" stat="strength" mine={me.str} theirs={pick.str} max={scale} />
              <CompareStat label="AGI" stat="agility" mine={me.agi} theirs={pick.agi} max={scale} />
              <CompareStat label="SPD" stat="speed" mine={me.spd} theirs={pick.spd} max={scale} />
              <CompareStat label="TOU" stat="toughness" mine={me.tou} theirs={pick.tou} max={scale} />
              <CompareStat label="PRE" stat="precision" mine={me.pre} theirs={pick.pre} max={scale} />
              <CompareStat label={UI.card.weapons} mine={me.weapons} theirs={pick.weapons} max={Math.max(1, me.weapons, pick.weapons)} />
              <CompareStat label={UI.card.skills} mine={me.skills} theirs={pick.skills} max={Math.max(1, me.skills, pick.skills)} />
            </div>
            <Button variant="primary" onClick={() => void fight()} disabled={busy}>{UI.card.fight}</Button>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
