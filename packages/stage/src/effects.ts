/**
 * What happens at the moment of contact, and the stickers around it (brief 3.12).
 *
 * The moment of contact is ONE value per swing. Flash, flinch, knockback, burst, number, HP,
 * shake, crowd and sound are all scheduled from it here, and from nothing else. The
 * `ContactMark.starts` record says which of the nine play (null = not for this contact); the
 * stage's test does not trust it and measures every start from sampled frames.
 * Block and evade, the skill tag, the OVERTIME sticker and the ticket tape are here too.
 */
import type { ActorId, HeldId, MoveId, PerkId, Proc, SkillId } from "@rankzero/core";
import { MOVE_IDS, SKILL_IDS, WEAPON_META, content, impactFamily } from "@rankzero/core";
import { toStage } from "@rankzero/rig";
import type { EffectKey, SfxItem } from "./contracts";
import { noise } from "./cues";
import { frameSpan } from "./camera";
import { drawnScale } from "./footwork";
import { segAt } from "./track";
import { CORAL, GREEN, INK, PAPER, SKY, VOLT, WHITE } from "./palette";
import type { TagItem, TagRole } from "./model";
import type { Builder } from "./timeline";
import { CONTACT, MOVE, OUTCOME, TEXT } from "./tuning";
import type { Zone } from "./layout";
import { STAGE_W, aimZone, hitOffset } from "./layout";

export interface Landing {
  i: number; at: number; attacker: ActorId | null; target: ActorId;
  outcome: "hit" | "evade" | "block"; damage: number; crit: boolean; hpAfter: number;
  weapon: HeldId | null;
  /** Heavy flinch forced (a Haymaker swing). Otherwise a crit or 25% of max HP. */
  heavy?: boolean;
  hitStop: number;
  /** No flinch clip and no knockback: the target plays its own clip (slammed). */
  ownClip?: boolean;
  /** The Firecrackers' own burst instead of the star. */
  burstFx?: "burst" | "crackers";
  /** Where the burst goes instead of the target's hit point (a rolled Tyre: at the shins). */
  burstAt?: { x: number; y: number };
  procs?: readonly Proc[];
}

const clampNum = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** The point on the target that is hit, as a stage point at time `at`. */
export function hitSpot(b: Builder, target: ActorId, at: number, zone: Zone = "body"): { x: number; y: number } {
  const tr = b.track(target);
  const p = b.place(target, at);
  return toStage(p, hitOffset(b.rig, tr.rig, b.dress(target), zone));
}
/** Above the head, where numbers and tags pop. */
/** What struck: the weapon of the step, else the attacking companion, else fists. */
function hitItem(b: Builder, L: Landing): SfxItem {
  if (L.weapon !== null) return L.weapon;
  if (L.attacker !== null && b.has(L.attacker)) return b.soundItem(L.attacker, "fists");
  return "fists";
}

export function overHead(b: Builder, id: ActorId, at: number): { x: number; y: number } {
  const tr = b.track(id);
  const p = b.place(id, at);
  const head = toStage(p, b.rig.hitPoint(tr.rig, b.dress(id), "head"));
  return { x: head.x, y: head.y - (tr.rig === "scrapper" ? 16 : 12) };
}

/**
 * A tag over an actor. It rides on the actor (drawn over its head wherever it is in the frame);
 * where it stands among the other tags, so no two ever overlap, is labels.ts's job at draw time
 * (they used to stack by count in stage units, and the clamp to the top band undid the stack:
 * HEAD START! covered HAYMAKER in 3 of 3 bouts). Every tag is the same small size; `role` says
 * what it is (a Move's name, a result, a proc, a note, the CRIT).
 */
export function tagOver(b: Builder, id: ActorId, at: number, text: string, colour: string, ms: number = OUTCOME.tagMs,
  icon?: PerkId, role: TagRole = "note"): void {
  const p = overHead(b, id, at);
  const base = b.place(id, at);
  const tag: TagItem = { from: at, to: at + ms, text, colour, ink: INK, actor: id, x: p.x, y: p.y, size: TEXT.tag, kind: "tag", role,
    follow: id, dx: (p.x - base.x) * base.facing, dy: p.y - base.y };
  if (icon !== undefined) tag.icon = icon;
  b.tags.push(tag);
}

