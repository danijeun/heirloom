const CANDIDATES = [
  "audio/mp4",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
];

export function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {}
  }
  return "";
}

export type RecState = "idle" | "recording" | "stopping";

export async function startRecording(onStop: (blob: Blob, mime: string, durMs: number) => void) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = pickMimeType();
  const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  const t0 = performance.now();
  rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  rec.onstop = () => {
    const dur = performance.now() - t0;
    const actualMime = rec.mimeType || mime || "audio/webm";
    onStop(new Blob(chunks, { type: actualMime }), actualMime, dur);
    stream.getTracks().forEach((t) => t.stop());
  };
  rec.start();
  return rec;
}
