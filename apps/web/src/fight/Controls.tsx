/**
 * Fight controls (brief 3.12): pause / play (Replay at the end), speed 1x / 2x, skip, sound.
 * Fight screen v2: they sit small over the top corners of the stage, out of the fight's way, as
 * ink discs with light glyphs. Every one is still a real 44 px button, labelled in words.
 */
import type { ReactNode } from "react";
import css from "./fight.module.css";

export interface ControlsProps {
  paused: boolean;
  ended: boolean;
  speed: 1 | 2;
  sound: boolean;
  canSkip: boolean;
  onPlayPause(): void;
  onSpeed(speed: 1 | 2): void;
  onSkip(): void;
  onSound(on: boolean): void;
}

const Play = () => (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>);
const Pause = () => (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" /></svg>);
const Again = () => (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.2-5.1" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /><path d="M4 3.5v5h5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const Skip = () => (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 5v14l9-7zM13 5v14l7-7z" fill="currentColor" /></svg>);
const SoundOn = () => (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>);
const SoundOff = () => (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" /><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>);

function Ctl({ label, onClick, disabled, pressed, wide, hot, children }: { label: string; onClick(): void; disabled?: boolean; pressed?: boolean; wide?: boolean; hot?: boolean; children: ReactNode }) {
  return (
    <button type="button" className={`${css.ctl} ${wide ? css.ctlWide : ""} ${hot ? css.ctlHot : ""}`} onClick={onClick} disabled={disabled}
      aria-label={label} title={label} aria-pressed={pressed}>
      <span className={css.ctlDisc}>{children}</span>
    </button>
  );
}

export function Controls(p: ControlsProps) {
  const playLabel = p.ended ? "Replay" : p.paused ? "Play" : "Pause";
  return (
    <>
      <div className={`${css.controls} ${css.controlsLeft}`} role="toolbar" aria-label="Bout controls">
        <Ctl label={playLabel} onClick={p.onPlayPause} hot={p.paused || p.ended}>{p.ended ? <Again /> : p.paused ? <Play /> : <Pause />}</Ctl>
        <Ctl label={`Speed ${p.speed}x. Switch to ${p.speed === 2 ? 1 : 2}x`} wide hot={p.speed === 2} onClick={() => p.onSpeed(p.speed === 2 ? 1 : 2)}>
          <span className={css.ctlWord}>{p.speed}x</span>
        </Ctl>
      </div>
      <div className={`${css.controls} ${css.controlsRight}`} role="toolbar" aria-label="More bout controls">
        <Ctl label="Skip to the end" onClick={p.onSkip} disabled={!p.canSkip}><Skip /></Ctl>
        <Ctl label={p.sound ? "Sound on" : "Sound off"} pressed={p.sound} onClick={() => p.onSound(!p.sound)}>{p.sound ? <SoundOn /> : <SoundOff />}</Ctl>
      </div>
    </>
  );
}
