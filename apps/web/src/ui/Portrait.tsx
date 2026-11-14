/** A scrapper's (or a companion's) head-and-shoulders portrait from the rig, in a small ink frame. */
import type { CompanionId, Look } from "@rankzero/core";
import { rig } from "../seams/rig";
import { SvgArtView } from "./SvgArt";
import css from "./Portrait.module.css";

export type PortraitProps =
  | { look: Look; companion?: undefined; size?: number; label: string; active?: boolean }
  | { companion: CompanionId; look?: undefined; size?: number; label: string; active?: boolean };

export function Portrait(props: PortraitProps) {
  const size = props.size ?? 40;
  const art = props.companion ? rig.companionPortrait(props.companion) : rig.portrait(props.look!);
  return (
    <span className={[css.frame, props.active ? css.active : ""].filter(Boolean).join(" ")} style={{ width: size, height: size }}>
      <SvgArtView art={art} size={size - 4} label={props.label} />
    </span>
  );
}
