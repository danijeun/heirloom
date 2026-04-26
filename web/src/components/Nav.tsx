import { useNavigate } from "react-router-dom";
import { useTheme } from "../useTheme";
import logo1 from "../assets/heirloom-logo1.png";
import logo2 from "../assets/heirloom-logo2.png";

interface Props {
  onExportPDF?: () => void;
  onShare?: () => void;
  shareCopied?: boolean;
  canGoBack?: boolean;
}

export function Nav({ onExportPDF, onShare, shareCopied = false, canGoBack = true }: Props) {
  const nav = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const logoSrc = theme === 'dark' ? logo2 : logo1;

  return (
    <nav className="nav" role="banner">
      <a className="nav-brand" href="/" aria-label="Heirloom home">
        <img src={logoSrc} alt="Heirloom logo" className="nav-logo-img" />
      </a>
      <div className="nav-actions">
        <button className="nav-btn" aria-label="My Library">
          <span className="hamburger">☰</span>
          <span className="nav-btn-label">My Library</span>
        </button>
        <button className="nav-btn nav-theme-btn" onClick={toggleTheme} aria-label="Toggle dark mode">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        {canGoBack && (
          <button className="nav-btn" onClick={() => nav(-1)} aria-label="Go back">
            ←&ensp;<span className="nav-btn-label">Back</span>
          </button>
        )}
        {onExportPDF && (
          <button className="nav-btn" onClick={onExportPDF} aria-label="Export as PDF">
            ⬇&ensp;<span className="nav-btn-label">Export PDF</span>
          </button>
        )}
        {onShare && (
          <button className="nav-btn" onClick={onShare} aria-label="Share this artifact">
            ⇧&ensp;<span className="nav-btn-label">{shareCopied ? "Copied" : "Share"}</span>
          </button>
        )}
      </div>
    </nav>
  );
}
