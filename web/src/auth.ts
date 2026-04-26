import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

const ANON_KEY = "heirloom_anon_artifact_ids";

export function recordAnonymousArtifact(id: string) {
  try {
    const ids = getAnonymousArtifactIds();
    if (!ids.includes(id)) {
      localStorage.setItem(ANON_KEY, JSON.stringify([...ids, id]));
    }
  } catch {}
}

export function getAnonymousArtifactIds(): string[] {
  try {
    const raw = localStorage.getItem(ANON_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function clearAnonymousArtifacts() {
  try { localStorage.removeItem(ANON_KEY); } catch {}
}

export interface MeUser {
  id: string;
  email: string;
  name: string | null;
  picture_url: string | null;
}

export interface MeResponse {
  user: MeUser | null;
  anonymous: boolean;
  google_configured: boolean;
}

export async function fetchMe(): Promise<MeResponse> {
  const r = await fetch("/api/me", { credentials: "same-origin" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function logout() {
  await fetch("/auth/logout", { method: "POST", credentials: "same-origin" });
}

export async function claimAnonymous(ids: string[]): Promise<{ claimed: number; skipped: number }> {
  const r = await fetch("/api/me/claim", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artifact_ids: ids }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export interface MyArtifactRow {
  id: string;
  status: "pending" | "ready" | "failed";
  created_at: number;
  original_language_guess: string;
  transcription_preview: string;
  has_translation: boolean;
}

export async function deleteArtifact(id: string): Promise<void> {
  const r = await fetch(`/api/artifacts/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "X-Requested-With": "heirloom-web" },
  });
  if (r.status === 204 || r.status === 404) {
    try {
      const ids = getAnonymousArtifactIds().filter((x) => x !== id);
      localStorage.setItem(ANON_KEY, JSON.stringify(ids));
    } catch {}
    return;
  }
  throw new Error(await r.text());
}

export async function fetchMyArtifacts(): Promise<MyArtifactRow[]> {
  const r = await fetch("/api/me/artifacts", { credentials: "same-origin" });
  if (!r.ok) throw new Error(await r.text());
  const data = await r.json();
  return data.artifacts;
}

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 60_000 });
}

/**
 * On first authenticated render, post any locally-tracked anonymous artifact ids
 * to /api/me/claim, then clear localStorage. Idempotent: only runs once per mount.
 */
export function useClaimOnLogin() {
  const me = useMe();
  const qc = useQueryClient();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    if (!me.data?.user) return;
    const ids = getAnonymousArtifactIds();
    if (ids.length === 0) return;
    ran.current = true;
    claimAnonymous(ids)
      .then(() => {
        clearAnonymousArtifacts();
        qc.invalidateQueries({ queryKey: ["my-artifacts"] });
      })
      .catch(() => { ran.current = false; });
  }, [me.data?.user, qc]);
}
