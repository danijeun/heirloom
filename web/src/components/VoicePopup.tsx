import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SpanT } from "../api";
import { startRecording as startMediaRecording } from "../recorder";
import { useMediaQuery } from "../useMediaQuery";
import { Waveform } from "./Waveform";

interface Props {
  span: SpanT;
  onClose: () => void;
  onRecord?: (blob: Blob, mime: string, durMs: number) => Promise<void>;
  readOnly?: boolean;
}

export function VoicePopup({ span, onClose, onRecord, readOnly = false }: Props) {
  const [state, setState] = useState<"idle" | "playing" | "recording">("idle");
  const [recorded, setRecorded] = useState(span.audio_clips.length > 0);
  const recRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isMobile = useMediaQuery('(max-width: 640px)');

  useEffect(() => {
    if (state === "playing") {
      const t = setTimeout(() => setState("idle"), 3200);
      return () => clearTimeout(t);
    }
  }, [state]);

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (state === 'recording') stopRecording();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, state]);

  // If user backgrounds the tab while recording, stop & save what we have
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden' && recRef.current && recRef.current.state === 'recording') {
        try { recRef.current.stop(); } catch {}
        setState('idle');
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  async function handleBtn() {
    if (state === "idle") {
      if (recorded && span.audio_clips.length > 0) {
        if (audioRef.current && span.audio_clips[0]) {
          audioRef.current.src = span.audio_clips[0].url;
          await audioRef.current.play();
          setState("playing");
        }
      } else if (!readOnly) {
        startRecording();
      }
    } else if (state === "playing") {
      audioRef.current?.pause();
      setState("idle");
    } else if (state === "recording") {
      stopRecording();
    }
  }

  async function startRecording() {
    try {
      const rec = await startMediaRecording(async (blob, mime, durMs) => {
        setRecorded(true);
        if (onRecord) {
          await onRecord(blob, mime, durMs);
        }
      });
      recRef.current = rec;
      setState("recording");
    } catch (e) {
      console.error("Recording failed:", e);
    }
  }

  function stopRecording() {
    try { recRef.current?.stop(); } catch {}
    setState('idle');
  }

  const btnLabel =
    state === "recording" ? "Stop recording" :
    state === "playing" ? "Stop playback" :
    recorded ? "Play recording" :
    readOnly ? "(Read-only)" : "Record audio";

  const popup = (
    <div
      className={`voice-popup${isMobile ? ' sheet' : ''}`}
      role="dialog"
      aria-modal={isMobile ? true : undefined}
      aria-label={`Voice note for "${span.text}"`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="popup-header">
        <div>
          <div className="popup-text">"{span.text}"</div>
          {span.is_uncertain && (
            <div className="popup-uncertain-flag">
              <span aria-hidden="true">!</span>
              <span>Uncertain - add your voice</span>
            </div>
          )}
        </div>
        <button className="popup-close" onClick={onClose} aria-label="Close">x</button>
      </div>

      {recorded && span.audio_clips[0]?.speaker_name && (
        <div style={{ fontSize: "11px", color: "var(--color-sepia)", fontStyle: "italic", marginBottom: "8px" }}>
          Recorded by {span.audio_clips[0].speaker_name}
        </div>
      )}

      <Waveform playing={state === "playing"} recording={state === "recording"} />

      <button
        className={`popup-btn${state === "recording" ? " recording" : ""}`}
        onClick={handleBtn}
        disabled={readOnly && !recorded}
      >
        {btnLabel}
      </button>

      <audio ref={audioRef} onEnded={() => setState("idle")} style={{ display: "none" }} />
    </div>
  );

  if (isMobile) {
    return createPortal(
      <>
        <div
          className="voice-sheet-backdrop"
          onClick={() => {
            if (state === 'recording') stopRecording();
            onClose();
          }}
          aria-hidden="true"
        />
        {popup}
      </>,
      document.body
    );
  }

  return popup;
}
