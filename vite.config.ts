import path from "node:path";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import crypto from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import type { IncomingMessage } from "node:http";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), latexPreviewDevServer()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
});

interface PreviewProjectFilePayload {
  path: string;
  kind: string;
  content?: string;
  binaryBase64?: string;
}

interface PreviewCompileRequest {
  tex: string;
  mainTexPath?: string;
  projectKey?: string;
  compileMode?: "preview" | "final";
  revision?: number;
  projectFiles?: PreviewProjectFilePayload[];
}

interface CompileSession {
  isCompiling: boolean;
  currentProcess?: ChildProcess;
  pending?: QueuedCompile;
}

interface QueuedCompile {
  payload: PreviewCompileRequest;
  resolve: (result: PreviewCompileResult) => void;
  reject: (error: unknown) => void;
}

interface PreviewCompileResult {
  pdfPath?: string;
  pdfUrl?: string;
  revision?: number;
  diagnostics: string[];
}

const compileSessions = new Map<string, CompileSession>();

function latexPreviewDevServer(): Plugin {
  return {
    name: "latex-preview-dev-server",
    configureServer(server) {
      server.middlewares.use("/api/compile-preview", async (request, response, next) => {
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.end("Method not allowed");
          return;
        }

        try {
          const payload = JSON.parse(await readRequestBody(request)) as PreviewCompileRequest;
          const result = await enqueueLatexPreviewCompile(payload);
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify(result));
        } catch (error) {
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json");
          response.end(
            JSON.stringify({
              diagnostics: [error instanceof Error ? error.message : "Falha ao compilar preview no Vite."],
            }),
          );
        }
      });
      server.middlewares.use("/api/preview-pdf", async (request, response) => {
        const startedAt = performance.now();
        const requestUrl = new URL(request.url ?? "", "http://localhost");
        const projectKey = sanitizeCacheKey(requestUrl.searchParams.get("projectKey") ?? "standalone");
        const mode = sanitizeCacheKey(requestUrl.searchParams.get("mode") ?? "preview");
        const previewDir = getPreviewCacheDir(projectKey, mode);
        const pdfPath = await findRequestedPdf(previewDir, requestUrl.searchParams.get("pdf")) ?? await findFirstPdf(previewDir);

        if (!pdfPath) {
          response.statusCode = 404;
          response.end("PDF not found");
          return;
        }

        response.setHeader("Content-Type", "application/pdf");
        response.setHeader("Cache-Control", "no-store");
        createReadStream(pdfPath)
          .on("open", () => {
            console.info(
              `[EditorTex perf] servir PDF por URL: ${(performance.now() - startedAt).toFixed(1)}ms | path=${pdfPath}`,
            );
          })
          .on("error", (error) => {
            response.statusCode = 500;
            response.end(error.message);
          })
          .pipe(response);
      });
    },
  };
}

function readRequestBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

