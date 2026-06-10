import type { ReactNode } from "react";
import type { BlockDefinition, BlockInstance } from "@/types/blocks";
import { getBaseName, looksLikeTable, type TocEntry } from "@/features/preview/components/htmlPreviewModel";
import { cn } from "@/utils/cn";

interface HtmlPreviewBlockProps {
  assetsByName: Map<string, string>;
  block: BlockInstance;
  definition?: BlockDefinition;
  selected: boolean;
  tocEntries: TocEntry[];
  onSelectBlock?: (blockId: string) => void;
  registerBlockRef?: (node: HTMLElement | null) => void;
}

export function HtmlPreviewBlock({
  assetsByName,
  block,
  definition,
  selected,
  tocEntries,
  onSelectBlock,
  registerBlockRef,
}: HtmlPreviewBlockProps) {
  const variableName = definition?.variableName ?? block.variableName;

  if (variableName === "newpage") {
    return (
      <div
        ref={registerBlockRef}
        className={cn(
          "my-8 border-t border-dashed border-zinc-300 pt-2 text-center text-[11px] text-zinc-400 transition-colors duration-300",
          selected && "bg-[#DBEAFE]/75",
        )}
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
        "group relative -mx-3 rounded-md px-3 py-1 transition-colors duration-300",
        selected ? "bg-[#DBEAFE]/75" : "hover:bg-[#E0F2FE]",
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
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Bloco LaTeX personalizado
        </p>
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded bg-zinc-950 p-3 text-[11px] leading-5 text-zinc-100">
          {block.data.rawLatex}
        </pre>
      </div>
    );
  }

  const values =
    definition?.fields.map((field) => block.data[field.id] ?? "").filter(Boolean) ?? Object.values(block.data);
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
    return (
      <h2 className="mb-4 mt-7 border-b border-zinc-300 pb-2 text-[21px] font-bold leading-tight">
        {primary || "Secao"}
      </h2>
    );
  }

  if (variableName === "subsection") {
    return (
      <h3 className="mb-3 mt-5 text-[17px] font-bold leading-tight">{primary || definition?.name || "Subsecao"}</h3>
    );
  }

  if (variableName === "subsubsection") {
    return (
      <h4 className="mb-2 mt-4 text-[15px] font-bold leading-tight">{primary || definition?.name || "Subsecao"}</h4>
    );
  }

  if (variableName === "tableofcontents") {
    return <TableOfContentsPreview entries={tocEntries} />;
  }

  if (looksLikeTable(values)) {
    return <TableLikePreview title={definition?.name} values={values} />;
  }

  return (
    <div className="my-4 rounded border-l-4 border-zinc-300 bg-zinc-50/70 px-4 py-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {definition?.name ?? block.type}
      </p>
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
          {block.data.subtitle ? (
            <p className="mt-4 text-[17px] leading-7 text-zinc-800">{block.data.subtitle}</p>
          ) : null}
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
      {block.data.title ? (
        <figcaption className="mb-2 text-[13px] font-semibold text-zinc-900">{block.data.title}</figcaption>
      ) : null}
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
      {block.data.subtitle ? (
        <figcaption className="mt-2 text-[11px] leading-5 text-zinc-500">{block.data.subtitle}</figcaption>
      ) : null}
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
            <li
              key={`${entry.level}-${entry.title}-${entry.index}`}
              className={cn("flex gap-3", entry.level > 1 && "pl-6 text-zinc-600")}
            >
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
  return (
    <p className={cn("my-3 whitespace-pre-wrap text-[13.5px] leading-[1.72] text-zinc-800", className)}>{children}</p>
  );
}
