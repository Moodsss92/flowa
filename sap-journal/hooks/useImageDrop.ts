"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { imagesFromDataTransfer } from "@/lib/images";

/**
 * Glisser-déposer d'images sur une zone + collage Ctrl/Cmd+V global (optionnel).
 * Le collage est ignoré quand le focus est dans un champ texte et que le
 * presse-papiers ne contient pas d'image.
 */
export function useImageDrop(onFiles: (files: File[]) => void, opts: { paste?: boolean; disabled?: boolean } = {}) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const cb = useRef(onFiles);
  cb.current = onFiles;

  useEffect(() => {
    if (!opts.paste || opts.disabled) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = imagesFromDataTransfer(e.clipboardData);
      if (!files.length) return;
      e.preventDefault();
      cb.current(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [opts.paste, opts.disabled]);

  const onDragEnter = useCallback((e: DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    depth.current++;
    setOver(true);
  }, []);
  const onDragOver = useCallback((e: DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);
  const onDragLeave = useCallback(() => {
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  }, []);
  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      if (opts.disabled) return;
      const files = imagesFromDataTransfer(e.dataTransfer);
      if (files.length) cb.current(files);
    },
    [opts.disabled],
  );

  return { over, dropProps: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}
