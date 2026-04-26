import { z } from "zod";

export const AudioClip = z.object({
  id: z.string(),
  url: z.string(),
  mime_type: z.string(),
  duration_ms: z.number().nullable().optional(),
  speaker_name: z.string().nullable().optional(),
});

export const MeaningOption = z.object({
  word: z.string(),
  meaning: z.string(),
});

export const Span = z.object({
  id: z.string(),
  start_char: z.number(),
  end_char: z.number(),
  text: z.string(),
  is_uncertain: z.boolean(),
  meaning_options: z.array(MeaningOption).default([]),
  audio_clips: z.array(AudioClip).default([]),
});

export const Artifact = z.object({
  id: z.string(),
  status: z.enum(["pending", "ready", "failed"]),
  error: z.string().nullable().optional(),
  image_url: z.string().optional().default(""),
  transcription_text: z.string(),
  translation_text: z.string(),
  original_language_guess: z.string(),
  spans: z.array(Span),
});

export type ArtifactT = z.infer<typeof Artifact>;
export type SpanT = z.infer<typeof Span>;

export async function uploadImage(file: File): Promise<{ id: string }> {
  const fd = new FormData();
  fd.append("image", file);
  const r = await fetch("/api/artifacts", { method: "POST", body: fd });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getArtifact(id: string): Promise<ArtifactT> {
  const r = await fetch(`/api/artifacts/${id}`);
  if (!r.ok) throw new Error(await r.text());
  return Artifact.parse(await r.json());
}

export async function createSpan(artifactId: string, start: number, end: number) {
  const r = await fetch(`/api/artifacts/${artifactId}/spans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start_char: start, end_char: end }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{ id: string; start_char: number; end_char: number; text: string }>;
}

export async function uploadAudio(spanId: string, blob: Blob, mimeType: string, durationMs: number) {
  const fd = new FormData();
  const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("webm") ? "webm" : "bin";
  fd.append("audio", new File([blob], `clip.${ext}`, { type: mimeType }));
  fd.append("duration_ms", String(Math.round(durationMs)));
  const r = await fetch(`/api/spans/${spanId}/audio`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
