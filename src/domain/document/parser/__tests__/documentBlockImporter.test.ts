import { describe, expect, it } from "vitest";
import { generateLatexDocument } from "@/domain/latex/latexGenerator";
import { importTemplateBodyAsBlocks } from "@/domain/document/parser/documentBlockImporter";
import { parseLatexTemplate } from "@/domain/document/parser/latexParser";
import { systemBlockDefinitions } from "@/domain/blocks/systemBlockDefinitions";
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

  it("recria comandos conhecidos importados como blocos limpos", () => {
    const template = parseLatexTemplate(String.raw`
\documentclass{article}
\begin{document}
\specialchapter {Objetivo} {
Este texto precisa manter a geometria original do template.
}
\end{document}
`);

    const importedBlocks = importTemplateBodyAsBlocks(template, systemBlockDefinitions);

    expect(importedBlocks).toHaveLength(1);
    expect(importedBlocks[0]).toMatchObject({
      definitionId: "system:specialchapter",
      variableName: "specialchapter",
      data: {
        arg1: "Objetivo",
        arg2: "Este texto precisa manter a geometria original do template.",
      },
      metadata: {
        importedFrom: "latex-command",
      },
    });
    expect(importedBlocks[0].metadata.originalLatex).toBeUndefined();
    expect(importedBlocks[0].metadata.originalArgs).toBeUndefined();
  });

  it("recria figuras importadas como blocos limpos de imagem anexada", () => {
    const template = parseLatexTemplate(String.raw`
\documentclass{article}
\begin{document}
\begin{figure}[H]
\centering
\caption{Nivel de Maturidade}
\includegraphics[width=0.2\textwidth]{Jornada da Qualidade/1.inicial.png}
Fonte: Elaborado pela Testing Company
\end{figure}
\end{document}
`);

    const importedBlocks = importTemplateBodyAsBlocks(template, systemBlockDefinitions);

    expect(importedBlocks).toHaveLength(1);
    expect(importedBlocks[0]).toMatchObject({
      definitionId: "system:attached-image",
      variableName: "attachedImage",
      data: {
        title: "Nivel de Maturidade",
        image: "Jornada da Qualidade/1.inicial.png",
        subtitle: "Fonte: Elaborado pela Testing Company",
      },
      metadata: {
        importedFrom: "figure",
      },
    });
    expect(importedBlocks[0].metadata.originalLatex).toBeUndefined();
    expect(importedBlocks[0].metadata.placement).toBeUndefined();
    expect(importedBlocks[0].metadata.width).toBeUndefined();
  });

  it("agrupa paragrafos consecutivos importados em um unico bloco de texto limpo", () => {
    const template = parseLatexTemplate(String.raw`
\documentclass{article}
\begin{document}
\chapter{Introducao}

Primeiro paragrafo do capitulo.

Segundo paragrafo do mesmo bloco textual.

\section{Proxima secao}
\end{document}
`);

    const importedBlocks = importTemplateBodyAsBlocks(template, systemBlockDefinitions);

    expect(importedBlocks).toHaveLength(3);
    expect(importedBlocks[0]).toMatchObject({ variableName: "chapter" });
    expect(importedBlocks[1]).toMatchObject({
      definitionId: "system:plain-text",
      variableName: "text",
      data: {
        text: "Primeiro paragrafo do capitulo.\n\nSegundo paragrafo do mesmo bloco textual.",
      },
    });
    expect(importedBlocks[2]).toMatchObject({ variableName: "section" });
  });

  it("converte listas importadas em blocos de texto limpos", () => {
    const template = parseLatexTemplate(String.raw`
\documentclass{article}
\begin{document}
\begin{itemize}
  \item \textbf{Problemas de Produto:} Falhas e defeitos.

  \item \textbf{Problemas de Processo:} Gargalos e inconsistencias.
\end{itemize}
\end{document}
`);

    const importedBlocks = importTemplateBodyAsBlocks(template, systemBlockDefinitions);

    expect(importedBlocks).toHaveLength(1);
    expect(importedBlocks[0]).toMatchObject({
      definitionId: "system:plain-text",
      variableName: "text",
    });
    expect(importedBlocks[0].data.text).toContain("- \\textbf{Problemas de Produto:} Falhas e defeitos.");
    expect(importedBlocks[0].data.text).toContain("- \\textbf{Problemas de Processo:} Gargalos e inconsistencias.");
    expect(importedBlocks.some((block) => block.variableName === "rawLatex")).toBe(false);
  });
});
