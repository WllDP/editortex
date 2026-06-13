import { describe, expect, it } from "vitest";
import { resolveLatexPreviewFontFamily } from "@/features/preview/lib/latexPreviewFont";
import type { UploadedTemplate } from "@/types/latex";

describe("resolveLatexPreviewFontFamily", () => {
  it("detects Montserrat from latex package imports", () => {
    const template = createTemplate(
      "\\documentclass{article}\n\\usepackage[sfdefault]{montserrat}\n\\begin{document}x",
    );

    expect(resolveLatexPreviewFontFamily(template)).toBe('"Montserrat", Arial, sans-serif');
  });

  it("detects explicit fontspec main font", () => {
    const template = createTemplate("\\documentclass{article}\n\\setmainfont{Montserrat}\n\\begin{document}x");

    expect(resolveLatexPreviewFontFamily(template)).toBe('"Montserrat", Arial, sans-serif');
  });

  it("reads font commands from imported style files", () => {
    const template = createTemplate("\\documentclass{article}\n\\usepackage{custom}\n\\begin{document}x", {
      styleContent: "\\setsansfont{Montserrat}",
    });

    expect(resolveLatexPreviewFontFamily(template)).toBe('"Montserrat", Arial, sans-serif');
  });

  it("falls back to the default preview font when no font is declared", () => {
    const template = createTemplate("\\documentclass{article}\n\\begin{document}x");

    expect(resolveLatexPreviewFontFamily(template)).toBe("Arial, sans-serif");
  });
});

function createTemplate(content: string, options: { styleContent?: string } = {}): UploadedTemplate {
  return {
    id: "template",
    name: "template",
    fileName: "main.tex",
    content,
    sourceType: "tex-file",
    parsedTemplate: {
      id: "parsed",
      name: "template",
      rawContent: content,
      preamble: content.split("\\begin{document}")[0],
      body: "",
      commands: [],
      variables: [],
      environments: [],
      parsedAt: "2026-06-12T00:00:00.000Z",
    },
    project: {
      sourceType: "tex-file",
      mainTexPath: "main.tex",
      files: [
        {
          path: "main.tex",
          name: "main.tex",
          extension: "tex",
          kind: "tex",
          size: content.length,
          content,
        },
        ...(options.styleContent
          ? [
              {
                path: "custom.sty",
                name: "custom.sty",
                extension: "sty",
                kind: "style" as const,
                size: options.styleContent.length,
                content: options.styleContent,
              },
            ]
          : []),
      ],
      assets: [],
    },
    createdAt: "2026-06-12T00:00:00.000Z",
  };
}
