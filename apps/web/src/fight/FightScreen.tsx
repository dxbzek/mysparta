/**
 * The fight screen (brief 3.11 D, 3.12). It satisfies `FightScreenProps` and reads only three
 * things from the stage player: `hud(t)`, `state(t)` and `timeline` (cues, step ends, result
 * time). One fight clock drives the canvas, the HUD, the bag strip, the log, the result card
 * and the sound. The frame loop is `requestAnimationFrame`; there is no other timer here.
 *
 * Sound: each frame, the cues the clock crossed by PLAYING are sounded; a seek (skip, scrub,
 * replay, the debug handle) sounds nothing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { stageFor } from "@rankzero/core";
import type { Side } from "@rankzero/core";
import type { Rig } from "@rankzero/rig";
import { createFightClock, createFightPlayer } from "@rankzero/stage";
import type { Cue, FightClock, FightPlayer } from "@rankzero/stage";
import type { FightScreenProps, Settings } from "../contracts";
import { createCueDriver, engineSink } from "../audio/cues";
import type { AudioEngine } from "../audio/engine";
import { sharedAudio, unlockOnFirstGesture } from "../audio/engine";
import { rig as seamRig } from "../seams/rig";
import { actorNames } from "../text/log";
import { STAGE_TEXT } from "../text/stage";
import { STAGE_FONTS } from "../ui/fonts";
import { Sheet } from "../ui/Sheet";
import { beatsOf, litAt } from "./beats";
import { FighterCard, cardInfo } from "./FighterCard";
import { LogStrip } from "./LogStrip";
import { StageOverlay } from "./StageOverlay";
import { Controls } from "./Controls";
import { Hud } from "./Hud";
import { ReplayBar, seekTimeFor } from "./ReplayBar";
import { ResultCard } from "./ResultCard";
import { StageCanvas } from "./StageCanvas";
import { TextLog } from "./TextLog";
import css from "./fight.module.css";

/** What the debug route may drive. Every call is a seek: it never sounds. */
export interface FightHandle { durationMs: number; seek(tMs: number): void; readonly t: number; readonly played: number;
  /** The timeline's sound cues and contact marks, for the recording tool's audio check. */
  readonly cues: readonly Cue[]; readonly contacts: readonly { step: number; at: number }[] }

export interface FightScreenExtraProps {
  rig?: Rig;
  audio?: AudioEngine;
  /** Start here, paused or not (the debug route). */
  startT?: number;
  startPaused?: boolean;
  onHandle?(handle: FightHandle | null): void;
}

/** Skip lands this long before the result card, on the knockout pose (brief 3.12). */
export const SKIP_HOLD_MS = 300;

