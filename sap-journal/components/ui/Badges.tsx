import { STATUT_LABEL, type Statut } from "@/lib/types";

export const STATUT_STYLE: Record<Statut, { dot: string; pill: string; text: string }> = {
  fait: { dot: "bg-green", pill: "bg-green/15 text-green", text: "text-green" },
  encours: { dot: "bg-blue", pill: "bg-blue/15 text-blue", text: "text-blue" },
  probleme: { dot: "bg-red", pill: "bg-red/15 text-red", text: "text-red" },
  afaire: { dot: "bg-gray", pill: "bg-gray/20 text-label3", text: "text-label3" },
};

export function StatutBadge({ statut }: { statut: Statut }) {
  const s = STATUT_STYLE[statut];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold ${s.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {STATUT_LABEL[statut]}
    </span>
  );
}

export function StatutLabel({ statut }: { statut: Statut }) {
  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      <span className={`h-2 w-2 shrink-0 rounded-full ${STATUT_STYLE[statut].dot}`} aria-hidden />
      {STATUT_LABEL[statut]}
    </span>
  );
}

export function TcodeBadge({ tcode }: { tcode: string }) {
  if (!tcode) return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-[6px] bg-blue/10 px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-blue">
      {tcode}
    </span>
  );
}

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

export type IconName =
  | "plus" | "chevron-right" | "chevron-left" | "chevron-down" | "chevron-up" | "search" | "camera"
  | "doc" | "copy" | "trash" | "edit" | "duplicate" | "close" | "sparkles" | "stop" | "image" | "logout" | "info";

const ICONS: Record<IconName, JSX.Element> = {
  plus: <path d="M12 5v14M5 12h14" />,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  "chevron-left": <path d="m15 6-6 6 6 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-up": <path d="m6 15 6-6 6 6" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  doc: <><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4M9 13h6M9 17h6" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13 7 4 4" /></>,
  duplicate: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M14 11v6M11 14h6M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  sparkles: <><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></>,
  logout: <><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
};
