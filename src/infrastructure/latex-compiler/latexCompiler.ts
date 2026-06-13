import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import type { CompileSession, PreviewCompileRequest, PreviewCompileResult, PreviewProjectFilePayload } from "./types";
import type { ProjectManifest } from "./projectManifest";
import { resolveLatexProgram } from "./toolchainResolver";
import {
  createPreviewPdfUrl,
  findCompiledPdf,
  getPreviewCacheDir,
  isPathInside,
  normalizeProjectRelativePath,
  sanitizeCacheKey,
} from "./pdfCache";

const knownFileHashes = new Map<string, string>();
const MAX_PROCESS_OUTPUT_BYTES = 128 * 1024;

interface CachedCompileResult {
  sourceHash: string;
  pdfPath: string;
  previewDir: string;
}

const compiledPreviewCache = new Map<string, CachedCompileResult>();

export async function isRenderablePdfFile(filePath: string) {
  try {
    const handle = await fs.open(filePath, "r");
    try {
      const buffer = Buffer.alloc(5);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      return bytesRead >= 5 && buffer.toString("latin1", 0, 5) === "%PDF-";
    } finally {
      await handle.close();
    }
  } catch {
    return false;
  }
}

export function injectProjectGraphicPaths(tex: string, manifest: ProjectManifest, mainTexPath: string) {
  const directories = new Set<string>();
  const mainDirectory = normalizeProjectRelativePath(path.dirname(mainTexPath));
  if (mainDirectory && mainDirectory !== ".") {
    directories.add(toLatexDirectory(mainDirectory));
  }

  for (const file of manifest.files) {
    if (!isGraphicAsset(file.path)) continue;
    const directory = normalizeProjectRelativePath(path.dirname(file.path));
    if (directory && directory !== ".") {
      directories.add(toLatexDirectory(directory));
    }
  }

  if (!directories.size || tex.includes("\\graphicspath")) {
    return tex;
  }

  const graphicspath = `\\graphicspath{${Array.from(directories)
    .map((directory) => `{${directory}}`)
    .join("")}}`;
  if (tex.includes("\\usepackage{graphicx}")) {
    return tex.replace("\\usepackage{graphicx}", `\\usepackage{graphicx}\n${graphicspath}`);
  }

  return tex.replace("\\begin{document}", `${graphicspath}\n\\begin{document}`);
}