async function compileLatexPreview(payload: PreviewCompileRequest) {
  const totalStartedAt = performance.now();
  const compileMode = payload.compileMode ?? "preview";
  const tex = compileMode === "preview" ? createFastPreviewTex(payload.tex) : payload.tex;
  const projectKey = sanitizeCacheKey(payload.projectKey ?? "standalone");
  const previewDir = getPreviewCacheDir(projectKey, compileMode);
  const mainRelativePath = normalizeProjectRelativePath(payload.mainTexPath ?? "main.tex") || "main.tex";
  const compileRelativePath =
    compileMode === "preview" ? createPreviewTexPath(mainRelativePath, payload.revision) : mainRelativePath;
  const texPath = path.join(previewDir, compileRelativePath);

  const writeStartedAt = performance.now();
  await fs.mkdir(path.dirname(texPath), { recursive: true });
  await writeTextIfChanged(texPath, tex);

  const diagnostics = await writeProjectFiles(previewDir, payload.projectFiles ?? [], mainRelativePath);
  await removeGeneratedLatexArtifacts(compileDirFromTexPath(texPath), path.basename(texPath, path.extname(texPath)));
  const writeMs = performance.now() - writeStartedAt;
  const compileDir = path.dirname(texPath);
  const compileTexPath = path.basename(texPath);

  diagnostics.push(`Cache de compilacao: ${previewDir}`);
  if (compileMode === "preview") {
    diagnostics.push("Preview rapido: compilador direto, duas passadas para atualizar sumario, com flag \\fastpreviewtrue.");
  }
  diagnostics.push(`Tempo escrita temporarios: ${writeMs.toFixed(1)}ms.`);
  console.info(
    `[EditorTex perf] escrever temporarios: ${writeMs.toFixed(1)}ms | revisao=${payload.revision ?? "-"} | modo=${compileMode}`,
  );

  const compileStartedAt = performance.now();
  const compileStartedWallTime = Date.now();
  for (const attempt of createLatexAttempts(tex, compileTexPath, compileDir, compileMode)) {
    const session = compileSessions.get(projectKey);
    const result = await attempt(session);
    diagnostics.push(...result.diagnostics);

    const pdfPath = result.success ? await findCompiledPdf(previewDir, texPath, compileStartedWallTime) : undefined;
    if (pdfPath) {
      const compileMs = performance.now() - compileStartedAt;
      const totalMs = performance.now() - totalStartedAt;
      diagnostics.push(`Tempo compilacao LaTeX: ${compileMs.toFixed(1)}ms.`);
      diagnostics.push(`Tempo total backend preview: ${totalMs.toFixed(1)}ms.`);
      console.info(
        `[EditorTex perf] compilacao LaTeX: ${compileMs.toFixed(1)}ms | total=${totalMs.toFixed(1)}ms | revisao=${payload.revision ?? "-"} | modo=${compileMode}`,
      );
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
      "Nenhum compilador local conseguiu gerar PDF pelo servidor Vite. Verifique latexmk/pdflatex no PATH.",
    ],
  };
}

function enqueueLatexPreviewCompile(payload: PreviewCompileRequest): Promise<PreviewCompileResult> {
  const projectKey = sanitizeCacheKey(payload.projectKey ?? "standalone");
  const session = compileSessions.get(projectKey) ?? { isCompiling: false };
  compileSessions.set(projectKey, session);

  if (!session.isCompiling) {
    session.isCompiling = true;
    return runCompileSession(session, payload);
  }

  cancelCurrentCompile(session, `revisao nova ${payload.revision ?? "-"}`);
  session.pending?.resolve({
    diagnostics: ["Compilacao substituida por uma revisao mais recente."],
  });

  return new Promise((resolve, reject) => {
    session.pending = {
      payload,
      resolve,
      reject,
    };
  });
}

async function runCompileSession(
  session: CompileSession,
  payload: PreviewCompileRequest,
): Promise<PreviewCompileResult> {
  try {
    return await compileLatexPreview(payload);
  } finally {
    session.currentProcess = undefined;
    const pending = session.pending;
    if (pending) {
      session.pending = undefined;
      void runCompileSession(session, pending.payload).then(pending.resolve, pending.reject);
    } else {
      session.isCompiling = false;
    }
  }
}

async function writeProjectFiles(root: string, files: PreviewProjectFilePayload[], mainRelativePath: string) {
  const diagnostics: string[] = [];

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
      await writeTextIfChanged(targetPath, file.content);
    } else if (file.binaryBase64) {
      await writeBufferIfChanged(targetPath, Buffer.from(file.binaryBase64, "base64"));
    }
  }

  return diagnostics;
}

async function removeGeneratedLatexArtifacts(directory: string, stem: string) {
  const generatedExtensions = [".aux", ".bbl", ".blg", ".fls", ".fdb_latexmk", ".log", ".lof", ".lot", ".nav", ".out", ".pdf", ".snm", ".synctex.gz", ".toc"];

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
      return [
        (session?: CompileSession) => runLatexCommandPasses("lualatex", ["-interaction=nonstopmode", "-halt-on-error", compileTexPath], compileDir, session, 2),
        (session?: CompileSession) => runLatexCommandPasses("xelatex", ["-interaction=nonstopmode", "-halt-on-error", compileTexPath], compileDir, session, 2),
      ];
    }

    return [
      (session?: CompileSession) => runLatexCommand("latexmk", ["-lualatex", "-interaction=nonstopmode", "-halt-on-error", compileTexPath], compileDir, session),
      (session?: CompileSession) => runLatexCommand("lualatex", ["-interaction=nonstopmode", "-halt-on-error", compileTexPath], compileDir, session),
      (session?: CompileSession) => runLatexCommand("latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", compileTexPath], compileDir, session),
      (session?: CompileSession) => runLatexCommand("xelatex", ["-interaction=nonstopmode", "-halt-on-error", compileTexPath], compileDir, session),
    ];
  }

  if (compileMode === "preview") {
    return [
      (session?: CompileSession) => runLatexCommandPasses("pdflatex", ["-interaction=nonstopmode", "-halt-on-error", compileTexPath], compileDir, session, 2),
    ];
  }

  return [
    (session?: CompileSession) => runLatexCommand("latexmk", ["-pdf", "-interaction=nonstopmode", "-halt-on-error", compileTexPath], compileDir, session),
    (session?: CompileSession) => runLatexCommand("pdflatex", ["-interaction=nonstopmode", "-halt-on-error", compileTexPath], compileDir, session),
  ];
}

