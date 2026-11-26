"use client";

import { useEffect, useRef } from "react";

export interface AlertOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}

/** Alerte iOS centrée : Annuler à gauche, action (rouge si destructive) à droite. */
export function Alert({
  options,
  onCancel,
  onConfirm,
}: {
  options: AlertOptions | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!options) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [options, onCancel]);

  if (!options) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="anim-fade absolute inset-0 bg-black/40" aria-hidden onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-title"
        aria-describedby={options.message ? "alert-msg" : undefined}
        className="anim-pop relative w-[270px] overflow-hidden rounded-[14px] bg-card/95 text-center shadow-pop backdrop-blur-xl dark:bg-[#2C2C2E]/95"
      >
        <div className="px-4 pb-4 pt-5">
          <h2 id="alert-title" className="text-[17px] font-semibold">
            {options.title}
          </h2>
          {options.message && (
            <p id="alert-msg" className="mt-1 text-[13px] leading-snug text-label">
              {options.message}
            </p>
          )}
        </div>
        <div className="hairline-t flex">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-[44px] flex-1 text-[17px] text-blue active:bg-fill/20"
          >
            {options.cancelLabel ?? "Annuler"}
          </button>
          <span className="w-[0.5px] bg-sep" aria-hidden />
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[44px] flex-1 text-[17px] font-semibold active:bg-fill/20 ${
              options.destructive ? "text-red" : "text-blue"
            }`}
          >
            {options.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
