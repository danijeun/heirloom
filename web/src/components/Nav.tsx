import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "../useTheme";
import { logout, useMe } from "../auth";
import logo1 from "../assets/heirloom-logo1.png";
import logo2 from "../assets/heirloom-logo2.png";

interface Props {
  canGoBack?: boolean;
}

export function Nav({ canGoBack = true }: Props) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { theme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const me = useMe();
  const user = me.data?.user ?? null;
  const googleConfigured = me.data?.google_configured ?? false;

  const logoSrc = theme === "dark" ? logo2 : logo1;

  useEffect(() => {
    if (!menuOpen && !userMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (userMenuOpen && userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, userMenuOpen]);

  const close = () => setMenuOpen(false);

  async function onLogout() {
    setUserMenuOpen(false);
    setMenuOpen(false);
    await logout();
    qc.invalidateQueries({ queryKey: ["me"] });
    qc.invalidateQueries({ queryKey: ["my-artifacts"] });
    nav("/");
  }

  return (
    <nav className="nav" role="banner">
      <a className="nav-brand" href="/" aria-label="Heirloom home">
        <img src={logoSrc} alt="Heirloom logo" className="nav-logo-img" />
      </a>

      <div className="nav-actions-desktop">
        <button className="nav-btn" onClick={() => nav("/mine")} aria-label="My Library">
          <span className="nav-btn-label">My Library</span>
        </button>
        {canGoBack && (
          <button className="nav-btn" onClick={() => nav(-1)} aria-label="Go back">
            <span className="nav-btn-label">Back</span>
          </button>
        )}

        {user ? (
          <div className="nav-user-wrap" ref={userMenuRef}>
            <button
              className="nav-user"
              onClick={() => setUserMenuOpen((o) => !o)}
              aria-label="Account menu"
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
            >
              {user.picture_url ? (
                <img src={user.picture_url} alt="" className="nav-avatar" referrerPolicy="no-referrer" />
              ) : (
                <span className="nav-avatar nav-avatar-fallback" aria-hidden="true">
                  {(user.name || user.email)[0].toUpperCase()}
                </span>
              )}
              <span className="nav-user-name">{user.name || user.email}</span>
            </button>
            {userMenuOpen && (
              <div className="nav-dropdown" role="menu">
                <div className="nav-dropdown-info" aria-hidden="true">{user.email}</div>
                <button className="nav-dropdown-item" role="menuitem" onClick={onLogout}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : googleConfigured ? (
          <a href="/auth/google/login" className="nav-btn nav-signin" aria-label="Sign in with Google">
            <span className="nav-btn-label">Sign in with Google</span>
          </a>
        ) : null}
      </div>

      <div className="nav-actions-mobile">
        <div className="nav-menu-wrap" ref={menuRef}>
          <button
            className="nav-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            <span className="hamburger">Menu</span>
          </button>
          {menuOpen && (
            <div className="nav-dropdown" role="menu">
              <button className="nav-dropdown-item" role="menuitem" onClick={() => { close(); nav("/mine"); }}>
                My Library
              </button>
              {canGoBack && (
                <button className="nav-dropdown-item" role="menuitem" onClick={() => { close(); nav(-1); }}>
                  Back
                </button>
              )}
              <div className="nav-dropdown-divider" aria-hidden="true" />
              {user ? (
                <>
                  <div className="nav-dropdown-info">{user.email}</div>
                  <button className="nav-dropdown-item" role="menuitem" onClick={onLogout}>
                    Sign out
                  </button>
                </>
              ) : googleConfigured ? (
                <a href="/auth/google/login" className="nav-dropdown-item" role="menuitem">
                  Sign in with Google
                </a>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