/**
 * The CRIT sticker beside the crit's number, not above it (review finding 23: the number rose
 * straight into the sticker and hid under it). It stands level with where the number starts, on
 * the side away from the attacker, its edge `TEXT.critGap` clear of the number's widest box (the
 * number pops at `CONTACT.numberPopFrom` x `CONTACT.critScale` of `TEXT.number`), so the number
 * rises past it. Near a stage edge it goes on the other side.
 */
export function critTag(b: Builder, id: ActorId, at: number, head: { x: number; y: number }, number: string, dir: 1 | -1): void {
  const text = b.opts.text.crit;
  const numberHalf = (TEXT.glyph * TEXT.number * CONTACT.critScale * CONTACT.numberPopFrom * number.length) / 2;
  const tagHalf = (TEXT.glyph * TEXT.tag * text.length + 0.9 * TEXT.tag) / 2;
  const off = numberHalf + TEXT.critGap + tagHalf;
  const fits = (sd: 1 | -1): boolean => head.x + sd * off - tagHalf >= 4 && head.x + sd * off + tagHalf <= STAGE_W - 4;
  const side = fits(dir) ? dir : -dir;
  b.tags.push({ from: at, to: at + OUTCOME.tagMs, text, colour: VOLT, ink: INK, actor: id, x: head.x + side * off, y: head.y,
    size: TEXT.tag, kind: "tag", role: "crit" });
}

/** The skill tag of a step: at most one, the first proc (the sim lists the rarest first), with the
 *  skill's icon and an exclamation mark ("PARRY!"), held long enough to read. */
export function skillTag(b: Builder, procs: readonly Proc[] | undefined, at: number): void {
  const p = procs?.[0];
  if (p === undefined || !b.has(p.by)) return;
  tagOver(b, p.by, at, `${b.opts.text.skillName(p.skill).toUpperCase()}!`, SKY, OUTCOME.skillTagMs, p.skill as PerkId, "proc");
  // every passive that procs also shows on the body (sigs.ts: an armour plate's flash, a blade's
  // glint, steam off a stubborn head), not only in words
  const seen = new Set<string>();
  for (const q of procs ?? []) {
    if (!b.has(q.by) || !PASSIVES.has(q.skill) || seen.has(`${q.by}|${q.skill}`)) continue;
    seen.add(`${q.by}|${q.skill}`);
    b.sigs.push({ kind: "proc", skill: q.skill as SkillId, actor: q.by, target: null, from: at, to: at + MOVE.procMarkMs });
  }
}
/** The passives (the skills with a fight moment of their own and no Move). */
export const PASSIVES: ReadonlySet<string> = new Set(SKILL_IDS.filter((id) => content.skills[id].kind === "passive"
  && !(MOVE_IDS as readonly string[]).includes(id)));

/** A Move's visible result over an actor, in the host's words ("-25 AIM", "SNARED"), with the
 *  Move's icon. No words from the host: no tag. */
export function resultTag(b: Builder, move: MoveId, id: ActorId, at: number, colour: string, part?: "pet"): void {
  const text = b.opts.text.moveResult?.(move, part) ?? "";
  if (text === "" || !b.has(id)) return;
  tagOver(b, id, at, text.toUpperCase(), colour, MOVE.resultMs, move, part === "pet" ? "note" : "result");
}

