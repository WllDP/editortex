import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type { UploadedLatexProject } from "@/types/latex";
import { isTauriRuntime } from "@/infrastructure/tauri/runtime";

export interface PdfCompileResult {
  pdfPath?: string;
  pdfUrl?: string;
  revision?: number;
  diagnostics: string[];
  unavailableInBrowser?: boolean;
}

export type PdfCompileMode = "preview" | "final";

interface TauriPdfCompileResult extends PdfCompileResult {
  pdf_path?: string;
}

const initializedProjectPayloads = new Set<string>();

export interface PreviewProjectFilePayload {
  path: string;
  kind: string;
  content?: string;
  binaryBase64?: string;
}

export async function compileLatexPreview(
  tex: string,
  project?: UploadedLatexProject,
  compileMode: PdfCompileMode = "preview",
  revision = Date.now(),
): Promise<PdfCompileResult> {
  const projectKey = createProjectCacheKey(project);
  const sessionKey = createProjectSessionKey(projectKey, compileMode);
  const projectFiles = createProjectFilePayloadForSession(project, sessionKey);

  if (!isTauriRuntime()) {
    if (!import.meta.env.DEV) {
      initializedProjectPayloads.delete(sessionKey);
      return {
        unavailableInBrowser: true,
        diagnostics: [
          "Compilacao PDF indisponivel no build web estatico.",
          "Use o aplicativo desktop Tauri para compilar PDF em producao.",
          "Para testar no navegador, rode npm run dev e acesse http://localhost:1420/.",
        ],
      };
    }

    return compileLatexPreviewInBrowserDevServer(tex, project, projectKey, projectFiles, compileMode, revision);
  }

  try {
    const startedAt = performance.now();
    const result = await invoke<TauriPdfCompileResult>("compile_pdf_preview", {
      tex,
      mainTexPath: project?.mainTexPath,
      projectKey,
      compileMode,
      revision,
      projectFiles,
    });
    const pdfPath = result.pdfPath ?? result.pdf_path;
    if (pdfPath || result.pdfUrl) {
      markProjectPayloadInitialized(sessionKey);
    } else {
      initializedProjectPayloads.delete(sessionKey);
    }
    console.info(
      `[EditorTex perf] backend Tauri retornou PDF: ${(performance.now() - startedAt).toFixed(1)}ms | revisao=${revision} | modo=${compileMode}`,
    );

    return {
      pdfPath,
      pdfUrl: result.pdfUrl
        ? withCacheBuster(result.pdfUrl)
        : pdfPath
          ? withCacheBuster(convertFileSrc(pdfPath))
          : undefined,
      revision,
      diagnostics: result.diagnostics ?? [],
    };
  } catch (error) {
    initializedProjectPayloads.delete(sessionKey);
    return {
      diagnostics: [
        error instanceof Error ? error.message : "Compilacao PDF ainda esta preparada como stub no backend Tauri.",
      ],
    };
  }
}

async function compileLatexPreviewInBrowserDevServer(
  tex: string,
  project?: UploadedLatexProject,
  projectKey = createProjectCacheKey(project),
  projectFiles = createProjectFilePayloadForSession(project, projectKey),
  compileMode: PdfCompileMode = "preview",
  revision = Date.now(),
): Promise<PdfCompileResult> {
  try {
    const startedAt = performance.now();
    const response = await fetch("/api/compile-preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tex,
        mainTexPath: project?.mainTexPath,
        projectKey,
        compileMode,
        projectFiles,
        revision,
      }),
    });
    if (!response.ok) {
      throw new Error(`Servidor local do Vite retornou HTTP ${response.status}.`);
    }

    const jsonStartedAt = performance.now();
    const result = (await response.json()) as TauriPdfCompileResult;
    const sessionKey = createProjectSessionKey(projectKey, compileMode);
    const pdfPath = result.pdfPath ?? result.pdf_path;
    const pdfUrl =
      result.pdfUrl ??
      (pdfPath
        ? `/api/preview-pdf?projectKey=${encodeURIComponent(projectKey)}&mode=${encodeURIComponent(compileMode)}&revision=${encodeURIComponent(String(revision))}`
        : undefined);
    if (pdfPath || pdfUrl) {
      markProjectPayloadInitialized(sessionKey);
    } else {
      initializedProjectPayloads.delete(sessionKey);
    }
    console.info(
      `[EditorTex perf] frontend receber URL do PDF: total=${(performance.now() - startedAt).toFixed(1)}ms | json=${(performance.now() - jsonStartedAt).toFixed(1)}ms | revisao=${revision}`,
    );

    return {
      pdfPath,
      pdfUrl,
      revision,
      diagnostics: result.diagnostics ?? [],
    };
  } catch (error) {
    initializedProjectPayloads.delete(createProjectSessionKey(projectKey, compileMode));
    return {
      unavailableInBrowser: true,
      diagnostics: [
        "Servidor local do Vite indisponivel para compilar PDF.",
        error instanceof Error ? error.message : "Falha desconhecida ao chamar /api/compile-preview.",
        "Execute com npm run dev e acesse http://localhost:1420/ para usar a compilacao no navegador.",
      ],
    };
  }
}

