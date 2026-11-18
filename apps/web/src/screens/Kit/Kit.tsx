/**
 * F. The fighter sheet (brief 3.11 F, plan 13.7 "a proper skill view, proper information, and
 * stats"). Three tabs:
 *   Kit         every owned perk as a card: icon, name, rarity word, kind, the one-line effect and
 *               its costs, built from the content tables. Tap for exact numbers. "Found N of 92"
 *               opens the Inventory tab (every perk, unlocked or locked).
 *   Level path  the Route: every level reached, the card taken and the card not taken.
 *   Stats       each stat with its number, bar and icon, max HP, and every derived value with a
 *               plain line, then "How bouts work".
 * Also here: "Retire this scrapper".
 */
import { useMemo, useState } from "react";
import { PERK_IDS, perkKind } from "@rankzero/core";
import type { PerkId, ScrapperRecord } from "@rankzero/core";
import { activeRecord } from "../../app/guards";
import { useDoc, useGame } from "../../app/context";
import type { KitTab } from "../../app/router";
import { shownRecord } from "../../state/actions";
import { NAMES } from "../../text/names";
import { DERIVED_CAP, DERIVED_KEYS, DERIVED_LINE, DERIVED_NAME, HOW_BOUTS_WORK, STAT_KEYS, STAT_LINE } from "../../text/stats";
import { LOCKER_WORDS, UI } from "../../text/ui";
import { Button } from "../../ui/Button";
import { Panel } from "../../ui/Panel";
import { PerkIcon } from "../../ui/PerkIcon";
import { Portrait } from "../../ui/Portrait";
import { Sheet } from "../../ui/Sheet";
import { StatBar } from "../../ui/StatBar";
import { Sticker } from "../../ui/Sticker";
import { MAIN_TABS } from "../../ui/LockerView";
import { TabBar } from "../../ui/TabBar";
import { tabRoute } from "../Locker/Locker";
import { BackGlyph, HeartGlyph } from "../parts/Glyphs";
import { PerkDetail, PerkRow } from "../parts/Perk";
import { RouteCardChip } from "../parts/RouteCard";
import common from "../common.module.css";
import css from "./Kit.module.css";

const TABS: readonly KitTab[] = ["kit", "route", "stats"];

export function KitScreen({ tab }: { tab: KitTab }) {
  const { core, go } = useGame();
  const doc = useDoc();
  const rec = activeRecord(doc);
  const shown = rec ? shownRecord(doc, rec) : null;
  const sheet = useMemo(() => (shown ? core.sheetOf(shown) : null), [core, shown?.id, shown?.picks.length, shown?.xp]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rec || !shown || !sheet) return null;
  return (
    <div className={`${common.screen} ${common.wide}`}>
      <header className={common.top}>
        <Button square onClick={() => go({ name: "locker" })} aria-label={UI.back}><BackGlyph /></Button>
        <div className={common.titles}>
          <span className={common.kicker}>{rec.name} · {UI.level(sheet.level)}</span>
          <h1 className={common.h1}>{UI.kit.title}</h1>
        </div>
        <Portrait look={sheet.look} size={44} label={rec.name} />
      </header>
      <div className={css.tabs} role="tablist" aria-label={UI.kit.title}>
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={t === tab} className={`${css.tab} ${t === tab ? css.tabOn : ""}`} onClick={() => go({ name: "kit", tab: t }, { replace: true })}>
            {UI.kit.tabs[t]}
          </button>
        ))}
      </div>
      <main className={common.body} role="tabpanel">
        {tab === "kit" ? <KitTabView rec={shown} perks={sheet.perks} /> : null}
        {tab === "route" ? <RouteTabView rec={shown} /> : null}
        {tab === "stats" ? <StatsTabView rec={shown} /> : null}
      </main>
      <div className={common.tabs}>
        <TabBar tabs={MAIN_TABS.map((k) => ({ key: k, label: LOCKER_WORDS.tabs[k] }))} active="kit" onSelect={(k) => go(tabRoute(k))} />
      </div>
    </div>
  );
}

