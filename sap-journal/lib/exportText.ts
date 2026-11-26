import { NO_BLOC } from "./blocs";
import { STATUT_LABEL, type Capture, type Step } from "./types";

export function stepToText(step: Step, captures: Capture[] = []): string {
  const lines: string[] = [];
  lines.push(`${step.num ? step.num + " · " : ""}${step.titre || "(sans titre)"}`);
  const field = (label: string, value: string) => {
    if (value.trim()) lines.push(`${label} : ${value.includes("\n") ? "\n  " + value.split("\n").join("\n  ") : value}`);
  };
  field("Bloc", step.bloc);
  field("Responsable", step.resp);
  field("Statut", STATUT_LABEL[step.statut]);
  field("Transaction", step.tcode);
  field("Chemin", step.chemin);
  field("Ce qu'on fait", step.action);
  field("Valeurs", step.valeurs);
  field("Contrôle", step.controle);
  field("Problème / solution", step.remarque);
  if (captures.length) {
    lines.push(
      `Captures (${captures.length}) : ` +
        captures.map((c, i) => `${i + 1}${c.legende ? " " + c.legende : ""}`).join(" ; "),
    );
  }
  return lines.join("\n");
}

export function journalToText(
  steps: Step[],
  capturesByStep: Map<string, Capture[]>,
  title = "Journal de configuration SAP · Philo Televisions",
): string {
  const out: string[] = [title, "=".repeat(title.length), ""];
  let current: string | null = null;
  for (const s of steps) {
    const bloc = s.bloc || NO_BLOC;
    if (bloc !== current) {
      current = bloc;
      out.push("", `## ${bloc}`, "");
    }
    out.push(stepToText(s, capturesByStep.get(s.id) ?? []), "");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}
