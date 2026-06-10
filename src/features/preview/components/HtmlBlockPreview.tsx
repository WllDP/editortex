import { useEffect, useMemo, useRef, useState } from "react";
import { HtmlPreviewBlock } from "@/features/preview/components/HtmlPreviewBlock";
import { HtmlPreviewPage } from "@/features/preview/components/HtmlPreviewPage";
import {
  createAssetLookup,
  createDefinitionsById,
  createTocEntries,
  paginateBlocks,
} from "@/features/preview/components/htmlPreviewModel";
import { usePreviewScale } from "@/features/preview/hooks/usePreviewScale";
import { usePreviewSelection } from "@/features/preview/hooks/usePreviewSelection";
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
  const pages = useMemo(() => paginateBlocks(sortedBlocks, definitionsById), [definitionsById, sortedBlocks]);
  const tocEntries = useMemo(() => createTocEntries(sortedBlocks, definitionsById), [definitionsById, sortedBlocks]);
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
          <HtmlPreviewPage key={page.id} pageNumber={pageIndex + 1} overflowHint={page.overflowHint} scale={pageScale}>
            {page.blocks.map((block) => (
              <HtmlPreviewBlock
                key={block.id}
                assetsByName={assetsByName}
                block={block}
                definition={definitionsById[block.definitionId]}
                selected={block.id === highlightedBlockId}
                tocEntries={tocEntries}
                onSelectBlock={onSelectBlock}
                registerBlockRef={registerBlockRef(block.id)}
              />
            ))}
          </HtmlPreviewPage>
        ))}
      </div>
    </div>
  );
}
