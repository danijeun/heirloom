import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ArtifactT, SpanT } from "../api";
import { getArtifact, uploadAudio } from "../api";
import { useMe } from "../auth";
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
      <div className="app"><div className="card muted">Loading…</div></div>
    </div>
  );

  if (data.status === "pending") {
    return (
      <div>
        <Nav canGoBack={false} />
        <div className="app"><div className="card"><h2>Reading the artifact…</h2>
          <p className="muted">Claude is transcribing. This usually takes 10–30 seconds.</p></div></div>
      </div>
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

  const voiceDone = artifact.spans.filter(s => s.audio_clips.length > 0).length;
  const voiceTotal = artifact.spans.length;

  const contributors = useMemo(() => {
    const names = new Set<string>();
    artifact.spans.forEach(s => {
      s.audio_clips.forEach(c => {
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
      console.error('Upload failed:', e);
    }
  }

  async function share() {
    const url = `${location.origin}/a/${artifact.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
    catch {
      prompt("Copy this link:", url);
    }
  }

  return (
<<<<<<< HEAD
    <>
      <Nav
        onExportPDF={() => window.print()}
        onShare={() => share()}
        shareCopied={shareCopied}
      />
      <Particles />

      <main className="page">
        {/* Sidebar */}
        <aside className="sidebar">
          <h1 className="artifact-title">{artifact.original_language_guess || "Artifact"}</h1>

          {/* Scan placeholder */}
          <div className="scan-image" role="img" aria-label="Scanned artifact image">
            <div style={{ padding: '28px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#5C3A28', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', margin: '0 0 8px' }}>Scan image placeholder</p>
              <p style={{ fontSize: '12px', margin: 0, opacity: 0.7 }}>Original artifact would display here</p>
            </div>
          </div>

          {/* Metadata */}
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

          {/* Voice progress */}
          <div className="progress-wrap">
            <div className="progress-header">
              <span className="progress-label">VOICE COVERAGE</span>
              <span className="progress-count">{voiceDone}/{voiceTotal} spans</span>
            </div>
            <div className="progress-track" role="progressbar"
              aria-valuenow={voiceDone} aria-valuemin={0} aria-valuemax={voiceTotal}>
              <div className="progress-fill"
                style={{ width: `${voiceTotal > 0 ? (voiceDone / voiceTotal) * 100 : 0}%` }}/>
            </div>
          </div>

          {/* Hint */}
          {!readOnly && (
            <p className="sidebar-hint">
              Tap any uncertain word to hear or record a voice note.
              Words with a&nbsp;<span className="hint-purple">purple glow</span>&nbsp;are
              uncertain — Claude flagged them for human review.
            </p>
=======
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
                {!!seg.span.meaning_options.length && (
                  <span style={{ display: "block", marginTop: 8, fontSize: 12, lineHeight: 1.4 }}>
                    {seg.span.meaning_options.map((option, idx) => (
                      <span key={`${seg.span!.id}-meaning-${idx}`} style={{ display: "block" }}>
                        {idx + 1}. <strong>{option.word}</strong>: {option.meaning}
                      </span>
                    ))}
                  </span>
                )}
                {seg.span.audio_clips.map((c) => (
                  <audio key={c.id} src={c.url} controls style={{ display: "block", marginTop: 4, width: "100%" }} />
                ))}
              </mark>
            ) : (
              <span key={i}>{seg.text}</span>
            )
>>>>>>> origin/main
          )}
        </aside>

        {/* Main content */}
        <section className="main-col">
          {/* Transcription */}
          <div className="transcription-block">
            <div className="section-label">Original — Claude's Transcription</div>
            <div className="transcription-lines">
              {segments.map((seg, i) =>
                seg.span ? (
                  <SpanToken
                    key={seg.span.id}
                    span={seg.span}
                    selected={selectedSpanId === seg.span.id}
                    onSelect={setSelectedSpanId}
                    onRecord={!readOnly ? recordSpan : undefined}
                    readOnly={readOnly}
                  />
                ) : (
                  <span key={i}>{seg.text}</span>
                )
              )}
            </div>
          </div>

<<<<<<< HEAD
          {/* Divider */}
          <hr className="ornament-divider" aria-hidden="true"/>
=======
        {!readOnly && (
          <div className="toolbar">
            <button onClick={recordSelection} disabled={recording}>Record selected text</button>
            <button className="secondary" onClick={share}>{shareCopied ? "Copied!" : "Copy share link"}</button>
          </div>
        )}
      </div>
>>>>>>> origin/main

          {/* Translation */}
          {artifact.translation_text && (
            <div>
              <div className="section-label">Translation — Claude's Draft (verify with speaker)</div>
              <div className="translation-card">
                <p className="translation-line">{artifact.translation_text}</p>
              </div>
            </div>
          )}

          {/* Contributors */}
          {contributors.length > 0 && (
            <div className="contributors-section">
              <div className="section-label">Voice Contributors</div>
              <div className="contributors-list">
                {contributors.map(name => (
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

      <footer className="page-footer">◈ Preserved with Heirloom · All voice data stays on your device</footer>
    </>
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