export async function compileLatexPreview(
  payload: PreviewCompileRequest,
  session?: CompileSession,
): Promise<PreviewCompileResult> {
  const totalStartedAt = performance.now();
  const compileMode = payload.compileMode ?? "preview";
  const tex = compileMode === "preview" ? createFastPreviewTex(payload.tex) : payload.tex;
  const projectKey = sanitizeCacheKey(payload.projectKey ?? "standalone");
  const previewDir = getPreviewCacheDir(projectKey, compileMode);
  const mainRelativePath = normalizeProjectRelativePath(payload.mainTexPath ?? "main.tex") || "main.tex";
  const compileRelativePath = compileMode === "preview" ? createPreviewTexPath(mainRelativePath) : mainRelativePath;
  const texPath = path.join(previewDir, compileRelativePath);
  const sourceHash = createHash(Buffer.from(tex, "utf8"));
  const compileCacheKey = createCompileCacheKey(projectKey, compileMode);
  const cachedCompile = compiledPreviewCache.get(compileCacheKey);

  if (compileMode === "preview" && cachedCompile?.sourceHash === sourceHash) {
    if (await isExistingFile(cachedCompile.pdfPath)) {
      const totalMs = performance.now() - totalStartedAt;
      const diagnostics = [
        `Cache de compilacao: ${cachedCompile.previewDir}`,
        "PDF reutilizado do cache em memoria; TEX efetivo nao mudou.",
        `Tempo total backend preview: ${totalMs.toFixed(1)}ms.`,
      ];
      console.info(
        `[EditorTex perf] cache hit memoria PDF: ${totalMs.toFixed(1)}ms | revisao=${payload.revision ?? "-"} | modo=${compileMode}`,
      );
      return {
        pdfPath: cachedCompile.pdfPath,
        pdfUrl: createPreviewPdfUrl(
          projectKey,
          compileMode,
          cachedCompile.pdfPath,
          cachedCompile.previewDir,
          payload.revision,
        ),
        revision: payload.revision,
        diagnostics,
      };
    }

    compiledPreviewCache.delete(compileCacheKey);
  }

  const writeStartedAt = performance.now();
  await fs.mkdir(path.dirname(texPath), { recursive: true });
  const texChanged = await writeTextIfChanged(texPath, tex);

  const projectWriteResult = await writeProjectFiles(previewDir, payload.projectFiles ?? [], mainRelativePath);
  const diagnostics = projectWriteResult.diagnostics;
  if (compileMode !== "preview") {
    await removeGeneratedLatexArtifacts(compileDirFromTexPath(texPath), path.basename(texPath, path.extname(texPath)));
  }
  const writeMs = performance.now() - writeStartedAt;
  const compileDir = path.dirname(texPath);
  const compileTexPath = path.basename(texPath);
  const sourceChanged = texChanged || projectWriteResult.changed;

  diagnostics.push(`Cache de compilacao: ${previewDir}`);
  if (compileMode === "preview") {
    diagnostics.push(
      requiresOverleafLikeCompile(tex)
        ? "Preview fiel otimizado: latexmk com XeLaTeX e cache de auxiliares persistente."
        : "Preview rapido otimizado: compilador direto, cache de auxiliares persistente e flag \\fastpreviewtrue.",
    );
  }
  diagnostics.push(`Tempo escrita temporarios: ${writeMs.toFixed(1)}ms.`);
  console.info(
    `[EditorTex perf] escrever temporarios: ${writeMs.toFixed(1)}ms | revisao=${payload.revision ?? "-"} | modo=${compileMode}`,
  );

  if (compileMode === "preview" && !sourceChanged) {
    const cachedPdfPath = await findLatexOutputPdf(previewDir, texPath, 0);
    if (cachedPdfPath) {
      const totalMs = performance.now() - totalStartedAt;
      diagnostics.push("PDF reutilizado do cache; TEX e assets nao mudaram.");
      diagnostics.push(`Tempo total backend preview: ${totalMs.toFixed(1)}ms.`);
      console.info(
        `[EditorTex perf] cache hit PDF: ${totalMs.toFixed(1)}ms | revisao=${payload.revision ?? "-"} | modo=${compileMode}`,
      );
      compiledPreviewCache.set(compileCacheKey, {
        sourceHash,
        pdfPath: cachedPdfPath,
        previewDir,
      });
      return {
        pdfPath: cachedPdfPath,
        pdfUrl: createPreviewPdfUrl(projectKey, compileMode, cachedPdfPath, previewDir, payload.revision),
        revision: payload.revision,
        diagnostics,
      };
    }
  }

  const compileStartedAt = performance.now();
  const compileStartedWallTime = Date.now();
  for (const attempt of createLatexAttempts(tex, compileTexPath, compileDir, compileMode)) {
    const result = await attempt(session);
    diagnostics.push(...result.diagnostics);

    const pdfPath = result.success
      ? await findLatexOutputPdf(previewDir, texPath, sourceChanged ? compileStartedWallTime : 0)
      : undefined;
    if (pdfPath) {
      const compileMs = performance.now() - compileStartedAt;
      const totalMs = performance.now() - totalStartedAt;
      diagnostics.push(`Tempo compilacao LaTeX: ${compileMs.toFixed(1)}ms.`);
      diagnostics.push(`Tempo total backend preview: ${totalMs.toFixed(1)}ms.`);
      console.info(
        `[EditorTex perf] compilacao LaTeX: ${compileMs.toFixed(1)}ms | total=${totalMs.toFixed(1)}ms | revisao=${payload.revision ?? "-"} | modo=${compileMode}`,
      );
      if (compileMode === "preview") {
        compiledPreviewCache.set(compileCacheKey, {
          sourceHash,
          pdfPath,
          previewDir,
        });
      }
      return {
        pdfPath,
        pdfUrl: createPreviewPdfUrl(projectKey, compileMode, pdfPath, previewDir, payload.revision),
        revision: payload.revision,
        diagnostics,
      };
    }
  }

  return {
    diagnostics: [
      ...diagnostics,
      "Nenhum compilador local conseguiu gerar PDF pelo servidor Vite. Configure EDITORTEX_LATEX_BIN/EDITORTEX_LATEX_HOME, inclua um runtime em latex-runtime/bin ou instale latexmk/pdflatex no PATH.",
    ],
  };
}

