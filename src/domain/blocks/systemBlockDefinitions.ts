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
  category: "Módulos de Texto",
  variableName: "text",
  latexTemplate: "#1",
  fields: [
    {
      id: "text",
      label: "Texto",
      type: "textarea",
      placeholder: "Digite o texto do parágrafo",
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
      label: "Conteúdo preservado",
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
  category: "Módulos de Texto",
  variableName: "attachedImage",
  latexTemplate: "\\begin{figure}[H]...",
  fields: [
    {
      id: "title",
      label: "Título",
      type: "textarea",
      placeholder: "Título da imagem",
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
      label: "Subtítulo",
      type: "textarea",
      placeholder: "Fonte, legenda complementar ou observação",
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
      label: "Título principal",
      type: "textarea",
      placeholder: "Título principal exibido na capa",
      defaultValue: "",
    },
    {
      id: "subtitle",
      label: "Título menor",
      type: "textarea",
      placeholder: "Título menor exibido abaixo do título principal",
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
  commandBlock("system:tableofcontents", "Sumário", "tableofcontents", []),
  commandBlock("system:newpage", "Nova página", "newpage", []),
  commandBlock("system:chapter", "Capítulo", "chapter", ["Título"]),
  commandBlock("system:specialchapter", "Capítulo especial", "specialchapter", ["Título", "Texto"]),
  commandBlock("system:section", "Seção", "section", ["Título"]),
  commandBlock("system:subsection", "Subseção", "subsection", ["Título"]),
  commandBlock("system:subsubsection", "Subseção nível 3", "subsubsection", ["Título"]),
];
