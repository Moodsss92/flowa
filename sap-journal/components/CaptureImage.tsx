"use client";

import { useSignedUrl } from "@/hooks/useSignedUrl";

/** Image d'une capture privée (URL signée). */
export function CaptureImage({ path, alt, className = "" }: { path: string; alt: string; className?: string }) {
  const url = useSignedUrl(path);
  if (!url) return <div className={`animate-pulse bg-fill/20 ${className}`} aria-label="Chargement de la capture" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} loading="lazy" decoding="async" />;
}
