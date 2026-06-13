import { describe, expect, it } from "vitest";
import { applyFastPreviewMode } from "@/infrastructure/latex-compiler/fastPreviewLatex";

describe("applyFastPreviewMode", () => {
  it("injeta fastpreviewtrue no modo pdf-preview", () => {
    const tex = applyFastPreviewMode("\\documentclass{article}\n\\begin{document}x\\end{document}", "pdf-preview");
    expect(tex).toContain("\\newif\\iffastpreview");
    expect(tex).toContain("\\fastpreviewtrue");
  });

  it("injeta fastpreviewfalse no modo pdf-final", () => {
    const tex = applyFastPreviewMode("\\documentclass{article}\n\\begin{document}x\\end{document}", "pdf-final");
    expect(tex).toContain("\\newif\\iffastpreview");
    expect(tex).toContain("\\fastpreviewfalse");
  });

  it("nao duplica newif e atualiza valor existente", () => {
    const tex = applyFastPreviewMode(
      "\\documentclass{article}\n\\newif\\iffastpreview\n\\fastpreviewfalse\n\\begin{document}x\\end{document}",
      "pdf-preview",
    );
    expect(tex.match(/\\newif\\iffastpreview/g)).toHaveLength(1);
    expect(tex.match(/\\fastpreviewtrue/g)).toHaveLength(1);
    expect(tex).not.toContain("\\fastpreviewfalse");
  });

  it("atualiza template com flag existente para final", () => {
    const tex = applyFastPreviewMode(
      "\\documentclass{article}\n\\newif\\iffastpreview\n\\fastpreviewtrue\n\\begin{document}x\\end{document}",
      "pdf-final",
    );
    expect(tex).toContain("\\fastpreviewfalse");
    expect(tex).not.toContain("\\fastpreviewtrue");
  });

  it("condiciona elementos visuais pesados apenas no preview", () => {
    const source = [
      "\\documentclass{article}",
      "\\AddToShipoutPictureBG{\\includegraphics{bg.png}}",
      "\\begin{tikzpicture}[remember picture,overlay]",
      "\\node at (0,0) {};",
      "\\end{tikzpicture}",
      "\\PaginaFinalImagem{final.png}",
    ].join("\n");
    const preview = applyFastPreviewMode(source, "pdf-preview");
    const final = applyFastPreviewMode(source, "pdf-final");

    expect(preview).toContain("fastpreview: \\AddToShipoutPictureBG");
    expect(preview).not.toContain("\\iffastpreview\\else \\AddToShipoutPictureBG");
    expect(preview).toContain("\\iffastpreview\\else\n\\begin{tikzpicture}");
    expect(preview).toContain("\\end{tikzpicture}\n\\fi");
    expect(preview).toContain("\\iffastpreview\\else \\PaginaFinalImagem");
    expect(final).toContain("\\AddToShipoutPictureBG{\\includegraphics{bg.png}}");
    expect(final).toContain("\\PaginaFinalImagem{final.png}");
    expect(final).not.toContain("\\iffastpreview\\else \\AddToShipoutPictureBG");
  });

  it("substitui definicoes decorativas por stubs no preview sem deixar corpo ativo", () => {
    const source = [
      "\\documentclass{report}",
      "\\usepackage{setspace}",
      "\\newcommand{\\capaCustomizada}{",
      "\\RodapeAtivofalse",
      "\\begin{titlepage}",
      "Capa",
      "\\end{titlepage}",
      "\\RodapeAtivotrue",
      "}",
      "\\newif\\ifRodapeAtivo",
      "\\RodapeAtivotrue",
      "\\begin{document}",
      "\\capaCustomizada",
      "\\end{document}",
    ].join("\n");

    const preview = applyFastPreviewMode(source, "pdf-preview");

    expect(preview).toContain("\\providecommand{\\capaCustomizada}{}");
    expect(preview).not.toContain("\\RodapeAtivofalse");
    expect(preview.indexOf("\\newif\\ifRodapeAtivo")).toBeGreaterThan(-1);
  });

  it("insere pagina placeholder quando o preview ficaria sem paginas", () => {
    const source = [
      "\\documentclass{report}",
      "\\newcommand{\\capaCustomizada}{Capa}",
      "\\begin{document}",
      "\\iffastpreview\\else \\capaCustomizada \\fi",
      "\\end{document}",
    ].join("\n");

    const preview = applyFastPreviewMode(source, "pdf-preview");
    const final = applyFastPreviewMode(source, "pdf-final");

    expect(preview).toContain("\\EditorLatexFastPreviewPlaceholder");
    expect(preview).toContain("Preview rapido sem conteudo renderizavel");
    expect(preview).toContain("Use a compilacao fiel/final");
    expect(preview).toContain("\\begin{document}\n\\EditorLatexFastPreviewPlaceholder");
    expect(final).not.toContain("\\EditorLatexFastPreviewPlaceholder");
  });

  it("pode injetar draft de imagens no preview quando configurado", () => {
    const tex = applyFastPreviewMode("\\documentclass{article}", "pdf-preview", {
      draftImages: true,
      disableBackgrounds: true,
      disableDecorativePages: true,
      disableHeavyTikz: true,
    });
    expect(tex).toContain("\\PassOptionsToPackage{draft}{graphicx}");
    expect(tex).toContain("\\PassOptionsToPackage{draft}{graphics}");
  });
});
