import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { BlockDefinition, BlockInstance } from "@/types/blocks";
import type { UploadedTemplate } from "@/types/latex";
import { cn } from "@/utils/cn";

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const PAGE_CAPACITY = 100;
const PREVIEW_PADDING_X = 48;
const MIN_PREVIEW_SCALE = 0.52;

interface HtmlBlockPreviewProps {
  blocks: BlockInstance[];
  definitions: BlockDefinition[];
  uploadedTemplate?: UploadedTemplate;
  selectedBlockId?: string;
  onSelectBlock?: (blockId: string) => void;
}

interface PreviewPage {
  id: string;
  blocks: BlockInstance[];
  overflowHint?: boolean;
}

export function HtmlBlockPreview({
  blocks,
  definitions,
  uploadedTemplate,
  selectedBlockId,
  onSelectBlock,
}: HtmlBlockPreviewProps) {
  const sortedBlocks = [...blocks].sort((a, b) => a.order - b.order);
  const hasPreviewContent = sortedBlocks.length > 0;
  const definitionsById = Object.fromEntries(definitions.map((definition) => [definition.id, definition]));
  const assetsByName = createAssetLookup(uploadedTemplate);
  const pages = paginateBlocks(sortedBlocks, definitionsById);
  const tocEntries = createTocEntries(sortedBlocks, definitionsById);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const blockRefs = useRef(new Map<string, HTMLElement>());
  const [viewportWidth, setViewportWidth] = useState(0);
  const pageScale = useMemo(() => {
    if (!viewportWidth) {
      return 1;
    }

    const availableWidth = Math.max(viewportWidth - PREVIEW_PADDING_X, 0);
    return Math.min(1, Math.max(MIN_PREVIEW_SCALE, availableWidth / PAGE_WIDTH));
  }, [viewportWidth]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const updateWidth = () => setViewportWidth(viewport.clientWidth);
    updateWidth();
    const animationFrameId = window.requestAnimationFrame(updateWidth);

    const observer = new ResizeObserver(updateWidth);
    observer.observe(viewport);
    return () => {
      window.cancelAnimationFrame(animationFrameId);
      observer.disconnect();
    };
  }, [hasPreviewContent]);

  useEffect(() => {
    if (!selectedBlockId) {
      return;
    }

    const viewport = viewportRef.current;
    const selectedElement = blockRefs.current.get(selectedBlockId);
    if (!viewport || !selectedElement) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const elementRect = selectedElement.getBoundingClientRect();
    const nextTop =
      viewport.scrollTop + (elementRect.top - viewportRect.top) - viewport.clientHeight / 2 + elementRect.height / 2;

    viewport.scrollTo({
      top: Math.max(nextTop, 0),
      behavior: "smooth",
    });
  }, [selectedBlockId, pageScale]);

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
      className="h-full overflow-auto bg-transparent bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:36px_36px] p-6"
    >
      <div className="mx-auto flex w-max flex-col gap-6">
        {pages.map((page, pageIndex) => (
          <PagePreview key={page.id} pageNumber={pageIndex + 1} overflowHint={page.overflowHint} scale={pageScale}>
            {page.blocks.map((block) => (
              <BlockPreview
                key={block.id}
                assetsByName={assetsByName}
                block={block}
                definition={definitionsById[block.definitionId]}
                selected={block.id === selectedBlockId}
                tocEntries={tocEntries}
                onSelectBlock={onSelectBlock}
                registerBlockRef={(node) => {
                  if (node) {
                    blockRefs.current.set(block.id, node);
                  } else {
                    blockRefs.current.delete(block.id);
                  }
                }}
              />
            ))}
          </PagePreview>
        ))}
      </div>
    </div>
  );
}

function PagePreview({
  children,
  overflowHint,
  pageNumber,
  scale,
}: {
  children: ReactNode;
  overflowHint?: boolean;
  pageNumber: number;
  scale: number;
}) {
  return (
    <div
      style={{
        width: PAGE_WIDTH * scale,
        height: PAGE_HEIGHT * scale,
      }}
    >
      <section
        className="relative origin-top-left overflow-hidden border border-white/25 bg-white text-zinc-950 shadow-[0_28px_90px_rgba(0,0,0,0.46)]"
        style={{
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT,
          fontFamily: "Montserrat, Arial, sans-serif",
          transform: `scale(${scale})`,
        }}
      >
        <div className="h-full px-[84px] pb-[80px] pt-[74px]">{children}</div>
        <div className="absolute bottom-6 right-10 text-[10px] text-zinc-400">{pageNumber}</div>
        {overflowHint ? (
          <div className="absolute bottom-0 left-0 right-0 bg-amber-100 px-8 py-1 text-center text-[11px] font-medium text-amber-900">
            Conteudo estimado acima da altura da pagina. Confira no PDF fiel.
          </div>
        ) : null}
      </section>
    </div>
  );
}

