import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { uploadImage } from "../api";
import { recordAnonymousArtifact, useMe } from "../auth";
import { Nav } from "../components/Nav";
import { Particles } from "../components/Particles";
import text1 from "../assets/text1.png";
import text1D from "../assets/text1-d.png";
import text3 from "../assets/text3.png";
import text3D from "../assets/text3-d.png";

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
      <div className="center-image"><img src={text1} alt="" aria-hidden="true" /></div>
      <div className="center-image-right"><img src={text1} alt="" aria-hidden="true" /></div>
      <div className="center-image-dark"><img src={text1D} alt="" aria-hidden="true" /></div>
      <div className="center-image-right-dark"><img src={text1D} alt="" aria-hidden="true" /></div>
      <div className="center-image-text3"><img src={text3} alt="" aria-hidden="true" /></div>
      <div className="center-image-text3-right"><img src={text3} alt="" aria-hidden="true" /></div>
      <div className="center-image-text3-dark"><img src={text3D} alt="" aria-hidden="true" /></div>
      <div className="center-image-text3-right-dark"><img src={text3D} alt="" aria-hidden="true" /></div>
      <div className="app">
        <motion.h1
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          Heirloom
        </motion.h1>
        <motion.p
          className="tagline"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        >
          A living dictionary for dying family languages. Humans create. Claude preserves.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
        >
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
              <span style={{ fontSize: 22 }}>{busy ? "Uploading…" : "Tap to take or choose a photo"}</span>
              <span className="muted" style={{ fontSize: 14 }}>JPEG, PNG, HEIC up to 8 MB</span>
            </label>
            {err && <p className="error" style={{ marginTop: 12 }}>{err}</p>}
          </div>
        </motion.div>

        <motion.p
          className="muted"
          style={{ fontSize: 14, marginTop: 32, textAlign: 'center' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.55 }}
        >
          Claude is the scribe. The elder is the source. The information does not exist without them.
        </motion.p>
      </div>
    </>
  );
}