/** Lands one swing, throw or Move hit on one target. Returns the contact's index. */
export function land(b: Builder, L: Landing, ci?: number): number {
  const ttr = b.track(L.target);
  const m = b.motion;
  const hit = L.outcome === "hit";
  const kill = L.i === b.killStep;
  // calm camera: the screen shakes only on a crit or the knockout blow, the crowd stirs only at the knockout
  const shakes = m.shake && (kill || L.crit);
  const stirs = m.crowd && kill;
  const before = b.hpNow.get(L.target) ?? ttr.maxHp;
  const starts: Partial<Record<EffectKey, number | null>> = hit
    ? { flash: m.flash ? L.at : null, flinch: L.ownClip === true ? null : L.at, knockback: L.ownClip === true ? null : L.at,
        burst: L.at, number: L.at, hp: L.at, shake: shakes ? L.at : null, crowd: stirs ? L.at : null, sound: L.at }
    : L.outcome === "block" ? { burst: L.at, sound: L.at } : { sound: L.at };
  const c = ci ?? b.addContact(L.i, L.at, starts);
  if (ci !== undefined) {
    // a second target of the same contact (Firecrackers): the same moment, more effects
    const mark = b.contacts[ci]!;
    for (const k of Object.keys(starts) as EffectKey[]) if (starts[k] !== null && starts[k] !== undefined) mark.starts[k] = L.at;
  }
  const s = (k: EffectKey): number => b.effectStart(c, k, L.at);
  // a pet's bite lands on a fighter's legs (layout.aimZone)
  const spot = L.burstAt ?? hitSpot(b, L.target, L.at, L.attacker !== null && b.has(L.attacker) ? aimZone(b.track(L.attacker).rig, ttr.rig, 0) : "body");
  const dir: 1 | -1 = L.attacker !== null && b.place(L.attacker, L.at).x > b.place(L.target, L.at).x ? -1 : 1;
  const seed = (b.opts.cosmeticSeed ^ (L.i * 7919)) | 0;

  if (hit) {
    const heavy = L.heavy === true || L.crit || L.damage >= CONTACT.heavyShare * ttr.maxHp;
    if (m.flash) b.flashes.push({ actor: L.target, from: s("flash"), ms: CONTACT.flashMs, contact: c });
    if (L.ownClip !== true) {
      b.play(L.target, b.flinchClip(ttr.rig, heavy), s("flinch"), { flinchOf: c });
      if (!b.knockStep(L.target, s("knockback"), heavy, dir, c)) {
        const amount = clampNum(CONTACT.knockbackBase + (CONTACT.knockbackPerHp * L.damage) / ttr.maxHp,
          CONTACT.knockbackMin, CONTACT.knockbackMax) * m.knockback;
        b.nudge({ actor: L.target, key: "knockback", from: s("knockback"), outMs: CONTACT.knockbackOutMs, holdMs: 0,
          backMs: CONTACT.knockbackBackMs, dx: dir * amount, arc: 0, contact: c });
      }
    }
    const fx = L.burstFx ?? "burst";
    if (fx === "crackers") {
      // the bundle has landed at the feet: its pops (the second part of the crackers effect) go off all round the target
      const feet = b.place(L.target, L.at);
      b.fx.push({ fx, from: s("burst"), to: s("burst") + MOVE.crackersMs, x: feet.x, y: feet.y - 2, facing: 1, seed, contact: c,
        key: "burst", p0: MOVE.crackersLit, p1: 1 });
    } else {
      b.fx.push({ fx, from: s("burst"), to: s("burst") + CONTACT.burstMs, x: spot.x, y: spot.y, facing: dir === 1 ? -1 : 1, seed,
        contact: c, key: "burst" });
    }
    const head = overHead(b, L.target, L.at);
    b.numbers.push({ from: s("number"), x: head.x, y: head.y, text: `-${L.damage}`, colour: L.crit ? VOLT : WHITE,
      scale: L.crit ? CONTACT.critScale : 1, contact: c });
    if (L.crit) critTag(b, L.target, L.at, head, `-${L.damage}`, dir);
    b.hp.push({ actor: L.target, at: s("hp"), from: before, to: L.hpAfter, ms: CONTACT.hpDropMs, kind: "loss", contact: c });
    if (shakes) {
      const k = kill ? CONTACT.shake.knockout : CONTACT.shake.crit;
      b.shakes.push({ from: s("shake"), ms: k.ms, amp: k.amp * (b.internal.shakeScale ?? 1), contact: c, seed });
    }
    if (stirs) {
      b.crowds.push({ from: s("crowd"), ms: CONTACT.crowdMs, contact: c });
      b.cue(s("crowd"), L.i, "crowd");
    }
    b.cue(s("sound"), L.i, impactFamily(L.weapon), 0, hitItem(b, L), "body");
    b.lastHitAt.set(L.target, L.at);
  } else if (L.outcome === "block") {
    // A shield on the back arm comes up and takes the blow (content v2); otherwise the arms do.
    const shield = b.shieldNow.get(L.target) ?? null;
    guardUp(b, L.target, L.at);
    b.play(L.target, shield !== null && ttr.rig === "scrapper" ? "block-shield" : "block", L.at);
    if (ttr.rig === "scrapper" && b.internal.easedDash !== true) {
      // the blow drives him back 6 units (eased out); the block clip's feet step with it, the front
      // foot holding its spot (rig content/clips/reactions.ts). He stays there and shuffles home
      // at the next way home (footwork.ts), so no foot slides back over the floor.
      const p = b.place(L.target, L.at);
      b.move(L.target, L.at, OUTCOME.blockSlideMs, p.x + dir * OUTCOME.blockSlide * drawnScale(b, L.target), p.y, 0, "out");
      b.out.add(L.target);
    } else {
      b.nudge({ actor: L.target, key: "slide", from: L.at, outMs: OUTCOME.blockSlideMs, holdMs: 120, backMs: OUTCOME.blockSlideBackMs,
        dx: dir * OUTCOME.blockSlide, arc: 0, contact: null });
    }
    b.fx.push({ fx: "spark", from: s("burst"), to: s("burst") + CONTACT.burstMs, x: spot.x, y: spot.y, facing: 1, seed,
      contact: c, key: "burst" });
    // a carried shield that took it is named by its own tag ("WOODEN PALLET!"): no BLOCK under it
    const shieldTag = shield !== null && L.procs?.[0]?.skill === shield;
    if (!shieldTag) tagOver(b, L.target, L.at, b.opts.text.block, PAPER, OUTCOME.blockTagMs);
    if (L.attacker !== null) {
      b.nudge({ actor: L.attacker, key: "recoil", from: L.at, outMs: OUTCOME.recoilMs * 0.5, holdMs: 0, backMs: OUTCOME.recoilMs,
        dx: -dir * OUTCOME.recoil, arc: 0, contact: null });
    }
    // the shield takes the blow; otherwise the attacker's item meets the parrying weapon or the arms
    const parry = ttr.rig === "scrapper" && (b.heldNow.get(L.target) ?? "fists") !== "fists";
    if (shield !== null) b.cue(s("sound"), L.i, "block", 0, shield, "shield");
    else b.cue(s("sound"), L.i, "block", 0, hitItem(b, L), parry ? "weapon" : "body");
  } else {
    // evade: the defender is already hopping back (see `evadeEarly`); the swing completes in a whoosh
    b.fx.push({ fx: "whoosh", from: L.at, to: L.at + CONTACT.burstMs, x: spot.x, y: spot.y, facing: dir, seed, contact: null });
    tagOver(b, L.target, L.at, b.opts.text.miss, PAPER);
    b.cue(s("sound"), L.i, "whoosh", 0, hitItem(b, L));
  }
  skillTag(b, L.procs, L.at);
  b.hpNow.set(L.target, L.hpAfter);
  return c;
}

