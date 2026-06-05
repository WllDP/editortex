import path from "node:path";
import fs from "node:fs/promises";

export type LatexToolchainSource = "manual" | "bundled" | "path";

export interface ResolvedLatexProgram {
  command: string;
  env?: NodeJS.ProcessEnv;
  source: LatexToolchainSource;
  diagnostics: string[];
}

const executableSuffix = process.platform === "win32" ? ".exe" : "";

export async function resolveLatexProgram(program: string): Promise<ResolvedLatexProgram> {
  const diagnostics: string[] = [];
  const manualProgram = await resolveManualProgram(program, diagnostics);
  if (manualProgram) {
    return manualProgram;
  }

  const bundledProgram = await resolveBundledProgram(program, diagnostics);
  if (bundledProgram) {
    return bundledProgram;
  }

  diagnostics.push(`Toolchain LaTeX: tentando ${program} pelo PATH.`);
  return {
    command: program,
    source: "path",
    diagnostics,
  };
}

async function resolveManualProgram(program: string, diagnostics: string[]): Promise<ResolvedLatexProgram | undefined> {
  const manualBin = process.env.EDITORTEX_LATEX_BIN;
  const manualHome = process.env.EDITORTEX_LATEX_HOME;
  const candidates = [
    ...(manualBin ? [manualBin] : []),
    ...(manualHome ? [path.join(manualHome, "bin"), path.join(manualHome, "bin", platformBinName()), manualHome] : []),
  ];

  for (const candidate of candidates) {
    const resolved = await resolveProgramCandidate(candidate, program);
    if (!resolved) {
      diagnostics.push(`Toolchain LaTeX manual: ${program} nao encontrado em ${candidate}.`);
      continue;
    }

    diagnostics.push(`Toolchain LaTeX: usando ${program} manual em ${resolved}.`);
    return {
      command: resolved,
      env: prependPath(path.dirname(resolved)),
      source: "manual",
      diagnostics,
    };
  }

  return undefined;
}

async function resolveBundledProgram(
  program: string,
  diagnostics: string[],
): Promise<ResolvedLatexProgram | undefined> {
  for (const directory of getBundledLatexBinDirectories()) {
    const resolved = await resolveProgramCandidate(directory, program);
    if (!resolved) {
      continue;
    }

    diagnostics.push(`Toolchain LaTeX: usando ${program} embutido em ${resolved}.`);
    return {
      command: resolved,
      env: prependPath(path.dirname(resolved)),
      source: "bundled",
      diagnostics,
    };
  }

  diagnostics.push("Toolchain LaTeX embutido: runtime nao encontrado nos caminhos conhecidos.");
  return undefined;
}

function getBundledLatexBinDirectories() {
  const cwd = process.cwd();
  return [
    path.join(cwd, "latex-runtime", "bin"),
    path.join(cwd, "latex-runtime", "bin", platformBinName()),
    path.join(cwd, "src-tauri", "resources", "latex-runtime", "bin"),
    path.join(cwd, "src-tauri", "resources", "latex-runtime", "bin", platformBinName()),
  ];
}

async function resolveProgramCandidate(candidate: string, program: string) {
  const stat = await safeStat(candidate);
  if (!stat) {
    return undefined;
  }

  if (stat.isFile()) {
    return isProgramFile(candidate, program) ? candidate : undefined;
  }

  if (!stat.isDirectory()) {
    return undefined;
  }

  const executablePath = path.join(candidate, `${program}${executableSuffix}`);
  if (await isFile(executablePath)) {
    return executablePath;
  }

  if (executableSuffix) {
    const extensionlessPath = path.join(candidate, program);
    if (await isFile(extensionlessPath)) {
      return extensionlessPath;
    }
  }

  return undefined;
}

function isProgramFile(filePath: string, program: string) {
  const basename = path.basename(filePath).toLowerCase();
  return basename === program.toLowerCase() || basename === `${program.toLowerCase()}${executableSuffix}`;
}

async function isFile(filePath: string) {
  return (await safeStat(filePath))?.isFile() ?? false;
}

async function safeStat(filePath: string) {
  try {
    return await fs.stat(filePath);
  } catch {
    return undefined;
  }
}

function prependPath(directory: string) {
  return {
    ...process.env,
    PATH: [directory, process.env.PATH].filter(Boolean).join(path.delimiter),
  };
}

function platformBinName() {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  return "linux";
}