async function writeProjectFiles(root: string, files: PreviewProjectFilePayload[], mainRelativePath: string) {
  const diagnostics: string[] = [];
  let changed = false;

  for (const file of files) {
    if (file.kind === "pdf" || file.kind === "auxiliary") {
      continue;
    }

    const relativePath = normalizeProjectRelativePath(file.path);
    if (!relativePath || relativePath === mainRelativePath) {
      continue;
    }

    const targetPath = path.join(root, relativePath);
    if (!isPathInside(root, targetPath)) {
      diagnostics.push(`Arquivo ignorado por caminho invalido: ${file.path}`);
      continue;
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    if (file.content !== undefined) {
      changed = (await writeTextIfChanged(targetPath, file.content)) || changed;
    } else if (file.binaryBase64) {
      changed = (await writeBufferIfChanged(targetPath, Buffer.from(file.binaryBase64, "base64"))) || changed;
    }
  }

  return { diagnostics, changed };
}

async function removeGeneratedLatexArtifacts(directory: string, stem: string) {
  const generatedExtensions = [
    ".aux",
    ".bbl",
    ".blg",
    ".fls",
    ".fdb_latexmk",
    ".log",
    ".lof",
    ".lot",
    ".nav",
    ".out",
    ".pdf",
    ".snm",
    ".synctex.gz",
    ".toc",
  ];

  await Promise.all(
    generatedExtensions.map(async (extension) => {
      const targetPath = path.join(directory, `${stem}${extension}`);
      if (!isPathInside(directory, targetPath)) {
        return;
      }

      try {
        await fs.unlink(targetPath);
      } catch {
        // The artifact may not exist on the first compile.
      }
    }),
  );
}

function compileDirFromTexPath(texPath: string) {
  return path.dirname(texPath);
}

function createLatexAttempts(
  tex: string,
  compileTexPath: string,
  compileDir: string,
  compileMode: PreviewCompileRequest["compileMode"],
) {
  if (requiresUnicodeEngine(tex)) {
    if (compileMode === "preview") {
      if (requiresOverleafLikeCompile(tex)) {
        return [
          (session?: CompileSession) =>
            runLatexCommand("latexmk", createLatexmkArgs("xelatex", compileTexPath), compileDir, session),
          (session?: CompileSession) =>
            runLatexCommandPasses(
              "xelatex",
              ["-interaction=nonstopmode", "-halt-on-error", compileTexPath],
              compileDir,
              session,
              2,
            ),
          (session?: CompileSession) =>
            runLatexCommandPasses(
              "lualatex",
              ["-interaction=nonstopmode", "-halt-on-error", compileTexPath],
              compileDir,
              session,
              2,
            ),
        ];
      }

      return [
        (session?: CompileSession) =>
          runLatexCommandPasses(
            "xelatex",
            ["-interaction=nonstopmode", "-halt-on-error", compileTexPath],
            compileDir,
            session,
            2,
          ),
        (session?: CompileSession) =>
          runLatexCommandPasses(
            "lualatex",
            ["-interaction=nonstopmode", "-halt-on-error", compileTexPath],
            compileDir,
            session,
            2,
          ),
      ];
    }

    return [
      (session?: CompileSession) =>
        runLatexCommand("latexmk", createLatexmkArgs("xelatex", compileTexPath), compileDir, session),
      (session?: CompileSession) =>
        runLatexCommand("xelatex", ["-interaction=nonstopmode", "-halt-on-error", compileTexPath], compileDir, session),
      (session?: CompileSession) =>
        runLatexCommand("latexmk", createLatexmkArgs("lualatex", compileTexPath), compileDir, session),
      (session?: CompileSession) =>
        runLatexCommand(
          "lualatex",
          ["-interaction=nonstopmode", "-halt-on-error", compileTexPath],
          compileDir,
          session,
        ),
    ];
  }

  if (compileMode === "preview") {
    return [
      (session?: CompileSession) =>
        runLatexCommandPasses(
          "pdflatex",
          ["-interaction=nonstopmode", "-halt-on-error", compileTexPath],
          compileDir,
          session,
          2,
        ),
    ];
  }

  return [
    (session?: CompileSession) =>
      runLatexCommand("latexmk", createLatexmkArgs("pdflatex", compileTexPath), compileDir, session),
    (session?: CompileSession) =>
      runLatexCommand("pdflatex", ["-interaction=nonstopmode", "-halt-on-error", compileTexPath], compileDir, session),
  ];
}

function createLatexmkArgs(compiler: "xelatex" | "lualatex" | "pdflatex", compileTexPath: string) {
  const compilerFlag = compiler === "pdflatex" ? "-pdf" : `-${compiler}`;

  return [
    "-cd",
    "-jobname=output",
    "-auxdir=.",
    "-outdir=.",
    "-synctex=0",
    "-interaction=batchmode",
    "-halt-on-error",
    "-time",
    compilerFlag,
    compileTexPath,
  ];
}

function requiresUnicodeEngine(tex: string) {
  return /\\usepackage(?:\[[^\]]*])?\{fontspec\}|\\setmainfont|\\setsansfont|\\setmonofont/.test(tex);
}

