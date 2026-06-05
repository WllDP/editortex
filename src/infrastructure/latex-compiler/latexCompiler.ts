import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import type { CompileSession, PreviewCompileRequest, PreviewCompileResult, PreviewProjectFilePayload } from "./types";
import { resolveLatexProgram } from "./toolchainResolver";
import {
  createPreviewPdfUrl,
  findCompiledPdf,
  getPreviewCacheDir,
  isPathInside,
  normalizeProjectRelativePath,
  sanitizeCacheKey,
} from "./pdfCache";

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
    diagnostics.push(
      "Preview rapido: compilador direto, duas passadas para atualizar sumario, com flag \\fastpreviewtrue.",
    );
  }
  diagnostics.push(`Tempo escrita temporarios: ${writeMs.toFixed(1)}ms.`);
  console.info(
    `[EditorTex perf] escrever temporarios: ${writeMs.toFixed(1)}ms | revisao=${payload.revision ?? "-"} | modo=${compileMode}`,
  );

  const compileStartedAt = performance.now();
  const compileStartedWallTime = Date.now();
  for (const attempt of createLatexAttempts(tex, compileTexPath, compileDir, compileMode)) {
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
      "Nenhum compilador local conseguiu gerar PDF pelo servidor Vite. Configure EDITORTEX_LATEX_BIN/EDITORTEX_LATEX_HOME, inclua um runtime em latex-runtime/bin ou instale latexmk/pdflatex no PATH.",
    ],
  };
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
      return [
        (session?: CompileSession) =>
          runLatexCommandPasses(
            "lualatex",
            ["-interaction=nonstopmode", "-halt-on-error", compileTexPath],
            compileDir,
            session,
            2,
          ),
        (session?: CompileSession) =>
          runLatexCommandPasses(
            "xelatex",
            ["-interaction=nonstopmode", "-halt-on-error", compileTexPath],
            compileDir,
            session,
            2,
          ),
      ];
    }

    return [
      (session?: CompileSession) =>
        runLatexCommand(
          "latexmk",
          ["-lualatex", "-interaction=nonstopmode", "-halt-on-error", compileTexPath],
          compileDir,
          session,
        ),
      (session?: CompileSession) =>
        runLatexCommand(
          "lualatex",
          ["-interaction=nonstopmode", "-halt-on-error", compileTexPath],
          compileDir,
          session,
        ),
      (session?: CompileSession) =>
        runLatexCommand(
          "latexmk",
          ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", compileTexPath],
          compileDir,
          session,
        ),
      (session?: CompileSession) =>
        runLatexCommand("xelatex", ["-interaction=nonstopmode", "-halt-on-error", compileTexPath], compileDir, session),
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
      runLatexCommand(
        "latexmk",
        ["-pdf", "-interaction=nonstopmode", "-halt-on-error", compileTexPath],
        compileDir,
        session,
      ),
    (session?: CompileSession) =>
      runLatexCommand("pdflatex", ["-interaction=nonstopmode", "-halt-on-error", compileTexPath], compileDir, session),
  ];
}

function requiresUnicodeEngine(tex: string) {
  return /\\usepackage(?:\[[^\]]*])?\{fontspec\}|\\setmainfont|\\setsansfont|\\setmonofont/.test(tex);
}

function createFastPreviewTex(tex: string) {
  if (tex.includes("\\fastpreviewtrue")) {
    return tex;
  }

  const flag = ["\\newif\\iffastpreview", "\\fastpreviewtrue"].join("\n");

  return tex.replace(/(\\documentclass(?:\[[^\]]*])?\{[^}]+\})/, `$1\n${flag}`);
}

function createPreviewTexPath(mainRelativePath: string, revision: unknown) {
  const parsed = path.parse(mainRelativePath);
  return path.join(
    parsed.dir,
    `${parsed.name}.preview.${sanitizeCacheKey(String(revision ?? Date.now()))}${parsed.ext || ".tex"}`,
  );
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
        diagnostics: [...resolvedProgram.diagnostics, `${program} indisponivel: ${error.message}`],
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
        diagnostics: [...resolvedProgram.diagnostics, status, stderrText, stdoutText].filter(Boolean),
      });
    });
  });
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
