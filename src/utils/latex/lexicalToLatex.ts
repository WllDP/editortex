import { escapeLatex } from "@/utils/latex/escapeLatex";
import type { SerializedLexicalEditorState, SerializedLexicalNode } from "@/types/editor";

const BOLD_FORMAT = 1;
const ITALIC_FORMAT = 2;
const UNDERLINE_FORMAT = 8;

export function lexicalJsonToLatex(lexicalJson: string | undefined, fallbackPlainText = "") {
  const state = parseLexicalState(lexicalJson);
  if (!state?.root) {
    return escapeLatex(fallbackPlainText);
  }

  const latex = renderChildren(state.root.children ?? [], "root").trim();
  return latex || escapeLatex(fallbackPlainText);
}

function parseLexicalState(value: string | undefined): SerializedLexicalEditorState | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(value) as SerializedLexicalEditorState;
  } catch {
    return undefined;
  }
}

function renderChildren(children: SerializedLexicalNode[], parentType: string) {
  return children
    .map((child) => renderNode(child))
    .filter((value) => value.length > 0)
    .join(parentType === "paragraph" || parentType === "link" ? "" : "\n\n");
}

function renderNode(node: SerializedLexicalNode): string {
  if (node.type === "text") {
    return applyTextFormat(escapeLatex(node.text ?? ""), Number(node.format ?? 0));
  }

  if (node.type === "linebreak") {
    return "\\\\";
  }

  if (node.type === "link") {
    const label = renderChildren(node.children ?? [], "link");
    const url = escapeLatex(node.url ?? "");
    return url ? `\\href{${url}}{${label}}` : label;
  }

  if (node.type === "list") {
    const environment = node.listType === "bullet" ? "itemize" : "itemize";
    const items = (node.children ?? []).map((child) => renderListItem(child)).filter(Boolean);
    return [`\\begin{${environment}}`, ...items, `\\end{${environment}}`].join("\n");
  }

  if (node.type === "listitem") {
    return renderListItem(node);
  }

  if (node.type === "paragraph") {
    return renderChildren(node.children ?? [], "paragraph");
  }

  return renderChildren(node.children ?? [], node.type ?? "unknown");
}

function renderListItem(node: SerializedLexicalNode) {
  const content = renderChildren(node.children ?? [], "paragraph").trim();
  return content ? `\\item ${content}` : "";
}

function applyTextFormat(value: string, format: number) {
  let nextValue = value;
  if (format & UNDERLINE_FORMAT) {
    nextValue = `\\underline{${nextValue}}`;
  }
  if (format & ITALIC_FORMAT) {
    nextValue = `\\textit{${nextValue}}`;
  }
  if (format & BOLD_FORMAT) {
    nextValue = `\\textbf{${nextValue}}`;
  }
  return nextValue;
}
