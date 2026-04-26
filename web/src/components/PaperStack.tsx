import { useEffect, useMemo, useRef, useState } from "react";
import type { MyArtifactRow } from "../auth";

const STATUS_LABEL: Record<MyArtifactRow["status"], string> = {
  ready: "Ready",
  pending: "Reading…",
  failed: "Needs retry",
};

const SWIPE_THRESHOLD = 60;
const TAP_SLOP = 6;
const LIFT_MS = 220;
const SLIDE_MS = 280;
const HINT_MS = 4000;

function formatDate(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

const STATUS_RANK: Record<MyArtifactRow["status"], number> = { ready: 0, pending: 1, failed: 2 };
function sortItems(items: MyArtifactRow[]): MyArtifactRow[] {
  return [...items].sort((a, b) => {
    const r = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (r !== 0) return r;
    return b.created_at - a.created_at;
  });
}

interface Props {
  items: MyArtifactRow[];
  onOpen: (id: string) => void;
  initialIndex?: number;
  onIndexChange?: (i: number) => void;
}

export function PaperStack({ items, onOpen, initialIndex = 0, onIndexChange }: Props) {
  const sorted = useMemo(() => sortItems(items), [items]);
  const total = sorted.length;
  const [index, setIndex] = useState(() => Math.min(Math.max(initialIndex, 0), Math.max(0, total - 1)));
  const [drag, setDrag] = useState(0);
  const [exiting, setExiting] = useState<null | "left" | "right">(null);
  const [lifting, setLifting] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [announce, setAnnounce] = useState("");

  const navigatingRef = useRef(false);
  const pointerRef = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const topBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => { onIndexChange?.(index); }, [index, onIndexChange]);

  useEffect(() => {
    if (total <= 1) { setShowHint(false); return; }
    const t = setTimeout(() => setShowHint(false), HINT_MS);
    return () => clearTimeout(t);
  }, [total]);

  const reducedMotion = typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  function commitSwipe(dir: "left" | "right") {
    if (exiting || lifting || navigatingRef.current) return;
    if (dir === "left" && index >= total - 1) { setDrag(0); return; }
    if (dir === "right" && index <= 0) { setDrag(0); return; }
    if (reducedMotion) {
      const next = dir === "left" ? index + 1 : index - 1;
      setIndex(next);
      setDrag(0);
      setAnnounce(`Card ${next + 1} of ${total}`);
      return;
    }
    setExiting(dir);
    setTimeout(() => {
      const next = dir === "left" ? index + 1 : index - 1;
      setIndex(next);
      setDrag(0);
      setExiting(null);
      setAnnounce(`Card ${next + 1} of ${total}`);
    }, SLIDE_MS);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (exiting || lifting || navigatingRef.current) return;
    pointerRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function handlePointerMove(e: React.PointerEvent) {
    const p = pointerRef.current;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.moved && Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) return;
    p.moved = true;
    let bounded = dx;
    if ((dx < 0 && index >= total - 1) || (dx > 0 && index <= 0)) {
      bounded = dx * 0.25;
    }
    setDrag(bounded);
  }
  function endPointer(e: React.PointerEvent) {
    const p = pointerRef.current;
    if (!p || p.id !== e.pointerId) return;
    pointerRef.current = null;
    if (!p.moved) {
      handleTap();
      return;
    }
    if (drag <= -SWIPE_THRESHOLD) commitSwipe("left");
    else if (drag >= SWIPE_THRESHOLD) commitSwipe("right");
    else setDrag(0);
  }

  function handleTap() {
    if (lifting || navigatingRef.current || exiting) return;
    const top = sorted[index];
    if (!top) return;
    navigatingRef.current = true;
    if (reducedMotion) { onOpen(top.id); return; }
    setLifting(true);
    setTimeout(() => onOpen(top.id), LIFT_MS);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") { e.preventDefault(); commitSwipe("right"); }
    else if (e.key === "ArrowRight") { e.preventDefault(); commitSwipe("left"); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleTap(); }
  }

  if (total === 0) return null;

  const slots: { item: MyArtifactRow; slot: number }[] = [];
  for (let off = -1; off <= 2; off++) {
    const i = index + off;
    if (i < 0 || i >= total) continue;
    slots.push({ item: sorted[i], slot: off });
  }

  return (
    <div className="paper-stack-wrap">
      <div
        className="paper-stack"
        role="region"
        aria-roledescription="carousel"
        aria-label="Artifact stack"
      >
        {slots.map(({ item, slot }) => {
          const isTop = slot === 0;
          const dragX = isTop ? drag : 0;
          const dragRot = isTop ? drag * 0.04 : 0;
          let className = "paper-card";
          if (slot === 0) className += " paper-card--top";
          else if (slot === -1) className += " paper-card--prev";
          else if (slot === 1) className += " paper-card--next1";
          else if (slot === 2) className += " paper-card--next2";
          if (isTop && exiting === "left") className += " paper-card--exit-left";
          if (isTop && exiting === "right") className += " paper-card--exit-right";
          if (isTop && lifting) className += " paper-card--lifting";
          const style: React.CSSProperties = {};
          if (isTop && !exiting && !lifting && dragX !== 0) {
            style.transform = `translate(-50%, -50%) translateX(${dragX}px) rotate(${dragRot}deg)`;
            style.transition = "none";
          }
          return (
            <button
              key={item.id}
              ref={isTop ? topBtnRef : undefined}
              type="button"
              className={className}
              style={style}
              tabIndex={isTop ? 0 : -1}
              aria-hidden={!isTop}
              aria-label={
                isTop
                  ? `${item.original_language_guess || "Untitled fragment"}, ${formatDate(item.created_at)}, status: ${STATUS_LABEL[item.status]}. ${index + 1} of ${total}. Tap to open, swipe to browse.`
                  : undefined
              }
              onPointerDown={isTop ? handlePointerDown : undefined}
              onPointerMove={isTop ? handlePointerMove : undefined}
              onPointerUp={isTop ? endPointer : undefined}
              onPointerCancel={isTop ? (() => { pointerRef.current = null; setDrag(0); }) : undefined}
              onKeyDown={isTop ? handleKeyDown : undefined}
              disabled={!isTop && slot !== 1}
            >
              <span className={`paper-status paper-status--${item.status}`}>
                <span className="paper-status-dot" aria-hidden="true" />
                {STATUS_LABEL[item.status]}
              </span>
              <h3 className="paper-card-title">
                {item.original_language_guess || "Untitled fragment"}
              </h3>
              <time className="paper-card-date" dateTime={new Date(item.created_at * 1000).toISOString()}>
                {formatDate(item.created_at)}
              </time>
              <p className="paper-card-preview">
                {truncate(item.transcription_preview, 140) || "(no transcription yet)"}
              </p>
              {item.has_translation && (
                <span className="paper-card-tag">✦ Translated</span>
              )}
              <span className="paper-card-grain" aria-hidden="true" />
            </button>
          );
        })}

        {showHint && total > 1 && (
          <div className="paper-stack-hint" aria-hidden="true">
            <span className="paper-stack-hint-chev">›</span>
          </div>
        )}
      </div>

      <div className="paper-stack-controls">
        <div className="paper-stack-counter" aria-hidden="true">
          {index + 1} <span>of</span> {total}
        </div>
        <DotRow total={total} index={index} onJump={(i) => {
          if (exiting || lifting || navigatingRef.current) return;
          setIndex(i);
          setAnnounce(`Card ${i + 1} of ${total}`);
        }} />
        {showHint && total > 1 && (
          <p className="paper-stack-tip">swipe or tap</p>
        )}
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">{announce}</div>
    </div>
  );
}

function DotRow({ total, index, onJump }: { total: number; index: number; onJump: (i: number) => void }) {
  const max = 7;
  if (total <= max) {
    return (
      <div className="paper-stack-dots" role="tablist">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Go to card ${i + 1}`}
            className={"paper-stack-dot" + (i === index ? " is-active" : "")}
            onClick={() => onJump(i)}
          />
        ))}
      </div>
    );
  }
  const half = Math.floor(max / 2);
  let start = Math.max(0, index - half);
  const end = Math.min(total, start + max);
  start = Math.max(0, end - max);
  const dots: React.ReactNode[] = [];
  for (let i = start; i < end; i++) {
    dots.push(
      <button
        key={i}
        type="button"
        role="tab"
        aria-selected={i === index}
        aria-label={`Go to card ${i + 1}`}
        className={"paper-stack-dot" + (i === index ? " is-active" : "")}
        onClick={() => onJump(i)}
      />
    );
  }
  return <div className="paper-stack-dots" role="tablist">{dots}</div>;
}
