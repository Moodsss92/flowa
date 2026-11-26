"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useJournal } from "@/hooks/useJournal";
import { useMembers } from "@/hooks/useMembers";
import { useSession } from "@/hooks/useSession";
import { usePrefetchSigned } from "@/hooks/useSignedUrl";
import { copyToClipboard, journalToText, stepToText } from "@/lib/exportText";
import { imagesFromDataTransfer } from "@/lib/images";
import { nextNum } from "@/lib/numbering";
import { copyFiles, uploadCaptures } from "@/lib/storage";
import { getSupabase } from "@/lib/supabase/client";
import { EMPTY_FIELDS, STATUT_LABEL, type DraftCapture, type MemberName, type Statut, type Step, type StepFields } from "@/lib/types";
import { ExportSheet, type ExportKind } from "./ExportSheet";
import { HelpBanner } from "./HelpBanner";
import { NewFromCaptureButton } from "./NewFromCaptureButton";
import { PersonTabs, type Tab } from "./PersonTabs";
import { StepDetail } from "./StepDetail";
import { StepForm, type FormInit, type StepFormHandle } from "./StepForm";
import { StepList, type ListFilters } from "./StepList";
import { WhoAreYouSheet } from "./WhoAreYouSheet";
import { Alert, type AlertOptions } from "./ui/Alert";
import { Icon } from "./ui/Badges";
import { useToast } from "./ui/Toast";

type Progress = { done: number; total: number } | null;