function requiresOverleafLikeCompile(tex: string) {
  return (
    requiresUnicodeEngine(tex) &&
    /\\(?:AddToHook|AddToShipoutPicture(?:BG)?\*?)|\\begin\{tikzpicture\}\[remember picture,overlay]|\\tableofcontents|\\usepackage(?:\[[^\]]*])?\{longtable\}/.test(
      tex,
    )
  );
}

function createFastPreviewTex(tex: string) {
  if (tex.includes("\\fastpreviewtrue")) {
    return tex;
  }

  const flag = ["\\newif\\iffastpreview", "\\fastpreviewtrue"].join("\n");

  return tex.replace(/(\\documentclass(?:\[[^\]]*])?\{[^}]+\})/, `$1\n${flag}`);
}

function createPreviewTexPath(mainRelativePath: string) {
  const parsed = path.parse(mainRelativePath);
  return path.join(parsed.dir, `${parsed.name}.preview${parsed.ext || ".tex"}`);
}

async function writeTextIfChanged(filePath: string, content: string) {
  const nextHash = createHash(Buffer.from(content, "utf8"));
  if (knownFileHashes.get(filePath) === nextHash || (await readExistingHash(filePath)) === nextHash) {
    knownFileHashes.set(filePath, nextHash);
    return false;
  }

  await fs.writeFile(filePath, content, "utf8");
  knownFileHashes.set(filePath, nextHash);
  return true;
}

async function writeBufferIfChanged(filePath: string, content: Buffer) {
  const nextHash = createHash(content);
  if (knownFileHashes.get(filePath) === nextHash || (await readExistingHash(filePath)) === nextHash) {
    knownFileHashes.set(filePath, nextHash);
    return false;
  }

  await fs.writeFile(filePath, content);
  knownFileHashes.set(filePath, nextHash);
  return true;
}

async function readExistingHash(filePath: string) {
  try {
    return createHash(await fs.readFile(filePath));
  } catch {
    return undefined;
  }
}

function createHash(content: Buffer) {
  return crypto.createHash("sha1").update(content).digest("hex");
}

function createCompileCacheKey(projectKey: string, compileMode: string) {
  return `${projectKey}:${compileMode}`;
}

