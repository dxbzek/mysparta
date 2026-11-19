/**
 * The boss banner (the ladder, plan 13.10 item 1): over the first seconds of a boss bout, a "BOSS"
 * tag, the boss's name on a big tape, its rank and street name, and its taunt in a speech box. It
 * reads the fight clock's `t` only: no timer, no CSS animation. It slides in and out over
 * BANNER_IN_MS; with reduced motion it only fades. It never takes a tap.
 */
import type { BossIntro } from "../contracts";
import css from "./fight.module.css";

/** The banner shows from t = 0 to this time (fight ms), fading out over the last BANNER_IN_MS. */
export const BANNER_MS = 3000;
export const BANNER_IN_MS = 300;

/** How far in (0 to 1) the banner is at fight time `t`. Pure. */
export function bannerIn(t: number): number {
  if (t < 0 || t >= BANNER_MS) return 0;
  if (t < BANNER_IN_MS) return t / BANNER_IN_MS;
  if (t > BANNER_MS - BANNER_IN_MS) return (BANNER_MS - t) / BANNER_IN_MS;
  return 1;
}

export function BossBanner({ intro, t, reduced }: { intro: BossIntro; t: number; reduced: boolean }) {
  const u = bannerIn(t);
  if (u <= 0) return null;
  const style = { opacity: u, transform: reduced ? undefined : `translateY(${((1 - u) * -24).toFixed(1)}px)` };
  return (
    <div className={css.bossBanner} style={style} data-testid="boss-banner" role="status">
      <span className={css.bossTag}>BOSS</span>
      <span className={css.bossName}>{intro.name}</span>
      <span className={css.bossTitle}>{intro.title}</span>
      <span className={css.bossTaunt}>{`"${intro.taunt}"`}</span>
    </div>
  );
}
