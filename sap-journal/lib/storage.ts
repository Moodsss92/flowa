"use client";

import { getSupabase } from "./supabase/client";
import { extFor, prepareImage } from "./images";

export const BUCKET = "captures";
const SIGN_TTL = 60 * 60; // 1 h

/** Envoie des captures dans `captures/<stepId>/…` et renvoie leurs chemins. */
export async function uploadCaptures(
  stepId: string,
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const supabase = getSupabase();
  const paths: string[] = [];
  onProgress?.(0, files.length);
  for (let i = 0; i < files.length; i++) {
    const blob = await prepareImage(files[i]);
    const type = blob.type || "image/png";
    const path = `${stepId}/${crypto.randomUUID()}.${extFor(type)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: type,
      upsert: false,
    });
    if (error) throw new Error(`Envoi de « ${files[i].name || "capture"} » impossible : ${error.message}`);
    paths.push(path);
    onProgress?.(i + 1, files.length);
  }
  return paths;
}

export async function removeFiles(paths: string[]): Promise<void> {
  if (!paths.length) return;
  await getSupabase().storage.from(BUCKET).remove(paths);
}

// ---------- URLs signées (cache partagé) ----------
type Entry = { url: string; exp: number };
const cache = new Map<string, Entry>();
const pending = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

export function subscribeSigned(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSignedUrlCached(path: string): string | undefined {
  const e = cache.get(path);
  return e && e.exp > Date.now() + 60_000 ? e.url : undefined;
}

export async function ensureSignedUrls(paths: string[]): Promise<void> {
  const missing = Array.from(new Set(paths)).filter((p) => !getSignedUrlCached(p) && !pending.has(p));
  const waits = paths.map((p) => pending.get(p)).filter(Boolean) as Promise<void>[];
  if (missing.length) {
    const job = (async () => {
      const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrls(missing, SIGN_TTL);
      if (!error && data) {
        const exp = Date.now() + SIGN_TTL * 1000;
        for (const d of data) if (d.signedUrl && d.path) cache.set(d.path, { url: d.signedUrl, exp });
      }
    })().finally(() => {
      missing.forEach((p) => pending.delete(p));
      listeners.forEach((l) => l());
    });
    missing.forEach((p) => pending.set(p, job));
    waits.push(job);
  }
  await Promise.all(waits);
}

export async function signedUrl(path: string): Promise<string | undefined> {
  await ensureSignedUrls([path]);
  return getSignedUrlCached(path);
}

/** Copie des captures vers le dossier d'une autre fiche (pour « Dupliquer »). */
export async function copyFiles(paths: string[], toStepId: string): Promise<string[]> {
  const supabase = getSupabase();
  const out: string[] = [];
  for (const from of paths) {
    const ext = from.split(".").pop() || "png";
    const to = `${toStepId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).copy(from, to);
    if (error) throw new Error(error.message);
    out.push(to);
  }
  return out;
}
