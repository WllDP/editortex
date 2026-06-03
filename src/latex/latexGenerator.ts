import type { BlockDefinition, BlockInstance } from "@/types/blocks";
import type { DocumentModel } from "@/types/document";
import type { ParsedLatexTemplate } from "@/types/latex";
import { renderBlockToLatex } from "@/latex/blockRenderer";
import { escapeLatex } from "@/latex/escapeLatex";
import { assembleDocument } from "@/latex/templateAssembler";

export function generateLatexDocument(
  document: DocumentModel,
  definitions: BlockDefinition[],
  template?: ParsedLatexTemplate,
): string {
  const definitionsById = definitions.reduce<Record<string, BlockDefinition>>((index, definition) => {
    index[definition.id] = definition;
    return index;
  }, {});

  const body = [...document.blocks]
    .sort((a, b) => a.order - b.order)
    .map((block: BlockInstance) => renderTrackedBlockToLatex(block, definitionsById[block.definitionId]))
    .join("\n\n");

  const coverOverrides = getCoverOverrides(document.blocks);
  return assembleDocument(template, body, coverOverrides);
}

function renderTrackedBlockToLatex(block: BlockInstance, definition?: BlockDefinition) {
  const rendered = renderBlockToLatex(block, definition);
  const metadata = {
    definitionId: block.definitionId,
    type: block.type,
    variableName: block.variableName,
    data: block.data,
    blockMetadata: block.metadata,
  };

  return [
    `% editortex:block ${encodeURIComponent(JSON.stringify(metadata))}`,
    rendered,
    "% editortex:endblock",
  ].join("\n");
}

function getCoverOverrides(blocks: BlockInstance[]) {
  const coverBlock = [...blocks].sort((a, b) => a.order - b.order).find((block) => block.type === "custom-cover");
  if (!coverBlock) {
    return {};
  }

  const title = coverBlock.data.title?.trim() ? escapeLatex(coverBlock.data.title.trim()) : undefined;
  const subtitle = coverBlock.data.subtitle?.trim() ? escapeLatex(coverBlock.data.subtitle.trim()) : undefined;
  const documentTitle = [title, subtitle].filter(Boolean).join("\\\\") || undefined;

  return {
    title: documentTitle,
    coverTitle: title,
    coverSubtitle: subtitle,
  };
}
