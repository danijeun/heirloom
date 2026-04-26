interface Props {
  isOpen: boolean;
  showContent: boolean;
  busy: boolean;
  err: string | null;
  onFile: (file: File) => void;
}

export function HomeBookIntro({ isOpen, showContent, busy, err, onFile }: Props) {
  return (
    <div className={`home-book${isOpen ? " is-open" : " is-closed"}`}>
      <div className="home-book-shadow" />
      <div className="home-book-spine" />
      <div className="home-book-pages">
        <div className="home-book-page home-book-page-left">
          {showContent ? (
            <div className="home-book-page-content">
              <p className="home-kicker">Living archive for family language</p>
              <h1 className="home-book-title">Heirloom</h1>
              <p className="tagline home-book-tagline">A living dictionary for dying family languages. Humans create. Claude preserves.</p>
              <p className="home-lead home-book-lead">
                Photograph a handwritten letter, recipe, or note. We transcribe what the page says.
                Then an elder records what only they can pronounce.
              </p>
            </div>
          ) : (
            <div className="home-book-page-content home-book-page-content--placeholder">
              <span className="home-book-page-label">Archive</span>
              <strong>Handwritten memory</strong>
              <p>Letters, recipes, and notes become the start of a living record.</p>
            </div>
          )}
        </div>
        <div className="home-book-page home-book-page-right">
          {showContent ? (
            <div className="home-book-page-content">
              <div className="home-upload-panel">
                <p className="home-book-page-label">Begin here</p>
                <h2 className="home-upload-title">Scan an artifact</h2>
                <label className="upload home-book-upload">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
                    capture="environment"
                    disabled={busy}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
                  />
                  <span style={{ fontSize: 22 }}>{busy ? "Uploading..." : "Tap to take or choose a photo"}</span>
                  <span className="muted" style={{ fontSize: 14 }}>JPEG, PNG, HEIC up to 8 MB</span>
                </label>
                {err && <p className="error home-book-error">{err}</p>}
              </div>
            </div>
          ) : (
            <div className="home-book-page-content home-book-page-content--placeholder">
              <span className="home-book-page-label">Voice</span>
              <strong>Elder pronunciation</strong>
              <p>The page holds the text. The speaker restores the meaning, sound, and family cadence.</p>
            </div>
          )}
        </div>
      </div>

      <div className="home-book-cover">
        <div className="home-book-cover-face">
          <span className="home-book-crest">Heirloom</span>
          <h2>The family book opens here</h2>
          <p>Bring one artifact. Let the story unfold.</p>
        </div>
      </div>
    </div>
  );
}