function isGraphicAsset(filePath: string) {
  return [".png", ".jpg", ".jpeg", ".webp", ".pdf"].includes(path.extname(filePath).toLowerCase());
}

function toLatexDirectory(directory: string) {
  return `${directory.replace(/\\/g, "/").replace(/\/?$/, "/")}`;
}

async function findLatexOutputPdf(root: string, texPath: string, newerThanMs = 0) {
  const outputPdfPath = path.join(path.dirname(texPath), "output.pdf");
  if (await isFreshFile(outputPdfPath, newerThanMs)) {
    return outputPdfPath;
  }

  return findCompiledPdf(root, texPath, newerThanMs);
}

async function isFreshFile(filePath: string, newerThanMs = 0) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.mtimeMs >= newerThanMs - 100;
  } catch {
    return false;
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

async function runLatexCommandPasses(
  program: string,
  args: string[],
  cwd: string,
  session: CompileSession | undefined,
  passes: number,
) {
  const diagnostics: string[] = [];

  for (let pass = 1; pass <= passes; pass += 1) {
    const result = await runLatexCommand(program, args, cwd, session);
    diagnostics.push(`Passada ${pass}/${passes}:`, ...result.diagnostics);
    if (!result.success) {
      return {
        success: false,
        diagnostics,
      };
    }
  }

  return {
    success: true,
    diagnostics,
  };
}

async function runLatexCommand(program: string, args: string[], cwd: string, session?: CompileSession) {
  const startedAt = performance.now();
  const resolvedProgram = await resolveLatexProgram(program);

  return new Promise<{ success: boolean; diagnostics: string[] }>((resolve) => {
    const child = spawn(resolvedProgram.command, args, {
      cwd,
      env: resolvedProgram.env,
      windowsHide: true,
    });
    if (session) {
      session.currentProcess = child;
    }
    const stdout = createLimitedOutputBuffer();
    const stderr = createLimitedOutputBuffer();

    child.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      if (session?.currentProcess === child) {
        session.currentProcess = undefined;
      }
      resolve({
        success: false,
        diagnostics: [...resolvedProgram.diagnostics, `${program} indisponivel: ${error.message}`],
      });
    });
    child.on("close", (code, signal) => {
      if (session?.currentProcess === child) {
        session.currentProcess = undefined;
      }
      const elapsed = performance.now() - startedAt;
      const stdoutText = stdout.toString().trim();
      const stderrText = stderr.toString().trim();
      const status =
        code === 0
          ? `${program} executado com sucesso em ${elapsed.toFixed(1)}ms.`
          : `${program} retornou codigo ${code ?? "sem codigo"}${signal ? ` (${signal})` : ""} em ${elapsed.toFixed(1)}ms.`;
      resolve({
        success: code === 0,
        diagnostics: [...resolvedProgram.diagnostics, status, stderrText, stdoutText].filter(Boolean),
      });
    });
  });
}

function createLimitedOutputBuffer() {
  const chunks: Buffer[] = [];
  let size = 0;
  let truncated = false;

  return {
    push(chunk: Buffer) {
      if (size >= MAX_PROCESS_OUTPUT_BYTES) {
        truncated = true;
        return;
      }

      const remaining = MAX_PROCESS_OUTPUT_BYTES - size;
      const nextChunk = chunk.byteLength > remaining ? chunk.subarray(0, remaining) : chunk;
      chunks.push(nextChunk);
      size += nextChunk.byteLength;
      truncated = truncated || nextChunk.byteLength < chunk.byteLength;
    },
    toString() {
      const value = Buffer.concat(chunks).toString("utf8");
      return truncated ? `${value}\n...saida truncada para preservar performance...` : value;
    },
  };
}

export function cancelCurrentCompile(session: CompileSession, reason: string) {
  const child = session.currentProcess;
  if (!child?.pid || child.killed) {
    return;
  }

  console.info(`[EditorTex perf] cancelando compilacao LaTeX antiga: pid=${child.pid} | motivo=${reason}`);
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true });
    return;
  }

  child.kill("SIGKILL");
}
