"use client";

import { useRef } from "react";
import { useImageDrop } from "@/hooks/useImageDrop";
import { Icon } from "./ui/Badges";

/**
 * Zone « + Ajouter d'autres captures » : clic, glisser-déposer, ou collage
 * quand la zone a le focus (attribut data-paste-target lu par JournalApp).
 */
export function AddCapturesZone({
  onFiles,
  progress,
  label = "+ Ajouter d'autres captures",
  target,
}: {
  onFiles: (files: File[]) => void;
  progress: { done: number; total: number } | null;
  label?: string;
  target: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const busy = !!progress;
  const { over, dropProps } = useImageDrop(onFiles, { disabled: busy });

  return (
    <div {...dropProps}>
      <button
        type="button"
        data-paste-target={target}
        disabled={busy}
        onClick={() => input.current?.click()}
        className={`flex min-h-[72px] w-full flex-col items-center justify-center gap-0.5 rounded-ios border-[1.5px] border-dashed px-4 py-3 text-center transition ${
          over ? "border-blue bg-blue/10" : "border-sep bg-card hover:border-blue/60"
        }`}
      >
        <span className="flex items-center gap-1.5 text-[16px] font-semibold text-blue">
          <Icon name="camera" className="h-5 w-5" />
          {busy ? `Envoi des captures… ${progress.done}/${progress.total}` : over ? "Dépose ici" : label}
        </span>
        {!busy && <span className="text-[13px] text-label3">Glisse des images, clique, ou clique puis colle (Ctrl/⌘ + V)</span>}
      </button>
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
