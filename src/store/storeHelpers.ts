import type { DocumentModel } from "@/types/document";

export function normalizeDocumentOrder(document: DocumentModel): DocumentModel {
  return {
    ...document,
    blocks: [...document.blocks].sort((a, b) => a.order - b.order).map((block, index) => ({ ...block, order: index })),
  };
}

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\\[a-zA-Z@][\w@]*/g, " ")
    .replace(/[{}\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function scoreBlockPreviewMatch(query: string, data: Record<string, string>) {
  const fieldValues = Object.values(data).map(normalizeSearchText).filter(Boolean);
  const fullValue = normalizeSearchText(fieldValues.join(" "));
  const queryWords = query.split(/\s+/).filter((word) => word.length >= 4);
  let score = 0;

  for (const value of fieldValues) {
    if (value === query) {
      score = Math.max(score, 1000);
    }
    if (value.startsWith(query)) {
      score = Math.max(score, 700);
    }
    if (value.includes(query)) {
      score = Math.max(score, 420 + Math.min(query.length, 80));
    }
    if (query.includes(value) && value.length >= 4) {
      score = Math.max(score, 360 + Math.min(value.length, 80));
    }
  }

  if (fullValue.includes(query)) {
    score = Math.max(score, 260 + Math.min(query.length, 80));
  }

  const matchedWords = queryWords.filter((word) => fullValue.includes(word));
  if (matchedWords.length > 0) {
    score = Math.max(score, matchedWords.length * 60);
  }

  if (fieldValues.length > 0 && fieldValues[0] === query) {
    score += 300;
  }

  return score;
}

export function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler imagem."));
    reader.readAsDataURL(file);
  });
}

export function createProjectAssetPath(rootPath: string | undefined, fileName: string, files: Array<{ path: string }>) {
  const safeName = sanitizeAssetFileName(fileName);
  const prefix = rootPath ? `${rootPath.replace(/\/+$/g, "")}/` : "";
  const existingPaths = new Set(files.map((file) => file.path));
  let candidate = `${prefix}${safeName}`;
  let suffix = 2;

  while (existingPaths.has(candidate)) {
    const extension = getFileExtension(safeName);
    const stem = extension ? safeName.slice(0, -extension.length - 1) : safeName;
    candidate = `${prefix}${stem}-${suffix}${extension ? `.${extension}` : ""}`;
    suffix += 1;
  }

  return candidate;
}

export function getFileExtension(value: string) {
  return value.toLowerCase().match(/\.([^.\\/]+)$/)?.[1] ?? "png";
}

export function getBaseName(value: string) {
  return value.replace(/\\/g, "/").split("/").at(-1) ?? value;
}

export function getImageMimeType(extension: string) {
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "svg") return "image/svg+xml";
  if (extension === "webp") return "image/webp";
  return "image/png";
}

function sanitizeAssetFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim() || `imagem-${Date.now()}.png`;
}
