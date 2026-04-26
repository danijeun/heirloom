import type { SpanT } from "../api";
import { VoicePopup } from "./VoicePopup";

interface Props {
  span: SpanT;
  selected: boolean;
  onSelect: (id: string | null) => void;
  onRecord?: (spanId: string, blob: Blob, mime: string, durMs: number) => Promise<void>;
  readOnly?: boolean;
}

export function SpanToken({ span, selected, onSelect, onRecord, readOnly }: Props) {
  const hasAudio = span.audio_clips.length > 0;
  const isUncertain = span.is_uncertain && !selected;

  return (
    <span className="span-wrap">
      <button
        className={`span-token${isUncertain ? ' uncertain' : ''}${selected ? ' selected' : ''}`}
        onClick={() => onSelect(selected ? null : span.id)}
        aria-pressed={selected}
        aria-label={`${span.text}${span.is_uncertain ? ' — uncertain' : ''}${hasAudio ? ', has voice recording' : ''}`}
      >
        {span.text}
        {hasAudio && !selected && (
          <span className="span-dot" aria-hidden="true"/>
        )}
      </button>

      {selected && (
        <VoicePopup
          span={span}
          onClose={() => onSelect(null)}
          onRecord={onRecord ? (blob, mime, dur) => onRecord(span.id, blob, mime, dur) : undefined}
          readOnly={readOnly}
        />
      )}
    </span>
  );
}
