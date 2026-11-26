"use client";

import { useMemo, useState } from "react";
import { BLOCS, NO_BLOC } from "@/lib/blocs";
import { STATUTS, STATUT_LABEL, type Capture, type Statut, type Step } from "@/lib/types";
import { Icon, StatutBadge, TcodeBadge } from "./ui/Badges";

export interface ListFilters {
  q: string;
  bloc: string;
  statut: Statut | "";
}

export function StepList({
  steps,
  allBlocs,
  capturesByStep,
  filters,
  onFilters,
  selectedId,
  onSelect,
  loading,
}: {
  steps: Step[];
  allBlocs: string[];
  capturesByStep: Map<string, Capture[]>;
  filters: ListFilters;
  onFilters: (f: ListFilters) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const out: { bloc: string; steps: Step[] }[] = [];
    for (const s of steps) {
      const bloc = s.bloc || NO_BLOC;
      const last = out[out.length - 1];
      if (last && last.bloc === bloc) last.steps.push(s);
      else out.push({ bloc, steps: [s] });
    }
    return out;
  }, [steps]);

  const blocOptions = useMemo(() => {
    const set = new Set<string>([...BLOCS, ...allBlocs.filter(Boolean)]);
    return Array.from(set);
  }, [allBlocs]);

  const toggle = (bloc: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(bloc)) next.delete(bloc);
      else next.add(bloc);
      return next;
    });

  const hasFilters = !!(filters.q || filters.bloc || filters.statut);

  return (
    <div>
      {/* Recherche + filtres */}
      <div className="mb-3 space-y-2">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-label3" />
          <label htmlFor="search" className="sr-only">
            Rechercher
          </label>
          <input
            id="search"
            type="search"
            placeholder="Rechercher (T-code, titre, valeurs…)"
            value={filters.q}
            onChange={(e) => onFilters({ ...filters, q: e.target.value })}
            className="w-full rounded-[10px] bg-fill/[0.12] py-2.5 pl-9 pr-3 text-[17px] outline-none placeholder:text-label3 focus:ring-2 focus:ring-blue/50"
          />
        </div>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="filter-bloc">
            Filtrer par bloc
          </label>
          <select
            id="filter-bloc"
            value={filters.bloc}
            onChange={(e) => onFilters({ ...filters, bloc: e.target.value })}
            className="min-h-[40px] min-w-0 flex-1 rounded-[10px] bg-card px-2.5 text-[15px] text-label outline-none focus:ring-2 focus:ring-blue/50"
          >
            <option value="">Tous les blocs</option>
            {blocOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="filter-statut">
            Filtrer par statut
          </label>
          <select
            id="filter-statut"
            value={filters.statut}
            onChange={(e) => onFilters({ ...filters, statut: e.target.value as Statut | "" })}
            className="min-h-[40px] w-[130px] shrink-0 rounded-[10px] bg-card px-2.5 text-[15px] text-label outline-none focus:ring-2 focus:ring-blue/50"
          >
            <option value="">Tous statuts</option>
            {STATUTS.map((s) => (
              <option key={s} value={s}>
                {STATUT_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2" aria-label="Chargement">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-[64px] animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="card px-4 py-8 text-center">
          <p className="text-[17px] font-semibold">{hasFilters ? "Aucun résultat" : "Aucune étape pour l'instant"}</p>
          <p className="mt-1 text-[14px] text-label3">
            {hasFilters ? "Modifie la recherche ou les filtres." : "Dépose une capture d'écran SAP pour créer la première."}
          </p>
          {hasFilters && (
            <button type="button" className="btn-plain mt-2" onClick={() => onFilters({ q: "", bloc: "", statut: "" })}>
              Effacer les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => {
            const done = g.steps.filter((s) => s.statut === "fait").length;
            const open = !collapsed.has(g.bloc);
            const pct = (done / g.steps.length) * 100;
            return (
              <section key={g.bloc} aria-label={g.bloc}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggle(g.bloc)}
                  className="flex min-h-[44px] w-full items-center gap-2 px-1 text-left"
                >
                  <Icon name="chevron-down" className={`h-4 w-4 shrink-0 text-label3 transition-transform ${open ? "" : "-rotate-90"}`} />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{g.bloc}</span>
                  <span className="shrink-0 text-[13px] tabular-nums text-label3">
                    {done}/{g.steps.length} faites
                  </span>
                </button>
                <div className="mx-1 mb-2 h-1 overflow-hidden rounded-full bg-fill/20" role="progressbar" aria-valuemin={0} aria-valuemax={g.steps.length} aria-valuenow={done} aria-label={`Progression ${g.bloc}`}>
                  <div className="h-full rounded-full bg-green transition-all" style={{ width: `${pct}%` }} />
                </div>
                {open && (
                  <ul className="card inset-list overflow-hidden">
                    {g.steps.map((s) => {
                      const nCap = capturesByStep.get(s.id)?.length ?? 0;
                      const active = s.id === selectedId;
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => onSelect(s.id)}
                            aria-current={active ? "true" : undefined}
                            className={`flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                              active ? "bg-blue/10 dark:bg-blue/25" : "active:bg-fill/15"
                            }`}
                          >
                            <span className="w-9 shrink-0 text-[14px] font-semibold tabular-nums text-label3">{s.num || "–"}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[16px]">{s.titre || <em className="text-label3">Sans titre</em>}</span>
                              <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-label3">
                                <TcodeBadge tcode={s.tcode} />
                                {nCap > 0 && (
                                  <span className="inline-flex items-center gap-0.5" aria-label={`${nCap} capture${nCap > 1 ? "s" : ""}`}>
                                    <Icon name="image" className="h-3.5 w-3.5" />
                                    {nCap}
                                  </span>
                                )}
                                {s.resp && <span className="truncate">· {s.resp}</span>}
                              </span>
                            </span>
                            <StatutBadge statut={s.statut} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
