import type { ReactNode } from "react";
import type { SerializedLexicalEditorState, SerializedLexicalNode } from "@/types/editor";

const BOLD_FORMAT = 1;
const ITALIC_FORMAT = 2;
const UNDERLINE_FORMAT = 8;

export function LexicalRichTextPreview({ lexicalJson, fallback }: { lexicalJson: string; fallback?: ReactNode }) {
  const state = parseLexicalState(lexicalJson);
  if (!state?.root?.children?.length) {
    return fallback;
  }

  return <>{state.root.children.map((node, index) => renderNode(node, index))}</>;
}

function parseLexicalState(value: string): SerializedLexicalEditorState | undefined {
  try {
    return JSON.parse(value) as SerializedLexicalEditorState;
  } catch {
    return undefined;
  }
}

function renderNode(node: SerializedLexicalNode, index: number): ReactNode {
  if (node.type === "text") {
    return applyTextFormat(node.text ?? "", Number(node.format ?? 0), index);
  }

  if (node.type === "linebreak") {
    return <br key={index} />;
  }

  if (node.type === "link") {
    return (
      <a
        key={index}
        className="text-blue-700 underline underline-offset-2"
        href={node.url}
        onClick={(event) => event.preventDefault()}
      >
        {renderInlineChildren(node.children ?? [])}
      </a>
    );
  }

  if (node.type === "list") {
    return (
      <ul key={index} className="my-3 list-disc space-y-1 pl-6 text-[13.5px] leading-[1.72] text-zinc-800">
        {(node.children ?? []).map((child, childIndex) => renderNode(child, childIndex))}
      </ul>
    );
  }

  if (node.type === "listitem") {
    return <li key={index}>{renderInlineChildren(node.children ?? [])}</li>;
  }

  if (node.type === "paragraph") {
    return (
      <p key={index} className="my-3 whitespace-pre-wrap text-[13.5px] leading-[1.72] text-zinc-800">
        {renderInlineChildren(node.children ?? [])}
      </p>
    );
  }

  return <span key={index}>{renderInlineChildren(node.children ?? [])}</span>;
}

function renderInlineChildren(children: SerializedLexicalNode[]) {
  return children.map((child, index) => renderNode(child, index));
}

function applyTextFormat(value: string, format: number, key: number): ReactNode {
  let node: ReactNode = value;
  if (format & UNDERLINE_FORMAT) {
    node = <u>{node}</u>;
  }
  if (format & ITALIC_FORMAT) {
    node = <em>{node}</em>;
  }
  if (format & BOLD_FORMAT) {
    node = <strong>{node}</strong>;
  }
  return <span key={key}>{node}</span>;
}
