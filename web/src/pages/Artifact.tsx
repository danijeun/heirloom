import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ArtifactT, SpanT } from "../api";
import { createSpan, deleteClip, deleteSpan, getArtifact, uploadAudio } from "../api";
import { Nav } from "../components/Nav";
import { Particles } from "../components/Particles";
import { SpanToken } from "../components/SpanToken";

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

  if (error) return (
    <div>
      <Nav canGoBack={false} />
      <div className="app"><div className="card error">Failed to load: {(error as Error).message}</div></div>
    </div>
  );
  if (!data) return (
    <div>
      <Nav canGoBack={false} />
      <div className="app"><div className="card muted">Loading...</div></div>
    </div>
  );

  if (data.status === "pending") {
    return (
      <>
        <Nav canGoBack={false} />
        <Particles />
        <main className="page" aria-busy="true">
          <aside className="sidebar">
            <div className="skel skel-title" />
            <div className="skel skel-scan" />
            <div className="skel skel-progress" />
            <div className="skel-meta">
              <div className="skel skel-meta-chip" />
              <div className="skel skel-meta-chip" />
            </div>
          </aside>
          <section className="main-col">
            <div className="skel skel-section-label" />
            <div className="skel skel-line" />
            <div className="skel skel-line" />
            <div className="skel skel-line skel-line-short" />
            <hr className="ornament-divider" aria-hidden="true" />
            <div className="skel skel-section-label" />
            <div className="skel skel-line" />
            <div className="skel skel-line skel-line-short" />
            <p className="muted" style={{ marginTop: 12, fontStyle: 'italic', textAlign: 'center' }}>
              Claude is transcribing. This usually takes 10–30 seconds.
            </p>
          </section>
        </main>
      </>
    );
  }
  if (data.status === "failed") {
    return (
      <div>
        <Nav canGoBack={false} />
        <div className="app"><div className="card error"><h2>Transcription failed</h2>
          <p>{data.error || "Unknown error"}</p>
          <button onClick={() => location.assign("/")}>Try another artifact</button></div></div>
      </div>
    );
  }

  return <Ready artifact={data} readOnly={readOnly} onChange={() => qc.invalidateQueries({ queryKey: ["artifact", id] })} />;
}

