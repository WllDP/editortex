import { describe, expect, it } from "vitest";
import { renderBlockToLatex } from "@/domain/latex/blockRenderer";
import type { BlockInstance } from "@/types/blocks";
import { lexicalTextDataKey } from "@/types/editor";

describe("renderBlockToLatex rich text", () => {
  it("uses Lexical JSON for Texto Livre when available", () => {
    const lexicalJson = JSON.stringify({
      root: {
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Importante", format: 1 }],
          },
        ],
      },
    });
    const block: BlockInstance = {
      id: "block-1",
      definitionId: "plain-text",
      type: "plain-text",
      variableName: "paragrafo",
      order: 0,
      data: {
        text: "Importante",
        [lexicalTextDataKey]: lexicalJson,
      },
      metadata: {},
    };

    expect(renderBlockToLatex(block)).toBe("\\textbf{Importante}");
  });

  it("keeps plain text fallback for older Texto Livre blocks", () => {
    const block: BlockInstance = {
      id: "block-1",
      definitionId: "plain-text",
      type: "plain-text",
      variableName: "paragrafo",
      order: 0,
      data: {
        text: "Texto com \\textbf{comando}",
      },
      metadata: {},
    };

    expect(renderBlockToLatex(block)).toBe("Texto com \\textbf{comando}");
  });
});