/** A block or a dodge starts from the raised guard (the brace's end). A scrapper standing idle
 *  when one comes (no dash to brace against: a combo swing, a riposte, a throw) raises it in the
 *  moments before, so the cut into the block or the dodge is from that guard and its feet stay
 *  put; one busy with another clip cuts straight from it. */
export function guardUp(b: Builder, id: ActorId, at: number): void {
  const tr = b.track(id);
  if (tr.rig !== "scrapper" || b.internal.easedDash === true) return;
  const now = segAt(tr, at - 0.5);
  if (now !== null && (now.clip === "brace" || now.busy)) return;
  const braceMs = b.info("scrapper", "brace").durationMs;
  let from = at - braceMs;
  for (const g of tr.segs) if (g.to <= at && g.to > from) from = g.to;
  if (at - from < OUTCOME.guardMinMs) return;
  b.play(id, "brace", from, { rate: braceMs / (at - from), until: at, busy: false });
}

/** What was swung at the defender, for its choice of dodge. */
export interface Swung { clip: string; weapon: HeldId | null; combo: boolean }

/** Which dodge a scrapper uses (movement pass 2). A light or fast blow that comes straight in
 *  (fists, a light weapon, a jab, a flick, a thrust, a thrown thing) is slipped: he ducks under it.
 *  A heavy swing (a heavy weapon, a two-hand swing or smash, a blade's slash coming down, a pet
 *  going for the legs) is hopped away from: a duck would put the head under it. A one-hand side
 *  swing of anything else is slipped or hopped by the log's seed and the step. Deterministic, and
 *  the sim is not asked. */
