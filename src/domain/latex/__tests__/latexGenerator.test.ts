import { describe, expect, it } from "vitest";
import { generateLatexDocument } from "@/domain/latex/latexGenerator";
import type { BlockDefinition, BlockInstance } from "@/types/blocks";
import type { DocumentModel } from "@/types/document";

const sectionDefinition: BlockDefinition = {
  id: "section",
  name: "Secao",
  type: "section",
  category: "estrutura",
  variableName: "section",
  latexTemplate: String.raw`\section{title}`,
  fields: [{ id: "title", label: "Titulo", type: "text" }],
  metadata: {},
};

function createDocument(blocks: BlockInstance[]): DocumentModel {
  return {
    id: "doc-1",
    title: "Documento",
    blocks,
    metadata: {},
    updatedAt: "2026-06-03T00:00:00.000Z",
  };
}

describe("generateLatexDocument", () => {
  it("monta documento fallback com blocos ordenados e marcadores rastreaveis", () => {
    const blocks: BlockInstance[] = [
      {
        id: "second",
        definitionId: sectionDefinition.id,
        type: sectionDefinition.type,
        variableName: sectionDefinition.variableName,
        order: 1,
        data: { title: "Segundo" },
        metadata: {},
      },
      {
        id: "first",
        definitionId: sectionDefinition.id,
        type: sectionDefinition.type,
        variableName: sectionDefinition.variableName,
        order: 0,
        data: { title: "Primeiro & seguro" },
        metadata: {},
      },
    ];

    const latex = generateLatexDocument(createDocument(blocks), [sectionDefinition]);

    expect(latex).toContain(String.raw`\documentclass{article}`);
    expect(latex).toContain("% editortex:block ");
    expect(latex.indexOf(String.raw`\section{Primeiro \& seguro}`)).toBeLessThan(
      latex.indexOf(String.raw`\section{Segundo}`),
    );
    expect(latex).toContain(String.raw`\end{document}`);
  });
});
