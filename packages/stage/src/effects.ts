/**
 * What happens at the moment of contact, and the stickers around it (brief 3.12).
 *
 * The moment of contact is ONE value per swing. Flash, flinch, knockback, burst, number, HP,
 * shake, crowd and sound are all scheduled from it here, and from nothing else. The
 * `ContactMark.starts` record says which of the nine play (null = not for this contact); the
 * stage's test does not trust it and measures every start from sampled frames.
 * Block and evade, the skill tag, the OVERTIME sticker and the ticket tape are here too.
 */
import type { ActorId, HeldId, MoveId, PerkId, Proc } from "@rankzero/core";
import { impactFamily } from "@rankzero/core";
import { toStage } from "@rankzero/rig";
import type { EffectKey, SfxItem } from "./contracts";
import { noise } from "./cues";
import { CORAL, GREEN, INK, PAPER, SKY, VOLT, WHITE } from "./palette";
import type { TagItem } from "./model";
import type { Builder } from "./timeline";
import { CONTACT, MOVE, OUTCOME, TEXT } from "./tuning";

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
  procs?: readonly Proc[];
}

const clampNum = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** The point on the target that is hit, as a stage point at time `at`. */
export function hitSpot(b: Builder, target: ActorId, at: number, zone: "head" | "body" = "body"): { x: number; y: number } {
  const tr = b.track(target);
  const p = b.place(target, at);
  return toStage(p, b.rig.hitPoint(tr.rig, b.dress(target), zone));
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

/** A sticker over an actor. Tags of the same actor at the same time stack upward. */
export function tagOver(b: Builder, id: ActorId, at: number, text: string, colour: string, ms: number = OUTCOME.tagMs,
  icon?: PerkId): void {
  const p = overHead(b, id, at);
  const stacked = b.tags.filter((t) => t.actor === id && t.from < at + ms && at < t.to).length;
  const tag: TagItem = { from: at, to: at + ms, text, colour, ink: INK, actor: id, x: p.x, y: p.y - 12 - stacked * 11,
    size: TEXT.tag, kind: "tag" };
  if (icon !== undefined) tag.icon = icon;
  b.tags.push(tag);
}

/** The skill tag of a step: at most one, the first proc (the sim lists the rarest first), with the
 *  skill's icon and an exclamation mark ("PARRY!"), held long enough to read. */
export function skillTag(b: Builder, procs: readonly Proc[] | undefined, at: number): void {
  const p = procs?.[0];
  if (p === undefined || !b.has(p.by)) return;
  tagOver(b, p.by, at, `${b.opts.text.skillName(p.skill).toUpperCase()}!`, SKY, OUTCOME.skillTagMs, p.skill as PerkId);
}

/** A Move's visible result over an actor, in the host's words ("-25 AIM", "SNARED"), with the
 *  Move's icon. No words from the host: no tag. */
export function resultTag(b: Builder, move: MoveId, id: ActorId, at: number, colour: string, part?: "pet"): void {
  const text = b.opts.text.moveResult?.(move, part) ?? "";
  if (text === "" || !b.has(id)) return;
  tagOver(b, id, at, text.toUpperCase(), colour, MOVE.resultMs, move);
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
  const spot = hitSpot(b, L.target, L.at);
  const dir: 1 | -1 = L.attacker !== null && b.place(L.attacker, L.at).x > b.place(L.target, L.at).x ? -1 : 1;
  const seed = (b.opts.cosmeticSeed ^ (L.i * 7919)) | 0;

  if (hit) {
    const heavy = L.heavy === true || L.crit || L.damage >= CONTACT.heavyShare * ttr.maxHp;
    if (m.flash) b.flashes.push({ actor: L.target, from: s("flash"), ms: CONTACT.flashMs, contact: c });
    if (L.ownClip !== true) {
      b.play(L.target, b.flinchClip(ttr.rig, heavy), s("flinch"), { flinchOf: c });
      const amount = clampNum(CONTACT.knockbackBase + (CONTACT.knockbackPerHp * L.damage) / ttr.maxHp,
        CONTACT.knockbackMin, CONTACT.knockbackMax) * m.knockback;
      b.nudge({ actor: L.target, key: "knockback", from: s("knockback"), outMs: CONTACT.knockbackOutMs, holdMs: 0,
        backMs: CONTACT.knockbackBackMs, dx: dir * amount, arc: 0, contact: c });
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
    if (L.crit) tagOver(b, L.target, L.at, b.opts.text.crit, VOLT);
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
    b.play(L.target, shield !== null && ttr.rig === "scrapper" ? "block-shield" : "block", L.at);
    b.nudge({ actor: L.target, key: "slide", from: L.at, outMs: OUTCOME.blockSlideMs, holdMs: 120, backMs: OUTCOME.blockSlideBackMs,
      dx: dir * OUTCOME.blockSlide, arc: 0, contact: null });
    b.fx.push({ fx: "spark", from: s("burst"), to: s("burst") + CONTACT.burstMs, x: spot.x, y: spot.y, facing: 1, seed,
      contact: c, key: "burst" });
    tagOver(b, L.target, L.at, b.opts.text.block, PAPER, OUTCOME.blockTagMs);
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

/** An evade starts before the contact: the defender hops back 22 units with a 14-unit arc, so
 *  the swing passes where it stood. Call it after the swing is planned. */
export function evadeEarly(b: Builder, target: ActorId, attacker: ActorId, at: number): void {
  const from = at - OUTCOME.evadeLead;
  const dir: 1 | -1 = b.place(attacker, at).x > b.place(target, at).x ? -1 : 1;
  b.play(target, "evade", from);
  b.nudge({ actor: target, key: "hop", from, outMs: OUTCOME.evadeMs, holdMs: 260, backMs: 220, dx: dir * OUTCOME.evadeHop,
    arc: OUTCOME.evadeArc, contact: null });
}

/** A heal: a Teal "+N", a ring of small plus shapes for 400 ms, the HP bar fills over 200 ms. */
export function healAt(b: Builder, i: number, target: ActorId, at: number, amount: number, hpAfter: number): void {
  const before = b.hpNow.get(target) ?? b.track(target).maxHp;
  const head = overHead(b, target, at);
  const p = b.place(target, at);
  b.fx.push({ fx: "plus", from: at, to: at + OUTCOME.healRingMs, x: p.x, y: p.y, facing: p.facing,
    seed: (b.opts.cosmeticSeed ^ i) | 0, contact: null, follow: target });
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
  tagOver(b, actor, at, b.opts.text.moveName(move).toUpperCase(), VOLT, MOVE.nameTagMs, move);
}

/** A cosmetic variation from the seed, 0 to 1. */
export function vary(b: Builder, i: number, n: number): number { return noise(b.opts.cosmeticSeed, i, n); }
