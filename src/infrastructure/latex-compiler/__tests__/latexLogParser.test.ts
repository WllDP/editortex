import { describe, expect, it } from "vitest";
import { parseLatexLog } from "@/infrastructure/latex-compiler/latexLogParser";

describe("parseLatexLog", () => {
  it("extrai erros iniciados por exclamação com linha", () => {
    const diagnostics = parseLatexLog("! Undefined control sequence.\nl.42 \\\\foo");
    expect(diagnostics[0]).toMatchObject({
      severity: "error",
      line: 42,
      message: "Undefined control sequence.",
    });
  });

  it("extrai LaTeX Error e arquivo ausente", () => {
    const diagnostics = parseLatexLog("! LaTeX Error: File `missing.sty' not found.");
    expect(diagnostics[0]).toMatchObject({
      severity: "error",
      message: "LaTeX Error: File `missing.sty' not found.",
    });
  });

  it("extrai warnings de referência e overfull", () => {
    const diagnostics = parseLatexLog(
      [
        "LaTeX Warning: Reference `sec:x' on page 1 undefined on input line 12.",
        "Overfull \\hbox (12.0pt too wide) in paragraph at lines 20--21",
      ].join("\n"),
    );
    expect(diagnostics.map((diagnostic) => diagnostic.severity)).toEqual(["warning", "warning"]);
    expect(diagnostics[0].line).toBe(12);
    expect(diagnostics[1].line).toBe(20);
  });
});
