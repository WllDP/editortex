import type { BlockDefinition, BlockInstance } from "@/types/blocks";
import { lexicalTextDataKey } from "@/types/editor";
import { escapeLatex } from "@/domain/latex/escapeLatex";
import { escapeLatexPreservingInlineCommands } from "@/domain/latex/inlineLatex";
import { lexicalJsonToLatex } from "@/utils/latex/lexicalToLatex";

export function renderBlockToLatex(block: BlockInstance, definition?: BlockDefinition): string {
  if (block.type === "plain-text") {
    if (block.data[lexicalTextDataKey]?.trim()) {
      return lexicalJsonToLatex(block.data[lexicalTextDataKey], block.data.text ?? "");
    }

    return escapeLatexPreservingInlineCommands(block.data.text ?? "");
  }

  if (block.type === "raw-latex") {
    return block.data.rawLatex ?? "";
  }

  if (block.type === "attached-image") {
    return renderAttachedImageBlock(block);
  }

  if (block.type === "final-image") {
    return renderFinalImageBlock(block);
  }

  if (block.type === "custom-cover") {
    return renderCustomCoverBlock(block);
  }

  if (!definition) {
    return `% Bloco sem definição: ${block.type}`;
  }

  const renderedArguments = definition.fields.map((field) => {
    const value = block.data[field.id] ?? field.defaultValue ?? "";
    return `{${escapeLatex(value)}}`;
  });

  return `\\${definition.variableName}${renderedArguments.join("")}`;
}

function renderCustomCoverBlock(_block: BlockInstance) {
  return "\\capaCustomizada";
}

function renderAttachedImageBlock(block: BlockInstance) {
  const title = block.data.title?.trim() ?? "";
  const image = block.data.image?.trim() ?? "";
  const subtitle = block.data.subtitle?.trim() ?? "";
  const placement = typeof block.metadata.placement === "string" ? block.metadata.placement : "[H]";
  const width = typeof block.metadata.width === "string" ? block.metadata.width : "width=0.7\\textwidth";
  const escapedSubtitle = subtitle ? escapeLatex(subtitle) : "";

  return [
    `\\begin{figure}${placement}`,
    "\\centering",
    title ? `\\caption{${escapeLatex(title)}}` : "",
    image ? `\\includegraphics[${width}]{${image}}` : "",
    escapedSubtitle ? `\\begin{center}\\footnotesize ${escapedSubtitle}\\end{center}` : "",
    "\\end{figure}",
  ]
    .filter(Boolean)
    .join("\n");
}

function renderFinalImageBlock(block: BlockInstance) {
  const image = block.data.image?.trim() ?? "";
  if (!image) {
    return "";
  }

  if (block.variableName === "PaginaFinalImagem") {
    return `\\PaginaFinalImagem{${image}}`;
  }

  return [
    "\\clearpage",
    "\\RodapeAtivofalse",
    "\\thispagestyle{empty}",
    "\\begin{tikzpicture}[remember picture,overlay]",
    "  \\node[anchor=center,inner sep=0pt] at (current page.center)",
    `  {\\includegraphics[width=\\paperwidth,height=\\paperheight]{${image}}};`,
    "\\end{tikzpicture}",
    "\\clearpage",
    "\\RodapeAtivotrue",
  ].join("\n");
}
