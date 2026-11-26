"use client";

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { NO_BLOC } from "./blocs";
import { signedUrl } from "./storage";
import { buildTeamSummary } from "./teamSummary";
import { STATUT_LABEL, type Capture, type Step } from "./types";

const MAX_WIDTH = 600;
const GREY = "6E6E73";
const STATUT_COLOR: Record<Step["statut"], string> = { fait: "34C759", encours: "007AFF", probleme: "FF3B30", afaire: "8E8E93" };

type DocxImage = { data: ArrayBuffer; type: "png" | "jpg" | "gif"; width: number; height: number };
type Block = Paragraph | Table;

/** Télécharge une capture et la convertit si besoin (webp → png) pour Word. */
async function loadForDocx(path: string): Promise<DocxImage | null> {
  const url = await signedUrl(path);
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;

  let data: ArrayBuffer;
  let type: DocxImage["type"];
  if (blob.type === "image/png" || blob.type === "image/jpeg" || blob.type === "image/gif") {
    data = await blob.arrayBuffer();
    type = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/gif" ? "gif" : "png";
  } else {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!png) return null;
    data = await png.arrayBuffer();
    type = "png";
  }
  bitmap.close();
  const scale = Math.min(1, MAX_WIDTH / width);
  return { data, type, width: Math.round(width * scale), height: Math.round(height * scale) };
}

function multiline(text: string, opts: { color?: string; font?: string } = {}): TextRun[] {
  return text.split("\n").map(
    (line, i) => new TextRun({ text: line, break: i > 0 ? 1 : undefined, color: opts.color, font: opts.font }),
  );
}

function field(label: string, value: string, opts: { color?: string; font?: string } = {}): Paragraph[] {
  if (!value.trim()) return [];
  return [
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: `${label} : `, bold: true }), ...multiline(value, opts)],
    }),
  ];
}

// ---------- Tableaux de synthèse ----------

function cell(text: string, opts: { bold?: boolean; header?: boolean; color?: string; align?: "left" | "center" } = {}) {
  return new TableCell({
    shading: opts.header ? { type: ShadingType.CLEAR, color: "auto", fill: "E5F0FF" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: opts.align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({ text, bold: opts.bold || opts.header, color: opts.color, size: 20 })],
      }),
    ],
  });
}

function table(header: string[], rows: { cells: string[]; colors?: (string | undefined)[] }[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, { header: true, align: i ? "center" : "left" })) }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.cells.map((c, i) => cell(c, { align: i ? "center" : "left", color: r.colors?.[i] })),
          }),
      ),
    ],
  });
}

function progressBar(done: number, total: number, width = 20): string {
  const n = total ? Math.round((done / total) * width) : 0;
  return "█".repeat(n) + "░".repeat(width - n);
}

function teamSummaryBlocks(steps: Step[], capturesByStep: Map<string, Capture[]>): Block[] {
  const s = buildTeamSummary(steps, capturesByStep);
  const out: Block[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Assemblage de l'équipe")] }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: `${s.fait}/${s.total} étapes faites (${s.pct} %)  `, bold: true, size: 28 }),
        new TextRun({ text: progressBar(s.fait, s.total), color: "34C759", size: 28 }),
      ],
    }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Avancement par bloc")] }),
    table(
      ["Bloc", "Étapes", "Faites", "En cours", "Problème", "À faire", "Contributeurs"],
      s.blocs.map((b) => ({
        cells: [
          b.bloc,
          String(b.total),
          String(b.byStatut.fait),
          String(b.byStatut.encours),
          String(b.byStatut.probleme),
          String(b.byStatut.afaire),
          b.contributors.join(", ") || "—",
        ],
        colors: [undefined, undefined, STATUT_COLOR.fait, STATUT_COLOR.encours, b.byStatut.probleme ? STATUT_COLOR.probleme : undefined],
      })),
    ),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Contribution de chacun")] }),
    table(
      ["Membre", "Étapes", "Faites", "Captures"],
      s.members.map((m) => ({ cells: [m.name, String(m.total), String(m.fait), String(m.captures)] })),
    ),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Pièces manquantes")] }),
  ];

  if (!s.emptyBlocs.length && !s.openSteps.length) {
    out.push(new Paragraph({ children: [new TextRun({ text: "Rien ne manque : toutes les étapes sont faites. 🎉", color: "34C759" })] }));
  }
  if (s.emptyBlocs.length) {
    out.push(new Paragraph({ children: [new TextRun({ text: "Blocs sans aucune étape :", bold: true })] }));
    s.emptyBlocs.forEach((b) => out.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(b)] })));
  }
  if (s.openSteps.length) {
    out.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: "Étapes à terminer :", bold: true })] }));
    s.openSteps.forEach((st) =>
      out.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [
            new TextRun(`${st.num ? st.num + " · " : ""}${st.titre || "(sans titre)"}`),
            new TextRun({ text: `  ${STATUT_LABEL[st.statut]}`, color: STATUT_COLOR[st.statut], bold: true }),
            new TextRun({ text: st.resp ? ` · ${st.resp}` : " · non attribuée", color: GREY }),
          ],
        }),
      ),
    );
  }
  return out;
}

