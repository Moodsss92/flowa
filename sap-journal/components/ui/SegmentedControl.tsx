"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface Segment<T extends string> {
  value: T;
  label: ReactNode;
  ariaLabel?: string;
  tint?: string; // classe de couleur de texte quand sélectionné
}

/** Segmented control iOS (radiogroup accessible, flèches ← →). */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  label,
  size = "md",
  scroll = false,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
  scroll?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = segments.findIndex((s) => s.value === value);

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const d = e.key === "ArrowRight" ? 1 : -1;
    const next = (idx + d + segments.length) % segments.length;
    onChange(segments[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKey}
      className={`flex rounded-[10px] bg-fill/[0.12] p-[2px] ${scroll ? "overflow-x-auto scroll-thin" : ""}`}
    >
      {segments.map((s, i) => {
        const active = s.value === value;
        return (
          <button
            key={s.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={s.ariaLabel}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(s.value)}
            className={`relative flex-1 whitespace-nowrap rounded-[8px] px-3 font-medium transition-all ${
              size === "sm" ? "min-h-[32px] text-[13px]" : "min-h-[36px] text-[14px]"
            } ${
              active
                ? `bg-card shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)] dark:bg-[#636366] dark:text-white ${s.tint ?? "text-label"}`
                : "text-label/80 hover:text-label"
            }`}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
