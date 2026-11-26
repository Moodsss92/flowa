"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BLOCS, matchBloc } from "@/lib/blocs";
import { nextNum } from "@/lib/numbering";
import { removeFiles, uploadCaptures } from "@/lib/storage";
import { lookupTcode, normalizeTcode } from "@/lib/tcodes";
import {
  MEMBERS,
  STATUTS,
  type AnalyzeResult,
  type DraftCapture,
  type Step,
  type StepFields,
} from "@/lib/types";
import { AddCapturesZone } from "./AddCapturesZone";
import { CaptureImage } from "./CaptureImage";
import { Icon, StatutLabel, STATUT_STYLE } from "./ui/Badges";
import { SegmentedControl } from "./ui/SegmentedControl";
import { useToast } from "./ui/Toast";

export interface FormInit {
  id: string;
  isNew: boolean;
  fields: StepFields;
  drafts: DraftCapture[];
  autoAnalyze?: boolean;
  /** Fichiers déjà envoyés pour ce brouillon (à nettoyer si on annule). */
  uploaded?: string[];
  numAuto?: boolean;
}

export interface StepFormHandle {
  addFiles: (files: File[]) => void;
  discard: () => Promise<void>;
}

type AiField = keyof AnalyzeResult;
const AI_FIELDS: AiField[] = ["tcode", "titre", "chemin", "action", "valeurs", "controle", "bloc"];
const MAX_ANALYZE = 5;

function snapshot(fields: StepFields, drafts: DraftCapture[]) {
  return JSON.stringify([fields, drafts.map((d) => [d.id ?? "", d.path, d.legende])]);
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="px-4 py-2.5">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-label3">
          {label}
        </label>
        {hint}
      </div>
      {children}
    </div>
  );
}

