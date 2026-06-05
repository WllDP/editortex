import { describe, expect, it } from "vitest";
import { escapeLatex } from "@/domain/latex/escapeLatex";

describe("escapeLatex", () => {
  it("escapa caracteres especiais do LaTeX", () => {
    expect(escapeLatex("50% & $value_1#{x} ~ ^ \\")).toBe(
      "50\\% \\& \\$value\\_1\\#\\{x\\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{}",
    );
  });

  it("preserva texto sem caracteres especiais", () => {
    expect(escapeLatex("Texto simples")).toBe("Texto simples");
  });
});
