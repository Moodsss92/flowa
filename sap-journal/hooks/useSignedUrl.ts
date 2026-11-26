"use client";

import { useEffect, useReducer } from "react";
import { ensureSignedUrls, getSignedUrlCached, subscribeSigned } from "@/lib/storage";

/** URL signée d'une capture (cache partagé, rafraîchie à l'expiration). */
export function useSignedUrl(path: string | undefined): string | undefined {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => subscribeSigned(force), []);
  useEffect(() => {
    if (path && !getSignedUrlCached(path)) ensureSignedUrls([path]);
  }, [path]);
  return path ? getSignedUrlCached(path) : undefined;
}

/** Pré-charge les URLs signées d'une liste de chemins. */
export function usePrefetchSigned(paths: string[]) {
  const key = paths.join("|");
  useEffect(() => {
    if (paths.length) ensureSignedUrls(paths);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
