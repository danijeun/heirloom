import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteArtifact, fetchMyArtifacts, useMe, type MyArtifactRow } from "../auth";
import { Nav } from "../components/Nav";
import { Particles } from "../components/Particles";
import { PaperStack } from "../components/PaperStack";

type Mode = "stack" | "grid";
const MODE_KEY = "heirloom_mine_mode";
const INDEX_KEY = "heirloom_mine_index";

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

function entryNo(i: number): string {
  return "No. " + String(i + 1).padStart(3, "0");
}

const UNDO_MS = 5000;

export function Mine() {
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["my-artifacts"],
    queryFn: fetchMyArtifacts,
    enabled: !!me.data?.user,
  });

  // Confirm-state on a specific card (grid mode).
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // Pending soft-delete: item is hidden in UI; actual DELETE fires after UNDO_MS.
  const [pending, setPending] = useState<{ item: MyArtifactRow; expiresAt: number } | null>(null);
  const pendingTimer = useRef<number | null>(null);

  function clearPendingTimer() {
    if (pendingTimer.current != null) {
      window.clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
    }
  }

  async function fireDelete(id: string) {
    try {
      await deleteArtifact(id);
    } catch {
      // Restore on failure.
      qc.invalidateQueries({ queryKey: ["my-artifacts"] });
      return;
    }
    qc.invalidateQueries({ queryKey: ["my-artifacts"] });
  }

  function startSoftDelete(item: MyArtifactRow) {
    setConfirmId(null);
    // Optimistic remove.
    qc.setQueryData<MyArtifactRow[]>(["my-artifacts"], (prev) =>
      (prev ?? []).filter((a) => a.id !== item.id)
    );
    clearPendingTimer();
    setPending({ item, expiresAt: Date.now() + UNDO_MS });
    pendingTimer.current = window.setTimeout(() => {
      setPending(null);
      pendingTimer.current = null;
      fireDelete(item.id);
    }, UNDO_MS);
  }

  function undoDelete() {
    if (!pending) return;
    clearPendingTimer();
    qc.setQueryData<MyArtifactRow[]>(["my-artifacts"], (prev) => {
      const list = prev ?? [];
      if (list.some((a) => a.id === pending.item.id)) return list;
      return [pending.item, ...list];
    });
    setPending(null);
  }

  // If user navigates away with a pending delete, fire it now.
  useEffect(() => {
    return () => {
      if (pendingTimer.current != null && pending) {
        clearPendingTimer();
        fireDelete(pending.item.id);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [mode, setMode] = useState<Mode>(() => {
    try {
      const saved = sessionStorage.getItem(MODE_KEY);
      if (saved === "stack" || saved === "grid") return saved;
    } catch {}
    return "stack";
  });
  useEffect(() => { try { sessionStorage.setItem(MODE_KEY, mode); } catch {} }, [mode]);

  const itemCount = list.data?.length ?? 0;
  useEffect(() => {
    if (itemCount > 12 && mode === "stack") {
      try {
        if (sessionStorage.getItem(MODE_KEY) == null) setMode("grid");
      } catch {}
    }
  }, [itemCount, mode]);

  const initialIndex = (() => {
    try {
      const v = sessionStorage.getItem(INDEX_KEY);
      const n = v ? parseInt(v, 10) : 0;
      return Number.isFinite(n) ? n : 0;
    } catch { return 0; }
  })();
  const handleIndexChange = (i: number) => {
    try { sessionStorage.setItem(INDEX_KEY, String(i)); } catch {}
  };

  // Loading the session
  if (me.isLoading) {
    return (
      <>
        <Nav canGoBack={false} />
        <Particles />
        <main className="library-page library-page--ledger">
          <header className="ledger-header">
            <h1 className="ledger-title">Archive</h1>
            <p className="ledger-meta">Opening.</p>
          </header>
          <div className="ledger-rule" aria-hidden="true" />
        </main>
      </>
    );
  }

  // Signed out
  if (!me.data?.user) {
    return (
      <>
        <Nav canGoBack={false} />
        <Particles />
        <main className="library-page library-page--ledger">
          <header className="ledger-header">
            <h1 className="ledger-title">Archive</h1>
            <p className="ledger-meta">Sealed.</p>
          </header>
          <div className="ledger-rule" aria-hidden="true" />
          <div className="ledger-empty">
            <p className="ledger-empty-body">
              Heirloom keeps every scan and recording private to you. Sign in with Google
              to read your archive from any device, and bring along anything you made
              before signing in.
            </p>
            {me.data?.google_configured ? (
              <a href="/auth/google/login" className="ledger-link ledger-link--strong">
                Sign in with Google
              </a>
            ) : (
              <p className="error">Google sign-in is not configured on this server.</p>
            )}
          </div>
        </main>
      </>
    );
  }

  // Signed in
  const items = list.data ?? [];
  const count = items.length;
  const metaLine =
    list.isLoading ? "Opening."
    : count === 0  ? "Empty."
    : count === 1  ? "1 entry."
    : `${count} entries.`;

  return (
    <>
      <Nav canGoBack={false} />
      <Particles />
      <main className="library-page library-page--ledger">
        <header className="ledger-header">
          <div>
            <h1 className="ledger-title">Archive</h1>
            <p className="ledger-meta">Your archive. {metaLine}</p>
          </div>
          <Link to="/" className="ledger-link" aria-label="Add a new entry">
            Add entry
          </Link>
        </header>

        <div className="ledger-rule" aria-hidden="true" />

        {count === 0 && !list.isLoading && (
          <div className="ledger-empty">
            <p className="ledger-empty-body">
              An archive starts with one scrap. A recipe card, a margin note, a
              postcard whose handwriting nobody quite reads anymore. Photograph it
              and the rest follows.
            </p>
            <Link to="/" className="ledger-link ledger-link--strong">Scan your first entry</Link>
          </div>
        )}

        {count > 0 && (
          <>
            <nav className="ledger-views" aria-label="View">
              <button
                type="button"
                className={"ledger-view-link" + (mode === "stack" ? " is-active" : "")}
                onClick={() => setMode("stack")}
                aria-pressed={mode === "stack"}
              >Stack</button>
              <span className="ledger-views-sep" aria-hidden="true">·</span>
              <button
                type="button"
                className={"ledger-view-link" + (mode === "grid" ? " is-active" : "")}
                onClick={() => setMode("grid")}
                aria-pressed={mode === "grid"}
              >Index</button>
            </nav>

            {mode === "stack" ? (
              <PaperStack
                items={items}
                initialIndex={Math.min(initialIndex, items.length - 1)}
                onIndexChange={handleIndexChange}
                onOpen={(id) => navigate(`/artifact/${id}`)}
                onDelete={(item) => startSoftDelete(item)}
              />
            ) : (
              <section className="ledger-grid" aria-label="Index">
                {items.map((a, idx) => {
                  const inConfirm = confirmId === a.id;
                  return (
                    <div key={a.id} className="ledger-card-wrap">
                      {inConfirm ? (
                        <div className="ledger-card ledger-card--confirm" role="alertdialog" aria-label="Confirm delete">
                          <div className="ledger-card-no">{entryNo(idx)}</div>
                          <h3 className="ledger-card-title">Delete this entry?</h3>
                          <div className="ledger-card-rule" aria-hidden="true" />
                          <p className="ledger-card-preview">
                            Removes the scan, transcription, and any voice recordings.
                          </p>
                          <div className="ledger-card-actions">
                            <button
                              type="button"
                              className="ledger-link"
                              onClick={() => setConfirmId(null)}
                            >Keep</button>
                            <button
                              type="button"
                              className="ledger-link ledger-link--strong"
                              autoFocus
                              onClick={() => startSoftDelete(a)}
                            >Delete</button>
                          </div>
                        </div>
                      ) : (
                        <Link to={`/artifact/${a.id}`} className="ledger-card">
                          <div className="ledger-card-no">{entryNo(idx)}</div>
                          <button
                            type="button"
                            className="ledger-remove"
                            aria-label="Remove this entry"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmId(a.id); }}
                          >Remove</button>
                          <h3 className="ledger-card-title">
                            {a.original_language_guess || "Untitled fragment"}
                          </h3>
                          <div className="ledger-card-rule" aria-hidden="true" />
                          <time
                            className="ledger-card-date"
                            dateTime={new Date(a.created_at * 1000).toISOString()}
                          >
                            {formatDate(a.created_at)}
                          </time>
                          <p className="ledger-card-preview">
                            {truncate(a.transcription_preview, 110) || "(no transcription yet)"}
                          </p>
                        </Link>
                      )}
                    </div>
                  );
                })}
              </section>
            )}
          </>
        )}

        {pending && (
          <div className="ledger-undo" role="status" aria-live="polite">
            <span>Removed “{pending.item.original_language_guess || "Untitled fragment"}”.</span>
            <button type="button" className="ledger-link" onClick={undoDelete}>Undo</button>
          </div>
        )}
      </main>
    </>
  );
}
