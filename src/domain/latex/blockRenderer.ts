import type { BlockDefinition, BlockInstance } from "@/types/blocks";
import { escapeLatex } from "@/domain/latex/escapeLatex";
import { escapeLatexPreservingInlineCommands } from "@/domain/latex/inlineLatex";

export function renderBlockToLatex(block: BlockInstance, definition?: BlockDefinition): string {
  if (block.type === "plain-text") {
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
    return `% Bloco sem definiÃ§Ã£o: ${block.type}`;
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
    image ? `\\makebox[\\linewidth][c]{\\includegraphics[${width}]{${image}}}\\par` : "",
    escapedSubtitle
      ? `\\vspace{0.35em}\\makebox[\\linewidth][c]{\\parbox{0.9\\linewidth}{\\centering\\footnotesize ${escapedSubtitle}}}\\par`
      : "",
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

  return [
    "\\clearpage",
    "\\RodapeAtivofalse",
    "\\thispagestyle{empty}",
    "\\begin{tikzpicture}[remember picture,overlay]",
    "  \\node[anchor=center,inner sep=0pt] at (current page.center)",
    `  {\\includegraphics[width=\\paperwidth,height=\\paperheight,keepaspectratio]{${image}}};`,
    "\\end{tikzpicture}",
    "\\clearpage",
    "\\RodapeAtivotrue",
  ].join("\n");
}
