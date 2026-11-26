"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Feuille iOS qui monte du bas, avec poignée. */
export function BottomSheet({
  open,
  title,
  onClose,
  children,
  dismissible = true,
}: {
  open: boolean;
  title: string;
  onClose?: () => void;
  children: ReactNode;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button, [href], input")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center split:items-center" role="presentation">
      <div
        className="anim-fade absolute inset-0 bg-black/40"
        onClick={() => dismissible && onClose?.()}
        aria-hidden
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="anim-sheet relative w-full max-w-[520px] rounded-t-[20px] bg-bg pb-[max(env(safe-area-inset-bottom),20px)] shadow-sheet split:rounded-[20px] split:pb-5"
      >
        <div className="flex justify-center pt-2">
          <span className="h-[5px] w-9 rounded-full bg-label3/50" aria-hidden />
        </div>
        {children}
      </div>
    </div>
  );
}
