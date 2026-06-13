import type { LatexDiagnostic } from "@/features/preview/types/compileTypes";

export function parseLatexLog(log: string): LatexDiagnostic[] {
  const diagnostics: LatexDiagnostic[] = [];
  const lines = log.split(/\r?\n/);
  let currentFile: string | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    currentFile = findCurrentFile(line) ?? currentFile;

    if (line.startsWith("!")) {
      const nextLine = lines[index + 1] ?? "";
      diagnostics.push({
        file: currentFile,
        line: parseLineNumber(nextLine),
        severity: "error",
        message: line.replace(/^!\s*/, "").trim() || "Erro LaTeX.",
        raw: [line, nextLine].filter(Boolean).join("\n"),
      });
      continue;
    }

    const latexError = line.match(/(?:LaTeX|Package\s+[^ ]+)\s+Error:\s*(.+)/);
    if (latexError?.[1]) {
      diagnostics.push({
        file: currentFile,
        line: parseLineNumber(lines[index + 1] ?? ""),
        severity: "error",
        message: latexError[1].trim(),
        raw: line,
      });
      continue;
    }

    const missingFile = line.match(/(?:File|LaTeX Error: File)\s+[`']?([^`'\s]+)[`']?\s+not found/i);
    if (missingFile?.[1]) {
      diagnostics.push({
        file: currentFile,
        severity: "error",
        message: `Arquivo nao encontrado: ${missingFile[1]}`,
        raw: line,
      });
      continue;
    }

    if (/Undefined control sequence|Missing \$ inserted/i.test(line)) {
      diagnostics.push({
        file: currentFile,
        line: parseLineNumber(lines[index + 1] ?? ""),
        severity: "error",
        message: line.trim(),
        raw: [line, lines[index + 1]].filter(Boolean).join("\n"),
      });
      continue;
    }

    if (/LaTeX Warning:|Package .* Warning:|Citation .* undefined|Reference .* undefined/i.test(line)) {
      diagnostics.push({
        file: currentFile,
        line: parseLineNumber(line),
        severity: "warning",
        message: line.replace(/^.*Warning:\s*/i, "").trim() || line.trim(),
        raw: line,
      });
      continue;
    }

    if (/(Over|Under)full \\[hv]box/i.test(line)) {
      diagnostics.push({
        file: currentFile,
        line: parseLineNumber(line),
        severity: "warning",
        message: line.trim(),
        raw: line,
      });
    }
  }

  return dedupeDiagnostics(diagnostics).slice(0, 30);
}

function findCurrentFile(line: string) {
  const match = line.match(/\(([^()\s]+\.(?:tex|sty|cls|bib|bst))/i);
  return match?.[1];
}

function parseLineNumber(line: string) {
  const match = line.match(/(?:^|\s)l\.(\d+)|lines?\s+(\d+)/i);
  const value = match?.[1] ?? match?.[2];
  return value ? Number(value) : undefined;
}

function dedupeDiagnostics(diagnostics: LatexDiagnostic[]) {
  const seen = new Set<string>();
  return diagnostics.filter((diagnostic) => {
    const key = [diagnostic.severity, diagnostic.file, diagnostic.line, diagnostic.message].join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
