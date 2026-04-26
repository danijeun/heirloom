import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadImage } from "../api";
import { recordAnonymousArtifact, useMe } from "../auth";
import { HomeBookIntro } from "../components/HomeBookIntro";
import { Nav } from "../components/Nav";
import { Particles } from "../components/Particles";

export function Home() {
  const nav = useNavigate();
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setBookOpen(true);
      setIntroDone(true);
      return;
    }

    const openTimer = window.setTimeout(() => setBookOpen(true), 2200);
    const revealTimer = window.setTimeout(() => setIntroDone(true), 5400);

    return () => {
      window.clearTimeout(openTimer);
      window.clearTimeout(revealTimer);
    };
  }, []);

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
      <main className="app home-shell">
        <section className="home-hero">
          <div className="home-stage">
            <HomeBookIntro
              isOpen={bookOpen}
              showContent={introDone}
              busy={busy}
              err={err}
              onFile={onFile}
            />
          </div>
        </section>

        <section className={`home-proof${introDone ? " is-visible" : ""}`}>
          <p className="muted home-proof-line">
            Claude is the scribe. The elder is the source. The information does not exist without them.
          </p>
        </section>
      </main>
    </>
  );
}
