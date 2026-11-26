"use client";

import JSZip from "jszip";
import { NO_BLOC, blocNumber } from "./blocs";
import { journalToText, stepToText } from "./exportText";
import { signedUrl } from "./storage";
import { buildTeamSummary } from "./teamSummary";
import { STATUT_LABEL, type Capture, type Step } from "./types";

/** Nom de fichier sûr (Windows / macOS), sans accents problématiques. */
function safe(name: string, max = 60): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max)
      .replace(/[ .]+$/, "") || "sans-titre"
  );
}

function blocFolder(bloc: string): string {
  const n = blocNumber(bloc);
  const name = bloc.replace(/^\d+\s*·\s*/, "");
  return safe(n !== null ? `${String(n).padStart(2, "0")} - ${name}` : bloc || NO_BLOC);
}

function stepFolder(s: Step): string {
  return safe([s.num, s.tcode, s.titre || "sans titre"].filter(Boolean).join(" - "), 80);
}

function summaryText(steps: Step[], capturesByStep: Map<string, Capture[]>): string {
  const s = buildTeamSummary(steps, capturesByStep);
  const lines = [
    "ASSEMBLAGE DE L'ÉQUIPE",
    `${s.fait}/${s.total} étapes faites (${s.pct} %)`,
    "",
    "Avancement par bloc :",
    ...s.blocs.map(
      (b) => `  ${b.bloc} : ${b.byStatut.fait}/${b.total} faites` + (b.contributors.length ? ` (${b.contributors.join(", ")})` : ""),
    ),
    "",
    "Contribution de chacun :",
    ...s.members.map((m) => `  ${m.name} : ${m.total} étape(s), ${m.fait} faite(s), ${m.captures} capture(s)`),
    "",
    "Pièces manquantes :",
    ...(s.emptyBlocs.length ? s.emptyBlocs.map((b) => `  Bloc sans étape : ${b}`) : []),
    ...s.openSteps.map((st) => `  ${st.num || "–"} ${st.titre || "(sans titre)"} : ${STATUT_LABEL[st.statut]} · ${st.resp || "non attribuée"}`),
    ...(!s.emptyBlocs.length && !s.openSteps.length ? ["  Rien ne manque, tout est fait."] : []),
  ];
  return lines.join("\n") + "\n";
}

/**
 * ZIP des captures rangées comme le journal :
 *   00 - LISEZMOI.txt            synthèse + journal complet
 *   01 - Company codes et FI/
 *     1.4 - OBY6 - Paramètres globaux/
 *       fiche.txt
 *       capture 1 - Écran OBY6.png
 */
export async function exportCapturesZip(
  steps: Step[],
  capturesByStep: Map<string, Capture[]>,
  opts: { title: string; onProgress?: (done: number, total: number) => void },
): Promise<{ blob: Blob; missing: number }> {
  const zip = new JSZip();
  zip.file(
    "00 - LISEZMOI.txt",
    `${opts.title}\nExporté le ${new Date().toLocaleString("fr-FR")}\n\n${summaryText(steps, capturesByStep)}\n\n${journalToText(steps, capturesByStep, "JOURNAL COMPLET")}`,
  );

  const total = steps.reduce((n, s) => n + (capturesByStep.get(s.id)?.length ?? 0), 0);
  let done = 0;
  let missing = 0;
  opts.onProgress?.(0, total);

  const used = new Set<string>();
  for (const s of steps) {
    let dir = `${blocFolder(s.bloc)}/${stepFolder(s)}`;
    for (let k = 2; used.has(dir); k++) dir = `${blocFolder(s.bloc)}/${stepFolder(s)} (${k})`;
    used.add(dir);

    const caps = capturesByStep.get(s.id) ?? [];
    zip.file(`${dir}/fiche.txt`, stepToText(s, caps) + "\n");

    for (let i = 0; i < caps.length; i++) {
      const c = caps[i];
      const ext = c.path.split(".").pop() || "png";
      const name = safe(`capture ${i + 1}${c.legende ? " - " + c.legende : ""}`, 70);
      try {
        const url = await signedUrl(c.path);
        const res = url ? await fetch(url) : null;
        if (!res?.ok) throw new Error();
        zip.file(`${dir}/${name}.${ext}`, await res.arrayBuffer());
      } catch {
        missing++;
      }
      opts.onProgress?.(++done, total);
    }
  }

  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  return { blob, missing };
}
