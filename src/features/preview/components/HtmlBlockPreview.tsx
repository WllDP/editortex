import { useEffect, useMemo, useRef, useState } from "react";
import { HtmlPreviewBlock } from "@/features/preview/components/HtmlPreviewBlock";
import { HtmlPreviewPage } from "@/features/preview/components/HtmlPreviewPage";
import {
  createAssetLookup,
  createDefinitionsById,
  createHeadingNumberLookup,
  createTocEntriesWithPages,
  findAssetUrl,
  getPreviewSourceBlockId,
  isPreviewSplitContinuation,
  paginateBlocks,
} from "@/features/preview/components/htmlPreviewModel";
import { usePreviewScale } from "@/features/preview/hooks/usePreviewScale";
import { usePreviewSelection } from "@/features/preview/hooks/usePreviewSelection";
import { resolveLatexPreviewFontFamily } from "@/features/preview/lib/latexPreviewFont";
import { resolveLatexPreviewLayout } from "@/features/preview/lib/latexPreviewLayout";
import type { BlockDefinition, BlockInstance } from "@/types/blocks";
import type { UploadedTemplate } from "@/types/latex";

interface HtmlBlockPreviewProps {
  blocks: BlockInstance[];
  definitions: BlockDefinition[];
  uploadedTemplate?: UploadedTemplate;
  selectedBlockId?: string;
  onSelectBlock?: (blockId: string) => void;
}

export function HtmlBlockPreview({
  blocks,
  definitions,
  uploadedTemplate,
  selectedBlockId,
  onSelectBlock,
}: HtmlBlockPreviewProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [highlightedBlockId, setHighlightedBlockId] = useState<string>();
  const sortedBlocks = useMemo(() => [...blocks].sort((a, b) => a.order - b.order), [blocks]);
  const hasPreviewContent = sortedBlocks.length > 0;
  const definitionsById = useMemo(() => createDefinitionsById(definitions), [definitions]);
  const assetsByName = useMemo(() => createAssetLookup(uploadedTemplate), [uploadedTemplate]);
  const previewFontFamily = useMemo(() => resolveLatexPreviewFontFamily(uploadedTemplate), [uploadedTemplate]);
  const previewLayout = useMemo(() => resolveLatexPreviewLayout(uploadedTemplate), [uploadedTemplate]);
  const pages = useMemo(() => paginateBlocks(sortedBlocks, definitionsById), [definitionsById, sortedBlocks]);
  const headingNumberByBlockId = useMemo(
    () => createHeadingNumberLookup(sortedBlocks, definitionsById),
    [definitionsById, sortedBlocks],
  );
  const tocEntries = useMemo(
    () => createTocEntriesWithPages(sortedBlocks, definitionsById, pages),
    [definitionsById, pages, sortedBlocks],
  );
  const pageScale = usePreviewScale(viewportRef, hasPreviewContent);
  const registerBlockRef = usePreviewSelection(viewportRef, selectedBlockId, pageScale);

  useEffect(() => {
    if (!selectedBlockId) {
      setHighlightedBlockId(undefined);
      return;
    }

    setHighlightedBlockId(selectedBlockId);
    const timeoutId = window.setTimeout(() => {
      setHighlightedBlockId((current) => (current === selectedBlockId ? undefined : current));
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [selectedBlockId]);

  if (!hasPreviewContent) {
    return (
      <div className="flex h-full items-center justify-center overflow-hidden bg-transparent px-8 text-center text-sm font-medium text-[#94A3B8]">
        {uploadedTemplate
          ? "Adicione blocos ao documento para ver o preview visual."
          : "Importe um arquivo .tex ou .zip para visualizar o documento."}
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      className="stable-scroll h-full overflow-auto bg-transparent bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:36px_36px] p-6"
    >
      <div className="mx-auto flex w-max flex-col gap-6">
        {pages.map((page, pageIndex) => (
          <HtmlPreviewPage
            key={page.id}
            backgroundImageUrl={getPageBackgroundUrl(page.blocks, definitionsById, previewLayout, assetsByName)}
            backgroundMirrored={isPageBackgroundMirrored(page.blocks, definitionsById, previewLayout)}
            fontFamily={previewFontFamily}
            footerImageUrl={getPageFooterUrl(page.blocks, definitionsById, previewLayout, assetsByName)}
            pageNumber={pageIndex + 1}
            overflowHint={page.overflowHint}
            scale={pageScale}
          >
            {page.blocks.map((block) => {
              const sourceBlockId = getPreviewSourceBlockId(block);
              return (
                <HtmlPreviewBlock
                  key={block.id}
                  assetsByName={assetsByName}
                  block={block}
                  definition={definitionsById[block.definitionId]}
                  headingNumber={headingNumberByBlockId.get(sourceBlockId)}
                  previewLayout={previewLayout}
                  selectBlockId={sourceBlockId}
                  selected={sourceBlockId === highlightedBlockId}
                  tocEntries={tocEntries}
                  onSelectBlock={onSelectBlock}
                  registerBlockRef={isPreviewSplitContinuation(block) ? undefined : registerBlockRef(sourceBlockId)}
                />
              );
            })}
          </HtmlPreviewPage>
        ))}
      </div>
    </div>
  );
}

function getPageFooterUrl(
  blocks: BlockInstance[],
  definitionsById: Record<string, BlockDefinition>,
  previewLayout: ReturnType<typeof resolveLatexPreviewLayout>,
  assetsByName: Map<string, string>,
) {
  if (!previewLayout.pageFooterImage || pageDisablesFooter(blocks, definitionsById)) {
    return undefined;
  }

  return findAssetUrl(assetsByName, previewLayout.pageFooterImage);
}

function pageDisablesFooter(blocks: BlockInstance[], definitionsById: Record<string, BlockDefinition>) {
  return blocks.some((block) => {
    const variableName = getVariableName(block, definitionsById);
    return block.type === "custom-cover" || block.type === "final-image" || variableName === "specialchapter";
  });
}

function getPageBackgroundUrl(
  blocks: BlockInstance[],
  definitionsById: Record<string, BlockDefinition>,
  previewLayout: ReturnType<typeof resolveLatexPreviewLayout>,
  assetsByName: Map<string, string>,
) {
  if (!previewLayout.chapterBackgroundImage || !pageHasChapter(blocks, definitionsById)) {
    return undefined;
  }

  return findAssetUrl(assetsByName, previewLayout.chapterBackgroundImage);
}

function isPageBackgroundMirrored(
  blocks: BlockInstance[],
  definitionsById: Record<string, BlockDefinition>,
  previewLayout: ReturnType<typeof resolveLatexPreviewLayout>,
) {
  return (
    previewLayout.chapterBackgroundMirrored &&
    blocks.some((block) => getVariableName(block, definitionsById) === "specialchapter")
  );
}

function pageHasChapter(blocks: BlockInstance[], definitionsById: Record<string, BlockDefinition>) {
  return blocks.some((block) => {
    const variableName = getVariableName(block, definitionsById);
    return variableName === "chapter" || variableName === "specialchapter" || variableName === "tableofcontents";
  });
}

function getVariableName(block: BlockInstance, definitionsById: Record<string, BlockDefinition>) {
  return definitionsById[block.definitionId]?.variableName ?? block.variableName;
}
