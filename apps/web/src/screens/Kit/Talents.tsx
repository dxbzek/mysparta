/**
 * The talent tree (content v3, batch 3, plan 13.11): one scrolling graphic, a panel per branch on the
 * asphalt band, its six nodes in their tiers joined by ink lines (lit once a tier is open), each node
 * its hex-nut icon with rank pips. A node is locked (flat silhouette, padlock), open (hazard ring,
 * a point waits), ranked (full colour, pips filled) or full (gold rim). Tap a node: its effect now
 * and at the next rank, and Spend. One free respec a day. Every number comes from the core's table.
 */
import { useMemo, useState } from "react";
import { TALENT_BRANCHES, TALENT_META, TALENT_TIER_NEED, branchNodes } from "@rankzero/core";
import type { ScrapperRecord, TalentBlock, TalentBranch, TalentId } from "@rankzero/core";
import { useGame } from "../../app/context";
import { rig, useRigVersion } from "../../seams/rig";
import { BRANCH_LINES, BRANCH_NAMES, TALENT_NAMES, TALENT_WORDS, talentLine } from "../../text/talents";
import { Button } from "../../ui/Button";
import { Sheet } from "../../ui/Sheet";
import { Sticker } from "../../ui/Sticker";
import { SvgArtView } from "../../ui/SvgArt";
import css from "./Talents.module.css";

type NodeState = "locked" | "open" | "ranked" | "full" | "idle";

/** Where each node of a branch sits in its panel, in % of the width and px from the top. */
const SPOTS: readonly { x: number; y: number }[] = [
  { x: 27, y: 0 }, { x: 73, y: 0 }, { x: 27, y: 158 }, { x: 73, y: 158 }, { x: 50, y: 316 }, { x: 50, y: 474 },
];
const LINKS: readonly [number, number][] = [[0, 2], [1, 3], [2, 4], [3, 4], [4, 5]];
const TREE_H = 620;

export function TalentIcon({ id, size, dim = false }: { id: TalentId; size: number; dim?: boolean }) {
  useRigVersion();
  return <SvgArtView art={rig.icon(`talent:${id}`)} size={size} className={dim ? css.dimArt : ""} label="" />;
}

