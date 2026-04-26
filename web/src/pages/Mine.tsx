import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchMyArtifacts, useMe, type MyArtifactRow } from "../auth";
import { Nav } from "../components/Nav";
import { Particles } from "../components/Particles";

const STATUS_LABEL: Record<MyArtifactRow["status"], string> = {
  ready: "Ready",
  pending: "Reading…",
  failed: "Needs retry",
};

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function formatDate(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function Mine() {
  const me = useMe();
  const list = useQuery({
    queryKey: ["my-artifacts"],
    queryFn: fetchMyArtifacts,
    enabled: !!me.data?.user,
  });

  // ─── Loading the session ──────────────────────────────────
  if (me.isLoading) {
    return (
      <>
        <Nav canGoBack={false} />
        <Particles />
        <main className="library-page">
          <header className="library-header">
            <div className="library-header-text">
              <p className="library-eyebrow">— Personal archive —</p>
              <h1 className="library-title">Your Library</h1>
              <p className="library-subtitle">gathering heirlooms…</p>
            </div>
          </header>
          <hr className="ornament-divider" aria-hidden="true" />
          <section className="library-grid" aria-busy="true" aria-label="Loading library">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="library-card library-card--skeleton" aria-hidden="true">
                <div className="library-skel-line library-skel-line--meta" />
                <div className="library-skel-line library-skel-line--title" />
                <div className="library-skel-line library-skel-line--meta" />
                <div className="library-skel-line library-skel-line--body" />
                <div className="library-skel-line library-skel-line--body short" />
              </div>
            ))}
          </section>
        </main>
      </>
    );
  }

  // ─── Signed out ────────────────────────────────────────────
  if (!me.data?.user) {
    return (
      <>
        <Nav canGoBack={false} />
        <Particles />
        <main className="library-page">
          <div className="library-empty library-empty--auth">
            <p className="library-empty-eyebrow">— Restricted —</p>
            <h1 className="library-empty-title">Your library is sealed</h1>
            <p className="library-empty-body">
              Heirloom keeps every scan and recording private to you. Sign in with Google
              to revisit your archive from any device — and to bring along anything you
              made before signing in.
            </p>
            {me.data?.google_configured ? (
              <a href="/auth/google/login" className="library-cta library-cta--center">
                <span className="library-cta-glyph" aria-hidden="true">✶</span>
                <span>Sign in with Google</span>
              </a>
            ) : (
              <p className="error">Google sign-in is not configured on this server.</p>
            )}
          </div>
        </main>
      </>
    );
  }

  // ─── Signed in ─────────────────────────────────────────────
  const items = list.data ?? [];
  const count = items.length;
  const subtitle =
    list.isLoading
      ? "opening the archive…"
      : count === 0
      ? "an empty page, awaiting your first mark"
      : count === 1
      ? "1 heirloom gathered"
      : `${count} heirlooms gathered`;

  return (
    <>
      <Nav canGoBack={false} />
      <Particles />
      <main className="library-page">
        <header className="library-header">
          <div className="library-header-text">
            <p className="library-eyebrow">— Personal archive —</p>
            <h1 className="library-title">Your Library</h1>
            <p className="library-subtitle">{subtitle}</p>
          </div>
          <Link to="/" className="library-cta" aria-label="Scan a new artifact">
            <span className="library-cta-glyph" aria-hidden="true">✒</span>
            <span>Scan a new artifact</span>
          </Link>
        </header>

        <hr className="ornament-divider" aria-hidden="true" />

        {count === 0 && !list.isLoading && (
          <div className="library-empty">
            <p className="library-empty-eyebrow">— Begin —</p>
            <h2 className="library-empty-title">Your shelf is bare</h2>
            <p className="library-empty-body">
              Every archive starts with a single scrap. A recipe card, a margin note,
              a postcard whose handwriting nobody quite reads anymore. Photograph it.
              The rest follows.
            </p>
            <Link to="/" className="library-cta library-cta--center">
              <span className="library-cta-glyph" aria-hidden="true">✒</span>
              <span>Scan your first artifact</span>
            </Link>
          </div>
        )}

        {count > 0 && (
          <section className="library-grid" aria-label="Saved artifacts">
            {items.map((a, idx) => (
              <Link
                to={`/artifact/${a.id}`}
                key={a.id}
                className="library-card"
                style={{ animationDelay: `${Math.min(idx * 55, 600)}ms` }}
              >
                <span
                  className={`library-status library-status--${a.status}`}
                  aria-label={`Status: ${STATUS_LABEL[a.status]}`}
                >
                  <span className="library-status-dot" aria-hidden="true" />
                  {STATUS_LABEL[a.status]}
                </span>
                <h3 className="library-card-title">
                  {a.original_language_guess || "Untitled fragment"}
                </h3>
                <time
                  className="library-card-date"
                  dateTime={new Date(a.created_at * 1000).toISOString()}
                >
                  {formatDate(a.created_at)}
                </time>
                <p className="library-card-preview">
                  {truncate(a.transcription_preview, 90) || "(no transcription yet)"}
                </p>
                {a.has_translation && (
                  <span className="library-card-tag" aria-label="Translation available">
                    ✦ Translated
                  </span>
                )}
              </Link>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