function BlockPreview({
  assetsByName,
  block,
  definition,
  selected,
  tocEntries,
  onSelectBlock,
  registerBlockRef,
}: {
  assetsByName: Map<string, string>;
  block: BlockInstance;
  definition?: BlockDefinition;
  selected: boolean;
  tocEntries: TocEntry[];
  onSelectBlock?: (blockId: string) => void;
  registerBlockRef?: (node: HTMLElement | null) => void;
}) {
  const variableName = definition?.variableName ?? block.variableName;

  if (variableName === "newpage") {
    return (
      <div
        ref={registerBlockRef}
        className={cn("my-8 border-t border-dashed border-zinc-300 pt-2 text-center text-[11px] text-zinc-400", selected && "bg-primary/10")}
        onClick={() => onSelectBlock?.(block.id)}
      >
        Quebra de pagina
      </div>
    );
  }

  return (
    <section
      ref={registerBlockRef}
      className={cn(
        "group relative -mx-3 rounded-md px-3 py-1 transition",
        selected ? "bg-[#DBEAFE] ring-[3px] ring-[#2563EB]" : "hover:bg-[#E0F2FE]",
      )}
      onClick={() => onSelectBlock?.(block.id)}
    >
      {renderBlockContent(block, definition, assetsByName, tocEntries)}
    </section>
  );
}

function renderBlockContent(
  block: BlockInstance,
  definition: BlockDefinition | undefined,
  assetsByName: Map<string, string>,
  tocEntries: TocEntry[],
) {
  const variableName = definition?.variableName ?? block.variableName;

  if (block.type === "custom-cover") {
    return <CoverPreview assetsByName={assetsByName} block={block} />;
  }

  if (block.type === "plain-text") {
    return <ParagraphPreview>{block.data.text}</ParagraphPreview>;
  }

  if (block.type === "attached-image") {
    return <ImagePreview assetsByName={assetsByName} block={block} />;
  }

  if (block.type === "final-image") {
    return <FinalImagePreview assetsByName={assetsByName} block={block} />;
  }

  if (block.type === "raw-latex") {
    return (
      <div className="my-4 rounded border border-zinc-200 bg-zinc-50 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Bloco LaTeX personalizado</p>
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded bg-zinc-950 p-3 text-[11px] leading-5 text-zinc-100">
          {block.data.rawLatex}
        </pre>
      </div>
    );
  }

  const values = definition?.fields.map((field) => block.data[field.id] ?? "").filter(Boolean) ?? Object.values(block.data);
  const [primary, ...rest] = values;

  if (variableName === "chapter" || variableName === "specialchapter") {
    return (
      <div className="mb-7 mt-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Capitulo</p>
        <h1 className="border-b-2 border-zinc-950 pb-3 text-[28px] font-bold leading-tight text-zinc-950">
          {primary || definition?.name || "Capitulo"}
        </h1>
        {rest.length ? <ParagraphPreview className="mt-5">{rest.join("\n\n")}</ParagraphPreview> : null}
      </div>
    );
  }

  if (variableName === "section") {
    return <h2 className="mb-4 mt-7 border-b border-zinc-300 pb-2 text-[21px] font-bold leading-tight">{primary || "Secao"}</h2>;
  }

  if (variableName === "subsection") {
    return <h3 className="mb-3 mt-5 text-[17px] font-bold leading-tight">{primary || definition?.name || "Subsecao"}</h3>;
  }

  if (variableName === "subsubsection") {
    return <h4 className="mb-2 mt-4 text-[15px] font-bold leading-tight">{primary || definition?.name || "Subsecao"}</h4>;
  }

  if (variableName === "tableofcontents") {
    return <TableOfContentsPreview entries={tocEntries} />;
  }

  if (looksLikeTable(values)) {
    return <TableLikePreview title={definition?.name} values={values} />;
  }

  return (
    <div className="my-4 rounded border-l-4 border-zinc-300 bg-zinc-50/70 px-4 py-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{definition?.name ?? block.type}</p>
      <ParagraphPreview>{values.join("\n\n")}</ParagraphPreview>
    </div>
  );
}

function CoverPreview({ assetsByName, block }: { assetsByName: Map<string, string>; block: BlockInstance }) {
  const background = assetsByName.get("fundo_titulo.png") ?? assetsByName.get("cabeca.png");
  const logo = assetsByName.get("icone.png");

  return (
    <div className="-mx-[84px] -mt-[74px] mb-8 flex min-h-[1123px] flex-col justify-between overflow-hidden">
      {background ? (
        <img className="absolute inset-x-0 top-0 h-full w-full object-cover" src={background} alt="" />
      ) : null}
      <div className="relative z-[1] px-[84px] pt-[82px]" />
      <div className="relative z-[1] grid grid-cols-[1fr_auto] items-center gap-8 px-[84px] pb-[420px]">
        <div>
          <h1 className="max-w-[520px] text-[30px] font-bold leading-tight text-zinc-950">
            {block.data.title || "Titulo principal"}
          </h1>
          {block.data.subtitle ? <p className="mt-4 text-[17px] leading-7 text-zinc-800">{block.data.subtitle}</p> : null}
        </div>
        {logo ? <img className="h-20 w-auto object-contain" src={logo} alt="" /> : null}
      </div>
    </div>
  );
}

