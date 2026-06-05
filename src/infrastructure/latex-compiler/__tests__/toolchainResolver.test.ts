import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveLatexProgram } from "@/infrastructure/latex-compiler/toolchainResolver";

const originalLatexBin = process.env.EDITORTEX_LATEX_BIN;
const originalLatexHome = process.env.EDITORTEX_LATEX_HOME;

afterEach(() => {
  restoreEnv("EDITORTEX_LATEX_BIN", originalLatexBin);
  restoreEnv("EDITORTEX_LATEX_HOME", originalLatexHome);
});

describe("resolveLatexProgram", () => {
  it("prioriza compilador configurado manualmente", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "editortex-latex-bin-"));
    const executableName = process.platform === "win32" ? "pdflatex.exe" : "pdflatex";
    const executablePath = path.join(directory, executableName);
    await fs.writeFile(executablePath, "");
    process.env.EDITORTEX_LATEX_BIN = directory;
    delete process.env.EDITORTEX_LATEX_HOME;

    const resolved = await resolveLatexProgram("pdflatex");

    expect(resolved.source).toBe("manual");
    expect(resolved.command).toBe(executablePath);
    expect(resolved.diagnostics.join("\n")).toContain("manual");
  });

  it("retorna PATH como fallback quando nao ha runtime configurado", async () => {
    delete process.env.EDITORTEX_LATEX_BIN;
    delete process.env.EDITORTEX_LATEX_HOME;

    const resolved = await resolveLatexProgram("pdflatex");

    expect(resolved.source).toBe("path");
    expect(resolved.command).toBe("pdflatex");
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
