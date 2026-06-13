import { describe, expect, it } from "vitest";
import {
  createAssetLookup,
  createHeadingNumberLookup,
  createTocEntriesWithPages,
  getPreviewSourceBlockId,
  paginateBlocks,
} from "@/features/preview/components/htmlPreviewModel";
import type { BlockDefinition, BlockInstance } from "@/types/blocks";
import type { UploadedTemplate } from "@/types/latex";

describe("createAssetLookup", () => {
  it("maps includegraphics names without extension to imported image assets", () => {
    const lookup = createAssetLookup(createTemplateWithImage("assets/Fundo_Titulo.png"));

    expect(lookup.get("fundo_titulo")).toBe("blob:fundo");
  });
});

describe("createTocEntriesWithPages", () => {
  it("adds hierarchical entries with estimated page numbers", () => {
    const definitions: Record<string, BlockDefinition> = {
      chapter: createDefinition("chapter", "chapter"),
      section: createDefinition("section", "section"),
      subsection: createDefinition("subsection", "subsection"),
    };
    const blocks: BlockInstance[] = [
      createBlock("a", "chapter", "Introducao", 0),
      createBlock("b", "section", "Escopo", 1),
      createBlock("c", "subsection", "Detalhe", 2),
    ];

    expect(createTocEntriesWithPages(blocks, definitions)).toEqual([
      expect.objectContaining({ index: "1", level: 1, pageNumber: 1, title: "Introducao" }),
      expect.objectContaining({ index: "1.1", level: 2, pageNumber: 1, title: "Escopo" }),
      expect.objectContaining({ index: "1.1.1", level: 3, pageNumber: 1, title: "Detalhe" }),
    ]);
  });
});

describe("createHeadingNumberLookup", () => {
  it("numbers section headings according to document hierarchy", () => {
    const definitions: Record<string, BlockDefinition> = {
      chapter: createDefinition("chapter", "chapter"),
      section: createDefinition("section", "section"),
      subsection: createDefinition("subsection", "subsection"),
    };
    const blocks: BlockInstance[] = [
      createBlock("chapter-1", "chapter", "Planejamento Inicial", 0),
      createBlock("section-1", "section", "Escopo do Projeto", 1),
      createBlock("section-2", "section", "Fases de Atuacao", 2),
      createBlock("subsection-1", "subsection", "Contextualizacao", 3),
    ];
    const numbers = createHeadingNumberLookup(blocks, definitions);

    expect(numbers.get("chapter-1")).toBe("1");
    expect(numbers.get("section-1")).toBe("1.1");
    expect(numbers.get("section-2")).toBe("1.2");
    expect(numbers.get("subsection-1")).toBe("1.2.1");
  });
});

