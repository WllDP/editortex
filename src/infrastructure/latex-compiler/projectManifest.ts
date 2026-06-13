import path from "node:path";
import fs from "node:fs/promises";
import type {
  AssetManifestItem,
  CompileAssetPayload,
  CompileMode,
  CompileRequest,
} from "@/features/preview/types/compileTypes";
import { isPathInside, normalizeProjectRelativePath, sanitizeCacheKey } from "./pdfCache";

export type ProjectFileKind = "tex" | "asset" | "style" | "class" | "bibliography" | "output" | "aux";

export type ProjectFileManifestItem = {
  path: string;
  hash: string;
  size: number;
  kind: ProjectFileKind;
  mimeType?: string;
  lastSyncedAt: number;
};

export type ProjectManifest = {
  projectKey: string;
  revision: number;
  sourceHash?: string;
  files: ProjectFileManifestItem[];
  lastCompiledByMode?: Partial<
    Record<
      CompileMode,
      {
        sourceHash: string;
        pdfPath: string;
        compiledAt: number;
      }
    >
  >;
  lastCompiledRevision?: number;
  lastCompiledSourceHash?: string;
  lastPdfPath?: string;
  updatedAt: number;
};

export type ProjectDirectories = {
  projectDir: string;
  sourceDir: string;
  assetsDir: string;
  compileDir: string;
  outputDir: string;
  manifestPath: string;
};

export type SyncResult = {
  manifest: ProjectManifest;
  written: string[];
  skipped: string[];
  removed: string[];
  syncMs: number;
  manifestSaveMs: number;
  assetSyncMs: number;
  manifestLoaded: boolean;
};

export function getProjectDirectories(cacheRoot: string, projectKey: string): ProjectDirectories {
  const projectDir = path.join(cacheRoot, "projects", sanitizeCacheKey(projectKey));
  return {
    projectDir,
    sourceDir: path.join(projectDir, "source"),
    assetsDir: path.join(projectDir, "assets"),
    compileDir: path.join(projectDir, "compile"),
    outputDir: path.join(projectDir, "output"),
    manifestPath: path.join(projectDir, "manifest.json"),
  };
}

export async function ensureProjectDirectories(dirs: ProjectDirectories) {
  await Promise.all([
    fs.mkdir(dirs.sourceDir, { recursive: true }),
    fs.mkdir(dirs.assetsDir, { recursive: true }),
    fs.mkdir(dirs.compileDir, { recursive: true }),
    fs.mkdir(dirs.outputDir, { recursive: true }),
  ]);
}

export async function loadProjectManifest(dirs: ProjectDirectories, projectKey: string) {
  const startedAt = performance.now();
  try {
    const manifest = JSON.parse(await fs.readFile(dirs.manifestPath, "utf8")) as ProjectManifest;
    return {
      manifest: {
        ...manifest,
        files: Array.isArray(manifest.files) ? manifest.files : [],
        lastCompiledByMode: manifest.lastCompiledByMode ?? {},
      },
      loaded: true,
      loadMs: performance.now() - startedAt,
    };
  } catch {
    return {
      manifest: createEmptyManifest(projectKey),
      loaded: false,
      loadMs: performance.now() - startedAt,
    };
  }
}

