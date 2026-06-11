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

const finalImageDefinition: BlockDefinition = {
  id: "system:final-image",
  name: "Imagem Final",
  type: "final-image",
  category: "estrutura",
  variableName: "PaginaFinalImagem",
  latexTemplate: String.raw`\PaginaFinalImagem{image}`,
  fields: [{ id: "image", label: "Imagem", type: "textarea" }],
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

  it("renderiza imagem final usando o macro do template", () => {
    const blocks: BlockInstance[] = [
      {
        id: "final",
        definitionId: finalImageDefinition.id,
        type: finalImageDefinition.type,
        variableName: finalImageDefinition.variableName,
        order: 0,
        data: { image: "ultima_imagem.png" },
        metadata: {},
      },
    ];

    const latex = generateLatexDocument(createDocument(blocks), [finalImageDefinition]);

    expect(latex).toContain(String.raw`\PaginaFinalImagem{ultima_imagem.png}`);
    expect(latex).not.toContain(String.raw`\begin{tikzpicture}[remember picture,overlay]`);
  });

  it("renderiza imagem anexada sem wrappers que alteram a geometria do template", () => {
    const imageDefinition: BlockDefinition = {
      id: "system:attached-image",
      name: "Imagem anexada",
      type: "attached-image",
      category: "texto",
      variableName: "attachedImage",
      latexTemplate: String.raw`\begin{figure}[H]`,
      fields: [],
      metadata: {},
    };
    const blocks: BlockInstance[] = [
      {
        id: "image",
        definitionId: imageDefinition.id,
        type: imageDefinition.type,
        variableName: imageDefinition.variableName,
        order: 0,
        data: {
          title: "Nivel de Maturidade",
          image: "Jornada da Qualidade/1.inicial.png",
          subtitle: "Fonte: Elaborado pela Testing Company",
        },
        metadata: {
          placement: "[H]",
          width: "width=0.2\\textwidth",
        },
      },
    ];

    const latex = generateLatexDocument(createDocument(blocks), [imageDefinition], undefined, {
      includeTrackingMarkers: false,
    });

    expect(latex).toContain(String.raw`\includegraphics[width=0.2\textwidth]{Jornada da Qualidade/1.inicial.png}`);
    expect(latex).toContain(String.raw`\begin{center}\footnotesize Fonte: Elaborado pela Testing Company\end{center}`);
    expect(latex).not.toContain(String.raw`\makebox[\linewidth][c]`);
    expect(latex).not.toContain(String.raw`\parbox{0.9\linewidth}`);
  });

  it("permite gerar latex limpo sem marcadores rastreaveis para preview PDF", () => {
    const blocks: BlockInstance[] = [
      {
        id: "first",
        definitionId: sectionDefinition.id,
        type: sectionDefinition.type,
        variableName: sectionDefinition.variableName,
        order: 0,
        data: { title: "Primeiro" },
        metadata: {},
      },
    ];

    const latex = generateLatexDocument(createDocument(blocks), [sectionDefinition], undefined, {
      includeTrackingMarkers: false,
    });

    expect(latex).toContain(String.raw`\section{Primeiro}`);
    expect(latex).not.toContain("% editortex:block ");
    expect(latex).not.toContain("% editortex:endblock");
  });

  it("mantem comentarios de rastreio compactos para blocos com textos longos", () => {
    const longText = "Texto longo ".repeat(200);
    const blocks: BlockInstance[] = [
      {
        id: "text",
        definitionId: "system:plain-text",
        type: "plain-text",
        variableName: "text",
        order: 0,
        data: { text: longText },
        metadata: { importedFrom: "plain-text" },
      },
    ];
    const textDefinition: BlockDefinition = {
      id: "system:plain-text",
      name: "Texto livre",
      type: "plain-text",
      category: "texto",
      variableName: "text",
      latexTemplate: "#1",
      fields: [{ id: "text", label: "Texto", type: "textarea" }],
      metadata: {},
    };

    const latex = generateLatexDocument(createDocument(blocks), [textDefinition]);
    const marker = latex.match(/% editortex:block [^\n]+/)?.[0] ?? "";

    expect(marker.length).toBeLessThan(450);
    expect(marker).not.toContain(encodeURIComponent(longText.slice(0, 80)));
    expect(latex).toContain(longText.trim());
  });
});