// ---------- Export ----------

export interface DocxOptions {
  title: string;
  subtitle?: string;
  /** Dossier d'équipe : page de synthèse + signature de chaque fiche. */
  team?: boolean;
  nameOf?: (id: string | null | undefined) => string | undefined;
  onProgress?: (done: number, total: number) => void;
}

export async function exportJournalDocx(
  steps: Step[],
  capturesByStep: Map<string, Capture[]>,
  opts: DocxOptions,
): Promise<Blob> {
  const children: Block[] = [new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(opts.title)] })];
  if (opts.subtitle) {
    children.push(new Paragraph({ children: [new TextRun({ text: opts.subtitle, italics: true, color: GREY })] }));
  }
  if (opts.team) children.push(...teamSummaryBlocks(steps, capturesByStep));

  const totalCaptures = steps.reduce((n, s) => n + (capturesByStep.get(s.id)?.length ?? 0), 0);
  let done = 0;
  opts.onProgress?.(0, totalCaptures);

  let current: string | null = null;
  for (const s of steps) {
    const bloc = s.bloc || NO_BLOC;
    if (bloc !== current) {
      current = bloc;
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: children.length > 2, children: [new TextRun(bloc)] }),
      );
    }
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun(`${s.num ? s.num + " · " : ""}${s.titre || "(sans titre)"}`)],
      }),
    );
    if (opts.team) {
      const author = opts.nameOf?.(s.author_id);
      const updater = opts.nameOf?.(s.updated_by);
      const parts = [
        `Responsable : ${s.resp || "non attribuée"}`,
        author && `rédigée par ${author}`,
        updater && updater !== author && `complétée par ${updater}`,
      ].filter(Boolean);
      children.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({ text: `● ${STATUT_LABEL[s.statut]}`, bold: true, color: STATUT_COLOR[s.statut] }),
            new TextRun({ text: `   ${parts.join(" · ")}`, italics: true, color: GREY }),
          ],
        }),
      );
    } else {
      children.push(...field("Responsable", s.resp), ...field("Statut", STATUT_LABEL[s.statut]));
    }
    children.push(
      ...field("Transaction", s.tcode),
      ...field("Chemin", s.chemin, { font: "Consolas", color: "007AFF" }),
      ...field("Ce qu'on fait", s.action),
      ...field("Valeurs", s.valeurs),
      ...field("Contrôle", s.controle),
      ...field("Problème / solution", s.remarque, { color: "FF3B30" }),
    );

    const caps = capturesByStep.get(s.id) ?? [];
    for (let i = 0; i < caps.length; i++) {
      const c = caps[i];
      let img: DocxImage | null = null;
      try {
        img = await loadForDocx(c.path);
      } catch {
        img = null;
      }
      done++;
      opts.onProgress?.(done, totalCaptures);
      if (img) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 160 },
            children: [
              new ImageRun({
                type: img.type,
                data: img.data,
                transformation: { width: img.width, height: img.height },
                altText: { name: `Capture ${i + 1}`, description: c.legende || `Capture ${i + 1}`, title: `Capture ${i + 1}` },
              }),
            ],
          }),
        );
      } else {
        children.push(new Paragraph({ children: [new TextRun({ text: "[capture indisponible]", italics: true, color: "8E8E93" })] }));
      }
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({ text: `Capture ${i + 1}/${caps.length}${c.legende ? " · " + c.legende : ""}`, italics: true, size: 18, color: GREY }),
          ],
        }),
      );
    }
    children.push(
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D1D1D6", space: 4 } },
        spacing: { after: 200 },
        children: [],
      }),
    );
  }

  const doc = new Document({
    creator: "Journal SAP · Philo Televisions",
    title: opts.title,
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ children }],
  });
  return Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