function ImagePreview({ assetsByName, block }: { assetsByName: Map<string, string>; block: BlockInstance }) {
  const imageValue = block.data.image?.trim() ?? "";
  const imageUrl = assetsByName.get(imageValue) ?? assetsByName.get(getBaseName(imageValue));

  return (
    <figure className="my-5 text-center">
      {block.data.title ? <figcaption className="mb-2 text-[13px] font-semibold text-zinc-900">{block.data.title}</figcaption> : null}
      {imageUrl ? (
        <img
          className="mx-auto max-h-[470px] max-w-full object-contain"
          src={imageUrl}
          alt={block.data.title || imageValue}
        />
      ) : (
        <div className="flex h-52 items-center justify-center border border-dashed border-zinc-300 bg-zinc-50 text-[13px] text-zinc-500">
          Imagem nao encontrada: {imageValue || "sem arquivo"}
        </div>
      )}
      {block.data.subtitle ? <figcaption className="mt-2 text-[11px] leading-5 text-zinc-500">{block.data.subtitle}</figcaption> : null}
    </figure>
  );
}

function FinalImagePreview({ assetsByName, block }: { assetsByName: Map<string, string>; block: BlockInstance }) {
  const imageValue = block.data.image?.trim() ?? "";
  const imageUrl = assetsByName.get(imageValue) ?? assetsByName.get(getBaseName(imageValue));

  return (
    <div className="-mx-[84px] -my-[74px] flex h-[1123px] items-center justify-center overflow-hidden bg-zinc-50">
      {imageUrl ? (
        <img className="h-full w-full object-contain" src={imageUrl} alt={imageValue || "Imagem final"} />
      ) : (
        <div className="flex h-full w-full items-center justify-center border border-dashed border-zinc-300 text-[13px] text-zinc-500">
          Imagem nao encontrada: {imageValue || "sem arquivo"}
        </div>
      )}
    </div>
  );
}

function TableOfContentsPreview({ entries }: { entries: TocEntry[] }) {
  return (
    <div className="my-8">
      <h2 className="mb-5 border-b border-zinc-300 pb-2 text-[24px] font-bold">Sumario</h2>
      {entries.length ? (
        <ol className="space-y-2 text-[13px]">
          {entries.map((entry) => (
            <li key={`${entry.level}-${entry.title}-${entry.index}`} className={cn("flex gap-3", entry.level > 1 && "pl-6 text-zinc-600")}>
              <span className="min-w-6 text-zinc-400">{entry.index}</span>
              <span className="flex-1 border-b border-dotted border-zinc-300">{entry.title}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[13px] text-zinc-500">Sumario gerado no PDF fiel.</p>
      )}
    </div>
  );
}

function TableLikePreview({ title, values }: { title?: string; values: string[] }) {
  return (
    <div className="my-4 overflow-hidden rounded border border-zinc-300">
      {title ? <div className="bg-zinc-100 px-3 py-2 text-[12px] font-semibold">{title}</div> : null}
      <div className="divide-y divide-zinc-200 text-[12px]">
        {values.map((value, index) => (
          <div key={`${value}-${index}`} className="grid grid-cols-[110px_1fr]">
            <span className="bg-zinc-50 px-3 py-2 font-medium text-zinc-500">Campo {index + 1}</span>
            <span className="whitespace-pre-wrap px-3 py-2 leading-5">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ParagraphPreview({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("my-3 whitespace-pre-wrap text-[13.5px] leading-[1.72] text-zinc-800", className)}>{children}</p>;
}

interface TocEntry {
  index: string;
  level: number;
  title: string;
}

function paginateBlocks(blocks: BlockInstance[], definitionsById: Record<string, BlockDefinition>) {
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

    if (block.type === "custom-cover") {
      pushPage();
    }

    if (block.type === "final-image") {
      pushPage();
    }
  }

  pushPage(currentWeight > PAGE_CAPACITY);
  return pages;
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

function createTocEntries(blocks: BlockInstance[], definitionsById: Record<string, BlockDefinition>) {
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

function looksLikeTable(values: string[]) {
  return values.some((value) => value.includes("&") || value.includes("\\\\") || value.includes("|"));
}

function createAssetLookup(uploadedTemplate?: UploadedTemplate) {
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

function getBaseName(value: string) {
  return value.replace(/\\/g, "/").split("/").at(-1) ?? value;
}
