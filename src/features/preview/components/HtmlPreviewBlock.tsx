import type { ReactNode } from "react";
import type { BlockDefinition, BlockInstance } from "@/types/blocks";
import { lexicalTextDataKey } from "@/types/editor";
import {
  findAssetUrl,
  getBaseName,
  looksLikeTable,
  type TocEntry,
} from "@/features/preview/components/htmlPreviewModel";
import { LexicalRichTextPreview } from "@/features/preview/components/LexicalRichTextPreview";
import type { LatexPreviewLayout } from "@/features/preview/lib/latexPreviewLayout";
import { cn } from "@/utils/cn";

interface HtmlPreviewBlockProps {
  assetsByName: Map<string, string>;
  block: BlockInstance;
  definition?: BlockDefinition;
  headingNumber?: string;
  previewLayout: LatexPreviewLayout;
  selectBlockId?: string;
  selected: boolean;
  tocEntries: TocEntry[];
  onSelectBlock?: (blockId: string) => void;
  registerBlockRef?: (node: HTMLElement | null) => void;
}

export function HtmlPreviewBlock({
  assetsByName,
  block,
  definition,
  headingNumber,
  previewLayout,
  selectBlockId,
  selected,
  tocEntries,
  onSelectBlock,
  registerBlockRef,
}: HtmlPreviewBlockProps) {
  const variableName = definition?.variableName ?? block.variableName;
  const isFullBleed = isFullBleedPreviewBlock(block, variableName);

  if (variableName === "newpage") {
    return (
      <div
        ref={registerBlockRef}
        className={cn(
          "my-8 border-t border-dashed border-zinc-300 pt-2 text-center text-[11px] text-zinc-400 transition-colors duration-300",
          selected && "bg-[#DBEAFE]/75",
        )}
        onClick={() => onSelectBlock?.(selectBlockId ?? block.id)}
      >
        Quebra de pagina
      </div>
    );
  }

  return (
    <section
      ref={registerBlockRef}
      className={cn(
        "group relative transition-colors duration-300",
        isFullBleed ? "-mx-[84px] -my-[74px] h-[1123px] overflow-hidden" : "-mx-3 rounded-md px-3 py-1",
        selected && !isFullBleed && "bg-[#DBEAFE]/75",
        !selected && !isFullBleed && "hover:bg-[#E0F2FE]",
        selected && isFullBleed && "ring-2 ring-[#60A5FA]/70 ring-inset",
      )}
      onClick={() => onSelectBlock?.(selectBlockId ?? block.id)}
    >
      {renderBlockContent(block, definition, assetsByName, tocEntries, previewLayout, headingNumber)}
    </section>
  );
}

