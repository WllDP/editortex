import { describe, expect, it } from "vitest";
import { generateLatexDocument } from "@/domain/latex/latexGenerator";
import { importTemplateBodyAsBlocks } from "@/domain/document/parser/documentBlockImporter";
import { parseLatexTemplate } from "@/domain/document/parser/latexParser";
import type { BlockDefinition, BlockInstance } from "@/types/blocks";
import type { DocumentModel } from "@/types/document";

const paragraphDefinition: BlockDefinition = {
  id: "paragraph",
  name: "Paragrafo",
  type: "paragraph",
  category: "texto",
  variableName: "paragrafo",
  latexTemplate: String.raw`\paragrafo{content}`,
  fields: [{ id: "content", label: "Conteudo", type: "textarea" }],
  metadata: {},
};

describe("importTemplateBodyAsBlocks", () => {
  it("reimporta blocos rastreados gerados pelo EditorTex", () => {
    const block: BlockInstance = {
      id: "block-1",
      definitionId: paragraphDefinition.id,
      type: paragraphDefinition.type,
      variableName: paragraphDefinition.variableName,
      order: 0,
      data: { content: "Texto importado" },
      metadata: {},
    };
    const document: DocumentModel = {
      id: "doc-1",
      title: "Documento",
      blocks: [block],
      metadata: {},
      updatedAt: "2026-06-03T00:00:00.000Z",
    };
    const generated = generateLatexDocument(document, [paragraphDefinition]);
    const template = parseLatexTemplate(generated);

    const importedBlocks = importTemplateBodyAsBlocks(template, [paragraphDefinition]);

    expect(importedBlocks).toHaveLength(1);
    expect(importedBlocks[0]).toMatchObject({
      definitionId: paragraphDefinition.id,
      type: paragraphDefinition.type,
      variableName: paragraphDefinition.variableName,
      order: 0,
      data: { content: "Texto importado" },
    });
  });
});
