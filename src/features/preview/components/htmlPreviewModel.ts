import type { BlockDefinition, BlockInstance } from "@/types/blocks";
import type { UploadedTemplate } from "@/types/latex";

export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;
const PAGE_CAPACITY = 100;

export interface PreviewPage {
  id: string;
  blocks: BlockInstance[];
  overflowHint?: boolean;
}

export interface TocEntry {
  index: string;
  level: number;
  title: string;
}

export function createDefinitionsById(definitions: BlockDefinition[]) {
  return Object.fromEntries(definitions.map((definition) => [definition.id, definition]));
}

export function paginateBlocks(blocks: BlockInstance[], definitionsById: Record<string, BlockDefinition>) {
  const pages: PreviewPage[] = [];
  let currentBlocks: BlockInstance[] = [];
  let currentWeight = 0;

  const pushPage = (overflowHint = false) => {
    if (!currentBlocks.length) {
      return;
    }
    pages.push({
      id: `page-${pages.length + 1}-${currentBlocks[0]?.id ?? "empty"}`,
      blocks: currentBlocks,
      overflowHint,
    });
    currentBlocks = [];
    currentWeight = 0;
  };

  for (const block of blocks) {
    const definition = definitionsById[block.definitionId];
    const variableName = definition?.variableName ?? block.variableName;

    if (variableName === "newpage") {
      currentBlocks.push(block);
      pushPage();
      continue;
    }

    const startsNewPage =
      block.type === "custom-cover" ||
      block.type === "final-image" ||
      variableName === "chapter" ||
      variableName === "specialchapter";
    if (startsNewPage && currentBlocks.length) {
      pushPage();
    }

    const weight = estimateBlockWeight(block, definition);
    if (currentBlocks.length && currentWeight + weight > PAGE_CAPACITY) {
      pushPage(currentWeight > PAGE_CAPACITY);
    }

    currentBlocks.push(block);
    currentWeight += weight;

    if (block.type === "custom-cover" || block.type === "final-image") {
      pushPage();
    }
  }

  pushPage(currentWeight > PAGE_CAPACITY);
  return pages;
}

export function createTocEntries(blocks: BlockInstance[], definitionsById: Record<string, BlockDefinition>) {
  let chapter = 0;
  let section = 0;
  let subsection = 0;
  const entries: TocEntry[] = [];

  for (const block of blocks) {
    const definition = definitionsById[block.definitionId];
    const variableName = definition?.variableName ?? block.variableName;
    const firstValue = definition?.fields.map((field) => block.data[field.id]).find(Boolean);

    if (variableName === "chapter" || variableName === "specialchapter") {
      chapter += 1;
      section = 0;
      subsection = 0;
      entries.push({ index: String(chapter), level: 1, title: firstValue || definition?.name || "Capitulo" });
    } else if (variableName === "section") {
      section += 1;
      subsection = 0;
      entries.push({ index: `${chapter}.${section}`, level: 2, title: firstValue || "Secao" });
    } else if (variableName === "subsection") {
      subsection += 1;
      entries.push({ index: `${chapter}.${section}.${subsection}`, level: 3, title: firstValue || "Subsecao" });
    }
  }

  return entries;
}

export function createAssetLookup(uploadedTemplate?: UploadedTemplate) {
  const lookup = new Map<string, string>();
  for (const file of uploadedTemplate?.project.files ?? []) {
    if (file.kind !== "image" || !file.objectUrl) {
      continue;
    }
    lookup.set(file.path, file.objectUrl);
    lookup.set(file.name, file.objectUrl);
    lookup.set(getBaseName(file.path), file.objectUrl);
  }
  return lookup;
}

export function getBaseName(value: string) {
  return value.replace(/\\/g, "/").split("/").at(-1) ?? value;
}

export function looksLikeTable(values: string[]) {
  return values.some((value) => value.includes("&") || value.includes("\\\\") || value.includes("|"));
}

function estimateBlockWeight(block: BlockInstance, definition?: BlockDefinition) {
  const variableName = definition?.variableName ?? block.variableName;
  const textLength = Object.values(block.data).join(" ").length;

  if (block.type === "custom-cover") return PAGE_CAPACITY;
  if (block.type === "final-image") return PAGE_CAPACITY;
  if (block.type === "attached-image") return 46;
  if (block.type === "raw-latex") return Math.min(45, 14 + Math.ceil(textLength / 180));
  if (variableName === "chapter" || variableName === "specialchapter") return 24 + Math.ceil(textLength / 220);
  if (variableName === "section") return 14;
  if (variableName === "subsection" || variableName === "subsubsection") return 10;
  if (variableName === "tableofcontents") return 46;
  if (variableName === "newpage") return 0;
  return Math.max(8, Math.ceil(textLength / 140));
}
