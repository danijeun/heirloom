import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { logout, useMe } from "../auth";

export function Header() {
  const me = useMe();
  const qc = useQueryClient();
  const user = me.data?.user;

  async function onLogout() {
    await logout();
    qc.invalidateQueries({ queryKey: ["me"] });
  }

  return (
    <header className="header">
      <Link to="/" className="brand">Heirloom</Link>
      <nav className="nav">
        {user ? (
          <>
            <Link to="/mine" className="muted">My artifacts</Link>
            <span className="user">
              {user.picture_url && <img src={user.picture_url} alt="" className="avatar" />}
              <span>{user.name || user.email}</span>
            </span>
            <button className="secondary small" onClick={onLogout}>Sign out</button>
          </>
        ) : me.data?.google_configured ? (
          <a href="/auth/google/login" className="btn small">Sign in with Google</a>
        ) : null}
      </nav>
    </header>
  );
}
