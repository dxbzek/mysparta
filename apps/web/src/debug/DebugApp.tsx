/**
 * The debug pages (fight-screen lane): the bout route that drives the fight screen from a fixture
 * or a seed, the Locker mock, and a page of every UI part. The bout route sets `window.__rz`
 * (the frozen `DebugHandle`) so a script can seek the fight clock frame by frame.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import * as core from "@rankzero/core";
import type { BagItem, BoutLog, FighterSnapshot } from "@rankzero/core";
import { BOUT_FIXTURES, SNAPSHOTS, l10Raccoon, l1Fists, l1Knife, l1Pipe, l20Thrower } from "@rankzero/core/fixtures";
import type { DebugHandle, ResultCardData, Settings } from "../contracts";
import { BagStrip } from "../fight/BagStrip";
import { RigGate } from "../app/RigGate";
import { FightScreen } from "../fight/FightScreen";
import type { FightHandle } from "../fight/FightScreen";
import { ActorStage } from "../ui/ActorStage";
import { Button } from "../ui/Button";
import { LockerView } from "../ui/LockerView";
import type { LockerPrimary, LockerViewProps } from "../ui/LockerView";
import { loadFonts } from "../ui/fonts";
import { Panel } from "../ui/Panel";
import { PerkIcon } from "../ui/PerkIcon";
import { Portrait } from "../ui/Portrait";
import { Sheet } from "../ui/Sheet";
import { StatBar } from "../ui/StatBar";
import { Sticker } from "../ui/Sticker";
import { TabBar } from "../ui/TabBar";
import type { DebugRoute } from "./route";
import { parseDebugRoute } from "./route";

const noop = (): void => undefined;

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = (): void => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

type Simulate = (seed: number, a: FighterSnapshot, b: FighterSnapshot, rulesVersion: 1) => BoutLog;

function boutFor(route: Extract<DebugRoute, { page: "bout" }>): { log: BoutLog; a: FighterSnapshot; b: FighterSnapshot } | string {
  if (route.fixture) return BOUT_FIXTURES[route.fixture];
  if (route.find !== null) {
    // the same candidate as tools/find-bout.ts: rivals 2n and 2n + 1, seed hash("find-bout", n)
    const n = route.find;
    const a = core.rivalSnapshot(core.REALM_SALT, route.level, 2 * n);
    const b = core.rivalSnapshot(core.REALM_SALT, route.level, 2 * n + 1);
    return { log: core.simulateFight(core.combineSeed("find-bout", n), a, b, 1), a, b };
  }
  const simulate = (core as unknown as { simulateFight?: Simulate }).simulateFight;
  if (typeof simulate !== "function") return "The sim is not in this build yet: use ?fixture=bout-gate.";
  const pick = (name: string | null, fallback: FighterSnapshot): FighterSnapshot =>
    (name !== null ? (SNAPSHOTS as Record<string, FighterSnapshot>)[name] : undefined) ?? fallback;
  const a = pick(route.a, l1Pipe);
  const b = pick(route.b, l1Knife);
  return { log: simulate(route.seed ?? 1, a, b, 1), a, b };
}

function DebugBout({ route }: { route: Extract<DebugRoute, { page: "bout" }> }) {
  const bout = useMemo(() => boutFor(route), [route]);
  const [settings, setSettings] = useState<Settings>({ sound: route.sound, speed: route.speed, reducedMotion: route.reduced, liveLog: true, isVip: route.vip });
  const [fontsReady, setFontsReady] = useState(false);
  const [handle, setHandle] = useState<FightHandle | null>(null);
  useEffect(() => {
    void loadFonts().then(() => setFontsReady(true));
  }, []);
  useEffect(() => {
    if (!handle || !fontsReady) {
      window.__rz = { ready: false, durationMs: 0, seek: noop };
      return;
    }
    const h: DebugHandle & Omit<FightHandle, "seek" | "durationMs"> = {
      ready: true,
      durationMs: handle.durationMs,
      seek: (tMs: number) => handle.seek(tMs),
      get t() { return handle.t; },
      get played() { return handle.played; },
      cues: handle.cues,
      contacts: handle.contacts,
    };
    window.__rz = h;
  }, [handle, fontsReady]);
  const onHandle = useCallback((h: FightHandle | null) => setHandle(h), []);
  if (typeof bout === "string") return <p style={{ padding: 16 }}>{bout}</p>;
  const won = bout.log.result.winner === "a";
  const result: ResultCardData = { won, line: won ? `${bout.a.name} folded ${bout.b.name} like a deckchair.` : `${bout.a.name} went looking for a fight and found a better one.`, xpBefore: 3, xpAfter: won ? 5 : 4, xpToNext: 8, levelUp: false, boutsLeft: 5 };
  return (
    <RigGate>
    <FightScreen
      log={bout.log}
      a={bout.a}
      b={bout.b}
      mode={route.replay ? "replay" : "live"}
      settings={settings}
      onSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
      onFinished={noop}
      result={route.replay ? null : result}
      onResultAction={noop}
      startT={route.t}
      startPaused={route.paused}
      onHandle={onHandle}
    />
    </RigGate>
  );
}

/** Fixture props for the Locker mock. Kept here so the screenshot never depends on a save. */
export function lockerMockProps(over: { levelUp?: boolean; done?: boolean } = {}): LockerViewProps {
  const primary: LockerPrimary = over.levelUp ? { kind: "levelup" } : over.done ? { kind: "done", backIn: "5 h 12 min" } : { kind: "fight", boutsLeft: 4 };
  return {
    roster: [
      { id: "r1", name: l10Raccoon.name, look: l10Raccoon.look },
      { id: "r2", name: l1Fists.name, look: l1Fists.look },
    ],
    activeId: "r1",
    canAdd: true,
    name: l10Raccoon.name,
    level: l10Raccoon.level,
    look: l10Raccoon.look,
    held: "bat",
    companions: ["raccoon"],
    xp: 5,
    xpToNext: 8,
    maxHp: 98,
    stats: { strength: 11, agility: 6, speed: 4 },
    statScale: 16,
    primary,
    kit: [...l10Raccoon.perks, "padding", "tarp", "pipe", "whistle"],
    bouts: [
      { id: "b1", won: true, opponent: "Wren", line: "Old Roy folded Wren like a deckchair.", xp: 2 },
      { id: "b2", won: false, opponent: "Tack", line: "Old Roy went looking for a fight and found a better one.", xp: 1 },
      { id: "b3", won: true, opponent: "Nettle", line: "Nettle brought fists to a bat fight.", xp: 1 },
    ],
    tab: "home",
    heroT: 400,
    onSelect: noop, onAdd: noop, onSettings: noop, onPrimary: noop, onKitItem: noop,
    onSeeAllKit: noop, onReplay: noop, onAllBouts: noop, onTab: noop,
  };
}