function matchesQuery(s: Step, q: string): boolean {
  if (!q) return true;
  const hay = [s.num, s.bloc, s.titre, s.tcode, s.chemin, s.action, s.valeurs, s.controle, s.remarque, s.resp, STATUT_LABEL[s.statut]]
    .join("\n")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

function stepFields(s: Step): StepFields {
  const { num, bloc, titre, tcode, chemin, action, valeurs, controle, remarque, resp, statut } = s;
  return { num, bloc, titre, tcode, chemin, action, valeurs, controle, remarque, resp, statut };
}

export function JournalApp() {
  const toast = useToast();
  const { user, loading: sessionLoading } = useSession();
  const { me, loaded: membersLoaded, chooseName, nameOf } = useMembers(user?.id);
  const journal = useJournal(!!me);
  const { steps, capturesByStep } = journal;

  // ---------- État de l'interface ----------
  const [tab, setTab] = useState<Tab>("all");
  const tabInit = useRef(false);
  const [filters, setFilters] = useState<ListFilters>({ q: "", bloc: "", statut: "" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormInit | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<StepFormHandle>(null);
  const [newUpload, setNewUpload] = useState<Progress>(null);
  const [detailUpload, setDetailUpload] = useState<Progress>(null);
  const [whoOpen, setWhoOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [alert, setAlert] = useState<(AlertOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Par défaut, l'utilisateur arrive sur son propre espace
  useEffect(() => {
    if (me && !tabInit.current) {
      tabInit.current = true;
      setTab(me.name);
    }
  }, [me]);

  // Hauteur du header sticky (pour les éléments collés en dessous)
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, [me]);

  const confirm = useCallback(
    (opts: AlertOptions) => new Promise<boolean>((resolve) => setAlert({ ...opts, resolve })),
    [],
  );
  const closeAlert = (ok: boolean) => {
    alert?.resolve(ok);
    setAlert(null);
  };

  // ---------- Données filtrées ----------
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of steps) c[s.resp] = (c[s.resp] ?? 0) + 1;
    return c;
  }, [steps]);

  const visible = useMemo(
    () =>
      steps.filter(
        (s) =>
          (tab === "all" || s.resp === tab) &&
          (!filters.bloc || s.bloc === filters.bloc) &&
          (!filters.statut || s.statut === filters.statut) &&
          matchesQuery(s, filters.q.trim()),
      ),
    [steps, tab, filters],
  );

  const allBlocs = useMemo(() => Array.from(new Set(steps.map((s) => s.bloc))), [steps]);
  const selected = steps.find((s) => s.id === selectedId) ?? null;
  const selectedCaptures = useMemo(() => (selected ? capturesByStep.get(selected.id) ?? [] : []), [selected, capturesByStep]);
  usePrefetchSigned(selectedCaptures.map((c) => c.path));
  const visibleIndex = selected ? visible.findIndex((s) => s.id === selected.id) : -1;

  // ---------- Navigation protégée (modifications non enregistrées) ----------
  const leaveForm = useCallback(async (): Promise<boolean> => {
    if (!form) return true;
    if (dirty) {
      const ok = await confirm({
        title: "Quitter sans enregistrer ?",
        message: "Tes modifications et les captures ajoutées seront perdues.",
        confirmLabel: "Quitter",
        destructive: true,
      });
      if (!ok) return false;
    }
    await formRef.current?.discard();
    setForm(null);
    setDirty(false);
    return true;
  }, [form, dirty, confirm]);

  const select = useCallback(
    async (id: string | null) => {
      if (!(await leaveForm())) return;
      setSelectedId(id);
    },
    [leaveForm],
  );

  const openForm = useCallback((init: FormInit) => {
    setForm(init);
    setDirty(false);
    setFormKey((k) => k + 1);
  }, []);

  const defaultResp = (): string => (tab !== "all" ? tab : me?.name ?? "");

  // ---------- Création depuis des captures ----------
  const createFromFiles = useCallback(
    async (files: File[]) => {
      if (newUpload) return;
      if (!(await leaveForm())) return;
      const id = crypto.randomUUID();
      try {
        const paths = await uploadCaptures(id, files, (done, total) => setNewUpload({ done, total }));
        const bloc = filters.bloc;
        openForm({
          id,
          isNew: true,
          fields: { ...EMPTY_FIELDS, bloc, num: bloc ? nextNum(steps, bloc) : "", resp: tab !== "all" ? tab : me?.name ?? "", statut: "encours" },
          drafts: paths.map((path) => ({ key: path, path, legende: "" })),
          uploaded: paths,
          autoAnalyze: true,
          numAuto: true,
        });
      } catch (e) {
        toast(e instanceof Error ? e.message : "Envoi des captures impossible.", "error", 6000);
      } finally {
        setNewUpload(null);
      }
    },
    [newUpload, leaveForm, filters.bloc, steps, tab, me, openForm, toast],
  );

  const addToSelected = useCallback(
    async (files: File[]) => {
      if (!selected || detailUpload) return;
      try {
        const paths = await uploadCaptures(selected.id, files, (done, total) => setDetailUpload({ done, total }));
        await journal.appendCaptures(selected.id, paths);
        toast(`${paths.length} capture${paths.length > 1 ? "s" : ""} ajoutée${paths.length > 1 ? "s" : ""}`, "success");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Ajout impossible.", "error", 6000);
      } finally {
        setDetailUpload(null);
      }
    },
    [selected, detailUpload, journal, toast],
  );

  // Collage Ctrl/Cmd+V : formulaire ouvert → captures du formulaire ;
  // zone « Ajouter d'autres captures » ciblée → fiche affichée ; sinon → nouvelle étape.
  useEffect(() => {
    if (!me) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = imagesFromDataTransfer(e.clipboardData);
      if (!files.length) return;
      e.preventDefault();
      if (form) {
        formRef.current?.addFiles(files);
        return;
      }
      const active = document.activeElement?.closest?.("[data-paste-target]");
      const hovered = document.querySelector("[data-paste-target]:hover");
      const target = (active ?? hovered)?.getAttribute("data-paste-target");
      if (target?.startsWith("step:") && selected && target === `step:${selected.id}`) addToSelected(files);
      else createFromFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [me, form, selected, addToSelected, createFromFiles]);

  // Flèches ↑↓ : étape précédente / suivante
  useEffect(() => {
    if (form) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [role=radiogroup], [contenteditable=true]")) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (!visible.length) return;
      e.preventDefault();
      const i = visibleIndex === -1 ? (e.key === "ArrowDown" ? 0 : visible.length - 1) : visibleIndex + (e.key === "ArrowDown" ? 1 : -1);
      if (i >= 0 && i < visible.length) setSelectedId(visible[i].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [form, visible, visibleIndex]);

  // ---------- Actions de la fiche ----------
  const onSave = useCallback(
    async (id: string, fields: StepFields, drafts: DraftCapture[], isNew: boolean) => {
      await journal.saveStep(id, fields, drafts, isNew);
      setForm(null);
      setDirty(false);
      setSelectedId(id);
      toast(isNew ? "Étape créée" : "Modifications enregistrées", "success");
    },
    [journal, toast],
  );

  const cancelForm = useCallback(() => {
    leaveForm();
  }, [leaveForm]);

  const edit = (s: Step) =>
    openForm({
      id: s.id,
      isNew: false,
      fields: stepFields(s),
      drafts: (capturesByStep.get(s.id) ?? []).map((c) => ({ key: c.id, id: c.id, path: c.path, legende: c.legende })),
    });

  const duplicate = async (s: Step) => {
    const id = crypto.randomUUID();
    const caps = capturesByStep.get(s.id) ?? [];
    let drafts: DraftCapture[] = [];
    let uploaded: string[] = [];
    try {
      uploaded = await copyFiles(caps.map((c) => c.path), id);
      drafts = uploaded.map((path, i) => ({ key: path, path, legende: caps[i].legende }));
    } catch {
      toast("Les captures n'ont pas pu être copiées.", "error");
    }
    openForm({
      id,
      isNew: true,
      fields: { ...stepFields(s), num: s.bloc ? nextNum(steps, s.bloc) : "", titre: s.titre ? `${s.titre} (copie)` : "", statut: "afaire" },
      drafts,
      uploaded,
      numAuto: true,
    });
  };

  const nextInBloc = (s: Step) =>
    openForm({
      id: crypto.randomUUID(),
      isNew: true,
      fields: { ...EMPTY_FIELDS, bloc: s.bloc, num: s.bloc ? nextNum(steps, s.bloc) : "", resp: s.resp || defaultResp(), statut: "afaire" },
      drafts: [],
      numAuto: true,
    });

  const remove = async (s: Step) => {
    const ok = await confirm({
      title: `Supprimer « ${s.num ? s.num + " " : ""}${s.titre || "cette étape"} » ?`,
      message: "La fiche et ses captures seront supprimées pour toute l'équipe.",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    const i = visible.findIndex((x) => x.id === s.id);
    const neighbour = visible[i + 1] ?? visible[i - 1] ?? null;
    try {
      await journal.deleteStep(s.id);
      setSelectedId(neighbour?.id ?? null);
      toast("Étape supprimée");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Suppression impossible.", "error");
    }
  };

  const changeStatut = async (s: Step, statut: Statut) => {
    try {
      await journal.updateStatut(s.id, statut);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Mise à jour impossible.", "error");
    }
  };

  // ---------- Exports ----------
  const scopeLabel = tab === "all" ? "Tout le journal" : `Espace de ${tab}`;

  const today = () => new Date().toISOString().slice(0, 10);

  const exportWord = async (team: boolean) => {
    const list = team ? steps : visible;
    if (!list.length) return toast("Aucune étape à exporter.", "error");
    setExporting("Préparation…");
    try {
      const { exportJournalDocx, downloadBlob } = await import("@/lib/exportDocx");
      const blob = await exportJournalDocx(list, capturesByStep, {
        title: team ? "Dossier de configuration SAP · Philo Televisions" : "Journal de configuration SAP · Philo Televisions",
        subtitle: `${team ? "Équipe Moad, Armel, Mazen, Thomas" : scopeLabel} · ${list.length} étape${list.length > 1 ? "s" : ""} · exporté le ${new Date().toLocaleDateString("fr-FR")}`,
        team,
        nameOf,
        onProgress: (d, t) => setExporting(t ? `Captures ${d}/${t}` : "Génération…"),
      });
      const suffix = team ? "dossier-equipe" : tab === "all" ? "journal" : tab.toLowerCase();
      downloadBlob(blob, `sap-philo-${suffix}-${today()}.docx`);
      toast(team ? "Dossier d'équipe exporté" : "Document Word exporté", "success");
    } catch (e) {
      toast(e instanceof Error ? `Export impossible : ${e.message}` : "Export impossible.", "error", 6000);
    } finally {
      setExporting(null);
    }
  };

  const exportZip = async () => {
    if (!steps.length) return toast("Aucune étape à exporter.", "error");
    setExporting("Préparation…");
    try {
      const [{ exportCapturesZip }, { downloadBlob }] = await Promise.all([import("@/lib/exportZip"), import("@/lib/exportDocx")]);
      const { blob, missing } = await exportCapturesZip(steps, capturesByStep, {
        title: "Captures de configuration SAP · Philo Televisions",
        onProgress: (d, t) => setExporting(t ? `Captures ${d}/${t}` : "Compression…"),
      });
      downloadBlob(blob, `sap-philo-captures-equipe-${today()}.zip`);
      toast(missing ? `ZIP exporté (${missing} capture${missing > 1 ? "s" : ""} introuvable${missing > 1 ? "s" : ""})` : "Captures exportées en ZIP", missing ? "error" : "success", 5000);
    } catch (e) {
      toast(e instanceof Error ? `Export impossible : ${e.message}` : "Export impossible.", "error", 6000);
    } finally {
      setExporting(null);
    }
  };

  const runExport = (k: ExportKind) => {
    setExportOpen(false);
    if (k === "team-docx") exportWord(true);
    else if (k === "team-zip") exportZip();
    else if (k === "view-docx") exportWord(false);
    else copyJournal();
  };

  const copyJournal = async () => {
    if (!visible.length) return toast("Aucune étape à copier.", "error");
    try {
      await copyToClipboard(journalToText(visible, capturesByStep, `Journal SAP · Philo Televisions · ${scopeLabel}`));
      toast(`${visible.length} étape${visible.length > 1 ? "s" : ""} copiée${visible.length > 1 ? "s" : ""}`, "success");
    } catch {
      toast("Copie impossible : autorise l'accès au presse-papiers.", "error");
    }
  };

  const signOut = async () => {
    if (!(await leaveForm())) return;
    await getSupabase().auth.signOut();
    window.location.href = "/login";
  };

  // ---------- Rendu ----------
  if (sessionLoading || (user && !membersLoaded)) {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-label="Chargement">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue border-t-transparent" />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="min-h-screen">
        <WhoAreYouSheet open current={undefined} onChoose={chooseName} />
      </div>
    );
  }

  const showRight = !!form || !!selected;

  return (
    <div className="min-h-screen">
      <header ref={headerRef} className="glass hairline-b sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-[1280px] px-4">
          <div className="flex min-h-[52px] items-center gap-x-3 py-1.5">
            <div className="mr-auto flex min-w-0 flex-1 items-center gap-2">
              <h1 className="truncate text-[20px] font-bold tracking-tight">Journal SAP</h1>
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${journal.live ? "bg-green" : "bg-label3"}`}
                title={journal.live ? "Synchronisé en temps réel" : "Connexion temps réel en cours…"}
                aria-label={journal.live ? "Synchronisé en temps réel" : "Connexion temps réel en cours"}
              />
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button type="button" onClick={() => setExportOpen(true)} disabled={!!exporting} aria-label="Exporter" className="btn-plain px-2 text-[15px]">
                <Icon name="doc" className="h-[18px] w-[18px]" />
                <span className={exporting ? "" : "hidden sm:inline"}>{exporting ?? "Exporter"}</span>
              </button>
              <button type="button" onClick={copyJournal} aria-label="Copier en texte" className="btn-plain px-2 text-[15px]">
                <Icon name="copy" className="h-[18px] w-[18px]" />
                <span className="hidden sm:inline">Copier en texte</span>
              </button>
              <span className="mx-1 hidden h-5 w-[0.5px] bg-sep sm:block" aria-hidden />
              <span className="hidden text-[15px] text-label3 sm:inline">{me.name}</span>
              <button type="button" onClick={() => setWhoOpen(true)} aria-label={`Changer de nom (actuellement ${me.name})`} className="btn-plain px-2 text-[15px]">
                Changer
              </button>
              <button type="button" onClick={signOut} aria-label="Se déconnecter" title="Se déconnecter" className="btn-plain px-2">
                <Icon name="logout" className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
          <div className="pb-2.5">
            <PersonTabs
              value={tab}
              onChange={(t) => {
                setTab(t);
              }}
              me={me.name as MemberName}
              counts={counts}
              total={steps.length}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)] gap-6 px-4 pt-4 split:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
        <aside
          aria-label="Liste des étapes"
          className={`${showRight ? "hidden split:block" : ""} split:sticky split:top-[calc(var(--header-h,120px)+16px)] split:max-h-[calc(100vh-var(--header-h,120px)-16px)] split:overflow-y-auto split:pb-8 scroll-thin`}
        >
          <HelpBanner />
          <div className="mb-4">
            <NewFromCaptureButton onFiles={createFromFiles} progress={newUpload} />
          </div>
          {journal.error && (
            <div role="alert" className="card mb-3 p-3 text-[14px] text-red">
              Impossible de charger le journal : {journal.error}
              <button type="button" className="btn-plain ml-1 min-h-0 p-0 text-[14px]" onClick={journal.reload}>
                Réessayer
              </button>
            </div>
          )}
          <StepList
            steps={visible}
            allBlocs={allBlocs}
            capturesByStep={capturesByStep}
            filters={filters}
            onFilters={setFilters}
            selectedId={form ? null : selectedId}
            onSelect={(id) => select(id)}
            loading={journal.loading}
          />
        </aside>

        <section aria-label="Détail" className={`${showRight ? "" : "hidden split:block"} min-w-0`}>
          {form ? (
            <StepForm
              key={formKey}
              ref={formRef}
              init={form}
              allSteps={steps}
              blocOptions={allBlocs}
              onSave={onSave}
              onCancel={cancelForm}
              onDirtyChange={setDirty}
            />
          ) : selected ? (
            <StepDetail
              key={selected.id}
              step={selected}
              captures={selectedCaptures}
              position={{ index: Math.max(visibleIndex, 0), total: visible.length }}
              onPrev={visibleIndex > 0 ? () => setSelectedId(visible[visibleIndex - 1].id) : undefined}
              onNext={visibleIndex !== -1 && visibleIndex < visible.length - 1 ? () => setSelectedId(visible[visibleIndex + 1].id) : undefined}
              onBack={() => setSelectedId(null)}
              onStatut={(st) => changeStatut(selected, st)}
              onEdit={() => edit(selected)}
              onDuplicate={() => duplicate(selected)}
              onCopy={async () => {
                try {
                  await copyToClipboard(stepToText(selected, selectedCaptures));
                  toast("Fiche copiée", "success");
                } catch {
                  toast("Copie impossible.", "error");
                }
              }}
              onDelete={() => remove(selected)}
              onNextInBloc={() => nextInBloc(selected)}
              onAddFiles={addToSelected}
              uploadProgress={detailUpload}
              authorName={nameOf(selected.author_id)}
              updaterName={nameOf(selected.updated_by)}
            />
          ) : (
            <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center text-label3">
              <Icon name="doc" className="mb-3 h-12 w-12 opacity-50" />
              <p className="text-[17px] font-semibold text-label">Sélectionne une étape</p>
              <p className="mt-1 max-w-[360px] text-[15px]">
                Ou colle une capture SAP (Ctrl/⌘ + V) n&apos;importe où pour créer une nouvelle étape.
              </p>
            </div>
          )}
        </section>
      </main>

      <WhoAreYouSheet
        open={whoOpen}
        current={me.name as MemberName}
        onChoose={async (n) => {
          await chooseName(n);
          setWhoOpen(false);
          setTab(n);
          toast(`Tu es maintenant ${n}`, "success");
        }}
        onClose={() => setWhoOpen(false)}
      />
      <ExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onExport={runExport}
        teamCount={steps.length}
        teamCaptures={journal.captures.length}
        viewCount={visible.length}
        scopeLabel={scopeLabel}
      />
      <Alert options={alert} onCancel={() => closeAlert(false)} onConfirm={() => closeAlert(true)} />
    </div>
  );
}
