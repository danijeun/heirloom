import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadImage } from "../api";

export function Home() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(file: File) {
    setErr(null); setBusy(true);
    try {
      const { id } = await uploadImage(file);
      nav(`/artifact/${id}`);
    } catch (e: any) {
      setErr(e.message || "Upload failed");
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <h1>Heirloom</h1>
      <p className="tagline">A living dictionary for dying family languages.</p>

      <div className="card">
        <h2>Scan an artifact</h2>
        <p className="muted">
          Photograph a handwritten letter, recipe, or note. We will transcribe it as best we can.
          Then an elder records what only they can pronounce.
        </p>
        <label className="upload">
          <input
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
            capture="environment"
            disabled={busy}
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />
          <span style={{ fontSize: 22 }}>{busy ? "Uploading…" : "Tap to take or choose a photo"}</span>
          <span className="muted" style={{ fontSize: 14 }}>JPEG, PNG, HEIC up to 8 MB</span>
        </label>
        {err && <p className="error" style={{ marginTop: 12 }}>{err}</p>}
      </div>

      <p className="muted" style={{ fontSize: 14, marginTop: 32 }}>
        Claude is the scribe. The elder is the source. The information does not exist without them.
      </p>
    </div>
  );
}