function DebugLocker({ route }: { route: Extract<DebugRoute, { page: "locker" }> }) {
  useEffect(() => {
    void loadFonts().then(() => { window.__rz = { ready: true, durationMs: 0, seek: noop }; });
  }, []);
  return <LockerView {...lockerMockProps({ levelUp: route.levelUp, done: route.done })} />;
}

/** A 12-item bag: the overflow case of the gate (8 icons and "+4"). */
export const BIG_BAG: BagItem[] = [
  ...(["pipe", "bat", "crowbar", "shovel", "darts", "bricks", "rebar", "umbrella", "broom"] as const).map((id) => ({ k: "weapon" as const, id })),
  { k: "move", id: "tarp", uses: 1 }, { k: "move", id: "firecrackers", uses: 2 }, { k: "move", id: "haymaker", uses: 1 },
];

function DebugUi() {
  const [sheet, setSheet] = useState(false);
  const [tab, setTab] = useState<"home" | "kit" | "history">("home");
  useEffect(() => {
    void loadFonts().then(() => { window.__rz = { ready: true, durationMs: 0, seek: noop }; });
  }, []);
  return (
    <>
    {/* full page width, as in the fight screen: the 390 px overflow case of the gate */}
    <div data-testid="bag-12" style={{ maxWidth: 560, margin: "0 auto" }}>
      <BagStrip bag={{ a: BIG_BAG, b: BIG_BAG.slice(0, 3) }} names={{ a: "Tack", b: "Cuff" }} />
    </div>
    <div style={{ display: "grid", gap: 16, padding: 12, maxWidth: 560, margin: "0 auto" }}>
      <Panel title="Buttons">
        <div style={{ display: "grid", gap: 10 }}>
          <Button variant="primary">Fight (4 bouts left)</Button>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button>Back</Button>
            <Button variant="hazard">2x</Button>
            <Button variant="dark">Locker</Button>
            <Button square aria-label="Add">+</Button>
          </div>
        </div>
      </Panel>
      <Panel tone="dark" title="Stickers">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Sticker>Brisket</Sticker>
          <Sticker tone="hazard" tilt={2}>Level 4</Sticker>
          <Sticker tone="action" tilt={-1}>Payback</Sticker>
          <Sticker tone="win" size="small">W</Sticker>
          <Sticker tone="loss" size="small">L</Sticker>
        </div>
      </Panel>
      <Panel title="Stats">
        <StatBar stat="health" value={9} max={16} />
        <StatBar stat="strength" value={11} max={16} />
        <StatBar stat="agility" value={6} max={16} />
        <StatBar stat="speed" value={4} max={16} />
      </Panel>
      <Panel title="Kit and portraits">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {l20Thrower.perks.slice(0, 5).map((id) => <PerkIcon key={id} id={id} rarity />)}
          <Portrait look={l1Pipe.look} label={l1Pipe.name} size={44} />
          <Portrait companion="goose" label="Goose" size={44} />
        </div>
      </Panel>
      <Panel tone="dark" flush>
        <ActorStage look={l1Pipe.look} held="pipe" clip="swing" height={200} label="Cuff swinging the Pipe" t={150} />
      </Panel>
      <Button onClick={() => setSheet(true)}>Open a sheet</Button>
      <TabBar<"home" | "kit" | "history"> tabs={[{ key: "home", label: "Home" }, { key: "kit", label: "Kit" }, { key: "history", label: "History" }]} active={tab} onSelect={setTab} />
      <Sheet open={sheet} title="Face-off" onClose={() => setSheet(false)} height={0.6}>
        <ActorStage look={l1Knife.look} held="pocket-knife" facing={-1} height={160} label="Brisket" />
      </Sheet>
    </div>
    </>
  );
}

export function DebugApp() {
  const hash = useHash();
  const route = useMemo(() => parseDebugRoute(hash || "#/debug/bout?fixture=bout-gate"), [hash]);
  switch (route.page) {
    case "bout":
      return <DebugBout key={hash} route={route} />;
    case "locker":
      return <DebugLocker route={route} />;
    case "ui":
      return <DebugUi />;
    default:
      return (
        <p style={{ padding: 16 }}>
          Unknown debug route. Try <a href="#/debug/bout?fixture=bout-gate">a bout</a>, <a href="#/debug/locker">the Locker</a> or <a href="#/debug/ui">the UI parts</a>.
        </p>
      );
  }
}
