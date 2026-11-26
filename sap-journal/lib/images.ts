"use client";

const MAX_BYTES = 3.5 * 1024 * 1024; // marge sous la limite de 5 Mo de l'API Claude
const MAX_SIDE = 2600;

export function isImageFile(f: File): boolean {
  return f.type.startsWith("image/");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image illisible"));
    img.src = src;
  });
}

/**
 * Prépare une capture pour l'envoi : les fichiers raisonnables sont gardés tels
 * quels ; les très grands sont réduits (côté max 2600 px) et réencodés.
 */
export async function prepareImage(file: File): Promise<Blob> {
  const okType = ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type);
  if (okType && file.size <= MAX_BYTES) return file;

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const [type, q] of [["image/png", undefined], ["image/jpeg", 0.9], ["image/jpeg", 0.75]] as const) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
      if (blob && blob.size <= MAX_BYTES) return blob;
    }
    return (await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.6))) ?? file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function extFor(type: string): string {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "png";
}

/** Fichiers images présents dans un presse-papiers ou un glisser-déposer. */
export function imagesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const files: File[] = [];
  if (dt.files?.length) {
    for (const f of Array.from(dt.files)) if (isImageFile(f)) files.push(f);
  }
  if (!files.length && dt.items) {
    for (const item of Array.from(dt.items)) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f && isImageFile(f)) files.push(f);
      }
    }
  }
  return files;
}
