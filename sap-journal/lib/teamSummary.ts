import { BLOCS, NO_BLOC, compareBlocs } from "./blocs";
import { MEMBERS, type Capture, type Statut, type Step } from "./types";

export interface BlocStat {
  bloc: string;
  total: number;
  byStatut: Record<Statut, number>;
  contributors: string[];
}

export interface MemberStat {
  name: string;
  total: number;
  fait: number;
  captures: number;
}

export interface TeamSummary {
  total: number;
  fait: number;
  pct: number;
  blocs: BlocStat[];
  members: MemberStat[];
  /** Blocs proposés qui n'ont encore aucune étape. */
  emptyBlocs: string[];
  /** Étapes pas encore faites (à faire, en cours, problème). */
  openSteps: Step[];
}

const zero = (): Record<Statut, number> => ({ afaire: 0, encours: 0, fait: 0, probleme: 0 });

/** Rassemble le travail de toute l'équipe, comme les pièces d'un puzzle. */
export function buildTeamSummary(steps: Step[], capturesByStep: Map<string, Capture[]>): TeamSummary {
  const blocMap = new Map<string, BlocStat>();
  const memberMap = new Map<string, MemberStat>(MEMBERS.map((m) => [m, { name: m, total: 0, fait: 0, captures: 0 }]));

  for (const s of steps) {
    const bloc = s.bloc || NO_BLOC;
    const b = blocMap.get(bloc) ?? { bloc, total: 0, byStatut: zero(), contributors: [] };
    b.total++;
    b.byStatut[s.statut]++;
    if (s.resp && !b.contributors.includes(s.resp)) b.contributors.push(s.resp);
    blocMap.set(bloc, b);

    const who = s.resp || "Non attribué";
    const m = memberMap.get(who) ?? { name: who, total: 0, fait: 0, captures: 0 };
    m.total++;
    if (s.statut === "fait") m.fait++;
    m.captures += capturesByStep.get(s.id)?.length ?? 0;
    memberMap.set(who, m);
  }

  const fait = steps.filter((s) => s.statut === "fait").length;
  return {
    total: steps.length,
    fait,
    pct: steps.length ? Math.round((fait / steps.length) * 100) : 0,
    blocs: Array.from(blocMap.values()).sort((a, b) => compareBlocs(a.bloc, b.bloc)),
    members: Array.from(memberMap.values()),
    emptyBlocs: BLOCS.filter((b) => !blocMap.has(b)),
    openSteps: steps.filter((s) => s.statut !== "fait"),
  };
}
