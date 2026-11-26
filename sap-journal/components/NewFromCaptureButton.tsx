"use client";

import { useRef } from "react";
import { useImageDrop } from "@/hooks/useImageDrop";
import { Icon } from "./ui/Badges";

/** Gros bouton bleu : clic (fichiers multiples), glisser-déposer, ou Ctrl/Cmd+V. */
export function NewFromCaptureButton({
  onFiles,
  progress,
}: {
  onFiles: (files: File[]) => void;
  progress: { done: number; total: number } | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const busy = !!progress;
  const { over, dropProps } = useImageDrop(onFiles, { disabled: busy });

  return (
    <div {...dropProps} className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className={`flex min-h-[64px] w-full items-center gap-3 rounded-ios px-4 py-3 text-left text-white transition active:scale-[0.99] ${
          over ? "bg-blue/80 ring-4 ring-blue/40" : "bg-blue"
        } disabled:opacity-90`}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Icon name={busy ? "image" : "plus"} className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold">
            {busy ? `Envoi des captures… ${progress.done}/${progress.total}` : over ? "Dépose pour créer l'étape" : "+ Nouvelle étape depuis une capture"}
          </span>
          <span className="block text-[13px] text-white/80">
            {busy ? "Ne ferme pas la page" : "Glisse une ou plusieurs images, choisis des fichiers ou colle avec Ctrl/⌘ + V"}
          </span>
        </span>
      </button>
      {busy && (
        <div className="absolute inset-x-4 bottom-1.5 h-1 overflow-hidden rounded-full bg-white/25" aria-hidden>
          <div
            className="h-full rounded-full bg-white transition-all"
            style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
          />
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}