export function dodgeOf(b: Builder, i: number, attacker: ActorId, swung: Swung | null): "slip" | "evade" {
  if (b.has(attacker) && b.track(attacker).rig !== "scrapper") return "evade";
  if (swung === null) return "slip";
  const tags: readonly string[] = swung.weapon !== null ? WEAPON_META[swung.weapon]?.tags ?? [] : [];
  if (tags.includes("heavy") || ["smash", "swing-2h", "swing-low", "slam"].includes(swung.clip)) return "evade";
  if (tags.includes("light") || ["punch", "flick", "thrust", "thrust-1h", "throw"].includes(swung.clip)) return "slip";
  if (tags.includes("blade")) return "evade";
  return noise(b.log.seed, i, 0x5119) < OUTCOME.slipShare ? "slip" : "evade";
}

/** An evade starts before the contact, so the swing passes where the defender was. A scrapper
 *  slips it (ducks under it, feet planted) or hops back from it (`dodgeOf`): the hop is carried
 *  22 units back on a 14-unit arc while the evade clip's feet are off the floor, and he stays
 *  there until the next way home (footwork.ts). A pet hops back and returns. Call it after the
 *  swing is planned. */
export function evadeEarly(b: Builder, target: ActorId, attacker: ActorId, at: number, i = 0, swung: Swung | null = null): void {
  const from = at - OUTCOME.evadeLead;
  const dir: 1 | -1 = b.place(attacker, at).x > b.place(target, at).x ? -1 : 1;
  const tr = b.track(target);
  if (tr.rig === "scrapper" && b.internal.easedDash !== true) {
    guardUp(b, target, from);
    if (dodgeOf(b, i, attacker, swung) === "slip") {
      const info = b.info(tr.rig, "slip");
      b.play(target, "slip", from, { until: from + (info.loop ? OUTCOME.evadeMs : info.durationMs) });
      return;
    }
    b.play(target, "evade", from);
    const p = b.place(target, from + OUTCOME.evadeUp);
    b.move(target, from + OUTCOME.evadeUp, OUTCOME.evadeDown - OUTCOME.evadeUp, p.x + dir * OUTCOME.evadeHop * drawnScale(b, target), p.y,
      OUTCOME.evadeArc, "linear");
    b.out.add(target);
    return;
  }
  if (tr.rig !== "scrapper") {
    // a pet has no dodge clip: it springs back off its legs (its run, in the air on the hop's arc),
    // stands its ground, and runs back in (review finding 20: it used to glide in its idle pose)
    const hold = OUTCOME.petEvadeHoldMs;
    // the hop stays inside the camera's bout frame (verifier: a crow at the stage's edge hopped out
    // of view); with no room behind it, it leaps up on the spot, never toward the attacker
    const span = frameSpan(b);
    const q = b.place(target, from);
    const m = Math.max(tr.reach.back, tr.reach.front);
    const to = Math.min(span.x1 - m, Math.max(span.x0 + m, q.x + dir * OUTCOME.evadeHop));
    const dx = dir * Math.max(0, dir * (to - q.x));
    b.play(target, "run", from, { until: from + OUTCOME.evadeMs });
    b.play(target, "run", from + OUTCOME.evadeMs + hold, { until: from + OUTCOME.evadeMs + hold + OUTCOME.petEvadeBackMs });
    b.nudge({ actor: target, key: "hop", from, outMs: OUTCOME.evadeMs, holdMs: hold, backMs: OUTCOME.petEvadeBackMs,
      dx, arc: OUTCOME.evadeArc, contact: null });
    return;
  }
  b.play(target, "evade", from);
  b.nudge({ actor: target, key: "hop", from, outMs: OUTCOME.evadeMs, holdMs: 260, backMs: 220, dx: dir * OUTCOME.evadeHop,
    arc: OUTCOME.evadeArc, contact: null });
}

