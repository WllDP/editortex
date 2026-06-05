import { describe, expect, it } from "vitest";
import { parseLatexTemplate } from "@/domain/document/parser/latexParser";

describe("parseLatexTemplate", () => {
  it("separa preambulo, corpo, comandos e variaveis", () => {
    const template = parseLatexTemplate(
      String.raw`
\documentclass{article}
\newcommand{\cliente}[1]{Cliente: #1}
\begin{document}
\cliente{ACME}
\end{document}
`,
      "Contrato",
    );

    expect(template.name).toBe("Contrato");
    expect(template.preamble).toContain(String.raw`\newcommand{\cliente}`);
    expect(template.body).toContain(String.raw`\cliente{ACME}`);
    expect(template.commands.map((command) => command.name)).toContain("cliente");
    expect(template.variables.map((variable) => variable.name)).toContain("cliente");
  });
});