function createProjectCacheKey(project: UploadedLatexProject | undefined) {
  if (!project) {
    return "standalone";
  }

  const signature = [
    project.sourceType,
    project.archiveName ?? "",
    project.mainTexPath,
    ...project.files
      .filter((file) => file.path !== project.mainTexPath)
      .map((file) => createProjectFileCacheSignature(file)),
  ].join("|");

  let hash = 0;
  for (let index = 0; index < signature.length; index += 1) {
    hash = (hash * 31 + signature.charCodeAt(index)) >>> 0;
  }

  return `project-${hash.toString(16)}`;
}

function createProjectFileCacheSignature(file: {
  path: string;
  size: number;
  extension: string;
  kind: string;
  content?: string;
  binaryBase64?: string;
}) {
  const contentHash = file.content
    ? createFastStringHash(file.content)
    : file.binaryBase64
      ? createLargeBinarySignature(file.binaryBase64)
      : "no-content";

  return `${file.path}:${file.size}:${file.extension}:${file.kind}:${contentHash}`;
}

function createFastStringHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

function createLargeBinarySignature(value: string) {
  const sampleSize = 4096;
  if (value.length <= sampleSize * 2) {
    return createFastStringHash(value);
  }

  return `${value.length}:${createFastStringHash(value.slice(0, sampleSize))}:${createFastStringHash(value.slice(-sampleSize))}`;
}

function withCacheBuster(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}compiledAt=${Date.now()}`;
}

function createProjectFilePayloadForSession(project: UploadedLatexProject | undefined, projectKey: string) {
  if (initializedProjectPayloads.has(projectKey)) {
    return undefined;
  }

  initializedProjectPayloads.add(projectKey);
  return createProjectFilePayload(project);
}

function markProjectPayloadInitialized(projectKey: string) {
  initializedProjectPayloads.add(projectKey);
}

function createProjectSessionKey(projectKey: string, compileMode: PdfCompileMode) {
  return `${projectKey}:${compileMode}`;
}

function createProjectFilePayload(project: UploadedLatexProject | undefined): PreviewProjectFilePayload[] {
  if (!project) {
    return [];
  }

  const files = project.files
    .filter((file) => file.kind !== "pdf" && file.kind !== "auxiliary")
    .filter((file) => file.path !== project.mainTexPath)
    .filter((file) => file.content || file.binaryBase64)
    .map((file) => ({
      path: file.path,
      kind: file.kind,
      content: file.content,
      binaryBase64: file.binaryBase64,
    }));

  return files;
}

export function getBundledPdfPreviewUrl(projectFiles: Array<{ name: string; kind: string; objectUrl?: string }>) {
  const mainPdf = projectFiles.find((file) => file.kind === "pdf" && file.name.toLowerCase() === "main.pdf");
  if (mainPdf?.objectUrl) {
    return mainPdf.objectUrl;
  }

  return projectFiles.find((file) => file.kind === "pdf" && file.objectUrl)?.objectUrl;
}

export function createStubCompileResult(): PdfCompileResult {
  return {
    diagnostics: [
      "Compilacao real ainda nao retornou um PDF. Integre tectonic ou latexmk no backend para gerar preview atualizado.",
    ],
  };
}

// TODO: persist compiled PDFs in an app cache directory.
// TODO: reuse unchanged assets between preview renders.
