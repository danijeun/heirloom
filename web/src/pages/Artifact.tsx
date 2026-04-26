import { useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ArtifactT, SpanT } from "../api";
import { createSpan, getArtifact, uploadAudio } from "../api";
import { startRecording } from "../recorder";

interface Props { readOnly?: boolean }

export function Artifact({ readOnly = false }: Props) {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ["artifact", id],
    queryFn: () => getArtifact(id),
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 1500 : false),
    enabled: !!id,
  });

  if (error) return <div className="app"><div className="card error">Failed to load: {(error as Error).message}</div></div>;
  if (!data) return <div className="app"><div className="card muted">Loading…</div></div>;

  if (data.status === "pending") {
    return <div className="app"><div className="card"><h2>Reading the artifact…</h2>
      <p className="muted">Claude is transcribing. This usually takes 10–30 seconds.</p></div></div>;
  }
  if (data.status === "failed") {
    return <div className="app"><div className="card error"><h2>Transcription failed</h2>
      <p>{data.error || "Unknown error"}</p>
      <button onClick={() => location.assign("/")}>Try another artifact</button></div></div>;
  }

  return <Ready artifact={data} readOnly={readOnly} onChange={() => qc.invalidateQueries({ queryKey: ["artifact", id] })} />;
}

function Ready({ artifact, readOnly, onChange }: { artifact: ArtifactT; readOnly: boolean; onChange: () => void }) {
  const [activeSpanId, setActiveSpanId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const segments = useMemo(() => buildSegments(artifact), [artifact]);
  const activeSpan = artifact.spans.find((s) => s.id === activeSpanId) || null;

  async function startRec(spanId: string) {
    setActiveSpanId(spanId);
    const rec = await startRecording(async (blob, mime, durMs) => {
      try {
        await uploadAudio(spanId, blob, mime, durMs);
        onChange();
      } finally {
        setRecording(false);
      }
    });
    recRef.current = rec;
    setRecording(true);
  }
  function stopRec() { recRef.current?.stop(); }

  async function recordSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { alert("Select some text first."); return; }
    const range = sel.getRangeAt(0);
    const root = document.getElementById("transcript-root");
    if (!root || !root.contains(range.commonAncestorContainer)) return;
    const start = charOffset(root, range.startContainer, range.startOffset);
    const end = charOffset(root, range.endContainer, range.endOffset);
    if (start >= end) return;
    sel.removeAllRanges();
    const span = await createSpan(artifact.id, start, end);
    onChange();
    await startRec(span.id);
  }

  async function share() {
    const url = `${location.origin}/a/${artifact.id}`;
    try { await navigator.clipboard.writeText(url); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }
    catch { prompt("Copy this link:", url); }
  }

  return (
    <div className="app">
      <h1>Heirloom</h1>
      <div className="card">
        <h2>Transcription</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Language guess: {artifact.original_language_guess || "unknown"}.
          Highlighted spans are uncertain — tap to record what only you know.
        </p>
        <div id="transcript-root" className="transcript">
          {segments.map((seg, i) =>
            seg.span ? (
              <mark
                key={i}
                className={seg.span.audio_clips.length ? "has-audio" : "uncertain"}
                onClick={() => !readOnly && startRec(seg.span!.id)}
                title={seg.span.audio_clips.length ? "Has voice note — tap to play" : "Tap to record"}
              >
                {seg.text}
                {seg.span.audio_clips.map((c) => (
                  <audio key={c.id} src={c.url} controls style={{ display: "block", marginTop: 4, width: "100%" }} />
                ))}
              </mark>
            ) : (
              <span key={i}>{seg.text}</span>
            )
          )}
        </div>

        {artifact.translation_text && (
          <div className="translation">
            <strong>Draft translation (Claude, not authoritative):</strong>
            <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{artifact.translation_text}</div>
          </div>
        )}

        {!readOnly && (
          <div className="toolbar">
            <button onClick={recordSelection} disabled={recording}>Record selected text</button>
            <button className="secondary" onClick={share}>{shareCopied ? "Copied!" : "Copy share link"}</button>
          </div>
        )}
      </div>

      {recording && activeSpan && (
        <div className="recorder">
          <strong>Recording: "{activeSpan.text}"</strong>
          <div style={{ flex: 1 }} />
          <button onClick={stopRec}>Stop</button>
        </div>
      )}
    </div>
  );
}

interface Seg { text: string; span?: SpanT }

function buildSegments(a: ArtifactT): Seg[] {
  const t = a.transcription_text;
  const ordered = [...a.spans].sort((x, y) => x.start_char - y.start_char);
  const out: Seg[] = [];
  let cursor = 0;
  for (const s of ordered) {
    if (s.start_char > cursor) out.push({ text: t.slice(cursor, s.start_char) });
    out.push({ text: t.slice(s.start_char, s.end_char), span: s });
    cursor = s.end_char;
  }
  if (cursor < t.length) out.push({ text: t.slice(cursor) });
  return out;
}

function charOffset(root: Node, node: Node, offset: number): number {
  let total = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let cur: Node | null = walker.nextNode();
  while (cur) {
    if (cur === node) return total + offset;
    total += (cur.textContent || "").length;
    cur = walker.nextNode();
  }
  return total;
}
