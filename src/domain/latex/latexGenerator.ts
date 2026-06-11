import type { BlockDefinition, BlockInstance } from "@/types/blocks";
import type { DocumentModel } from "@/types/document";
import type { ParsedLatexTemplate } from "@/types/latex";
import { renderBlockToLatex } from "@/domain/latex/blockRenderer";
import { escapeLatex } from "@/domain/latex/escapeLatex";
import { assembleDocument } from "@/domain/latex/templateAssembler";

const MAX_RENDER_CACHE_SIZE = 1000;
const renderedBlockCache = new Map<string, string>();

interface GenerateLatexOptions {
  includeTrackingMarkers?: boolean;
}

export function generateLatexDocument(
  document: DocumentModel,
  definitions: BlockDefinition[],
  template?: ParsedLatexTemplate,
  options: GenerateLatexOptions = {},
): string {
  const includeTrackingMarkers = options.includeTrackingMarkers ?? true;
  const definitionsById = definitions.reduce<Record<string, BlockDefinition>>((index, definition) => {
    index[definition.id] = definition;
    return index;
  }, {});

  const sortedBlocks = [...document.blocks].sort((a, b) => a.order - b.order);
  const body = sortedBlocks
    .map((block: BlockInstance) =>
      includeTrackingMarkers
        ? renderTrackedBlockToLatexCached(block, definitionsById[block.definitionId])
        : renderBlockToLatex(block, definitionsById[block.definitionId]),
    )
    .join("\n\n");

  const coverOverrides = getCoverOverrides(sortedBlocks);
  return assembleDocument(template, body, coverOverrides);
}

function renderTrackedBlockToLatexCached(block: BlockInstance, definition?: BlockDefinition) {
  const cacheKey = createRenderCacheKey(block, definition);
  const cached = renderedBlockCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const rendered = renderTrackedBlockToLatex(block, definition);
  if (renderedBlockCache.size >= MAX_RENDER_CACHE_SIZE) {
    renderedBlockCache.clear();
  }
  renderedBlockCache.set(cacheKey, rendered);
  return rendered;
}

function renderTrackedBlockToLatex(block: BlockInstance, definition?: BlockDefinition) {
  const rendered = renderBlockToLatex(block, definition);
  const metadata = {
    definitionId: block.definitionId,
    type: block.type,
    variableName: block.variableName,
    ...(shouldTrackBlockData(block) ? { data: block.data } : {}),
    blockMetadata: createTrackableBlockMetadata(block.metadata),
  };

  return [`% editortex:block ${encodeURIComponent(JSON.stringify(metadata))}`, rendered, "% editortex:endblock"].join(
    "\n",
  );
}

function shouldTrackBlockData(block: BlockInstance) {
  return block.type === "custom-cover";
}

function createTrackableBlockMetadata(metadata: Record<string, unknown>) {
  const trackableMetadata: Record<string, unknown> = {};

  for (const key of ["placement", "width", "importedFrom"]) {
    if (metadata[key] !== undefined) {
      trackableMetadata[key] = metadata[key];
    }
  }

  return trackableMetadata;
}

function createRenderCacheKey(block: BlockInstance, definition?: BlockDefinition) {
  return stableStringify({
    block: {
      id: block.id,
      definitionId: block.definitionId,
      type: block.type,
      variableName: block.variableName,
      data: block.data,
      metadata: block.metadata,
    },
    definition: definition
      ? {
          id: definition.id,
          type: definition.type,
          variableName: definition.variableName,
          fields: definition.fields,
        }
      : undefined,
  });
}

function stableStringify(value: unknown): string {
  if (!value || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(",")}}`;
}

function getCoverOverrides(blocks: BlockInstance[]) {
  const coverBlock = blocks.find((block) => block.type === "custom-cover");
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