function KitTabView({ rec, perks }: { rec: ScrapperRecord; perks: PerkId[] }) {
  const { core, go } = useGame();
  const doc = useDoc();
  const [open, setOpen] = useState<PerkId | null>(null);
  const [retire, setRetire] = useState(false);
  const foundIds = useMemo(() => new Set(core.foundPerks([...doc.fighters, ...doc.retired])), [core, doc.fighters, doc.retired]);
  const groups = [
    { title: UI.kit.weapons, empty: UI.kit.emptyFor.weapon, ids: perks.filter((p) => perkKind(p) === "weapon") },
    { title: UI.kit.skills, empty: UI.kit.emptyFor.skill, ids: perks.filter((p) => perkKind(p) === "skill") },
    { title: UI.kit.pets, empty: UI.kit.emptyFor.companion, ids: perks.filter((p) => perkKind(p) === "companion") },
    { title: UI.kit.shields, empty: UI.kit.emptyFor.shield, ids: perks.filter((p) => perkKind(p) === "shield") },
  ];
  return (
    <>
      <button type="button" className={css.found} onClick={() => go({ name: "inventory" })}>
        <span className={css.foundCount}>{UI.kit.found(foundIds.size, PERK_IDS.length)}</span>
        <span className={css.foundBar} aria-hidden="true"><span style={{ width: `${((foundIds.size / PERK_IDS.length) * 100).toFixed(1)}%` }} /></span>
        <span className={css.foundSub}>{UI.kit.foundSub}</span>
      </button>
      {groups.map((g) => (
        <section key={g.title} aria-label={g.title}>
          <h2 className={css.groupTitle}>{g.title} <span className={css.groupCount}>{g.ids.length}</span></h2>
          {g.ids.length === 0 ? <p className={css.empty}>{g.empty}</p> : (
            <div className={css.list}>
              {g.ids.map((id, i) => <PerkRow key={`${id}${i}`} id={id} owned={perks} onOpen={setOpen} />)}
            </div>
          )}
        </section>
      ))}
      {doc.retired.length > 0 ? (
        <Panel title={UI.kit.retiredList}>
          <ul className={css.retired}>
            {doc.retired.slice(0, 20).map((r) => (
              <li key={r.id}><Portrait look={core.rollLook(r.seed, r.lookSalt, r.colourSalt)} size={32} label="" /><span>{r.name}</span><span className={css.retiredLevel}>{UI.level(1 + r.picks.length)}</span></li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <Button onClick={() => setRetire(true)} className={css.retireButton}>{UI.kit.retire}</Button>

      <Sheet open={open !== null} title={UI.locker.perkSheet} onClose={() => setOpen(null)}>
        {open ? <PerkDetail id={open} owned={perks} /> : null}
      </Sheet>
      <RetireSheet open={retire} rec={rec} onClose={() => setRetire(false)} />
    </>
  );
}

function RetireSheet({ open, rec, onClose }: { open: boolean; rec: ScrapperRecord; onClose(): void }) {
  const { actions, go, toast } = useGame();
  const [typed, setTyped] = useState("");
  const [bad, setBad] = useState(false);
  const submit = async (): Promise<void> => {
    try {
      const r = await actions.retire(rec.id, typed);
      if (!r.ok) {
        setBad(true);
        return;
      }
      onClose();
      go({ name: "locker" });
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <Sheet open={open} title={UI.kit.retireTitle} onClose={onClose}>
      <form className={css.retireForm} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <p>{UI.kit.retireLine(rec.name)}</p>
        <label className={common.visuallyHidden} htmlFor="rz-retire">{UI.kit.retireField}</label>
        <input id="rz-retire" className={common.field} value={typed} placeholder={rec.name} autoComplete="off" onChange={(e) => { setTyped(e.target.value); setBad(false); }} />
        {bad ? <p className={common.error}>{UI.kit.retireMismatch}</p> : null}
        <Button type="submit" variant="primary">{UI.kit.retireConfirm}</Button>
      </form>
    </Sheet>
  );
}

function RouteTabView({ rec }: { rec: ScrapperRecord }) {
  const { core } = useGame();
  const nodes = useMemo(() => core.route(rec), [core, rec]);
  const sheet = core.sheetOf(rec);
  return (
    <>
      <p className={css.intro}><Sticker size="small" tone="hazard" tilt={-1}>{UI.kit.routeTitle}</Sticker> {UI.kit.routeIntro}</p>
      <ol className={css.timeline}>
        <li className={css.node}>
          <span className={css.nodeLevel}>{UI.kit.start}</span>
          <div className={css.nodeCards}>
            {[...new Set([sheet.startPerk, sheet.startSkill])].map((id) => (
              <span key={id} className={css.startPerk}>
                <PerkIcon id={id} size={44} rarity />
                <span className={css.chipName}>{NAMES[id]}</span>
                <span className={css.startLabel}>{UI.kit.startPerk}</span>
              </span>
            ))}
          </div>
        </li>
        {nodes.map((n) => (
          <li key={n.level} className={css.node}>
            <span className={css.nodeLevel}>{UI.lv(n.level)}</span>
            <div className={css.nodeCards}>
              <RouteCardChip card={n.taken === "L" ? n.left : n.right} taken />
              <RouteCardChip card={n.taken === "L" ? n.right : n.left} taken={false} />
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

function StatsTabView({ rec }: { rec: ScrapperRecord }) {
  const { core } = useGame();
  const sheet = core.sheetOf(rec);
  const top = Math.max(10, ...STAT_KEYS.map((k) => sheet.effective[k]));
  return (
    <>
      <Panel className={css.hpPanel}>
        <div className={css.hpBig}>
          <span className={css.hpIcon}><HeartGlyph size={28} /></span>
          <span className={css.hpLabel}>{UI.maxHp}</span>
          <span className={css.hpValue}>{sheet.maxHp}</span>
        </div>
        <p className={common.sub}>{UI.kit.maxHpLine(sheet.companionCostPct)}</p>
        <div className={css.statList}>
          {STAT_KEYS.map((k) => (
            <div key={k} className={css.stat}>
              <StatBar stat={k} value={sheet.effective[k]} max={top} />
              <p className={css.statLine}>
                <span className={css.statPoints}>{UI.kit.points(sheet.stats.points[k], sheet.stats.mult[k])}</span> {STAT_LINE[k]}
              </p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title={UI.kit.fightValues}>
        <p className={common.sub}>{UI.kit.fightValuesSub}</p>
        <dl className={css.derived}>
          {DERIVED_KEYS.map((k) => {
            const cap = DERIVED_CAP[k];
            return (
              <div key={k} className={css.dv}>
                <dt className={css.dvName}>{DERIVED_NAME[k]}</dt>
                <dd className={css.dvValue}>{sheet.derived[k]}{k === "aim" || k === "pierce" ? "" : "%"}</dd>
                <dd className={css.dvLine}>{DERIVED_LINE[k]}{cap !== null ? <span className={css.dvCap}> ({UI.kit.cap(cap)})</span> : null}</dd>
              </div>
            );
          })}
        </dl>
      </Panel>
      <Panel title={UI.kit.howBouts}>
        <ol className={css.how}>
          {HOW_BOUTS_WORK.map((l) => <li key={l}>{l}</li>)}
        </ol>
      </Panel>
    </>
  );
}
