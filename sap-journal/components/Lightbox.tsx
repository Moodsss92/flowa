"use client";

import { useEffect } from "react";
import { CaptureImage } from "./CaptureImage";
import { Icon } from "./ui/Badges";
import type { Capture } from "@/lib/types";

export function Lightbox({
  captures,
  index,
  onIndex,
  onClose,
}: {
  captures: Capture[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const n = captures.length;

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        onIndex((index + 1) % n);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        onIndex((index - 1 + n) % n);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [index, n, onClose, onIndex]);

  if (index === null || !captures[index]) return null;
  const c = captures[index];

  return (
    <div className="anim-fade fixed inset-0 z-[55] flex flex-col bg-black/95 text-white" role="dialog" aria-modal="true" aria-label="Capture en grand">
      <div className="flex items-center justify-between gap-2 px-3 pt-[max(env(safe-area-inset-top),8px)]">
        <p className="truncate px-2 text-[15px]">
          Capture {index + 1}/{n}
          {c.legende ? ` · ${c.legende}` : ""}
        </p>
        <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
          <Icon name="close" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="flex max-h-full max-w-full items-center justify-center">
          <CaptureImage path={c.path} alt={c.legende || `Capture ${index + 1}`} className="max-h-[calc(100vh-120px)] max-w-full rounded-[8px] object-contain" />
        </div>
        {n > 1 && (
          <>
            <button
              type="button"
              aria-label="Capture précédente"
              onClick={(e) => {
                e.stopPropagation();
                onIndex((index - 1 + n) % n);
              }}
              className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 backdrop-blur"
            >
              <Icon name="chevron-left" />
            </button>
            <button
              type="button"
              aria-label="Capture suivante"
              onClick={(e) => {
                e.stopPropagation();
                onIndex((index + 1) % n);
              }}
              className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 backdrop-blur"
            >
              <Icon name="chevron-right" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
