import { describe, expect, it } from "vitest";
import { getBlockSuggestions } from "@/features/block-suggestions/suggestionEngine";
import type { BlockDefinition, BlockInstance } from "@/types/blocks";

const availableBlocks = [
  definition("system:capaCustomizada", "capaCustomizada", "custom-cover"),
  definition("system:tableofcontents", "tableofcontents", "latex-command"),
  definition("system:newpage", "newpage", "latex-command"),
  definition("system:chapter", "chapter", "latex-command"),
  definition("system:specialchapter", "specialchapter", "latex-command"),
  definition("system:section", "section", "latex-command"),
  definition("system:subsection", "subsection", "latex-command"),
  definition("system:attached-image", "attachedImage", "attached-image"),
  definition("system:final-image", "PaginaFinalImagem", "final-image"),
  definition("system:plain-text", "text", "plain-text"),
  definition("system:raw-latex", "rawLatex", "raw-latex"),
];

describe("getBlockSuggestions", () => {
  it("sugere texto logo apos capitulo", () => {
    const currentBlock = block("chapter", 0);
    const suggestions = getBlockSuggestions({
      currentBlock,
      availableBlocks,
      documentBlocks: [currentBlock],
      currentIndex: 0,
    });

    expect(keys(suggestions).slice(0, 3)).toEqual(["text", "section", "attachedImage"]);
  });

  it("ordena continuidade e estrutura apos texto livre", () => {
    const currentBlock = block("text", 0);
    const suggestions = getBlockSuggestions({
      currentBlock,
      availableBlocks,
      documentBlocks: [currentBlock],
      currentIndex: 0,
    });

    expect(keys(suggestions).slice(0, 4)).toEqual(["text", "section", "chapter", "specialchapter"]);
  });

  it("mantem imagem final no fim quando nao esta perto do fim do documento", () => {
    const currentBlock = block("section", 0);
    const documentBlocks = [currentBlock, block("text", 1), block("section", 2), block("text", 3)];
    const suggestions = getBlockSuggestions({
      currentBlock,
      availableBlocks,
      documentBlocks,
      currentIndex: 0,
    });

    expect(keys(suggestions).at(-1)).toBe("PaginaFinalImagem");
  });
});

function definition(id: string, variableName: string, type: string): BlockDefinition {
  return {
    id,
    name: variableName,
    type,
    category: "teste",
    variableName,
    latexTemplate: "",
    fields: [],
    metadata: {},
  };
}

function block(variableName: string, order: number): BlockInstance {
  return {
    id: `${variableName}-${order}`,
    definitionId: `system:${variableName}`,
    type: variableName,
    variableName,
    order,
    data: {},
    metadata: {},
  };
}

function keys(suggestions: Array<{ key: string }>) {
  return suggestions.map((suggestion) => suggestion.key);
}
