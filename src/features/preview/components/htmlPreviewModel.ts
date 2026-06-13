import type { BlockDefinition, BlockInstance } from "@/types/blocks";
import { lexicalTextDataKey } from "@/types/editor";
import type { UploadedTemplate } from "@/types/latex";

export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;
export const PAGE_CONTENT_PADDING_TOP = 74;
export const PAGE_FOOTER_IMAGE_HEIGHT = 74;
export const PAGE_FOOTER_SAFE_GAP = 8;
export const PAGE_CONTENT_PADDING_BOTTOM = PAGE_FOOTER_IMAGE_HEIGHT + PAGE_FOOTER_SAFE_GAP;
const PAGE_CAPACITY = PAGE_HEIGHT - PAGE_CONTENT_PADDING_TOP - PAGE_CONTENT_PADDING_BOTTOM;
const MIN_TEXT_CHUNK_CAPACITY = 96;
const TEXT_CHARS_PER_LINE = 72;
const TEXT_LINE_HEIGHT = 13.5 * 1.72;
const PARAGRAPH_VERTICAL_MARGIN = 24;
export const previewSourceBlockIdKey = "previewSourceBlockId";
export const previewSplitPartKey = "previewSplitPart";

export interface PreviewPage {
  id: string;
  blocks: BlockInstance[];
  overflowHint?: boolean;
}

export interface TocEntry {
  index: string;
  level: number;
  pageNumber?: number;
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

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex];
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

    const nextBlock = blocks[blockIndex + 1];
    if (isKeepWithNextHeading(variableName) && nextBlock && canSplitPlainTextBlock(nextBlock)) {
      const headingWeight = estimateBlockWeight(block, definition);
      const nextDefinition = definitionsById[nextBlock.definitionId];
      let remainingCapacity = PAGE_CAPACITY - currentWeight - headingWeight;

      if (currentBlocks.length && remainingCapacity < MIN_TEXT_CHUNK_CAPACITY) {
        pushPage();
        remainingCapacity = PAGE_CAPACITY - headingWeight;
      }

      const { chunk, rest } = takePlainTextChunk(nextBlock.data.text, remainingCapacity);
      const firstTextBlock = createPreviewTextBlock(nextBlock, chunk, 0);
      const firstTextWeight = estimateBlockWeight(firstTextBlock, nextDefinition);

      if (currentBlocks.length && currentWeight + headingWeight + firstTextWeight > PAGE_CAPACITY) {
        pushPage();
      }

      currentBlocks.push(block, firstTextBlock);
      currentWeight += headingWeight + firstTextWeight;

      if (rest.trim()) {
        pushPage(currentWeight > PAGE_CAPACITY);
        addRemainingPlainTextChunks(nextBlock, nextDefinition, rest, 1);
      }

      blockIndex += 1;
      continue;
    }

    if (canSplitPlainTextBlock(block)) {
      addRemainingPlainTextChunks(block, definition, block.data.text, 0);
      continue;
    }

    const weight = estimateBlockWeight(block, definition);
    if (currentBlocks.length && currentWeight + weight > PAGE_CAPACITY) {
      pushPage(currentWeight > PAGE_CAPACITY);
    }

    currentBlocks.push(block);
    currentWeight += weight;

    if (block.type === "custom-cover" || block.type === "final-image" || variableName === "specialchapter") {
      pushPage();
    }
  }

  pushPage(currentWeight > PAGE_CAPACITY);
  return pages;

  function addRemainingPlainTextChunks(
    block: BlockInstance,
    definition: BlockDefinition | undefined,
    text: string,
    initialSplitPart: number,
  ) {
    let remainingText = text;
    let splitPart = initialSplitPart;

    while (remainingText.trim()) {
      let remainingCapacity = currentBlocks.length ? PAGE_CAPACITY - currentWeight : PAGE_CAPACITY;
      if (remainingCapacity < MIN_TEXT_CHUNK_CAPACITY && currentBlocks.length) {
        pushPage();
        remainingCapacity = PAGE_CAPACITY;
      }

      const { chunk, rest } = takePlainTextChunk(remainingText, remainingCapacity);
      const previewBlock = createPreviewTextBlock(block, chunk, splitPart);
      const chunkWeight = estimateBlockWeight(previewBlock, definition);

      if (currentBlocks.length && currentWeight + chunkWeight > PAGE_CAPACITY) {
        pushPage();
      }

      currentBlocks.push(previewBlock);
      currentWeight += chunkWeight;
      remainingText = rest;
      splitPart += 1;

      if (remainingText.trim()) {
        pushPage(currentWeight > PAGE_CAPACITY);
      }
    }
  }
}

