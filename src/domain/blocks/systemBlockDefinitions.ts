import type { BlockDefinition } from "@/types/blocks";

function commandBlock(
  id: string,
  name: string,
  variableName: string,
  fieldLabels: string[],
  category = "Estrutura do Documento",
): BlockDefinition {
  return {
    id,
    name,
    type: "latex-command",
    category,
    variableName,
    latexTemplate: `\\${variableName}${fieldLabels.map((_, index) => `{#${index + 1}}`).join("")}`,
    fields: fieldLabels.map((label, index) => ({
      id: `arg${index + 1}`,
      label,
      type: "textarea",
      placeholder: label,
      defaultValue: "",
    })),
    metadata: {
      system: true,
      builtin: true,
    },
  };
}

export const plainTextBlockDefinition: BlockDefinition = {
  id: "system:plain-text",
  name: "Texto livre",
  type: "plain-text",
  category: "MÃ³dulos de Texto",
  variableName: "text",
  latexTemplate: "#1",
  fields: [
    {
      id: "text",
      label: "Texto",
      type: "textarea",
      placeholder: "Digite o texto do parÃ¡grafo",
      defaultValue: "",
    },
  ],
  metadata: {
    system: true,
  },
};

export const rawLatexBlockDefinition: BlockDefinition = {
  id: "system:raw-latex",
  name: "LaTeX preservado",
  type: "raw-latex",
  category: "Estrutura do Documento",
  variableName: "rawLatex",
  latexTemplate: "#1",
  fields: [
    {
      id: "rawLatex",
      label: "ConteÃºdo preservado",
      type: "textarea",
      placeholder: "Trecho LaTeX preservado",
      defaultValue: "",
    },
  ],
  metadata: {
    system: true,
    editableLatex: true,
  },
};

export const attachedImageBlockDefinition: BlockDefinition = {
  id: "system:attached-image",
  name: "Imagem anexada",
  type: "attached-image",
  category: "MÃ³dulos de Texto",
  variableName: "attachedImage",
  latexTemplate: "\\begin{figure}[H]...",
  fields: [
    {
      id: "title",
      label: "TÃ­tulo",
      type: "textarea",
      placeholder: "TÃ­tulo da imagem",
      defaultValue: "",
    },
    {
      id: "image",
      label: "Imagem",
      type: "textarea",
      placeholder: "Cole a imagem ou informe o arquivo, ex: inicial.png",
      defaultValue: "",
    },
    {
      id: "subtitle",
      label: "SubtÃ­tulo",
      type: "textarea",
      placeholder: "Fonte, legenda complementar ou observaÃ§Ã£o",
      defaultValue: "",
    },
  ],
  metadata: {
    system: true,
    builtin: true,
  },
};

export const finalImageBlockDefinition: BlockDefinition = {
  id: "system:final-image",
  name: "Imagem Final",
  type: "final-image",
  category: "Estrutura do Documento",
  variableName: "PaginaFinalImagem",
  latexTemplate: "\\PaginaFinalImagem{#1}",
  fields: [
    {
      id: "image",
      label: "Imagem",
      type: "textarea",
      placeholder: "Cole a imagem ou informe o arquivo, ex: ultima_imagem.png",
      defaultValue: "",
    },
  ],
  metadata: {
    system: true,
    builtin: true,
  },
};

export const customCoverBlockDefinition: BlockDefinition = {
  id: "system:capaCustomizada",
  name: "Capa customizada",
  type: "custom-cover",
  category: "Estrutura do Documento",
  variableName: "capaCustomizada",
  latexTemplate: "\\title{#1}\n\\capaCustomizada",
  fields: [
    {
      id: "title",
      label: "TÃ­tulo principal",
      type: "textarea",
      placeholder: "TÃ­tulo principal exibido na capa",
      defaultValue: "",
    },
    {
      id: "subtitle",
      label: "TÃ­tulo menor",
      type: "textarea",
      placeholder: "TÃ­tulo menor exibido abaixo do tÃ­tulo principal",
      defaultValue: "",
    },
  ],
  metadata: {
    system: true,
    builtin: true,
  },
};

export const systemBlockDefinitions = [
  plainTextBlockDefinition,
  rawLatexBlockDefinition,
  attachedImageBlockDefinition,
  finalImageBlockDefinition,
  customCoverBlockDefinition,
  commandBlock("system:tableofcontents", "SumÃ¡rio", "tableofcontents", []),
  commandBlock("system:newpage", "Nova pÃ¡gina", "newpage", []),
  commandBlock("system:chapter", "CapÃ­tulo", "chapter", ["TÃ­tulo"]),
  commandBlock("system:specialchapter", "CapÃ­tulo especial", "specialchapter", ["TÃ­tulo", "Texto"]),
  commandBlock("system:section", "SeÃ§Ã£o", "section", ["TÃ­tulo"]),
  commandBlock("system:subsection", "SubseÃ§Ã£o", "subsection", ["TÃ­tulo"]),
  commandBlock("system:subsubsection", "SubseÃ§Ã£o nÃ­vel 3", "subsubsection", ["TÃ­tulo"]),
];
