import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import type { CompileMetrics, ImportProjectResult, ProjectFileKind } from "@/features/preview/types/compileTypes";
import { getPreviewCacheRoot, isPathInside, sanitizeCacheKey } from "./pdfCache";
import {
  ensureProjectDirectories,
  getProjectDirectories,
  saveProjectManifest,
  type ProjectFileManifestItem,
  type ProjectManifest,
} from "./projectManifest";

export type ImportProjectZipOptions = {
  projectKey?: string;
  archiveName?: string;
};

type ImportedFile = ImportProjectResult["files"][number] & {
  alreadySynced: true;
};

export async function importProjectZipBytes(
  zipBytes: Buffer,
  options: ImportProjectZipOptions = {},
): Promise<ImportProjectResult> {
  const totalStartedAt = performance.now();
  const projectKey = sanitizeCacheKey(options.projectKey ?? `project-${createHash(zipBytes).slice(0, 16)}`);
  const dirs = getProjectDirectories(getPreviewCacheRoot(), projectKey);
  await ensureProjectDirectories(dirs);

  const extractStartedAt = performance.now();
  const zip = await JSZip.loadAsync(zipBytes);
  const zipExtractMs = performance.now() - extractStartedAt;

  const classifyStartedAt = performance.now();
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const acceptedEntries = entries
    .map((entry) => ({ entry, normalizedPath: normalizeZipEntryPath(entry.name) }))
    .filter((entry): entry is { entry: JSZip.JSZipObject; normalizedPath: string } => Boolean(entry.normalizedPath))
    .filter(({ normalizedPath }) => !shouldIgnoreZipEntry(normalizedPath));
  const zipClassifyMs = performance.now() - classifyStartedAt;

  const mainStartedAt = performance.now();
  const texCandidates: Array<{ path: string; content: string }> = [];
  for (const { entry, normalizedPath } of acceptedEntries.filter(({ normalizedPath }) =>
    normalizedPath.toLowerCase().endsWith(".tex"),
  )) {
    texCandidates.push({ path: normalizedPath, content: await entry.async("text") });
  }
  const mainTex = selectMainTexCandidate(texCandidates);
  const mainTexDetectionMs = performance.now() - mainStartedAt;
  if (!mainTex) {
    throw new Error("O ZIP nao contem um arquivo .tex principal reconhecivel.");
  }

  const files: ImportedFile[] = [];
  const manifestFiles: ProjectFileManifestItem[] = [];
  let assetHashMs = 0;
  const now = Date.now();
  const writeFilesStartedAt = performance.now();

  for (const { entry, normalizedPath } of acceptedEntries) {
    const bytes = Buffer.from(await entry.async("uint8array"));
    const hashStartedAt = performance.now();
    const hash = createHash(bytes);
    assetHashMs += performance.now() - hashStartedAt;
    const kind = classifyProjectFileKind(normalizedPath);
    const mimeType = mimeTypeForPath(normalizedPath);
    const relativePath = pathFromManifestPath(normalizedPath);
    const assetsPath = path.join(dirs.assetsDir, relativePath);
    const compilePath = path.join(dirs.compileDir, relativePath);
    if (!isPathInside(dirs.assetsDir, assetsPath) || !isPathInside(dirs.compileDir, compilePath)) {
      continue;
    }

    await writeBytesIfChanged(assetsPath, bytes);
    await writeBytesIfChanged(compilePath, bytes);

    files.push({
      path: normalizedPath,
      hash,
      size: bytes.byteLength,
      kind,
      mimeType,
      alreadySynced: true,
    });
    manifestFiles.push({
      path: normalizedPath,
      hash,
      size: bytes.byteLength,
      kind,
      mimeType,
      lastSyncedAt: now,
    });
  }
  const writeFilesMs = performance.now() - writeFilesStartedAt;

  await writeTextIfChanged(path.join(dirs.sourceDir, "imported-main.tex"), mainTex.content);
  const sourceHash = createHash(
    Buffer.from(
      JSON.stringify({
        tex: mainTex.content,
        assets: files.filter((file) => file.path !== mainTex.path).map((file) => [file.path, file.hash, file.size]),
      }),
      "utf8",
    ),
  );

  const manifest: ProjectManifest = {
    projectKey,
    revision: 0,
    sourceHash,
    files: manifestFiles,
    lastCompiledByMode: {},
    updatedAt: now,
  };
  const manifestSaveMs = await saveProjectManifest(dirs, manifest);
  const metrics: CompileMetrics = {
    mode: "pdf-preview",
    importMs: performance.now() - totalStartedAt,
    importZipReadMs: 0,
    zipExtractMs,
    zipClassifyMs,
    mainTexDetectionMs,
    assetHashMs,
    writeFilesMs,
    importManifestSaveMs: manifestSaveMs,
    manifestSaveMs,
    usedPersistedProject: true,
  };

  return {
    projectKey,
    templateName: options.archiveName,
    mainTexPath: mainTex.path,
    mainTexContent: mainTex.content,
    sourceHash,
    metrics,
    files,
    assets: files
      .filter((file) => file.kind !== "tex" && file.kind !== "aux" && file.kind !== "output")
      .map((file) => ({
        path: file.path,
        hash: file.hash,
        size: file.size,
        kind: file.kind,
        mimeType: file.mimeType,
        alreadySynced: true,
      })),
  };
}

export function normalizeZipEntryPath(entryName: string) {
  const normalized = entryName.replace(/\\/g, "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.match(/^[a-zA-Z]:\//)
  ) {
    return undefined;
  }

  const parts = normalized.split("/").filter((part) => part && part !== ".");
  if (!parts.length || parts.some((part) => part === "..")) {
    return undefined;
  }
  return parts.join("/");
}

export function shouldIgnoreZipEntry(filePath: string) {
  return (
    filePath.startsWith("__MACOSX/") ||
    filePath.startsWith(".git/") ||
    filePath.includes("/.git/") ||
    filePath.startsWith("node_modules/") ||
    filePath.includes("/node_modules/") ||
    filePath.endsWith("/.DS_Store")
  );
}

export function selectMainTexCandidate(candidates: Array<{ path: string; content: string }>) {
  return (
    candidates.find((candidate) => path.basename(candidate.path).toLowerCase() === "main.tex") ??
    candidates.find((candidate) => !candidate.path.includes("/")) ??
    candidates.find((candidate) => candidate.content.includes("\\documentclass"))
  );
}

export function classifyProjectFileKind(filePath: string): ProjectFileKind {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".tex")) return "tex";
  if (lower.endsWith(".sty")) return "style";
  if (lower.endsWith(".cls")) return "class";
  if (lower.endsWith(".bib") || lower.endsWith(".bst")) return "bibliography";
  if (lower.endsWith(".aux") || lower.endsWith(".log") || lower.endsWith(".out") || lower.endsWith(".toc"))
    return "aux";
  if (lower.endsWith(".pdf")) return "asset";
  return "asset";
}

function mimeTypeForPath(filePath: string) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return undefined;
}

function pathFromManifestPath(filePath: string) {
  return filePath.split("/").join(path.sep);
}

async function writeBytesIfChanged(filePath: string, content: Buffer) {
  try {
    const existing = await fs.readFile(filePath);
    if (existing.equals(content)) {
      return;
    }
  } catch {
    // File does not exist yet.
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

async function writeTextIfChanged(filePath: string, content: string) {
  await writeBytesIfChanged(filePath, Buffer.from(content, "utf8"));
}

function createHash(content: Buffer) {
  return crypto.createHash("sha1").update(content).digest("hex");
}
