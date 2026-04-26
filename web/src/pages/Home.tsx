import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadImage } from "../api";
import { recordAnonymousArtifact, useMe } from "../auth";
import { Nav } from "../components/Nav";
import { Particles } from "../components/Particles";
import text3 from "../assets/text3.png";
import text3D from "../assets/text3-d.png";
import text1 from "../assets/text1.png";
import text1D from "../assets/text1-d.png";
import badge1 from "../assets/badge1.png";
import badge2 from "../assets/badge2.png";
import symbol1 from "../assets/symbol1.png";
import symbol2 from "../assets/symbol2.png";

export function Home() {
  const nav = useNavigate();
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const { id } = await uploadImage(file);
      if (!me.data?.user) recordAnonymousArtifact(id);
      nav(`/artifact/${id}`);
    } catch (e: any) {
      setErr(e.message || "Upload failed");
      setBusy(false);
    }
  }

  return (
    <>
      <Nav canGoBack={false} />
      <Particles />
      <div className="dark-bg-overlay"></div>
      <div className="center-image">
        <img src={text1} alt="Center image left" />
      </div>
      <div className="center-image-right">
        <img src={text1} alt="Center image right" />
      </div>
      <div className="center-image-dark">
        <img src={text1D} alt="Center image dark left" />
      </div>
      <div className="center-image-right-dark">
        <img src={text1D} alt="Center image dark right" />
      </div>
      <div className="center-image-text3">
        <img src={text3} alt="Center image text3 left" />
      </div>
      <div className="center-image-text3-right">
        <img src={text3} alt="Center image text3 right" />
      </div>
      <div className="center-image-text3-dark">
        <img src={text3D} alt="Center image text3 dark left" />
      </div>
      <div className="center-image-text3-right-dark">
        <img src={text3D} alt="Center image text3 dark right" />
      </div>
      <div className="app">
        <div className="header-with-badge">
          <img src={badge1} alt="Badge" className="badge badge-light" />
          <img src={badge2} alt="Badge dark" className="badge badge-dark" />
          <div>
            <h1>Heirloom</h1>
            <p className="tagline">A living dictionary for dying family languages. Humans create. Claude preserves.</p>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: -8 }}>Scan an artifact</h2>
          <p className="muted" style={{ marginBottom: 24 }}>
            Photograph a handwritten letter, recipe, or note. We will transcribe it as best we can.
            Then an elder records what only they can pronounce.
          </p>
          <label className="upload">
            <input
              type="file"
              accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
              capture="environment"
              disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
            />
            {busy ? (
              <div className="loader">
                <div className="pencil">
                  <div className="pencil-body"></div>
                  <div className="pencil-eraser"></div>
                </div>
                <div className="line"></div>
              </div>
            ) : (
              <>
                <span style={{ fontSize: 22 }}>Tap to take or choose a photo</span>
                <span className="muted" style={{ fontSize: 14 }}>JPEG, PNG, HEIC up to 8 MB</span>
              </>
            )}
          </label>
          {err && <p className="error" style={{ marginTop: 12 }}>{err}</p>}
        </div>

        <p className="muted closing-text" style={{ fontSize: 12, marginTop: -12, textAlign: 'center' }}>
          Claude is the scribe. The elder is the source. The information does not exist without them.
        </p>

        <div className="symbol-container">
          <img src={symbol1} alt="Symbol" className="symbol symbol-light" />
          <img src={symbol2} alt="Symbol dark" className="symbol symbol-dark" />
        </div>
      </div>
    </>
  );
}
