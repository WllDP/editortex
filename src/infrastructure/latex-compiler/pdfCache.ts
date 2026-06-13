import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

export function getPreviewCacheDir(projectKey: string, mode: string) {
  return path.join(getPreviewCacheRoot(), `${sanitizeCacheKey(projectKey)}-${sanitizeCacheKey(mode)}`);
}

export function getPreviewCacheRoot() {
  return path.join(os.tmpdir(), "editortex-preview-cache");
}

export function createPreviewPdfUrl(
  projectKey: string,
  compileMode: string,
  pdfPath: string,
  previewDir: string,
  revision: unknown,
) {
  const pdfRelativePath = path.relative(previewDir, pdfPath).replace(/\\/g, "/");
  const params = new URLSearchParams({
    projectKey,
    mode: compileMode,
    revision: String(revision ?? Date.now()),
    pdf: pdfRelativePath,
  });

  return `/api/preview-pdf?${params.toString()}`;
}

export async function findRequestedPdf(root: string, requestedPath: string | null): Promise<string | undefined> {
  if (!requestedPath) {
    return undefined;
  }

  const relativePath = normalizeProjectRelativePath(requestedPath);
  if (!relativePath || path.extname(relativePath).toLowerCase() !== ".pdf") {
    return undefined;
  }

  const targetPath = path.join(root, relativePath);
  if (!isPathInside(root, targetPath)) {
    return undefined;
  }

  try {
    const stat = await fs.stat(targetPath);
    return stat.isFile() ? targetPath : undefined;
  } catch {
    return undefined;
  }
}

export async function findCompiledPdf(root: string, texPath: string, newerThanMs = 0): Promise<string | undefined> {
  const expected = replaceExtension(texPath, ".pdf");
  if (await isFreshFile(expected, newerThanMs)) {
    return expected;
  }

  const expectedInRoot = path.join(root, `${path.basename(texPath, path.extname(texPath))}.pdf`);
  if (await isFreshFile(expectedInRoot, newerThanMs)) {
    return expectedInRoot;
  }

  return findPdfByStem(root, path.basename(texPath, path.extname(texPath)), newerThanMs);
}

async function findPdfByStem(dir: string, stem: string, newerThanMs = 0): Promise<string | undefined> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const pdfPath = await findPdfByStem(entryPath, stem, newerThanMs);
      if (pdfPath) {
        return pdfPath;
      }
      continue;
    }

    if (
      entry.isFile() &&
      path.extname(entry.name).toLowerCase() === ".pdf" &&
      path.basename(entry.name, ".pdf") === stem &&
      (await isFreshFile(entryPath, newerThanMs))
    ) {
      return entryPath;
    }
  }

  return undefined;
}

export async function findFirstPdf(dir: string): Promise<string | undefined> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const nestedPdf = await findFirstPdf(entryPath);
        if (nestedPdf) {
          return nestedPdf;
        }
      } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".pdf") {
        return entryPath;
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

async function isFreshFile(filePath: string, newerThanMs = 0) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.mtimeMs >= newerThanMs - 100;
  } catch {
    return false;
  }
}

function replaceExtension(filePath: string, extension: string) {
  return path.join(path.dirname(filePath), `${path.basename(filePath, path.extname(filePath))}${extension}`);
}

export function normalizeProjectRelativePath(filePath: string) {
  return filePath
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join(path.sep);
}

export function isPathInside(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function sanitizeCacheKey(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80) || "standalone";
}