function SuggestHint({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-[12px] font-medium text-orange">proposé, à vérifier</span>;
}

export const StepForm = forwardRef<
  StepFormHandle,
  {
    init: FormInit;
    allSteps: Step[];
    blocOptions: string[];
    onSave: (id: string, fields: StepFields, drafts: DraftCapture[], isNew: boolean) => Promise<void>;
    onCancel: () => void;
    onDirtyChange: (dirty: boolean) => void;
  }
>(function StepForm({ init, allSteps, blocOptions, onSave, onCancel, onDirtyChange }, ref) {
  const toast = useToast();
  const [fields, setFields] = useState<StepFields>(init.fields);
  const [drafts, setDrafts] = useState<DraftCapture[]>(init.drafts);
  const [suggested, setSuggested] = useState<Set<keyof StepFields>>(new Set());
  const [numAuto, setNumAuto] = useState(!!init.numAuto);
  const [saving, setSaving] = useState(false);
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const [analysis, setAnalysis] = useState<{ state: "idle" | "running" | "done" | "error"; message?: string }>({ state: "idle" });

  const initial = useRef(snapshot(init.fields, init.drafts));
  const uploaded = useRef<string[]>(init.uploaded ?? []);
  const abort = useRef<AbortController | null>(null);
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  const dirty = useMemo(
    () => snapshot(fields, drafts) !== initial.current || (init.isNew && drafts.length > 0),
    [fields, drafts, init.isNew],
  );
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  // Avertissement du navigateur si on quitte la page avec des modifications
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const set = useCallback(<K extends keyof StepFields>(key: K, value: StepFields[K]) => {
    setFields((f) => ({ ...f, [key]: value }));
    setSuggested((s) => {
      if (!s.has(key)) return s;
      const next = new Set(s);
      next.delete(key);
      return next;
    });
  }, []);

  const numFor = useCallback(
    (bloc: string) => (bloc ? nextNum(allSteps.filter((s) => s.id !== init.id), bloc) : ""),
    [allSteps, init.id],
  );

  function changeBloc(bloc: string) {
    set("bloc", bloc);
    if (numAuto || !fieldsRef.current.num) {
      setFields((f) => ({ ...f, num: numFor(bloc) }));
      setNumAuto(true);
    }
  }

  /** T-code → chemin et titre depuis le dictionnaire local, s'ils sont vides. */
  function changeTcode(raw: string) {
    const tcode = raw.toUpperCase();
    set("tcode", tcode);
    const entry = lookupTcode(tcode);
    if (!entry) return;
    const [chemin, titre] = entry;
    const cur = fieldsRef.current;
    const filled: (keyof StepFields)[] = [];
    const patch: Partial<StepFields> = {};
    if (!cur.chemin.trim()) {
      patch.chemin = chemin;
      filled.push("chemin");
    }
    if (!cur.titre.trim()) {
      patch.titre = titre;
      filled.push("titre");
    }
    setFields((f) => ({ ...f, ...patch }));
    if (filled.length) setSuggested((s) => new Set([...Array.from(s), ...filled]));
  }

  // ---------- Lecture des captures par Claude ----------
  const analyze = useCallback(async () => {
    const paths = draftsRef.current.map((d) => d.path).slice(0, MAX_ANALYZE);
    if (!paths.length) {
      setAnalysis({ state: "error", message: "Ajoute au moins une capture à analyser." });
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setAnalysis({ state: "running" });
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
        signal: ctrl.signal,
      });
      const body = (await res.json().catch(() => ({}))) as { result?: AnalyzeResult; error?: string };
      if (!res.ok || !body.result) throw new Error(body.error || `Erreur ${res.status}`);
      const r = body.result;

      // On ne remplit QUE les champs vides
      const cur = fieldsRef.current;
      const next: StepFields = { ...cur };
      const filled: (keyof StepFields)[] = [];
      for (const k of AI_FIELDS) {
        const v = k === "bloc" ? matchBloc(r.bloc) : k === "tcode" ? normalizeTcode(r.tcode) : r[k];
        if (v && !cur[k].trim()) {
          next[k] = v;
          filled.push(k);
        }
      }
      // Complément par le dictionnaire si Claude a trouvé le T-code mais pas le chemin
      const entry = lookupTcode(next.tcode);
      if (entry) {
        if (!next.chemin.trim()) {
          next.chemin = entry[0];
          filled.push("chemin");
        }
        if (!next.titre.trim()) {
          next.titre = entry[1];
          filled.push("titre");
        }
      }
      if (filled.includes("bloc") && (numAuto || !next.num)) {
        next.num = numFor(next.bloc);
        setNumAuto(true);
      }
      setFields(next);
      setSuggested((s) => new Set([...Array.from(s), ...filled]));
      const n = new Set(filled).size;
      const more = draftsRef.current.length > MAX_ANALYZE ? ` (${MAX_ANALYZE} premières captures lues)` : "";
      setAnalysis({
        state: "done",
        message:
          n > 0
            ? `Claude a rempli ${n} champ${n > 1 ? "s" : ""}. Relis et complète « Ce qu'on fait ».${more}`
            : `Claude n'a rien trouvé à ajouter : les champs étaient déjà remplis ou illisibles.${more}`,
      });
    } catch (e) {
      if (ctrl.signal.aborted) {
        setAnalysis({ state: "idle", message: "Analyse arrêtée. Tu peux remplir la fiche à la main." });
      } else {
        setAnalysis({
          state: "error",
          message: `${e instanceof Error ? e.message : "Analyse impossible."} La saisie manuelle reste possible.`,
        });
      }
    } finally {
      if (abort.current === ctrl) abort.current = null;
    }
  }, [numAuto, numFor]);

  const autoRan = useRef(false);
  useEffect(() => {
    if (init.autoAnalyze && !autoRan.current) {
      autoRan.current = true;
      analyze();
    }
    return () => abort.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Captures ----------
  const addFiles = useCallback(
    async (files: File[]) => {
      if (upload) return;
      try {
        const paths = await uploadCaptures(init.id, files, (done, total) => setUpload({ done, total }));
        uploaded.current.push(...paths);
        setDrafts((d) => [...d, ...paths.map((path) => ({ key: path, path, legende: "" }))]);
        toast(`${paths.length} capture${paths.length > 1 ? "s" : ""} ajoutée${paths.length > 1 ? "s" : ""}`, "success");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Envoi impossible", "error", 5000);
      } finally {
        setUpload(null);
      }
    },
    [init.id, toast, upload],
  );

  const move = (i: number, d: -1 | 1) =>
    setDrafts((list) => {
      const j = i + d;
      if (j < 0 || j >= list.length) return list;
      const next = list.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const discard = useCallback(async () => {
    abort.current?.abort();
    const paths = uploaded.current;
    uploaded.current = [];
    await removeFiles(paths);
  }, []);

  useImperativeHandle(ref, () => ({ addFiles, discard }), [addFiles, discard]);

  // ---------- Enregistrement ----------
  const save = useCallback(async () => {
    if (saving || upload) return;
    setSaving(true);
    try {
      const f = fieldsRef.current;
      const clean: StepFields = {
        ...f,
        tcode: normalizeTcode(f.tcode),
        num: f.num.trim(),
        bloc: f.bloc.trim(),
        titre: f.titre.trim(),
      };
      const finalDrafts = draftsRef.current;
      await onSave(init.id, clean, finalDrafts, init.isNew);
      // Nettoyage des fichiers envoyés puis retirés avant l'enregistrement
      const kept = new Set(finalDrafts.map((d) => d.path));
      const orphans = uploaded.current.filter((p) => !kept.has(p));
      uploaded.current = [];
      removeFiles(orphans);
      initial.current = snapshot(clean, finalDrafts);
    } catch (e) {
      toast(`Enregistrement impossible : ${e instanceof Error ? e.message : "erreur"}`, "error", 6000);
    } finally {
      setSaving(false);
    }
  }, [init.id, init.isNew, onSave, saving, toast, upload]);

  // Raccourcis : Ctrl/Cmd+S, Échap
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      } else if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, onCancel]);

  const running = analysis.state === "running";
  const allBlocs = Array.from(new Set([...BLOCS, ...blocOptions.filter(Boolean)]));

  return (
    <form
      className="pb-28"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      aria-label={init.isNew ? "Nouvelle étape" : "Modifier l'étape"}
    >
      {/* Barre du haut */}
      <div className="glass sticky top-[var(--header-h,0px)] z-10 -mx-4 mb-3 flex items-center justify-between gap-2 px-4 py-2 split:static split:mx-0 split:bg-transparent split:px-0 split:backdrop-blur-0">
        <button type="button" onClick={onCancel} className="btn-plain -ml-2">
          Annuler
        </button>
        <h1 className="truncate text-[17px] font-semibold">{init.isNew ? "Nouvelle étape" : "Modifier l'étape"}</h1>
        <button type="submit" disabled={saving || !!upload} className="btn-blue min-w-[110px]">
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      {/* Lecture par Claude */}
      <div className="card mb-4 p-3" aria-live="polite">
        <div className="flex flex-wrap items-center gap-2">
          {running ? (
            <>
              <span className="flex flex-1 items-center gap-2 text-[15px]">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue border-t-transparent" aria-hidden />
                Claude lit {Math.min(drafts.length, MAX_ANALYZE)} capture{drafts.length > 1 ? "s" : ""}…
              </span>
              <button type="button" onClick={() => abort.current?.abort()} className="btn-danger min-h-[36px] px-3 text-[15px]">
                <Icon name="stop" className="h-4 w-4" /> Arrêter
              </button>
            </>
          ) : (
            <>
              <span className="flex flex-1 items-center gap-2 text-[15px] text-label3">
                <Icon name="sparkles" className="h-5 w-5 text-blue" />
                Claude remplit uniquement les champs vides.
              </span>
              <button
                type="button"
                onClick={analyze}
                disabled={!drafts.length || !!upload}
                className="btn-tinted min-h-[36px] px-3 text-[15px]"
              >
                Remplir depuis les captures
              </button>
            </>
          )}
        </div>
        {analysis.message && (
          <p
            role={analysis.state === "error" ? "alert" : undefined}
            className={`mt-2 text-[14px] ${analysis.state === "error" ? "text-red" : analysis.state === "done" ? "text-green" : "text-label3"}`}
          >
            {analysis.message}
          </p>
        )}
      </div>

      {/* Identification */}
      <div className="card inset-list mb-4 overflow-hidden">
        <div className="grid grid-cols-[1fr_96px]">
          <Field label="T-code" htmlFor="f-tcode">
            <input
              id="f-tcode"
              className="ios-input font-mono uppercase"
              value={fields.tcode}
              onChange={(e) => changeTcode(e.target.value)}
              placeholder="ex. OX18"
              autoComplete="off"
              spellCheck={false}
              autoFocus={!init.autoAnalyze}
            />
          </Field>
          <Field label="N°" htmlFor="f-num">
            <input
              id="f-num"
              className="ios-input tabular-nums"
              value={fields.num}
              onChange={(e) => {
                set("num", e.target.value);
                setNumAuto(false);
              }}
              placeholder="1.8"
              inputMode="decimal"
            />
          </Field>
        </div>
        <Field label="Bloc" htmlFor="f-bloc" hint={<SuggestHint show={suggested.has("bloc")} />}>
          <input
            id="f-bloc"
            list="bloc-options"
            className="ios-input"
            value={fields.bloc}
            onChange={(e) => changeBloc(e.target.value)}
            placeholder="Choisir ou saisir un bloc"
          />
          <datalist id="bloc-options">
            {allBlocs.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>
        <Field label="Titre" htmlFor="f-titre" hint={<SuggestHint show={suggested.has("titre")} />}>
          <input id="f-titre" className="ios-input" value={fields.titre} onChange={(e) => set("titre", e.target.value)} placeholder="ex. Affecter le plant au company code" />
        </Field>
        <Field label="Responsable" htmlFor="f-resp">
          <select id="f-resp" className="ios-input" value={fields.resp} onChange={(e) => set("resp", e.target.value)}>
            <option value="">—</option>
            {MEMBERS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            {fields.resp && !(MEMBERS as readonly string[]).includes(fields.resp) && <option value={fields.resp}>{fields.resp}</option>}
          </select>
        </Field>
        <div className="px-4 py-3">
          <span className="mb-1.5 block text-[13px] font-medium text-label3" id="f-statut-label">
            Statut
          </span>
          <SegmentedControl
            label="Statut"
            size="sm"
            value={fields.statut}
            onChange={(v) => set("statut", v)}
            segments={STATUTS.map((s) => ({ value: s, label: <StatutLabel statut={s} />, tint: STATUT_STYLE[s].text }))}
          />
        </div>
      </div>

      {/* Contenu */}
      <div className="card inset-list mb-4 overflow-hidden">
        <Field label="Chemin" htmlFor="f-chemin" hint={<SuggestHint show={suggested.has("chemin")} />}>
          <textarea
            id="f-chemin"
            rows={2}
            className="ios-input resize-y font-mono text-[14px] text-blue"
            value={fields.chemin}
            onChange={(e) => set("chemin", e.target.value)}
            placeholder="SPRO › Enterprise Structure › …"
          />
        </Field>
        <Field label="Ce qu'on fait" htmlFor="f-action" hint={<SuggestHint show={suggested.has("action")} />}>
          <textarea id="f-action" rows={3} className="ios-input resize-y" value={fields.action} onChange={(e) => set("action", e.target.value)} placeholder="Explique en 1 à 3 phrases ce que tu as configuré et pourquoi." />
        </Field>
        <Field label="Valeurs saisies" htmlFor="f-valeurs" hint={<SuggestHint show={suggested.has("valeurs")} />}>
          <textarea id="f-valeurs" rows={4} className="ios-input resize-y font-mono text-[14px]" value={fields.valeurs} onChange={(e) => set("valeurs", e.target.value)} placeholder={"Champ : valeur\nPlant : 2BRE"} />
        </Field>
        <Field label="Contrôle" htmlFor="f-controle" hint={<SuggestHint show={suggested.has("controle")} />}>
          <textarea id="f-controle" rows={2} className="ios-input resize-y" value={fields.controle} onChange={(e) => set("controle", e.target.value)} placeholder="Message de la barre d'état, transaction de vérification…" />
        </Field>
        <Field label="Problème / solution" htmlFor="f-remarque">
          <textarea id="f-remarque" rows={2} className="ios-input resize-y text-red placeholder:text-red/50" value={fields.remarque} onChange={(e) => set("remarque", e.target.value)} placeholder="Erreur rencontrée et comment tu l'as résolue" />
        </Field>
      </div>

      {/* Captures */}
      <h2 className="section-title">Captures ({drafts.length})</h2>
      <div className="space-y-2">
        {drafts.length > 0 && (
          <ul className="card inset-list overflow-hidden">
            {drafts.map((d, i) => (
              <li key={d.key} className="flex items-center gap-3 p-3">
                <CaptureImage path={d.path} alt={d.legende || `Capture ${i + 1}`} className="h-16 w-24 shrink-0 rounded-[8px] bg-black/5 object-cover" />
                <div className="min-w-0 flex-1">
                  <label htmlFor={`leg-${d.key}`} className="text-[12px] text-label3">
                    Capture {i + 1} · légende
                  </label>
                  <input
                    id={`leg-${d.key}`}
                    className="ios-input mt-0.5 py-2 text-[15px]"
                    value={d.legende}
                    onChange={(e) => setDrafts((list) => list.map((x) => (x.key === d.key ? { ...x, legende: e.target.value } : x)))}
                    placeholder="ex. Écran de sauvegarde"
                  />
                </div>
                <div className="flex shrink-0 flex-col">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Monter la capture ${i + 1}`} className="flex h-9 w-11 items-center justify-center text-blue disabled:text-label3/40">
                    <Icon name="chevron-up" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === drafts.length - 1} aria-label={`Descendre la capture ${i + 1}`} className="flex h-9 w-11 items-center justify-center text-blue disabled:text-label3/40">
                    <Icon name="chevron-down" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setDrafts((list) => list.filter((x) => x.key !== d.key))}
                  className="min-h-[44px] shrink-0 px-2 text-[15px] text-red"
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
        <AddCapturesZone target="form" onFiles={addFiles} progress={upload} label={drafts.length ? "+ Ajouter d'autres captures" : "+ Ajouter des captures"} />
      </div>

      <p className="mt-4 px-4 text-center text-[13px] text-label3">Ctrl/⌘ + S pour enregistrer · Échap pour annuler</p>
    </form>
  );
});