export function reducedFrom(setting: Settings["reducedMotion"]): boolean {
  if (setting === "on") return true;
  if (setting === "off") return false;
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function FightScreen(props: FightScreenProps & FightScreenExtraProps) {
  const { log, a, b, mode, settings, onSettings, onFinished, result, onResultAction } = props;
  const rig = props.rig ?? seamRig;
  const audio = props.audio ?? sharedAudio();
  const reduced = reducedFrom(settings.reducedMotion);

  const player: FightPlayer = useMemo(
    () => createFightPlayer(log, a, b, rig, { reducedMotion: reduced, cosmeticSeed: log.seed, stage: stageFor(log.seed), text: STAGE_TEXT, fonts: STAGE_FONTS }),
    [log, a, b, rig, reduced],
  );
  const tl = player.timeline;
  const clock: FightClock = useMemo(() => createFightClock(tl.durationMs), [tl]);
  const cues = useMemo(() => createCueDriver(tl.cues, engineSink(audio)), [tl, audio]);
  const [t, setT] = useState(0);
  const [paused, setPaused] = useState(props.startPaused ?? false);
  const finished = useRef(false);

  // A new player (reduced motion switched) keeps the time; a new bout starts at startT.
  useEffect(() => {
    clock.seek(props.startT ?? 0);
    clock.paused = props.startPaused ?? false;
    setPaused(clock.paused);
    setT(clock.t);
    finished.current = false;
  }, [clock]);

  clock.speed = settings.speed;
  audio.enabled = settings.sound;

  useEffect(() => unlockOnFirstGesture(audio), [audio]);

  // The one frame loop: advance the clock, sound what it crossed, show the new time.
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min(100, now - last);
      last = now;
      const from = clock.t;
      const to = clock.tick(dt);
      if (to !== from) {
        cues.advance(from, to);
        setT(to);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [clock, cues]);

  const seek = useCallback((tMs: number) => {
    clock.seek(tMs);
    cues.seek(clock.t);
    setT(clock.t);
  }, [clock, cues]);

  const { onHandle } = props;
  useEffect(() => {
    if (!onHandle) return undefined;
    onHandle({
      durationMs: tl.durationMs,
      seek: (tMs: number) => flushSync(() => seek(tMs)),
      get t() { return clock.t; },
      get played() { return audio.played; },
      cues: tl.cues,
      contacts: tl.contacts.map((c) => ({ step: c.step, at: c.at })),
    });
    return () => onHandle(null);
  }, [onHandle, tl, seek, clock, audio]);

  const hud = player.hud(t);
  const state = player.state(t);
  const ended = hud.phase === "result";

  useEffect(() => {
    if (ended && !finished.current) {
      finished.current = true;
      onFinished("watched");
    }
  }, [ended, onFinished]);

  const sides = useMemo(() => ({ a: { name: a.name, level: a.level }, b: { name: b.name, level: b.level } }), [a, b]);
  const names = useMemo(() => actorNames(log.init, a, b), [log, a, b]);
  const sideNames: Record<Side, string> = useMemo(() => ({ a: a.name, b: b.name }), [a, b]);
  const cards = useMemo(() => ({ a: cardInfo("a", a, log.init.actors), b: cardInfo("b", b, log.init.actors) }), [a, b, log]);
  const beats = useMemo(() => beatsOf(log, tl), [log, tl]);
  const lit = litAt(beats, t);
  // lit tiles hold still (calm fight): no pulsing scale
  const pulse = 0;
  const [logOpen, setLogOpen] = useState(false);
  const closeLog = useCallback(() => setLogOpen(false), []);
  const winner = state.ended?.winner ?? hud.winner ?? log.result.winner;

  const onPlayPause = (): void => {
    void audio.unlock();
    if (ended) {
      seek(0);
      clock.paused = false;
      setPaused(false);
      return;
    }
    clock.paused = !clock.paused;
    setPaused(clock.paused);
  };
  const onSkip = (): void => {
    const target = Math.max(clock.t, tl.resultAt - SKIP_HOLD_MS);
    seek(target);
    clock.paused = false;
    setPaused(false);
    if (!finished.current) {
      finished.current = true;
      onFinished("skipped");
    }
  };
  const onResult = (action: "levelup" | "next" | "replay" | "locker"): void => {
    if (action === "replay" && mode === "replay") {
      seek(0);
      clock.paused = false;
      setPaused(false);
      return;
    }
    onResultAction(action);
  };

  return (
    <div className={`${css.screen} ${mode === "replay" ? css.replayMode : ""}`} data-phase={hud.phase} data-t={Math.round(t)}>
      <Hud frame={hud} sides={sides} actors={log.init.actors} t={t} turn={state.turn} reduced={reduced} />
      <div className={css.stageArea}>
        <StageCanvas player={player} t={t} label={`${a.name} against ${b.name}`} />
        <StageOverlay beats={beats} t={t} reduced={reduced} names={sideNames} />
        <Controls
          paused={paused}
          ended={ended}
          speed={settings.speed}
          sound={settings.sound}
          canSkip={!ended && t < tl.resultAt - SKIP_HOLD_MS}
          onPlayPause={onPlayPause}
          onSpeed={(speed) => onSettings({ speed })}
          onSkip={onSkip}
          onSound={(on) => {
            if (on) void audio.unlock();
            onSettings({ sound: on });
          }}
        />
      </div>
      {mode === "replay" ? (
        <ReplayBar stepsShown={hud.stepsShown} total={log.steps.length} onSeekStep={(n) => seek(seekTimeFor(tl.stepEnd, n))} />
      ) : null}
      <LogStrip steps={log.steps} stepsShown={hud.stepsShown} names={names} live={settings.liveLog && !logOpen} onOpen={() => setLogOpen(true)} />
      <div className={css.lower}>
        <div className={css.cards}>
          {(["a", "b"] as const).map((side) => (
            <FighterCard
              key={side}
              info={cards[side]}
              frame={hud}
              state={state.actors[`${side}0`]}
              pets={cards[side].pets.map((p) => state.actors[p.id])}
              bag={hud.bag[side]}
              lit={lit}
              pulse={pulse}
            />
          ))}
        </div>
        {ended ? <ResultCard resultIn={hud.resultIn} data={mode === "replay" ? null : result} winnerName={sideNames[winner]} onAction={onResult} /> : null}
      </div>
      <Sheet open={logOpen} title="Bout log" onClose={closeLog} closeLabel="Close">
        <TextLog steps={log.steps} stepsShown={hud.stepsShown} names={names} live={false} />
      </Sheet>
    </div>
  );
}