describe("paginateBlocks", () => {
  it("splits long plain text blocks across visual preview pages", () => {
    const definitions: Record<string, BlockDefinition> = {
      "system:plain-text": createDefinition("system:plain-text", "text"),
    };
    const longText = Array.from(
      { length: 30 },
      (_, index) =>
        `Paragrafo ${index + 1} com texto suficiente para ocupar varias linhas no preview visual e exigir paginacao antes do rodape.`,
    ).join("\n\n");
    const block: BlockInstance = {
      id: "plain-1",
      definitionId: "system:plain-text",
      type: "plain-text",
      variableName: "text",
      order: 0,
      data: { text: longText },
      metadata: {},
    };

    const pages = paginateBlocks([block], definitions);

    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0].blocks[0].id).toBe("plain-1");
    expect(pages[1].blocks[0].id).toContain("plain-1:preview-part-");
    expect(getPreviewSourceBlockId(pages[1].blocks[0])).toBe("plain-1");
    expect(
      pages
        .flatMap((page) => page.blocks)
        .map((previewBlock) => previewBlock.data.text)
        .join("\n\n"),
    ).toBe(longText);
  });

  it("keeps section headings with the first following text chunk", () => {
    const definitions: Record<string, BlockDefinition> = {
      filler: createDefinition("filler", "filler"),
      subsection: createDefinition("subsection", "subsection"),
      "system:plain-text": createDefinition("system:plain-text", "text"),
    };
    const filler: BlockInstance = {
      id: "filler-1",
      definitionId: "filler",
      type: "latex-command",
      variableName: "filler",
      order: 0,
      data: { arg1: "x".repeat(9600) },
      metadata: {},
    };
    const heading = createBlock("heading-1", "subsection", "Realizacao de Conversas Individuais", 1);
    const text: BlockInstance = {
      id: "plain-1",
      definitionId: "system:plain-text",
      type: "plain-text",
      variableName: "text",
      order: 2,
      data: {
        text: "A partir das primeiras interacoes realizadas durante a contextualizacao inicial, foi definida a aplicacao de conversas individuais com os profissionais envolvidos.",
      },
      metadata: {},
    };

    const pages = paginateBlocks([filler, heading, text], definitions);
    const headingPage = pages.find((page) => page.blocks.some((block) => block.id === "heading-1"));

    expect(headingPage?.blocks.map((block) => getPreviewSourceBlockId(block))).toContain("plain-1");
  });

  it("reserves enough space after attached images before flowing long text", () => {
    const definitions: Record<string, BlockDefinition> = {
      "system:attached-image": createDefinition("system:attached-image", "attachedImage"),
      "system:plain-text": createDefinition("system:plain-text", "text"),
    };
    const image: BlockInstance = {
      id: "image-1",
      definitionId: "system:attached-image",
      type: "attached-image",
      variableName: "attachedImage",
      order: 0,
      data: {
        image: "diagrama.png",
        subtitle: "Fonte: Elaborado pela Testing Company",
      },
      metadata: {},
    };
    const text: BlockInstance = {
      id: "plain-1",
      definitionId: "system:plain-text",
      type: "plain-text",
      variableName: "text",
      order: 1,
      data: {
        text: Array.from(
          { length: 9 },
          (_, index) =>
            `Item ${index + 1}: O problema ou oportunidade tem um impacto significativo e precisa ser apresentado sem invadir o rodape visual da pagina.`,
        ).join(" "),
      },
      metadata: {},
    };

    const pages = paginateBlocks([image, text], definitions);

    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0].blocks.map((block) => getPreviewSourceBlockId(block))).toContain("plain-1");
    expect(pages[1].blocks.map((block) => getPreviewSourceBlockId(block))).toContain("plain-1");
  });
});

function createTemplateWithImage(path: string): UploadedTemplate {
  return {
    id: "template",
    name: "template",
    fileName: "main.tex",
    content: "",
    sourceType: "overleaf-zip",
    parsedTemplate: {
      id: "parsed",
      name: "template",
      rawContent: "",
      preamble: "",
      body: "",
      commands: [],
      variables: [],
      environments: [],
      parsedAt: "2026-06-12T00:00:00.000Z",
    },
    project: {
      sourceType: "overleaf-zip",
      mainTexPath: "main.tex",
      files: [
        {
          path,
          name: "Fundo_Titulo.png",
          extension: "png",
          kind: "image",
          size: 1,
          objectUrl: "blob:fundo",
          mimeType: "image/png",
        },
      ],
      assets: [],
    },
    createdAt: "2026-06-12T00:00:00.000Z",
  };
}

function createDefinition(id: string, variableName: string): BlockDefinition {
  return {
    id,
    name: id,
    type: "latex-command",
    category: "test",
    variableName,
    latexTemplate: "",
    fields: [{ id: "arg1", label: "Titulo", type: "textarea" }],
    metadata: {},
  };
}

function createBlock(id: string, definitionId: string, title: string, order: number): BlockInstance {
  return {
    id,
    definitionId,
    type: "latex-command",
    variableName: definitionId,
    order,
    data: { arg1: title },
    metadata: {},
  };
}
