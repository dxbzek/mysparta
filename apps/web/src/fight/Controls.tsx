/**
 * Fight controls (brief 3.12): pause / play (Replay at the end), speed 1x / 2x / 3x, skip, sound.
 * 3x is a VIP perk (owner, 15 Nov 2026): without VIP its button shows a small lock and a tap
 * calls `onLocked` (the fight screen shows a toast) instead of changing speed.
 * Since the stage-only fight screen (owner, 19 Nov 2026) they sit in the bottom corners of the
 * full-screen stage, as ink discs with light glyphs, with the LOG button last. Every one is a real
 * 44 px button, labelled in words.
 */
import type { ReactNode } from "react";
import css from "./fight.module.css";

export interface ControlsProps {
  paused: boolean;
  ended: boolean;
  speed: 1 | 2 | 3;
  /** Whether 3x is open. */
  vip: boolean;
  sound: boolean;
  canSkip: boolean;
  onPlayPause(): void;
  onSpeed(speed: 1 | 2 | 3): void;
  /** The locked 3x button was tapped. */
  onLocked(): void;
  onSkip(): void;
  onSound(on: boolean): void;
  /** The LOG button: opens the fight drawer (the log and the fighter cards). Absent: no button. */
  onLog?(): void;
}

const Play = () => (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>);
const Pause = () => (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" /></svg>);
const Again = () => (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.2-5.1" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /><path d="M4 3.5v5h5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const Skip = () => (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 5v14l9-7zM13 5v14l7-7z" fill="currentColor" /></svg>);
const SoundOn = () => (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>);
const Lock = () => (<svg className={css.ctlLock} viewBox="0 0 12 14" width="12" height="14" aria-hidden="true"><path d="M3.5 6V4.5a2.5 2.5 0 0 1 5 0V6" fill="none" stroke="currentColor" strokeWidth="1.8" /><rect x="1.5" y="6" width="9" height="7" rx="1.5" fill="currentColor" /></svg>);
const SoundOff = () => (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" /><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>);

function Ctl({ label, onClick, disabled, pressed, wide, hot, locked, children }: { label: string; onClick(): void; disabled?: boolean; pressed?: boolean; wide?: boolean; hot?: boolean; locked?: boolean; children: ReactNode }) {
  return (
    <button type="button" className={`${css.ctl} ${wide ? css.ctlWide : ""} ${hot ? css.ctlHot : ""} ${locked ? css.ctlLocked : ""}`} onClick={onClick} disabled={disabled}
      aria-label={label} title={label} aria-pressed={pressed}>
      <span className={css.ctlDisc}>{children}</span>
    </button>
  );
}

const SPEEDS = [1, 2, 3] as const;

export function Controls(p: ControlsProps) {
  const playLabel = p.ended ? "Replay" : p.paused ? "Play" : "Pause";
  return (
    <>
      <div className={`${css.controls} ${css.controlsLeft}`} role="toolbar" aria-label="Bout controls">
        <Ctl label={playLabel} onClick={p.onPlayPause} hot={p.paused || p.ended}>{p.ended ? <Again /> : p.paused ? <Play /> : <Pause />}</Ctl>
        <span className={css.speeds} role="group" aria-label="Speed">
          {SPEEDS.map((s) => {
            const locked = s === 3 && !p.vip;
            return (
              <Ctl key={s} label={locked ? `Speed ${s}x, a VIP perk` : `Speed ${s}x`} pressed={p.speed === s} hot={p.speed === s} locked={locked}
                onClick={() => (locked ? p.onLocked() : p.onSpeed(s))}>
                <span className={css.ctlWord}>{s}x</span>
                {locked ? <Lock /> : null}
              </Ctl>
            );
          })}
        </span>
      </div>
      <div className={`${css.controls} ${css.controlsRight}`} role="toolbar" aria-label="More bout controls">
        <Ctl label="Skip to the end" onClick={p.onSkip} disabled={!p.canSkip}><Skip /></Ctl>
        <Ctl label={p.sound ? "Sound on" : "Sound off"} pressed={p.sound} onClick={() => p.onSound(!p.sound)}>{p.sound ? <SoundOn /> : <SoundOff />}</Ctl>
        {p.onLog ? <Ctl label="Open the bout log and the fighter cards" wide onClick={p.onLog}><span className={css.ctlWord}>LOG</span></Ctl> : null}
      </div>
    </>
  );
}