export function createTocEntries(blocks: BlockInstance[], definitionsById: Record<string, BlockDefinition>) {
  return createTocEntriesWithPages(blocks, definitionsById);
}

export function createHeadingNumberLookup(blocks: BlockInstance[], definitionsById: Record<string, BlockDefinition>) {
  let chapter = 0;
  let section = 0;
  let subsection = 0;
  let subsubsection = 0;
  const lookup = new Map<string, string>();

  for (const block of blocks) {
    const definition = definitionsById[block.definitionId];
    const variableName = definition?.variableName ?? block.variableName;

    if (variableName === "chapter" || variableName === "specialchapter") {
      chapter += 1;
      section = 0;
      subsection = 0;
      subsubsection = 0;
      lookup.set(block.id, String(chapter));
      continue;
    }

    if (variableName === "section") {
      section += 1;
      subsection = 0;
      subsubsection = 0;
      lookup.set(block.id, `${chapter}.${section}`);
      continue;
    }

    if (variableName === "subsection") {
      subsection += 1;
      subsubsection = 0;
      lookup.set(block.id, `${chapter}.${section}.${subsection}`);
      continue;
    }

    if (variableName === "subsubsection") {
      subsubsection += 1;
      lookup.set(block.id, `${chapter}.${section}.${subsection}.${subsubsection}`);
    }
  }

  return lookup;
}

export function createTocEntriesWithPages(
  blocks: BlockInstance[],
  definitionsById: Record<string, BlockDefinition>,
  pages: PreviewPage[] = paginateBlocks(blocks, definitionsById),
) {
  let chapter = 0;
  let section = 0;
  let subsection = 0;
  const entries: TocEntry[] = [];
  const pageByBlockId = createPageLookup(pages);

  for (const block of blocks) {
    const definition = definitionsById[block.definitionId];
    const variableName = definition?.variableName ?? block.variableName;
    const firstValue = definition?.fields.map((field) => block.data[field.id]).find(Boolean);

    if (variableName === "chapter" || variableName === "specialchapter") {
      chapter += 1;
      section = 0;
      subsection = 0;
      entries.push({
        index: String(chapter),
        level: 1,
        pageNumber: pageByBlockId.get(block.id),
        title: firstValue || definition?.name || "Capitulo",
      });
    } else if (variableName === "section") {
      section += 1;
      subsection = 0;
      entries.push({
        index: `${chapter}.${section}`,
        level: 2,
        pageNumber: pageByBlockId.get(block.id),
        title: firstValue || "Secao",
      });
    } else if (variableName === "subsection") {
      subsection += 1;
      entries.push({
        index: `${chapter}.${section}.${subsection}`,
        level: 3,
        pageNumber: pageByBlockId.get(block.id),
        title: firstValue || "Subsecao",
      });
    }
  }

  return entries;
}

function createPageLookup(pages: PreviewPage[]) {
  const lookup = new Map<string, number>();
  pages.forEach((page, pageIndex) => {
    page.blocks.forEach((block) => {
      const sourceBlockId = getPreviewSourceBlockId(block);
      if (!lookup.has(sourceBlockId)) {
        lookup.set(sourceBlockId, pageIndex + 1);
      }
      lookup.set(block.id, pageIndex + 1);
    });
  });
  return lookup;
}

export function getPreviewSourceBlockId(block: BlockInstance) {
  const sourceBlockId = block.metadata[previewSourceBlockIdKey];
  return typeof sourceBlockId === "string" ? sourceBlockId : block.id;
}

export function isPreviewSplitContinuation(block: BlockInstance) {
  return typeof block.metadata[previewSplitPartKey] === "number" && block.metadata[previewSplitPartKey] > 0;
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
    lookup.set(normalizeAssetLookupKey(file.path), file.objectUrl);
    lookup.set(normalizeAssetLookupKey(file.name), file.objectUrl);
    lookup.set(normalizeAssetLookupKey(getBaseName(file.path)), file.objectUrl);
    lookup.set(normalizeAssetLookupKey(stripKnownAssetExtension(file.path)), file.objectUrl);
    lookup.set(normalizeAssetLookupKey(stripKnownAssetExtension(file.name)), file.objectUrl);
    lookup.set(normalizeAssetLookupKey(stripKnownAssetExtension(getBaseName(file.path))), file.objectUrl);
  }
  return lookup;
}

export function getBaseName(value: string) {
  return value.replace(/\\/g, "/").split("/").at(-1) ?? value;
}

export function normalizeAssetLookupKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function findAssetUrl(lookup: Map<string, string>, ...names: Array<string | undefined>) {
  for (const name of names) {
    if (!name) continue;
    const asset =
      lookup.get(name) ??
      lookup.get(normalizeAssetLookupKey(name)) ??
      lookup.get(normalizeAssetLookupKey(stripKnownAssetExtension(name)));
    if (asset) {
      return asset;
    }
  }

  return undefined;
}

