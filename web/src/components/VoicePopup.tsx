import { useEffect, useRef, useState } from "react";
import type { SpanT } from "../api";
import { Waveform } from "./Waveform";

interface Props {
  span: SpanT;
  onClose: () => void;
  onRecord?: (blob: Blob, mime: string, durMs: number) => Promise<void>;
  readOnly?: boolean;
}

export function VoicePopup({ span, onClose, onRecord, readOnly = false }: Props) {
  const [state, setState] = useState<'idle' | 'playing' | 'recording'>('idle');
  const [recorded, setRecorded] = useState(span.audio_clips.length > 0);
  const recRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (state === 'playing') {
      const t = setTimeout(() => setState('idle'), 3200);
      return () => clearTimeout(t);
    }
    if (state === 'recording') {
      const t = setTimeout(() => { setRecorded(true); setState('idle'); }, 4000);
      return () => clearTimeout(t);
    }
  }, [state]);

  async function handleBtn() {
    if (state === 'idle') {
      if (recorded && span.audio_clips.length > 0) {
        // Play existing recording
        if (audioRef.current && span.audio_clips[0]) {
          audioRef.current.src = span.audio_clips[0].url;
          await audioRef.current.play();
          setState('playing');
        }
      } else if (!readOnly) {
        // Start recording
        startRecording();
      }
    } else if (state === 'playing') {
      audioRef.current?.pause();
      setState('idle');
    } else if (state === 'recording') {
      stopRecording();
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = 'audio/mp4';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunks, { type: mime });
        const durMs = Date.now() - startTimeRef.current;
        stream.getTracks().forEach(t => t.stop());
        setRecorded(true);
        if (onRecord) {
          await onRecord(blob, mime, durMs);
        }
      };
      rec.start();
      recRef.current = rec;
      startTimeRef.current = Date.now();
      setState('recording');
    } catch (e) {
      console.error('Recording failed:', e);
    }
  }

  function stopRecording() {
    recRef.current?.stop();
    setState('idle');
  }

  const btnLabel =
    state === 'recording' ? '■  Save recording' :
    state === 'playing'   ? '■  Stop'            :
    recorded              ? '▶  Play'             :
    readOnly              ? '(Read-only)'         : '⏺  Record';

  return (
    <div className="voice-popup" role="dialog" aria-label={`Voice note for "${span.text}"`}>
      <div className="popup-header">
        <div>
          <div className="popup-text">"{span.text}"</div>
          {span.is_uncertain && (
            <div className="popup-uncertain-flag">
              <span aria-hidden="true">⚠</span>
              <span>Uncertain — add your voice</span>
            </div>
          )}
        </div>
        <button className="popup-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      {recorded && span.audio_clips[0]?.speaker_name && (
        <div style={{ fontSize: '11px', color: 'var(--color-sepia)', fontStyle: 'italic', marginBottom: '8px' }}>
          Recorded by {span.audio_clips[0].speaker_name}
        </div>
      )}

      <Waveform playing={state === 'playing'} recording={state === 'recording'}/>

      <button
        className={`popup-btn${state === 'recording' ? ' recording' : ''}`}
        onClick={handleBtn}
        disabled={readOnly && !recorded}
      >
        {btnLabel}
      </button>

      <audio ref={audioRef} onEnded={() => setState('idle')} style={{ display: 'none' }} />
    </div>
  );
}
