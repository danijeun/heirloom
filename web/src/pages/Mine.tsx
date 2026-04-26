import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchMyArtifacts, useMe } from "../auth";
import { Header } from "../components/Header";

export function Mine() {
  const me = useMe();
  const list = useQuery({
    queryKey: ["my-artifacts"],
    queryFn: fetchMyArtifacts,
    enabled: !!me.data?.user,
  });

  if (me.isLoading) {
    return <div className="app"><Header /><div className="card muted">Loading…</div></div>;
  }
  if (!me.data?.user) {
    return (
      <div className="app">
        <Header />
        <div className="card">
          <h2>Sign in to see your artifacts</h2>
          <p className="muted">Heirloom keeps your scans and recordings private to you.
            Sign in with Google to revisit them from any device.</p>
          {me.data?.google_configured ? (
            <a href="/auth/google/login" className="btn">Sign in with Google</a>
          ) : (
            <p className="error">Google sign-in is not configured on this server.</p>
          )}
        </div>
      </div>
    );
  }

  const items = list.data ?? [];

  return (
    <div className="app">
      <Header />
      <h1>My artifacts</h1>
      <p className="tagline">{items.length} saved.</p>
      {list.isLoading && <p className="muted">Loading…</p>}
      {items.length === 0 && !list.isLoading && (
        <div className="card">
          <p>You haven&rsquo;t saved any artifacts yet.</p>
          <Link to="/" className="btn" style={{ marginTop: 12 }}>Scan one now</Link>
        </div>
      )}
      {items.map((a) => (
        <Link to={`/artifact/${a.id}`} key={a.id} className="card artifact-row">
          <div className="row-meta">
            <strong>{a.original_language_guess || "Untitled"}</strong>
            <span className="muted">
              {new Date(a.created_at * 1000).toLocaleDateString()} · {a.status}
            </span>
          </div>
          <p className="muted preview">{a.transcription_preview || "(no transcription)"}</p>
        </Link>
      ))}
    </div>
  );
}
