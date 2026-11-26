"use client";

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { NO_BLOC } from "./blocs";
import { signedUrl } from "./storage";
import { STATUT_LABEL, type Capture, type Step } from "./types";

const MAX_WIDTH = 600;

type DocxImage = { data: ArrayBuffer; type: "png" | "jpg" | "gif"; width: number; height: number };

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

export async function exportJournalDocx(
  steps: Step[],
  capturesByStep: Map<string, Capture[]>,
  opts: { title: string; subtitle?: string; onProgress?: (done: number, total: number) => void },
): Promise<Blob> {
  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(opts.title)] }),
  ];
  if (opts.subtitle) {
    children.push(new Paragraph({ children: [new TextRun({ text: opts.subtitle, italics: true, color: "6E6E73" })] }));
  }

  const totalCaptures = steps.reduce((n, s) => n + (capturesByStep.get(s.id)?.length ?? 0), 0);
  let done = 0;
  opts.onProgress?.(0, totalCaptures);

  let current: string | null = null;
  for (const s of steps) {
    const bloc = s.bloc || NO_BLOC;
    if (bloc !== current) {
      current = bloc;
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: children.length > 2, children: [new TextRun(bloc)] }));
    }
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun(`${s.num ? s.num + " · " : ""}${s.titre || "(sans titre)"}`)],
      }),
      ...field("Responsable", s.resp),
      ...field("Statut", STATUT_LABEL[s.statut]),
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
            new TextRun({ text: `Capture ${i + 1}/${caps.length}${c.legende ? " · " + c.legende : ""}`, italics: true, size: 18, color: "6E6E73" }),
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