function requiresUnicodeEngine(tex: string) {
  return /\\usepackage(?:\[[^\]]*])?\{fontspec\}|\\setmainfont|\\setsansfont|\\setmonofont/.test(tex);
}

function createFastPreviewTex(tex: string) {
  if (tex.includes("\\fastpreviewtrue")) {
    return tex;
  }

  const flag = [
    "\\newif\\iffastpreview",
    "\\fastpreviewtrue",
  ].join("\n");

  return tex.replace(/(\\documentclass(?:\[[^\]]*])?\{[^}]+\})/, `$1\n${flag}`);
}

function createPreviewTexPath(mainRelativePath: string, revision: unknown) {
  const parsed = path.parse(mainRelativePath);
  return path.join(parsed.dir, `${parsed.name}.preview.${sanitizeCacheKey(String(revision ?? Date.now()))}${parsed.ext || ".tex"}`);
}

async function writeTextIfChanged(filePath: string, content: string) {
  if ((await readExistingHash(filePath)) === createHash(Buffer.from(content, "utf8"))) {
    return;
  }

  await fs.writeFile(filePath, content, "utf8");
}

async function writeBufferIfChanged(filePath: string, content: Buffer) {
  if ((await readExistingHash(filePath)) === createHash(content)) {
    return;
  }

  await fs.writeFile(filePath, content);
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

async function runLatexCommandPasses(program: string, args: string[], cwd: string, session: CompileSession | undefined, passes: number) {
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

  return new Promise<{ success: boolean; diagnostics: string[] }>((resolve) => {
    const child = spawn(program, args, {
      cwd,
      windowsHide: true,
    });
    session && (session.currentProcess = child);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      if (session?.currentProcess === child) {
        session.currentProcess = undefined;
      }
      resolve({
        success: false,
        diagnostics: [`${program} indisponivel: ${error.message}`],
      });
    });
    child.on("close", (code, signal) => {
      if (session?.currentProcess === child) {
        session.currentProcess = undefined;
      }
      const elapsed = performance.now() - startedAt;
      const stdoutText = Buffer.concat(stdout).toString("utf8").trim();
      const stderrText = Buffer.concat(stderr).toString("utf8").trim();
      const status =
        code === 0
          ? `${program} executado com sucesso em ${elapsed.toFixed(1)}ms.`
          : `${program} retornou codigo ${code ?? "sem codigo"}${signal ? ` (${signal})` : ""} em ${elapsed.toFixed(1)}ms.`;
      resolve({
        success: code === 0,
        diagnostics: [status, stderrText, stdoutText].filter(Boolean),
      });
    });
  });
}

function cancelCurrentCompile(session: CompileSession, reason: string) {
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

function getPreviewCacheDir(projectKey: string, mode: string) {
  return path.join(os.tmpdir(), "editortex-preview-cache", `${sanitizeCacheKey(projectKey)}-${sanitizeCacheKey(mode)}`);
}

function createPreviewPdfUrl(
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

async function findRequestedPdf(root: string, requestedPath: string | null): Promise<string | undefined> {
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

async function findCompiledPdf(root: string, texPath: string, newerThanMs = 0): Promise<string | undefined> {
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

async function findFirstPdf(dir: string): Promise<string | undefined> {
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

function normalizeProjectRelativePath(filePath: string) {
  return filePath
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join(path.sep);
}

function isPathInside(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function sanitizeCacheKey(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80) || "standalone";
}