function stripKnownAssetExtension(value: string) {
  return value.replace(/\.(png|jpe?g|webp|svg|pdf)$/i, "");
}

export function looksLikeTable(values: string[]) {
  return values.some((value) => value.includes("&") || value.includes("\\\\") || value.includes("|"));
}

function estimateBlockWeight(block: BlockInstance, definition?: BlockDefinition) {
  const variableName = definition?.variableName ?? block.variableName;
  const textLength = Object.values(block.data).join(" ").length;

  if (block.type === "custom-cover") return PAGE_CAPACITY;
  if (block.type === "final-image") return PAGE_CAPACITY;
  if (block.type === "attached-image") return 552;
  if (block.type === "raw-latex") return Math.min(440, 136 + Math.ceil(textLength / 180) * TEXT_LINE_HEIGHT);
  if (variableName === "chapter" || variableName === "specialchapter")
    return 112 + Math.ceil(textLength / 220) * TEXT_LINE_HEIGHT;
  if (variableName === "section") return 78;
  if (variableName === "subsection") return 60;
  if (variableName === "subsubsection") return 50;
  if (variableName === "tableofcontents") return 450;
  if (variableName === "newpage") return 0;
  if (block.type === "plain-text") return estimatePlainTextWeight(block.data.text ?? "");
  return Math.max(78, Math.ceil(textLength / 140) * TEXT_LINE_HEIGHT);
}

function canSplitPlainTextBlock(block: BlockInstance) {
  return block.type === "plain-text" && Boolean(block.data.text?.trim()) && !block.data[lexicalTextDataKey]?.trim();
}

function isKeepWithNextHeading(variableName: string) {
  return variableName === "section" || variableName === "subsection" || variableName === "subsubsection";
}

function createPreviewTextBlock(block: BlockInstance, text: string, splitPart: number): BlockInstance {
  if (splitPart === 0) {
    return {
      ...block,
      data: { ...block.data, text },
      metadata: {
        ...block.metadata,
        [previewSourceBlockIdKey]: block.id,
        [previewSplitPartKey]: splitPart,
      },
    };
  }

  return {
    ...block,
    id: `${block.id}:preview-part-${splitPart}`,
    data: { ...block.data, text },
    metadata: {
      ...block.metadata,
      [previewSourceBlockIdKey]: block.id,
      [previewSplitPartKey]: splitPart,
    },
  };
}

function takePlainTextChunk(text: string, maxWeight: number) {
  const capacity = Math.max(maxWeight, MIN_TEXT_CHUNK_CAPACITY);
  const paragraphs = splitTextParagraphs(text);
  const accepted: string[] = [];
  const remaining: string[] = [];

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    const candidate = [...accepted, paragraph].join("\n\n");
    if (estimatePlainTextWeight(candidate) <= capacity) {
      accepted.push(paragraph);
      continue;
    }

    if (!accepted.length) {
      const split = splitParagraphByWeight(paragraph, capacity);
      accepted.push(split.chunk);
      if (split.rest.trim()) {
        remaining.push(split.rest);
      }
      remaining.push(...paragraphs.slice(index + 1));
      break;
    }

    remaining.push(...paragraphs.slice(index));
    break;
  }

  return {
    chunk: accepted.join("\n\n").trim(),
    rest: remaining.join("\n\n").trim(),
  };
}

function splitParagraphByWeight(paragraph: string, maxWeight: number) {
  const words = paragraph.trim().split(/\s+/).filter(Boolean);
  const accepted: string[] = [];

  for (let index = 0; index < words.length; index += 1) {
    const candidate = [...accepted, words[index]].join(" ");
    if (accepted.length && estimatePlainTextWeight(candidate) > maxWeight) {
      return {
        chunk: accepted.join(" "),
        rest: words.slice(index).join(" "),
      };
    }
    accepted.push(words[index]);
  }

  return { chunk: accepted.join(" "), rest: "" };
}

function estimatePlainTextWeight(text: string) {
  const paragraphs = splitTextParagraphs(text);
  if (!paragraphs.length) {
    return 0;
  }

  const lineCount = paragraphs.reduce(
    (total, paragraph) => total + Math.max(1, Math.ceil(paragraph.length / TEXT_CHARS_PER_LINE)),
    0,
  );

  return Math.max(78, Math.ceil(lineCount * TEXT_LINE_HEIGHT + paragraphs.length * PARAGRAPH_VERTICAL_MARGIN));
}

function splitTextParagraphs(text: string) {
  return text
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}
