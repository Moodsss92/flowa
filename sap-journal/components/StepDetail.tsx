"use client";

import { useState, type ReactNode } from "react";
import { STATUTS, type Capture, type Statut, type Step } from "@/lib/types";
import { AddCapturesZone } from "./AddCapturesZone";
import { CaptureImage } from "./CaptureImage";
import { Lightbox } from "./Lightbox";
import { Icon, StatutLabel, STATUT_STYLE, TcodeBadge } from "./ui/Badges";
import { SegmentedControl } from "./ui/SegmentedControl";

function Row({ label, children, tone }: { label: string; children: ReactNode; tone?: "red" }) {
  return (
    <div className="px-4 py-3">
      <dt className={`text-[13px] ${tone === "red" ? "text-red" : "text-label3"}`}>{label}</dt>
      <dd className={`mt-0.5 whitespace-pre-wrap break-words text-[16px] ${tone === "red" ? "text-red" : ""}`}>{children}</dd>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

export function StepDetail({
  step,
  captures,
  position,
  onPrev,
  onNext,
  onBack,
  onStatut,
  onEdit,
  onDuplicate,
  onCopy,
  onDelete,
  onNextInBloc,
  onAddFiles,
  uploadProgress,
  authorName,
  updaterName,
}: {
  step: Step;
  captures: Capture[];
  position: { index: number; total: number };
  onPrev?: () => void;
  onNext?: () => void;
  onBack: () => void;
  onStatut: (s: Statut) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onNextInBloc: () => void;
  onAddFiles: (files: File[]) => void;
  uploadProgress: { done: number; total: number } | null;
  authorName?: string;
  updaterName?: string;
}) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  return (
    <article aria-labelledby="step-title" className="pb-10">
      {/* Barre de navigation */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="btn-plain -ml-2 split:hidden">
          <Icon name="chevron-left" />
          Liste
        </button>
        <span className="hidden text-[13px] tabular-nums text-label3 split:inline">
          {position.index + 1} / {position.total} · ↑↓ pour naviguer
        </span>
        <div className="flex gap-1">
          <button type="button" onClick={onPrev} disabled={!onPrev} aria-label="Étape précédente" className="btn-tinted px-3">
            <Icon name="chevron-up" />
            <span className="hidden sm:inline">Précédent</span>
          </button>
          <button type="button" onClick={onNext} disabled={!onNext} aria-label="Étape suivante" className="btn-tinted px-3">
            <span className="hidden sm:inline">Suivant</span>
            <Icon name="chevron-down" />
          </button>
        </div>
      </div>

      {/* Titre */}
      <header className="mb-4 px-1">
        <div className="flex flex-wrap items-center gap-2 text-[15px] text-label3">
          {step.num && <span className="font-semibold tabular-nums">{step.num}</span>}
          <TcodeBadge tcode={step.tcode} />
        </div>
        <h1 id="step-title" className="mt-1 text-[30px] font-bold leading-tight tracking-tight">
          {step.titre || <span className="text-label3">Sans titre</span>}
        </h1>
      </header>

      {/* Statut en un clic */}
      <div className="mb-5">
        <SegmentedControl
          label="Statut"
          value={step.statut}
          onChange={onStatut}
          segments={STATUTS.map((s) => ({ value: s, label: <StatutLabel statut={s} />, tint: STATUT_STYLE[s].text }))}
        />
      </div>

      {/* Infos groupées façon Réglages */}
      <dl className="card inset-list mb-5 overflow-hidden">
        <Row label="Bloc">{step.bloc || "—"}</Row>
        <Row label="Responsable">{step.resp || "—"}</Row>
        <Row label="Transaction">{step.tcode ? <span className="font-mono font-semibold">{step.tcode}</span> : "—"}</Row>
        <Row label="Chemin">
          {step.chemin ? <span className="font-mono text-[14px] text-blue">{step.chemin}</span> : "—"}
        </Row>
      </dl>

      <dl className="card inset-list mb-5 overflow-hidden">
        <Row label="Ce qu'on fait">{step.action || <span className="text-label3">À compléter</span>}</Row>
        <Row label="Valeurs saisies">{step.valeurs ? <span className="font-mono text-[14px]">{step.valeurs}</span> : "—"}</Row>
        <Row label="Contrôle">{step.controle || "—"}</Row>
        {step.remarque && (
          <Row label="Problème / solution" tone="red">
            {step.remarque}
          </Row>
        )}
      </dl>

      <p className="mb-6 px-4 text-[13px] text-label3">
        Mis à jour le {formatDate(step.updated_at)}
        {updaterName ? ` par ${updaterName}` : ""}
        {authorName ? ` · créé par ${authorName}` : ""}
      </p>

      {/* Captures */}
      <h2 className="section-title">Captures ({captures.length})</h2>
      <div className="space-y-4">
        {captures.map((c, i) => (
          <figure key={c.id} className="card overflow-hidden">
            <button type="button" onClick={() => setLightbox(i)} className="block w-full bg-black/5" aria-label={`Agrandir la capture ${i + 1}`}>
              <CaptureImage path={c.path} alt={c.legende || `Capture ${i + 1}`} className="mx-auto max-h-[520px] w-full object-contain" />
            </button>
            <figcaption className="px-4 py-2.5 text-[14px] text-label3">
              Capture {i + 1}/{captures.length}
              {c.legende ? ` · ${c.legende}` : ""}
            </figcaption>
          </figure>
        ))}
        <AddCapturesZone target={`step:${step.id}`} onFiles={onAddFiles} progress={uploadProgress} />
      </div>

      {/* Actions */}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button type="button" onClick={onEdit} className="btn-blue">
          <Icon name="edit" className="h-[18px] w-[18px]" /> Modifier
        </button>
        <button type="button" onClick={onNextInBloc} className="btn-tinted">
          <Icon name="plus" className="h-[18px] w-[18px]" /> Étape suivante dans ce bloc
        </button>
        <button type="button" onClick={onDuplicate} className="btn-tinted">
          <Icon name="duplicate" className="h-[18px] w-[18px]" /> Dupliquer
        </button>
        <button type="button" onClick={onCopy} className="btn-tinted">
          <Icon name="copy" className="h-[18px] w-[18px]" /> Copier cette fiche
        </button>
        <button type="button" onClick={onDelete} className="btn-danger">
          <Icon name="trash" className="h-[18px] w-[18px]" /> Supprimer
        </button>
      </div>

      <Lightbox captures={captures} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />
    </article>
  );
}
