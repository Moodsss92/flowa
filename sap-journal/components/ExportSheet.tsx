"use client";

import { BottomSheet } from "./ui/BottomSheet";
import { Icon, type IconName } from "./ui/Badges";

export type ExportKind = "team-docx" | "team-zip" | "view-docx" | "view-text";

interface Option {
  kind: ExportKind;
  icon: IconName;
  title: string;
  detail: string;
}

export function ExportSheet({
  open,
  onClose,
  onExport,
  teamCount,
  teamCaptures,
  viewCount,
  scopeLabel,
}: {
  open: boolean;
  onClose: () => void;
  onExport: (k: ExportKind) => void;
  teamCount: number;
  teamCaptures: number;
  viewCount: number;
  scopeLabel: string;
}) {
  const s = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;
  const team: Option[] = [
    {
      kind: "team-docx",
      icon: "doc",
      title: "Dossier complet de l'équipe (Word)",
      detail: `Les fiches de tout le monde rassemblées dans l'ordre du business case, avec qui a fait quoi, l'avancement par bloc et les pièces manquantes · ${s(teamCount, "étape")}, ${s(teamCaptures, "capture")}`,
    },
    {
      kind: "team-zip",
      icon: "image",
      title: "Captures de l'équipe (ZIP)",
      detail: "Un dossier par bloc, un sous-dossier par étape, avec les captures numérotées et la fiche texte",
    },
  ];
  const view: Option[] = [
    { kind: "view-docx", icon: "doc", title: "Vue actuelle en Word", detail: `${scopeLabel} avec les filtres en cours · ${s(viewCount, "étape")}` },
    { kind: "view-text", icon: "copy", title: "Copier la vue actuelle en texte", detail: "Dans le presse-papiers, pour un mail ou Teams" },
  ];

  const group = (title: string, options: Option[]) => (
    <>
      <h3 className="section-title mt-4">{title}</h3>
      <div className="card inset-list overflow-hidden">
        {options.map((o) => (
          <button
            key={o.kind}
            type="button"
            onClick={() => onExport(o.kind)}
            className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-fill/20"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-blue text-white">
              <Icon name={o.icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-medium">{o.title}</span>
              <span className="block text-[13px] leading-snug text-label3">{o.detail}</span>
            </span>
            <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-label3" />
          </button>
        ))}
      </div>
    </>
  );

  return (
    <BottomSheet open={open} title="Exporter" onClose={onClose}>
      <div className="px-4 pt-3">
        <h2 className="text-center text-[22px] font-bold">Exporter</h2>
        <p className="mt-1 text-center text-[14px] text-label3">Rassemble le travail de chacun en un seul dossier.</p>
        {group("Toute l'équipe", team)}
        {group("Vue actuelle", view)}
        <button type="button" className="btn-plain mt-2 w-full" onClick={onClose}>
          Annuler
        </button>
      </div>
    </BottomSheet>
  );
}