export async function saveProjectManifest(dirs: ProjectDirectories, manifest: ProjectManifest) {
  const startedAt = performance.now();
  await fs.mkdir(path.dirname(dirs.manifestPath), { recursive: true });
  await fs.writeFile(dirs.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return performance.now() - startedAt;
}

export async function syncProjectFiles(
  request: CompileRequest,
  dirs: ProjectDirectories,
  manifest: ProjectManifest,
): Promise<SyncResult> {
  const startedAt = performance.now();
  const written: string[] = [];
  const skipped: string[] = [];
  const removed: string[] = [];
  const previousByPath = new Map(manifest.files.map((file) => [file.path, file]));
  const payloadByPath = new Map((request.assets ?? []).map((asset) => [asset.path, asset]));
  const nextFiles: ProjectFileManifestItem[] = [];

  for (const asset of request.assetManifest ?? []) {
    const relativePath = normalizeProjectRelativePath(asset.path);
    const manifestPath = toManifestPath(relativePath);
    if (!relativePath) {
      continue;
    }

    const payload = payloadByPath.get(asset.path) ?? payloadByPath.get(relativePath);
    const previous =
      previousByPath.get(manifestPath) ?? previousByPath.get(relativePath) ?? previousByPath.get(asset.path);
    const canonicalAssetPath = path.join(dirs.assetsDir, relativePath);
    const compileAssetPath = path.join(dirs.compileDir, relativePath);
    const isSynced = previous?.hash === asset.hash && (await isExistingFile(compileAssetPath));

    if (!isPathInside(dirs.assetsDir, canonicalAssetPath) || !isPathInside(dirs.compileDir, compileAssetPath)) {
      continue;
    }

    if (!isSynced) {
      if (!payload) {
        skipped.push(manifestPath);
      } else {
        await writeAssetPayload(canonicalAssetPath, payload);
        await writeAssetPayload(compileAssetPath, payload);
        written.push(manifestPath);
      }
    } else {
      skipped.push(manifestPath);
    }

    nextFiles.push({
      path: manifestPath,
      hash: asset.hash,
      size: asset.size,
      kind: classifyProjectFile(relativePath, asset),
      mimeType: asset.mimeType,
      lastSyncedAt: isSynced ? (previous?.lastSyncedAt ?? Date.now()) : Date.now(),
    });
  }

  const nextPaths = new Set(nextFiles.map((file) => file.path));
  for (const previous of manifest.files) {
    if (previous.kind === "output" || previous.kind === "aux" || previous.kind === "tex") {
      nextFiles.push(previous);
      continue;
    }

    if (nextPaths.has(previous.path)) {
      continue;
    }

    await removeProjectFileIfExists(path.join(dirs.assetsDir, previous.path), dirs.assetsDir);
    await removeProjectFileIfExists(path.join(dirs.compileDir, previous.path), dirs.compileDir);
    removed.push(previous.path);
  }

  const nextManifest: ProjectManifest = {
    ...manifest,
    projectKey: request.projectKey,
    revision: request.revision,
    sourceHash: request.sourceHash,
    files: nextFiles,
    updatedAt: Date.now(),
  };

  const beforeManifestSaveMs = performance.now();
  const manifestSaveMs = await saveProjectManifest(dirs, nextManifest);
  const assetSyncMs = beforeManifestSaveMs - startedAt;

  return {
    manifest: nextManifest,
    written,
    skipped,
    removed,
    syncMs: performance.now() - startedAt,
    manifestSaveMs,
    assetSyncMs,
    manifestLoaded: manifest.updatedAt > 0,
  };
}

function toManifestPath(filePath: string) {
  return filePath.replace(/\\/g, "/");
}

export function updateManifestFile(manifest: ProjectManifest, file: ProjectFileManifestItem) {
  const files = manifest.files.filter((item) => item.path !== file.path);
  return {
    ...manifest,
    files: [...files, file],
    updatedAt: Date.now(),
  };
}

export function createEmptyManifest(projectKey: string): ProjectManifest {
  return {
    projectKey,
    revision: 0,
    files: [],
    lastCompiledByMode: {},
    updatedAt: 0,
  };
}

export function classifyProjectFile(filePath: string, asset?: Pick<AssetManifestItem, "mimeType">): ProjectFileKind {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".sty") return "style";
  if (extension === ".cls") return "class";
  if (extension === ".bib" || extension === ".bst") return "bibliography";
  if (extension === ".tex") return "tex";
  if (extension === ".pdf") return asset?.mimeType === "application/pdf" ? "asset" : "output";
  return "asset";
}

async function writeAssetPayload(filePath: string, payload: CompileAssetPayload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  if (payload.content !== undefined) {
    await fs.writeFile(filePath, payload.content, "utf8");
    return;
  }

  if (payload.binaryBase64) {
    await fs.writeFile(filePath, Buffer.from(payload.binaryBase64, "base64"));
  }
}

async function removeProjectFileIfExists(filePath: string, root: string) {
  if (!isPathInside(root, filePath)) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch {
    // File may already be gone if the cache was cleaned externally.
  }
}

async function isExistingFile(filePath: string) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}