function Ready({ artifact, readOnly, onChange }: { artifact: ArtifactT; readOnly: boolean; onChange: () => void }) {
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const segments = useMemo(() => buildSegments(artifact), [artifact]);

  const voiceDone = artifact.spans.filter((s) => s.audio_clips.length > 0).length;
  const voiceTotal = artifact.spans.length;

  const contributors = useMemo(() => {
    const names = new Set<string>();
    artifact.spans.forEach((s) => {
      s.audio_clips.forEach((c) => {
        if (c.speaker_name) names.add(c.speaker_name);
      });
    });
    return Array.from(names);
  }, [artifact]);

  async function recordSpan(spanId: string, blob: Blob, mime: string, durMs: number) {
    try {
      await uploadAudio(spanId, blob, mime, durMs);
      onChange();
    } catch (e) {
      console.error("Upload failed:", e);
    }
  }

  async function removeSpan(spanId: string) {
    try {
      await deleteSpan(spanId);
      setSelectedSpanId(null);
      onChange();
    } catch (e) {
      console.error("Delete span failed:", e);
    }
  }

  async function removeClip(clipId: string) {
    try {
      await deleteClip(clipId);
      onChange();
    } catch (e) {
      console.error("Delete clip failed:", e);
    }
  }

  async function addSpan(start: number, end: number) {
    try {
      const created = await createSpan(artifact.id, start, end);
      onChange();
      setSelectedSpanId(created.id);
    } catch (e) {
      console.error("Add span failed:", e);
    }
  }

  async function share() {
    const url = `${location.origin}/a/${artifact.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      prompt("Copy this link:", url);
    }
  }

  return (
    <>
      <Nav
        onExportPDF={() => window.print()}
        onShare={() => share()}
        shareCopied={shareCopied}
      />
      <Particles />

      <main className="page">
        <aside className="sidebar">
          <h1 className="artifact-title">{artifact.original_language_guess || "Artifact"}</h1>

          <div className="scan-image" role="img" aria-label="Scanned artifact image">
            <div style={{ padding: "28px 22px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", color: "#5C3A28", textAlign: "center" }}>
              <p style={{ fontSize: "14px", margin: "0 0 8px" }}>Scan image placeholder</p>
              <p style={{ fontSize: "12px", margin: 0, opacity: 0.7 }}>Original artifact would display here</p>
            </div>
          </div>

          <div className="progress-wrap">
            <div className="progress-header">
              <span className="progress-label">VOICE COVERAGE</span>
              <span className="progress-count">{voiceDone}/{voiceTotal} spans</span>
            </div>
            <div className="progress-track" role="progressbar"
              aria-valuenow={voiceDone} aria-valuemin={0} aria-valuemax={voiceTotal}>
              <div className="progress-fill"
                style={{ width: `${voiceTotal > 0 ? (voiceDone / voiceTotal) * 100 : 0}%` }} />
            </div>
          </div>

          <div className="meta-grid">
            <div className="meta-chip">
              <div className="meta-label">Language</div>
              <div className="meta-value">{artifact.original_language_guess || "Unknown"}</div>
            </div>
            <div className="meta-chip">
              <div className="meta-label">Status</div>
              <div className="meta-value">Ready</div>
            </div>
          </div>

          {!readOnly && (
            <p className="sidebar-hint">
              Hover purple words to preview possible meanings.
              Click to open recording, or long press on touch devices to see the meanings first.
            </p>
          )}
        </aside>

        <section className="main-col">
          <div className="transcription-block">
            <div className="section-label">Original - Claude&apos;s Transcription</div>
            <div className="transcription-lines">
              {segments.map((seg, i) => {
                if (seg.span) {
                  return (
                    <SpanToken
                      key={seg.span.id}
                      span={seg.span}
                      selected={selectedSpanId === seg.span.id}
                      onSelect={setSelectedSpanId}
                      onRecord={!readOnly ? recordSpan : undefined}
                      onDeleteSpan={!readOnly ? removeSpan : undefined}
                      onDeleteClip={!readOnly ? removeClip : undefined}
                      readOnly={readOnly}
                    />
                  );
                }
                if (readOnly) return <span key={i}>{seg.text}</span>;
                return (
                  <span key={i}>
                    {tokenizeGap(seg.text, seg.offset!).map((tok, j) =>
                      tok.word ? (
                        <button
                          key={j}
                          type="button"
                          className="span-add"
                          onClick={() => addSpan(tok.start, tok.end)}
                          aria-label={`Add highlight to ${tok.text}`}
                        >
                          {tok.text}
                        </button>
                      ) : (
                        <span key={j}>{tok.text}</span>
                      ),
                    )}
                  </span>
                );
              })}
            </div>
          </div>

          <hr className="ornament-divider" aria-hidden="true" />

          {artifact.translation_text && (
            <div>
              <div className="section-label">Translation - Claude&apos;s Draft (verify with speaker)</div>
              <div className="translation-card">
                <p className="translation-line">{artifact.translation_text}</p>
              </div>
            </div>
          )}

          {contributors.length > 0 && (
            <div className="contributors-section">
              <div className="section-label">Voice Contributors</div>
              <div className="contributors-list">
                {contributors.map((name) => (
                  <div key={name} className="contributor-chip">
                    <div className="contributor-avatar" aria-hidden="true">{name[0]}</div>
                    <span className="contributor-name">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="page-footer">Preserved with Heirloom · All voice data stays on your device</footer>
    </>
  );
}

interface Seg { text: string; span?: SpanT; offset?: number }

function buildSegments(a: ArtifactT): Seg[] {
  const t = a.transcription_text;
  const ordered = [...a.spans].sort((x, y) => x.start_char - y.start_char);
  const out: Seg[] = [];
  let cursor = 0;
  for (const s of ordered) {
    if (s.start_char > cursor) out.push({ text: t.slice(cursor, s.start_char), offset: cursor });
    out.push({ text: t.slice(s.start_char, s.end_char), span: s });
    cursor = s.end_char;
  }
  if (cursor < t.length) out.push({ text: t.slice(cursor), offset: cursor });
  return out;
}

interface Tok { text: string; start: number; end: number; word: boolean }

const WORD_RE = /[^\s\p{P}\p{S}]+/gu;

function tokenizeGap(text: string, offset: number): Tok[] {
  const toks: Tok[] = [];
  let cursor = 0;
  for (const m of text.matchAll(WORD_RE)) {
    const s = m.index ?? 0;
    const e = s + m[0].length;
    if (s > cursor) toks.push({ text: text.slice(cursor, s), start: offset + cursor, end: offset + s, word: false });
    toks.push({ text: m[0], start: offset + s, end: offset + e, word: true });
    cursor = e;
  }
  if (cursor < text.length) toks.push({ text: text.slice(cursor), start: offset + cursor, end: offset + text.length, word: false });
  return toks;
}
