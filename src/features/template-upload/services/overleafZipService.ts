import JSZip from "jszip";
import type { LatexProjectAsset, LatexProjectFile, LatexProjectFileKind, UploadedLatexProject } from "@/types/latex";

interface ExtractedLatexProject {
  fileName: string;
  content: string;
  project: UploadedLatexProject;
}

const textExtensions = new Set(["tex", "bib", "cls", "sty", "bst", "txt", "md"]);
const ignoredAuxiliaryExtensions = new Set(["aux", "log", "out", "toc", "synctex.gz", "fls", "fdb_latexmk"]);
const imageMimeTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  webp: "image/webp",
};

export async function readLatexUpload(file: File): Promise<ExtractedLatexProject> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".tex")) {
    const content = await file.text();
    return {
      fileName: file.name,
      content,
      project: {
        sourceType: "tex-file",
        mainTexPath: file.name,
        files: [
          {
            path: file.name,
            name: file.name,
            extension: "tex",
            kind: "tex",
            size: file.size,
            content,
          },
        ],
        assets: [],
      },
    };
  }

  if (lowerName.endsWith(".zip")) {
    return extractOverleafZip(file);
  }

  throw new Error("Envie um arquivo .tex ou um .zip exportado pelo Overleaf.");
}

async function extractOverleafZip(file: File): Promise<ExtractedLatexProject> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).filter((entry) => !entry.dir && !isMacOsMetadata(entry.name));
  const files: LatexProjectFile[] = [];
  const assets: LatexProjectAsset[] = [];

  for (const entry of entries) {
    const extension = getExtension(entry.name);
    const kind = classifyFile(extension);
    const baseFile = {
      path: entry.name,
      name: getBaseName(entry.name),
      extension,
      kind,
      size: getUncompressedSize(entry),
    };

    if (kind === "image") {
      const blob = await entry.async("blob");
      const binaryBase64 = await entry.async("base64");
      const mimeType = imageMimeTypes[extension] ?? "application/octet-stream";
      const asset: LatexProjectAsset = {
        ...baseFile,
        mimeType,
        objectUrl: URL.createObjectURL(new Blob([blob], { type: mimeType })),
      };
      assets.push(asset);
      files.push({ ...baseFile, binaryBase64, mimeType, objectUrl: asset.objectUrl });
      continue;
    }

    if (kind === "pdf") {
      const blob = await entry.async("blob");
      files.push({
        ...baseFile,
        mimeType: "application/pdf",
        objectUrl: URL.createObjectURL(new Blob([blob], { type: "application/pdf" })),
      });
      continue;
    }

    if (textExtensions.has(extension)) {
      files.push({ ...baseFile, content: await entry.async("text") });
      continue;
    }

    files.push(baseFile);
  }

  const texFiles = files.filter((projectFile) => projectFile.kind === "tex" && projectFile.content);
  const mainTex = selectMainTexFile(texFiles);
  if (!mainTex?.content) {
    throw new Error("O ZIP nÃ£o contÃ©m um arquivo .tex principal reconhecÃ­vel.");
  }

  return {
    fileName: mainTex.path,
    content: mainTex.content,
    project: {
      sourceType: "overleaf-zip",
      archiveName: file.name,
      rootPath: inferRootPath(entries.map((entry) => entry.name)),
      mainTexPath: mainTex.path,
      files,
      assets,
    },
  };
}

function selectMainTexFile(files: LatexProjectFile[]) {
  const byName = files.find((file) => file.name.toLowerCase() === "main.tex");
  if (byName) {
    return byName;
  }

  return files.find((file) => {
    const content = file.content ?? "";
    return /\\documentclass/.test(content) || /\\begin\s*\{\s*document\s*\}/.test(content);
  });
}

function classifyFile(extension: string): LatexProjectFileKind {
  if (extension === "tex") {
    return "tex";
  }
  if (extension === "bib") {
    return "bib";
  }
  if (extension === "cls") {
    return "class";
  }
  if (extension === "sty") {
    return "style";
  }
  if (extension === "pdf") {
    return "pdf";
  }
  if (Object.prototype.hasOwnProperty.call(imageMimeTypes, extension)) {
    return "image";
  }
  if (ignoredAuxiliaryExtensions.has(extension)) {
    return "auxiliary";
  }
  return "other";
}

function getExtension(path: string) {
  const lowerPath = path.toLowerCase();
  if (lowerPath.endsWith(".synctex.gz")) {
    return "synctex.gz";
  }

  const match = lowerPath.match(/\.([^.\\/]+)$/);
  return match?.[1] ?? "";
}

function getBaseName(path: string) {
  return path.split("/").at(-1) ?? path;
}

function inferRootPath(paths: string[]) {
  const firstSegments = paths.map((path) => path.split("/")[0]).filter(Boolean);
  const [first] = firstSegments;
  if (!first) {
    return undefined;
  }

  return firstSegments.every((segment) => segment === first) ? first : undefined;
}

function isMacOsMetadata(path: string) {
  return path.startsWith("__MACOSX/") || path.includes("/.DS_Store");
}

function getUncompressedSize(entry: JSZip.JSZipObject) {
  const metadata = entry as JSZip.JSZipObject & {
    _data?: {
      uncompressedSize?: number;
    };
  };

  return Number(metadata._data?.uncompressedSize ?? 0);
}
