"use client";

import { MEMBERS, type MemberName } from "@/lib/types";
import { SegmentedControl } from "./ui/SegmentedControl";

export type Tab = MemberName | "all";

export function PersonTabs({
  value,
  onChange,
  me,
  counts,
  total,
}: {
  value: Tab;
  onChange: (t: Tab) => void;
  me?: MemberName;
  counts: Record<string, number>;
  total: number;
}) {
  // « Mon espace » en premier, puis les autres, puis « Tout le journal »
  const order: MemberName[] = me ? [me, ...MEMBERS.filter((m) => m !== me)] : [...MEMBERS];
  const segments = [
    ...order.map((m) => ({
      value: m as Tab,
      ariaLabel: `${m === me ? "Mon espace, " : ""}${m}, ${counts[m] ?? 0} étapes`,
      label: (
        <span className="flex items-center justify-center gap-1.5">
          <span>{m === me ? `Mon espace · ${m}` : m}</span>
          <span className="rounded-full bg-fill/20 px-1.5 text-[11.5px] tabular-nums text-label3">{counts[m] ?? 0}</span>
        </span>
      ),
    })),
    {
      value: "all" as Tab,
      ariaLabel: `Tout le journal, ${total} étapes`,
      label: (
        <span className="flex items-center justify-center gap-1.5">
          <span>Tout le journal</span>
          <span className="rounded-full bg-fill/20 px-1.5 text-[11.5px] tabular-nums text-label3">{total}</span>
        </span>
      ),
    },
  ];
  return <SegmentedControl label="Espaces de l'équipe" value={value} onChange={onChange} segments={segments} scroll />;
}
