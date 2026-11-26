import { blocNumber, compareBlocs } from "./blocs";
import type { Step } from "./types";

/** Compare deux numéros « 1.10 » / « 1.9 » de façon numérique. */
export function compareNums(a: string, b: string): number {
  const pa = a.split(/[.\-]/).map((x) => parseInt(x, 10));
  const pb = b.split(/[.\-]/).map((x) => parseInt(x, 10));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === undefined || Number.isNaN(x)) return y === undefined || Number.isNaN(y) ? 0 : 1;
    if (y === undefined || Number.isNaN(y)) return -1;
    if (x !== y) return x - y;
  }
  return a.localeCompare(b);
}

export function compareSteps(a: Step, b: Step): number {
  return compareBlocs(a.bloc, b.bloc) || compareNums(a.num, b.num) || a.created_at.localeCompare(b.created_at);
}

/**
 * Numéro suivant dans un bloc : après 1.7 vient 1.8 ; un bloc « 2 · … » vide
 * commence à 2.1. Sans numéro de bloc : simple compteur.
 */
export function nextNum(steps: Pick<Step, "bloc" | "num">[], bloc: string, excludeNum?: string): string {
  const inBloc = steps.filter((s) => s.bloc === bloc);
  const n = blocNumber(bloc);
  let max = 0;
  for (const s of inBloc) {
    if (excludeNum !== undefined && s.num === excludeNum) continue;
    const m = s.num.trim().match(/^(\d+)\.(\d+)/);
    if (m && (n === null || Number(m[1]) === n)) max = Math.max(max, Number(m[2]));
    else if (n === null) {
      const k = parseInt(s.num, 10);
      if (!Number.isNaN(k)) max = Math.max(max, k);
    }
  }
  return n === null ? String(max + 1) : `${n}.${max + 1}`;
}
