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
import book from "../assets/book.png";

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
        <h1>Heirloom</h1>
        <p className="tagline">A living dictionary for dying family languages. Humans create. Claude preserves.</p>

        <label className="book-upload">
          <input
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
            capture="environment"
            disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />
          <img src={book} alt="Scan an artifact" style={{ opacity: busy ? 0.6 : 1, cursor: busy ? "wait" : "pointer" }} />
        </label>
        {err && <p className="error" style={{ marginTop: 12, textAlign: 'center' }}>{err}</p>}

        <p className="muted" style={{ fontSize: 14, marginTop: 32, textAlign: 'center' }}>
          Claude is the scribe. The elder is the source. The information does not exist without them.
        </p>
      </div>
    </>
  );
}
