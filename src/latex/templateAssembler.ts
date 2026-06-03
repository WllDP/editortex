import type { ParsedLatexTemplate } from "@/types/latex";

const beginDocumentRegex = /\\begin\s*\{\s*document\s*\}/;
const endDocumentRegex = /\\end\s*\{\s*document\s*\}/;
const titleCommandRegex = /\\title\s*\{(?:[^{}]|\{[^{}]*\})*\}/;

interface DocumentCommandOverrides {
  title?: string;
  coverTitle?: string;
  coverSubtitle?: string;
}

export function assembleDocument(
  template: ParsedLatexTemplate | undefined,
  body: string,
  commandOverrides: DocumentCommandOverrides = {},
): string {
  if (!template) {
    const fallback = [
      "\\documentclass{article}",
      "\\usepackage[utf8]{inputenc}",
      commandOverrides.title ? `\\title{${commandOverrides.title}}` : "",
      "\\begin{document}",
      body,
      "\\end{document}",
    ];

    return fallback.filter(Boolean).join("\n");
  }

  const source = applyDocumentCommandOverrides(template.rawContent, commandOverrides);
  if (beginDocumentRegex.test(source) && endDocumentRegex.test(source)) {
    return source.replace(
      /\\begin\s*\{\s*document\s*\}[\s\S]*\\end\s*\{\s*document\s*\}/,
      `\\begin{document}\n${body}\n\\end{document}`,
    );
  }

  return [template.preamble, "\\begin{document}", body, "\\end{document}"].join("\n");
}

function applyDocumentCommandOverrides(source: string, commandOverrides: DocumentCommandOverrides) {
  let nextSource = source;

  if (commandOverrides.title) {
    const nextTitle = `\\title{${commandOverrides.title}}`;
    if (titleCommandRegex.test(nextSource)) {
      nextSource = nextSource.replace(titleCommandRegex, nextTitle);
    } else {
      nextSource = nextSource.replace(beginDocumentRegex, `${nextTitle}\n\\begin{document}`);
    }
  }

  if (commandOverrides.coverTitle) {
    nextSource = replaceCoverNodeText(nextSource, "TITULO PRINCIPAL", commandOverrides.coverTitle);
  }

  if (commandOverrides.coverSubtitle) {
    nextSource = replaceCoverNodeText(nextSource, "SUBTITULO", commandOverrides.coverSubtitle);
  }

  return nextSource;
}

function replaceCoverNodeText(source: string, normalizedComment: string, value: string) {
  const range = findCoverNodeTextRange(source, normalizedComment);
  if (!range) {
    return source;
  }

  return `${source.slice(0, range.start)}{${value}}${source.slice(range.end)}`;
}

function findCoverNodeTextRange(source: string, normalizedComment: string) {
  const lines = source.split(/\r?\n/);
  let offset = 0;

  for (const line of lines) {
    if (!normalizeLatexComment(line).includes(normalizedComment)) {
      offset += line.length + 1;
      continue;
    }

    const nodeTextRegex = /\bat\s*\([\s\S]*?\)\s*(\{(?:[^{}]|\{[^{}]*\})*\});/g;
    nodeTextRegex.lastIndex = offset + line.length;
    const match = nodeTextRegex.exec(source);
    if (!match) {
      return undefined;
    }
    const group = match[1];
    const groupStart = match.index + match[0].indexOf(group);

    return {
      start: groupStart,
      end: groupStart + group.length,
    };
  }

  return undefined;
}

function normalizeLatexComment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