export function TalentsTabView({ rec }: { rec: ScrapperRecord }) {
  const { core, actions, clock, toast } = useGame();
  const [open, setOpen] = useState<TalentId | null>(null);
  const [respec, setRespec] = useState(false);
  const t = useMemo(() => core.sheetOf(rec).talents, [core, rec]);
  const rank = (id: TalentId): number => t.ranks[id] ?? 0;
  const block = (id: TalentId): TalentBlock | null => core.talentBlock(rec, id);
  const state = (id: TalentId): NodeState => {
    const b = block(id);
    const r = rank(id);
    if (b === "maxed") return "full";
    if (b === "locked") return "locked";
    if (r > 0) return "ranked";
    return b === null ? "open" : "idle";
  };
  const today = clock.today();
  const canRespec = core.canRespec(rec, today);
  const spend = async (id: TalentId): Promise<void> => {
    try {
      const r = await actions.spendTalent(rec.id, id);
      if (!r.ok) toast(r.error === "no-points" ? TALENT_WORDS.noPoints : r.error === "maxed" ? TALENT_WORDS.maxed : TALENT_WORDS.locked);
    } catch (e) { toast((e as Error).message); }
  };
  const doRespec = async (): Promise<void> => {
    try {
      const r = await actions.respecTalents(rec.id);
      if (!r.ok) toast(r.error === "used-today" ? TALENT_WORDS.respecUsed : TALENT_WORDS.respecNothing);
      setRespec(false);
    } catch (e) { toast((e as Error).message); }
  };

  return (
    <div className={css.wrap}>
      <section className={css.head} aria-label={TALENT_WORDS.title}>
        <div className={css.points}>
          <span className={css.pointsBig} data-testid="talent-unspent">{t.unspent}</span>
          <span className={css.pointsWord}>{t.unspent > 0 ? TALENT_WORDS.points(t.unspent).replace(/^\d+ /, "") : TALENT_WORDS.none}</span>
        </div>
        <p className={css.headLine}>{t.earned === 0 ? TALENT_WORDS.firstAt : TALENT_WORDS.earnedLine(t.earned, t.spent)}</p>
        <Button variant="dark" className={css.respec} disabled={!canRespec} onClick={() => setRespec(true)}>{TALENT_WORDS.respec}</Button>
      </section>
      <nav className={css.jump} aria-label="Branches">
        {TALENT_BRANCHES.map((b) => {
          const n = branchNodes(b).reduce((s, id) => s + rank(id), 0);
          return <a key={b} href={`#branch-${b}`} className={css.jumpChip} data-branch={b}
            onClick={(e) => { e.preventDefault(); document.getElementById(`branch-${b}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
            {BRANCH_NAMES[b]}{n > 0 ? <span className={css.jumpN}>{n}</span> : null}</a>;
        })}
      </nav>
      {TALENT_BRANCHES.map((b) => (
        <Branch key={b} branch={b} rank={rank} state={state} onOpen={setOpen} unspent={t.unspent} />
      ))}

      <Sheet open={open !== null} title={open ? TALENT_NAMES[open] : ""} onClose={() => setOpen(null)}>
        {open ? <NodeDetail id={open} rank={rank(open)} why={block(open)} lowerNeed={lowerNeed(open, t.ranks)} onSpend={() => void spend(open)} /> : null}
      </Sheet>
      <Sheet open={respec} title={TALENT_WORDS.respec} onClose={() => setRespec(false)}>
        <div className={css.detail}>
          <p>{TALENT_WORDS.respecLine}</p>
          <Button variant="primary" onClick={() => void doRespec()}>{TALENT_WORDS.respecConfirm}</Button>
        </div>
      </Sheet>
    </div>
  );
}

/** Points still needed lower in the branch before a node's tier opens (0 when open). */
function lowerNeed(id: TalentId, ranks: Readonly<Partial<Record<TalentId, number>>>): number {
  const m = TALENT_META[id];
  let have = 0;
  for (const n of branchNodes(m.branch)) if (TALENT_META[n].tier < m.tier) have += ranks[n] ?? 0;
  return Math.max(0, TALENT_TIER_NEED[m.tier] - have);
}

function Branch({ branch, rank, state, onOpen, unspent }: { branch: TalentBranch; rank(id: TalentId): number;
  state(id: TalentId): NodeState; onOpen(id: TalentId): void; unspent: number }) {
  const nodes = branchNodes(branch);
  const spent = nodes.reduce((s, id) => s + rank(id), 0);
  const lit = (to: number): boolean => state(nodes[to]!) !== "locked";
  return (
    <section id={`branch-${branch}`} className={css.branch} data-branch={branch} aria-label={BRANCH_NAMES[branch]}>
      <header className={css.branchHead}>
        <Sticker tilt={-1.5}>{BRANCH_NAMES[branch]}</Sticker>
        <span className={css.branchSpent}>{spent} pts</span>
        <p className={css.branchLine}>{BRANCH_LINES[branch]}</p>
      </header>
      <div className={css.tree} style={{ height: TREE_H }}>
        <svg className={css.links} viewBox={`0 0 100 ${TREE_H}`} preserveAspectRatio="none" aria-hidden="true">
          {LINKS.map(([a, b]) => (
            <line key={`${a}-${b}`} x1={SPOTS[a]!.x} y1={SPOTS[a]!.y + 40} x2={SPOTS[b]!.x} y2={SPOTS[b]!.y + 40}
              className={lit(b) ? css.linkLit : css.linkDark} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {[1, 2, 3].map((tier) => {
          const y = tier === 1 ? 126 : tier === 2 ? 284 : 442;
          const open = lit(tier === 1 ? 2 : tier === 2 ? 4 : 5);
          return <span key={tier} className={`${css.gate} ${open ? css.gateOpen : ""}`} style={{ top: y }}>
            {open ? `Tier ${tier + 1}` : `${TALENT_TIER_NEED[tier]} pts to open`}</span>;
        })}
        {nodes.map((id, i) => (
          <NodeButton key={id} id={id} rank={rank(id)} state={state(id)} spot={SPOTS[i]!} cap={TALENT_META[id].tier === 3}
            waiting={unspent > 0} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function NodeButton({ id, rank, state, spot, cap, onOpen, waiting }: { id: TalentId; rank: number; state: NodeState;
  spot: { x: number; y: number }; cap: boolean; onOpen(id: TalentId): void; waiting: boolean }) {
  const max = TALENT_META[id].max;
  return (
    <button type="button" className={`${css.node} ${cap ? css.cap : ""}`} data-state={state} data-waiting={waiting && state === "open" ? "1" : undefined}
      data-talent={id} style={{ left: `${spot.x}%`, top: spot.y }} onClick={() => onOpen(id)}
      aria-label={`${TALENT_NAMES[id]}, ${TALENT_WORDS.rank(rank, max)}${state === "locked" ? `, ${TALENT_WORDS.locked}` : ""}`}>
      <span className={css.disc}>
        <TalentIcon id={id} size={cap ? 72 : 60} dim={state === "locked"} />
        {state === "locked" ? <span className={css.lock} aria-hidden="true"><LockGlyph /></span> : null}
      </span>
      <span className={css.name}>{cap ? <span className={css.capWord}>{TALENT_WORDS.capstone}</span> : null}{TALENT_NAMES[id]}</span>
      <span className={css.pips} aria-hidden="true">
        {Array.from({ length: max }, (_, k) => <span key={k} className={k < rank ? css.pipOn : css.pip} />)}
      </span>
    </button>
  );
}

function NodeDetail({ id, rank, why, lowerNeed: need, onSpend }: { id: TalentId; rank: number; why: TalentBlock | null; lowerNeed: number; onSpend(): void }) {
  const { core } = useGame();
  const m = TALENT_META[id];
  return (
    <div className={css.detail}>
      <div className={css.detailTop}>
        <span className={css.detailIcon}><TalentIcon id={id} size={88} dim={why === "locked"} /></span>
        <div>
          <p className={css.detailBranch}>{BRANCH_NAMES[m.branch]}{m.tier === 3 ? ` · ${TALENT_WORDS.capstone}` : ""}</p>
          <p className={css.detailRank}>{TALENT_WORDS.rank(rank, m.max)}</p>
        </div>
      </div>
      {rank > 0 ? <p className={css.detailNow}><b>{TALENT_WORDS.now}:</b> {talentLine(core.content, id, rank)}</p> : null}
      {rank < m.max ? <p className={css.detailNext}><b>{rank === 0 ? "Rank 1" : TALENT_WORDS.nextRank}:</b> {talentLine(core.content, id, rank + 1)}</p> : null}
      {m.branch === "pack" ? <p className={css.detailNote}>{TALENT_WORDS.needsPet}</p> : null}
      {why === "locked" ? <p className={css.detailNote}>{TALENT_WORDS.tierNeed(need, BRANCH_NAMES[m.branch])}</p> : null}
      {why === "maxed" ? <p className={css.detailNote}>{TALENT_WORDS.maxed}</p> : null}
      {why === "no-points" ? <p className={css.detailNote}>{TALENT_WORDS.noPoints}</p> : null}
      {why === "maxed" ? null : (
        <Button variant={why === null ? "primary" : "secondary"} disabled={why !== null} onClick={onSpend} data-testid="talent-spend">
          {why === null ? TALENT_WORDS.spend : why === "locked" ? TALENT_WORDS.locked : TALENT_WORDS.none}
        </Button>
      )}
    </div>
  );
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <rect x="4.5" y="10.5" width="15" height="11" rx="2" fill="currentColor" />
      <rect x="11" y="14" width="2" height="4" rx="1" fill="var(--c-locked)" />
    </svg>
  );
}