/** A heal: a Teal "+N", a ring of small plus shapes for 400 ms, the HP bar fills over 200 ms. */
export function healAt(b: Builder, i: number, target: ActorId, at: number, amount: number, hpAfter: number): void {
  const before = b.hpNow.get(target) ?? b.track(target).maxHp;
  const head = overHead(b, target, at);
  const p = b.place(target, at);
  // (an fx that follows its actor takes x as an offset in its facing: 0 is on the actor)
  // (the plus signs rise from 30 units over `at`: a scrapper's chest; a pet's are lowered to its back)
  b.fx.push({ fx: "plus", from: at, to: at + OUTCOME.healRingMs, x: 0, y: 0, facing: p.facing,
    seed: (b.opts.cosmeticSeed ^ i) | 0, contact: null, follow: target, dy: b.track(target).rig === "scrapper" ? 0 : 30 });
  b.numbers.push({ from: at, x: head.x, y: head.y, text: `+${amount}`, colour: GREEN, scale: 1.25, contact: null });
  b.hp.push({ actor: target, at, from: before, to: hpAfter, ms: OUTCOME.healFillMs, kind: "gain", contact: null });
  b.hpNow.set(target, hpAfter);
  b.busy(at, at + OUTCOME.healRingMs);
}

/** An overtime loss: a small coral number and an HP drop, no dash and no flinch clip. */
export function overtimeLoss(b: Builder, i: number, actor: ActorId, at: number, damage: number, hpAfter: number): number {
  const before = b.hpNow.get(actor) ?? b.track(actor).maxHp;
  const c = b.addContact(i, at, { number: at, hp: at });
  const head = overHead(b, actor, at);
  b.numbers.push({ from: b.effectStart(c, "number", at), x: head.x, y: head.y, text: `-${damage}`, colour: CORAL, scale: 0.75, contact: c });
  b.hp.push({ actor, at: b.effectStart(c, "hp", at), from: before, to: hpAfter, ms: CONTACT.hpDropMs, kind: "loss", contact: c });
  b.hpNow.set(actor, hpAfter);
  b.lastHitAt.set(actor, at);
  return c;
}

/** The OVERTIME sticker, once per bout at the first overtime step. */
export function overtimeSticker(b: Builder, at: number): void {
  if (b.overtimeShown) return;
  b.overtimeShown = true;
  b.tags.push({ from: at, to: at + OUTCOME.overtimeStickerMs, text: b.opts.text.overtime, colour: CORAL, ink: INK,
    actor: null, x: 180, y: 70, size: TEXT.sticker * 1.4, kind: "sticker" });
}

/** A Move's name tag: a small tag with the Move's icon and name over its user, as it happens,
 *  the size and length of a passive's tag (owner, 15 Nov 2026: "It should just show"). */
export function moveNameTag(b: Builder, move: MoveId, actor: ActorId, at: number): void {
  if (!b.has(actor)) return;
  tagOver(b, actor, at, b.opts.text.moveName(move).toUpperCase(), VOLT, MOVE.nameTagMs, move, "move");
}

/** A cosmetic variation from the seed, 0 to 1. */
export function vary(b: Builder, i: number, n: number): number { return noise(b.opts.cosmeticSeed, i, n); }