function renderBlockContent(
  block: BlockInstance,
  definition: BlockDefinition | undefined,
  assetsByName: Map<string, string>,
  tocEntries: TocEntry[],
  previewLayout: LatexPreviewLayout,
  headingNumber?: string,
) {
  const variableName = definition?.variableName ?? block.variableName;

  if (block.type === "custom-cover") {
    return <CoverPreview assetsByName={assetsByName} block={block} previewLayout={previewLayout} />;
  }

  if (block.type === "plain-text") {
    if (block.data[lexicalTextDataKey]?.trim()) {
      return (
        <LexicalRichTextPreview
          lexicalJson={block.data[lexicalTextDataKey]}
          fallback={<ParagraphPreview>{block.data.text}</ParagraphPreview>}
        />
      );
    }

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

  if (variableName === "specialchapter") {
    return (
      <SpecialChapterPreview
        assetsByName={assetsByName}
        previewLayout={previewLayout}
        text={rest.join("\n\n")}
        title={primary || definition?.name || "Capitulo"}
      />
    );
  }

  if (variableName === "chapter" || variableName === "specialchapter") {
    const chapterIcon = findAssetUrl(assetsByName, previewLayout.chapterTitleIconImage);
    return (
      <div className="mb-7 mt-4">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Capitulo</p>
        <h1 className="flex items-center gap-3 pb-3 text-[28px] font-normal leading-tight text-zinc-950">
          {chapterIcon ? <img className="h-[0.9em] w-auto object-contain" src={chapterIcon} alt="" /> : null}
          {primary || definition?.name || "Capitulo"}
        </h1>
        {rest.length ? <ParagraphPreview className="mt-5">{rest.join("\n\n")}</ParagraphPreview> : null}
      </div>
    );
  }

  if (variableName === "section") {
    return (
      <h2 className="mb-5 mt-8 flex items-baseline gap-[1em] pl-[1.5em] text-[21px] font-normal leading-tight text-red-600">
        {headingNumber ? <span className="tabular-nums">{headingNumber}</span> : null}
        <span>{primary || "Secao"}</span>
      </h2>
    );
  }

  if (variableName === "subsection") {
    return (
      <h3 className="mb-4 mt-6 flex items-baseline gap-[1em] pl-[4em] text-[17px] font-normal leading-tight text-red-600">
        {headingNumber ? <span className="tabular-nums">{headingNumber}</span> : null}
        <span>{primary || definition?.name || "Subsecao"}</span>
      </h3>
    );
  }

  if (variableName === "subsubsection") {
    return (
      <h4 className="mb-3 mt-5 flex items-baseline gap-[1em] pl-[6em] text-[15px] font-normal leading-tight text-red-600">
        {headingNumber ? <span className="tabular-nums">{headingNumber}</span> : null}
        <span>{primary || definition?.name || "Subsecao"}</span>
      </h4>
    );
  }

  if (variableName === "tableofcontents") {
    return (
      <TableOfContentsPreview
        entries={tocEntries}
        titleIconUrl={findAssetUrl(assetsByName, previewLayout.chapterTitleIconImage)}
      />
    );
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

function CoverPreview({
  assetsByName,
  block,
  previewLayout,
}: {
  assetsByName: Map<string, string>;
  block: BlockInstance;
  previewLayout: LatexPreviewLayout;
}) {
  const header = findAssetUrl(assetsByName, previewLayout.coverHeaderImage);
  const logo = findAssetUrl(assetsByName, previewLayout.coverLogoImage);

  return (
    <div className="relative h-full overflow-hidden bg-white">
      {header ? (
        <img
          className="absolute left-1/2 top-[38px] h-auto w-[715px] -translate-x-1/2 object-contain"
          src={header}
          alt=""
        />
      ) : null}
      <div className="absolute left-[113px] top-[378px] z-[2]">
        <h1 className="max-w-[520px] text-[32px] font-bold leading-[1.16] text-zinc-950">
          {block.data.title || "Titulo principal"}
        </h1>
        {block.data.subtitle ? (
          <p className="mt-[22px] text-[19px] leading-[1.28] text-zinc-800">{block.data.subtitle}</p>
        ) : null}
      </div>
      {logo ? (
        <img className="absolute left-[548px] top-[362px] z-[2] h-[76px] w-auto object-contain" src={logo} alt="" />
      ) : null}
      <div className="absolute inset-x-0 bottom-0 z-[1] h-[113px] bg-black">
        <a
          className="absolute bottom-[38px] left-1/2 -translate-x-1/2 text-center text-[16px] leading-none text-white"
          href="https://www.testingcompany.com.br"
          onClick={(event) => event.preventDefault()}
        >
          www.testingcompany.com.br
        </a>
      </div>
    </div>
  );
}

function ImagePreview({ assetsByName, block }: { assetsByName: Map<string, string>; block: BlockInstance }) {
  const imageValue = block.data.image?.trim() ?? "";
  const imageUrl = findAssetUrl(assetsByName, imageValue, getBaseName(imageValue));

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
  const imageUrl = findAssetUrl(assetsByName, imageValue, getBaseName(imageValue));

  return (
    <div className="flex h-full items-center justify-center overflow-hidden bg-zinc-50">
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

function SpecialChapterPreview({
  assetsByName,
  previewLayout,
  text,
  title,
}: {
  assetsByName: Map<string, string>;
  previewLayout: LatexPreviewLayout;
  text: string;
  title: string;
}) {
  const chapterIcon = findAssetUrl(assetsByName, previewLayout.chapterTitleIconImage);

  return (
    <div className="relative h-full overflow-hidden">
      <div className="absolute left-[302px] top-[290px] z-[2] flex max-w-[390px] items-center gap-3 text-[32px] font-normal leading-tight text-zinc-950">
        <span>{title}</span>
        {chapterIcon ? <img className="h-[0.9em] w-auto object-contain" src={chapterIcon} alt="" /> : null}
      </div>
      {text ? (
        <div className="absolute right-0 top-[340px] z-[2] w-[492px] whitespace-pre-wrap bg-black p-[45px] text-justify text-[15px] leading-[1.55] text-white">
          {text}
        </div>
      ) : null}
    </div>
  );
}

function isFullBleedPreviewBlock(block: BlockInstance, variableName: string) {
  return block.type === "custom-cover" || block.type === "final-image" || variableName === "specialchapter";
}

function TableOfContentsPreview({ entries, titleIconUrl }: { entries: TocEntry[]; titleIconUrl?: string }) {
  return (
    <div className="my-8">
      <h2 className="mb-12 flex items-center gap-3 text-[24px] font-normal">
        {titleIconUrl ? <img className="h-[0.9em] w-auto object-contain" src={titleIconUrl} alt="" /> : null}
        <span>Sumario</span>
      </h2>
      {entries.length ? (
        <ol className="space-y-[11px] text-[12px] leading-none text-black">
          {entries.map((entry) => {
            const isChapter = entry.level === 1;
            return (
              <li
                key={`${entry.level}-${entry.title}-${entry.index}`}
                className={cn(
                  "grid grid-cols-[auto_auto_1fr_auto] items-baseline gap-x-2",
                  isChapter && "font-bold",
                  entry.level === 2 && "pl-[22px] font-normal",
                  entry.level >= 3 && "pl-[46px] font-normal",
                )}
              >
                <span className="min-w-[18px] tabular-nums">{entry.index}</span>
                <span>{entry.title}</span>
                {isChapter ? <span /> : <span className="mx-1 border-b border-dotted border-black/70" />}
                <span className={cn("min-w-[20px] text-right tabular-nums", isChapter && "font-bold")}>
                  {entry.pageNumber ?? ""}
                </span>
              </li>
            );
          })}
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
  if (typeof children === "string") {
    const paragraphs = splitPreviewParagraphs(children);
    return (
      <>
        {paragraphs.map((paragraph, index) => (
          <p
            key={`${paragraph.slice(0, 24)}-${index}`}
            className={cn("my-3 text-justify text-[13.5px] leading-[1.72] text-zinc-800", className)}
            style={{ textIndent: "1.5cm" }}
          >
            {renderInlineLatexPreview(paragraph)}
          </p>
        ))}
      </>
    );
  }

  return (
    <p
      className={cn("my-3 text-justify text-[13.5px] leading-[1.72] text-zinc-800", className)}
      style={{ textIndent: "1.5cm" }}
    >
      {children}
    </p>
  );
}

function splitPreviewParagraphs(value: string) {
  return value
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

function renderInlineLatexPreview(value: string): ReactNode {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  const commandRegex = /\\(textbf|textit|emph|underline)\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = commandRegex.exec(value)) !== null) {
    if (match.index > cursor) {
      nodes.push(value.slice(cursor, match.index));
    }

    const command = match[1];
    const parsed = readBalancedGroup(value, commandRegex.lastIndex - 1);
    if (!parsed) {
      nodes.push(match[0]);
      cursor = commandRegex.lastIndex;
      continue;
    }

    const content = renderInlineLatexPreview(parsed.value);
    const key = `${command}-${match.index}`;
    if (command === "textbf") {
      nodes.push(<strong key={key}>{content}</strong>);
    } else if (command === "textit" || command === "emph") {
      nodes.push(<em key={key}>{content}</em>);
    } else if (command === "underline") {
      nodes.push(<u key={key}>{content}</u>);
    }

    cursor = parsed.end;
    commandRegex.lastIndex = parsed.end;
  }

  if (cursor < value.length) {
    nodes.push(value.slice(cursor));
  }

  return nodes;
}

function readBalancedGroup(value: string, openBraceIndex: number) {
  let depth = 0;
  let groupValue = "";

  for (let index = openBraceIndex; index < value.length; index += 1) {
    const character = value[index];
    const previous = value[index - 1];

    if (character === "{" && previous !== "\\") {
      if (depth > 0) {
        groupValue += character;
      }
      depth += 1;
      continue;
    }

    if (character === "}" && previous !== "\\") {
      depth -= 1;
      if (depth === 0) {
        return { value: groupValue, end: index + 1 };
      }
      groupValue += character;
      continue;
    }

    if (depth > 0) {
      groupValue += character;
    }
  }

  return undefined;
}
