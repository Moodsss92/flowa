export const MEMBERS = ["Moad", "Armel", "Mazen", "Thomas"] as const;
export type MemberName = (typeof MEMBERS)[number];

export const STATUTS = ["afaire", "encours", "fait", "probleme"] as const;
export type Statut = (typeof STATUTS)[number];

export const STATUT_LABEL: Record<Statut, string> = {
  afaire: "À faire",
  encours: "En cours",
  fait: "Fait",
  probleme: "Problème",
};

export interface Member {
  id: string;
  name: MemberName;
  created_at: string;
}

export interface Step {
  id: string;
  num: string;
  bloc: string;
  titre: string;
  tcode: string;
  chemin: string;
  action: string;
  valeurs: string;
  controle: string;
  remarque: string;
  resp: string;
  statut: Statut;
  author_id: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Champs éditables d'une étape (formulaire). */
export type StepFields = Pick<
  Step,
  "num" | "bloc" | "titre" | "tcode" | "chemin" | "action" | "valeurs" | "controle" | "remarque" | "resp" | "statut"
>;

export interface Capture {
  id: string;
  step_id: string;
  path: string;
  legende: string;
  position: number;
  created_at?: string;
}

/** Capture dans le formulaire : déjà enregistrée (id) ou fraîchement envoyée. */
export interface DraftCapture {
  key: string;
  id?: string;
  path: string;
  legende: string;
}

/** Réponse de /api/analyze. */
export interface AnalyzeResult {
  tcode: string;
  titre: string;
  chemin: string;
  action: string;
  valeurs: string;
  controle: string;
  bloc: string;
}

export const EMPTY_FIELDS: StepFields = {
  num: "",
  bloc: "",
  titre: "",
  tcode: "",
  chemin: "",
  action: "",
  valeurs: "",
  controle: "",
  remarque: "",
  resp: "",
  statut: "afaire",
};
