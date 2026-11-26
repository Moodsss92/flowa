export const BLOCS = [
  "1 · Company codes et FI",
  "2 · Plants et storage locations",
  "3 · Organisation achats",
  "4 · Organisation ventes",
  "5 · Shipping points",
  "6 · Business partners",
  "7 · Material master et BOM",
  "8 · Contrats et accords d'achat",
  "9 · Production et MRP",
  "10 · STO intercompany",
  "11 · SD : documents et pricing",
] as const;

export const NO_BLOC = "Sans bloc";

/** Numéro en tête du bloc (« 2 · Plants… » → 2), ou null. */
export function blocNumber(bloc: string): number | null {
  const m = bloc.trim().match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Retrouve le libellé canonique d'un bloc proposé par Claude (« 3 », « Organisation achats »…). */
export function matchBloc(input: string): string {
  const s = input.trim();
  if (!s) return "";
  const exact = BLOCS.find((b) => b.toLowerCase() === s.toLowerCase());
  if (exact) return exact;
  const n = blocNumber(s);
  if (n !== null) {
    const byNum = BLOCS.find((b) => blocNumber(b) === n);
    if (byNum) return byNum;
  }
  const lower = s.toLowerCase();
  const byName = BLOCS.find((b) => {
    const name = b.replace(/^\d+\s*·\s*/, "").toLowerCase();
    return name.includes(lower) || lower.includes(name);
  });
  return byName ?? s;
}

export function compareBlocs(a: string, b: string): number {
  const na = blocNumber(a);
  const nb = blocNumber(b);
  if (na !== null && nb !== null && na !== nb) return na - nb;
  if (na !== null && nb === null) return -1;
  if (na === null && nb !== null) return 1;
  if (!a && b) return 1;
  if (a && !b) return -1;
  return a.localeCompare(b, "fr");
}
