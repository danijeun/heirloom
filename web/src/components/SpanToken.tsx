import type { CSSProperties, FocusEvent, MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { SpanT } from "../api";
import { VoicePopup } from "./VoicePopup";

const VIEWPORT_GUTTER = 12;
const TOOLTIP_ARROW_MARGIN = 18;
const TOOLTIP_VERTICAL_GAP = 10;
const TOOLTIP_MAX_WIDTH = 280; // must match max-width in CSS

interface Props {
  span: SpanT;
  selected: boolean;
  onSelect: (id: string | null) => void;
  onRecord?: (spanId: string, blob: Blob, mime: string, durMs: number) => Promise<void>;
  onDeleteSpan?: (spanId: string) => Promise<void>;
  onDeleteClip?: (clipId: string) => Promise<void>;
  readOnly?: boolean;
}

export function SpanToken({ span, selected, onSelect, onRecord, onDeleteSpan, onDeleteClip, readOnly }: Props) {
  const hasAudio = span.audio_clips.length > 0;
  const isUncertain = span.is_uncertain;
  const [showMeanings, setShowMeanings] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({});
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  useEffect(() => {
    if (!showMeanings) return;
    function handlePointerDown(event: PointerEvent) {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setShowMeanings(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showMeanings]);

  useEffect(() => {
    if (!showMeanings || selected) return;

    function updateTooltipPosition() {
      const wrap = wrapRef.current;
      const tooltip = tooltipRef.current;
      if (!wrap || !tooltip) return;

      const wrapRect = wrap.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      // Fall back to TOOLTIP_MAX_WIDTH if the tooltip hasn't painted yet (width is 0)
      const tooltipWidth = tooltipRect.width || TOOLTIP_MAX_WIDTH;
      const anchorCenter = wrapRect.left + (wrapRect.width / 2);
      const idealLeft = anchorCenter - (tooltipWidth / 2);
      const maxLeft = Math.max(
        VIEWPORT_GUTTER,
        window.innerWidth - VIEWPORT_GUTTER - tooltipWidth,
      );
      const left = Math.min(Math.max(idealLeft, VIEWPORT_GUTTER), maxLeft);
      const top = wrapRect.bottom + TOOLTIP_VERTICAL_GAP;
      const tooltipCenter = left + (tooltipWidth / 2);
      const nextArrowShift = anchorCenter - tooltipCenter;

      const maxArrowShift = Math.max(
        0,
        (tooltipWidth / 2) - TOOLTIP_ARROW_MARGIN,
      );
      const arrowShift = Math.max(-maxArrowShift, Math.min(maxArrowShift, nextArrowShift));

      setTooltipStyle((current) => {
        const nextStyle = {
          left: `${left}px`,
          top: `${top}px`,
          "--tooltip-arrow-shift": `${arrowShift}px`,
        } as CSSProperties;
        if (
          current.left === nextStyle.left &&
          current.top === nextStyle.top &&
          current["--tooltip-arrow-shift" as keyof CSSProperties] === nextStyle["--tooltip-arrow-shift" as keyof CSSProperties]
        ) {
          return current;
        }
        return nextStyle;
      });
    }

    updateTooltipPosition();
    requestAnimationFrame(updateTooltipPosition);
    window.addEventListener("resize", updateTooltipPosition);
    window.addEventListener("scroll", updateTooltipPosition, true);

    return () => {
      window.removeEventListener("resize", updateTooltipPosition);
      window.removeEventListener("scroll", updateTooltipPosition, true);
    };
  }, [showMeanings, selected]);

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!isUncertain || event.pointerType === "mouse") return;
    longPressTriggeredRef.current = false;
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setShowMeanings(true);
      onSelect(null);
    }, 450);
  }

  function handlePointerEnd() {
    clearLongPressTimer();
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (longPressTriggeredRef.current) {
      event.preventDefault();
      event.stopPropagation();
      longPressTriggeredRef.current = false;
      return;
    }
    setShowMeanings(false);
    setTooltipStyle({});
    onSelect(selected ? null : span.id);
  }

  function handleBlur(event: FocusEvent<HTMLSpanElement>) {
    if (wrapRef.current?.contains(event.relatedTarget as Node | null)) return;
    setShowMeanings(false);
  }

  return (
    <span
      ref={wrapRef}
      className="span-wrap"
      onMouseEnter={() => isUncertain && !selected && setShowMeanings(true)}
      onMouseLeave={() => {
        setShowMeanings(false);
        setTooltipStyle({});
      }}
      onBlur={handleBlur}
    >
      <button
        className={`span-token${isUncertain ? " uncertain" : ""}${selected ? " selected" : ""}`}
        onClick={handleClick}
        onFocus={() => isUncertain && !selected && setShowMeanings(true)}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        aria-pressed={selected}
        aria-label={`${span.text}${span.is_uncertain ? " - uncertain" : ""}${hasAudio ? ", has voice recording" : ""}`}
        aria-describedby={showMeanings ? `meaning-options-${span.id}` : undefined}
      >
        {span.text}
        {hasAudio && !selected && (
          <span className="span-dot" aria-hidden="true" />
        )}
      </button>

      {showMeanings && !selected && isUncertain && span.meaning_options.length > 0 && (
        <div
          ref={tooltipRef}
          className="meaning-tooltip"
          role="tooltip"
          id={`meaning-options-${span.id}`}
          style={tooltipStyle}
        >
          <div className="meaning-tooltip-title">Possible meanings</div>
          <ul className="meaning-tooltip-list">
            {span.meaning_options.map((option, index) => (
              <li key={`${span.id}-${index}`} className="meaning-tooltip-item">
                {option.meaning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {selected && (
        <VoicePopup
          span={span}
          onClose={() => onSelect(null)}
          onRecord={onRecord ? (blob, mime, dur) => onRecord(span.id, blob, mime, dur) : undefined}
          onDeleteSpan={onDeleteSpan ? () => onDeleteSpan(span.id) : undefined}
          onDeleteClip={onDeleteClip}
          readOnly={readOnly}
        />
      )}
    </span>
  );
}
