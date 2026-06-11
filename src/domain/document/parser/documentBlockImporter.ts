import type { BlockDefinition, BlockInstance } from "@/types/blocks";
import type { ParsedLatexTemplate } from "@/types/latex";
import { containsUnsafeLatexCommand } from "@/domain/latex/inlineLatex";

interface ParsedCommandUse {
  name: string;
  args: string[];
  start: number;
  end: number;
}

const rawEnvironmentNames = ["table", "center", "tabular"];

export function importTemplateBodyAsBlocks(
  template: ParsedLatexTemplate,
  definitions: BlockDefinition[],
): BlockInstance[] {
  const body = extractEditableBody(template.rawContent);
  const trackedBlocks = importTrackedBlocks(body, definitions);
  if (trackedBlocks.length > 0) {
    return trackedBlocks.map((block, order) => ({ ...block, order }));
  }

  const coverTitle = extractCoverTitle(template.rawContent);
  const definitionByCommand = definitions.reduce<Record<string, BlockDefinition>>((index, definition) => {
    index[definition.variableName] = definition;
    return index;
  }, {});

  const blocks: BlockInstance[] = [];
  let cursor = 0;

  while (cursor < body.length) {
    const nextToken = findNextToken(body, cursor, definitionByCommand);
    if (!nextToken) {
      appendTextSegments(blocks, body.slice(cursor));
      break;
    }

    appendTextSegments(blocks, body.slice(cursor, nextToken.start));

    if ("figureLatex" in nextToken) {
      appendAttachedImageBlock(blocks, nextToken.figureLatex);
    } else if ("rawLatex" in nextToken) {
      appendRawBlock(blocks, nextToken.rawLatex);
    } else if ("text" in nextToken) {
      appendPlainTextBlock(blocks, nextToken.text);
    } else {
      appendCommandBlock(blocks, nextToken, definitionByCommand[nextToken.name], coverTitle);
    }

    cursor = nextToken.end;
  }

  return blocks.map((block, order) => ({ ...block, order }));
}

function importTrackedBlocks(body: string, definitions: BlockDefinition[]) {
  const blocks: BlockInstance[] = [];
  const definitionById = definitions.reduce<Record<string, BlockDefinition>>((index, definition) => {
    index[definition.id] = definition;
    return index;
  }, {});
  const trackedBlockRegex = /% editortex:block (?<encodedMetadata>[^\n]+)\n(?<latex>[\s\S]*?)\n% editortex:endblock/g;

  for (const match of body.matchAll(trackedBlockRegex)) {
    const metadata = parseTrackedBlockMetadata(match.groups?.encodedMetadata);
    const definition = metadata?.definitionId ? definitionById[metadata.definitionId] : undefined;
    if (!metadata || !definition) {
      continue;
    }

    blocks.push(createBlockFromTrackedLatex(match.groups?.latex ?? "", metadata, definition, blocks.length));
  }

  return blocks;
}

function parseTrackedBlockMetadata(encodedMetadata: string | undefined) {
  if (!encodedMetadata) {
    return undefined;
  }

  try {
    return JSON.parse(decodeURIComponent(encodedMetadata)) as {
      definitionId: string;
      type: BlockInstance["type"];
      variableName: string;
      data?: Record<string, string>;
      blockMetadata?: Record<string, unknown>;
    };
  } catch {
    return undefined;
  }
}

function createBlockFromTrackedLatex(
  latex: string,
  metadata: {
    definitionId: string;
    type: BlockInstance["type"];
    variableName: string;
    data?: Record<string, string>;
    blockMetadata?: Record<string, unknown>;
  },
  definition: BlockDefinition,
  order: number,
): BlockInstance {
  const trimmedLatex = latex.trim();
  const parsedCommand =
    metadata.type === "custom-cover"
      ? { args: [extractFirstGroup(trimmedLatex, "title")], end: trimmedLatex.length }
      : parseCommandArguments(
          trimmedLatex,
          trimmedLatex.indexOf(`\\${metadata.variableName}`) + metadata.variableName.length + 1,
          definition.fields.length,
        );

  const data = metadata.data
    ? metadata.data
    : metadata.type === "plain-text"
      ? { text: trimmedLatex }
      : metadata.type === "raw-latex"
        ? { rawLatex: trimmedLatex }
        : metadata.type === "attached-image"
          ? {
              title: extractFirstGroup(trimmedLatex, "caption"),
              image: extractIncludeGraphicsPath(trimmedLatex),
              subtitle: extractFigureSubtitle(trimmedLatex),
            }
          : metadata.type === "custom-cover"
            ? createCoverData(parsedCommand?.args[0] ?? "")
            : definition.fields.reduce<Record<string, string>>((values, field, index) => {
                values[field.id] = parsedCommand?.args[index] ?? "";
                return values;
              }, {});

  return {
    id: crypto.randomUUID(),
    definitionId: metadata.definitionId,
    type: metadata.type,
    variableName: metadata.variableName,
    order,
    data,
    metadata: {
      ...metadata.blockMetadata,
      importedFrom: "editortex-block",
      ...(metadata.type === "attached-image"
        ? {
            placement: extractFigurePlacement(trimmedLatex),
            width: extractIncludeGraphicsWidth(trimmedLatex),
          }
        : {}),
    },
  };
}

function extractEditableBody(source: string) {
  const match = source.match(/\\begin\s*\{\s*document\s*\}([\s\S]*?)\\end\s*\{\s*document\s*\}/);
  return (match?.[1] ?? "").trim();
}

function findNextToken(
  body: string,
  from: number,
  definitionsByCommand: Record<string, BlockDefinition>,
):
  | ParsedCommandUse
  | { rawLatex: string; start: number; end: number }
  | { figureLatex: string; start: number; end: number }
  | { text: string; start: number; end: number }
  | undefined {
  const nextFigure = findNextFigureEnvironment(body, from);
  const nextList = findNextListEnvironment(body, from);
  const nextEnvironment = findNextRawEnvironment(body, from);
  const nextCoverCommand = findNextCoverCommand(body, from, definitionsByCommand);
  const nextCommand = findNextKnownCommand(body, from, definitionsByCommand);

  if (
    nextFigure &&
    (!nextCommand || nextFigure.start < nextCommand.start) &&
    (!nextCoverCommand || nextFigure.start < nextCoverCommand.start) &&
    (!nextEnvironment || nextFigure.start < nextEnvironment.start)
  ) {
    return nextFigure;
  }

  if (
    nextList &&
    (!nextCommand || nextList.start < nextCommand.start) &&
    (!nextCoverCommand || nextList.start < nextCoverCommand.start) &&
    (!nextEnvironment || nextList.start < nextEnvironment.start)
  ) {
    return nextList;
  }

  if (
    nextEnvironment &&
    (!nextCommand || nextEnvironment.start < nextCommand.start) &&
    (!nextCoverCommand || nextEnvironment.start < nextCoverCommand.start)
  ) {
    return nextEnvironment;
  }

  if (nextCoverCommand && (!nextCommand || nextCoverCommand.start <= nextCommand.start)) {
    return nextCoverCommand;
  }

  return nextCommand;
}

function findNextCoverCommand(
  body: string,
  from: number,
  definitionsByCommand: Record<string, BlockDefinition>,
): ParsedCommandUse | undefined {
  const definition = definitionsByCommand.capaCustomizada;
  if (!definition) {
    return undefined;
  }

  const commandRegex = /\\(title|capaCustomizada)\b/g;
  commandRegex.lastIndex = from;

  let match: RegExpExecArray | null;
  while ((match = commandRegex.exec(body)) !== null) {
    const name = match[1];

    if (name === "capaCustomizada") {
      return {
        name: "capaCustomizada",
        args: [],
        start: match.index,
        end: match.index + match[0].length,
      };
    }

    const parsedTitle = parseCommandArguments(body, match.index + match[0].length, 1);
    if (!parsedTitle) {
      continue;
    }

    const afterTitle = skipWhitespace(body, parsedTitle.end);
    const coverMatch = body.slice(afterTitle).match(/^\\capaCustomizada\b/);
    if (!coverMatch) {
      continue;
    }

    return {
      name: "capaCustomizada",
      args: [parsedTitle.args[0] ?? ""],
      start: match.index,
      end: afterTitle + coverMatch[0].length,
    };
  }

  return undefined;
}

function findNextFigureEnvironment(body: string, from: number) {
  const beginRegex = /\\begin\s*\{\s*figure\s*\}(?:\[[^\]]*])?/g;
  beginRegex.lastIndex = from;

  const match = beginRegex.exec(body);
  if (!match) {
    return undefined;
  }

  const endRegex = /\\end\s*\{\s*figure\s*\}/g;
  endRegex.lastIndex = beginRegex.lastIndex;
  const endMatch = endRegex.exec(body);
  const end = endMatch ? endMatch.index + endMatch[0].length : beginRegex.lastIndex;

  return {
    figureLatex: body.slice(match.index, end).trim(),
    start: match.index,
    end,
  };
}

function findNextListEnvironment(body: string, from: number) {
  const beginRegex = /\\begin\s*\{\s*(itemize|enumerate)\s*\}(?:\[[^\]]*])?/g;
  beginRegex.lastIndex = from;

  const match = beginRegex.exec(body);
  if (!match) {
    return undefined;
  }

  const environment = match[1] ?? "";
  const end = findMatchingEnvironmentEnd(body, beginRegex.lastIndex, environment);
  const listLatex = body.slice(match.index, end).trim();
  const text = convertListEnvironmentToText(listLatex);

  if (!text || containsUnsafeLatexCommand(stripListCommands(listLatex))) {
    return {
      rawLatex: listLatex,
      start: match.index,
      end,
    };
  }

  return {
    text,
    start: match.index,
    end,
  };
}

function findNextRawEnvironment(body: string, from: number) {
  const beginRegex = /\\begin\s*\{\s*(figure|table|center|tabular)\s*\}/g;
  beginRegex.lastIndex = from;

  const match = beginRegex.exec(body);
  if (!match) {
    return undefined;
  }

  const environment = match[1];
  if (!rawEnvironmentNames.includes(environment)) {
    return undefined;
  }

  const endRegex = new RegExp(`\\\\end\\s*\\{\\s*${environment}\\s*\\}`, "g");
  endRegex.lastIndex = beginRegex.lastIndex;
  const endMatch = endRegex.exec(body);
  const end = endMatch ? endMatch.index + endMatch[0].length : beginRegex.lastIndex;

  return {
    rawLatex: body.slice(match.index, end).trim(),
    start: match.index,
    end,
  };
}

function findMatchingEnvironmentEnd(body: string, from: number, environment: string) {
  const environmentRegex = new RegExp(`\\\\(begin|end)\\s*\\{\\s*${environment}\\s*\\}`, "g");
  environmentRegex.lastIndex = from;
  let depth = 1;

  let match: RegExpExecArray | null;
  while ((match = environmentRegex.exec(body)) !== null) {
    depth += match[1] === "begin" ? 1 : -1;
    if (depth === 0) {
      return match.index + match[0].length;
    }
  }

  return from;
}

function convertListEnvironmentToText(listLatex: string) {
  const withoutBoundaries = listLatex
    .replace(/\\begin\s*\{\s*(itemize|enumerate)\s*\}(?:\[[^\]]*])?/g, "\n")
    .replace(/\\end\s*\{\s*(itemize|enumerate)\s*\}/g, "\n")
    .trim();

  const items = withoutBoundaries
    .split(/\\item(?:\[[^\]]*])?/)
    .map((item) => normalizeImportedListItem(item))
    .filter(Boolean);

  return items.map((item) => `- ${item}`).join("\n");
}

function normalizeImportedListItem(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

function stripListCommands(value: string) {
  return value
    .replace(/\\begin\s*\{\s*(itemize|enumerate)\s*\}(?:\[[^\]]*])?/g, "")
    .replace(/\\end\s*\{\s*(itemize|enumerate)\s*\}/g, "")
    .replace(/\\item(?:\[[^\]]*])?/g, "");
}

function findNextKnownCommand(
  body: string,
  from: number,
  definitionsByCommand: Record<string, BlockDefinition>,
): ParsedCommandUse | undefined {
  const commandRegex = /\\([a-zA-Z@][\w@]*)/g;
  commandRegex.lastIndex = from;

  let match: RegExpExecArray | null;
  while ((match = commandRegex.exec(body)) !== null) {
    const name = match[1];
    const definition = definitionsByCommand[name];
    if (!definition || definition.type === "plain-text" || definition.type === "raw-latex") {
      continue;
    }

    const parsed =
      definition.fields.length === 0 || definition.type === "custom-cover"
        ? (parseCommandArguments(body, match.index + match[0].length, definition.fields.length) ?? {
            args: [],
            end: match.index + match[0].length,
          })
        : parseCommandArguments(body, match.index + match[0].length, definition.fields.length);
    if (!parsed) {
      continue;
    }

    return {
      name,
      args: parsed.args,
      start: match.index,
      end: parsed.end,
    };
  }

  return undefined;
}

function parseCommandArguments(body: string, from: number, count: number) {
  const args: string[] = [];
  let cursor = from;

  for (let index = 0; index < count; index += 1) {
    cursor = skipWhitespace(body, cursor);
    if (body[cursor] !== "{") {
      return undefined;
    }

    const parsed = parseBalancedGroup(body, cursor);
    if (!parsed) {
      return undefined;
    }

    args.push(parsed.value);
    cursor = parsed.end;
  }

  return { args, end: cursor };
}

function parseBalancedGroup(body: string, from: number) {
  let depth = 0;
  let value = "";

  for (let index = from; index < body.length; index += 1) {
    const character = body[index];
    const previous = body[index - 1];

    if (character === "{" && previous !== "\\") {
      if (depth > 0) {
        value += character;
      }
      depth += 1;
      continue;
    }

    if (character === "}" && previous !== "\\") {
      depth -= 1;
      if (depth === 0) {
        return { value: value.trim(), end: index + 1 };
      }
      value += character;
      continue;
    }

    if (depth > 0) {
      value += character;
    }
  }

  return undefined;
}

function skipWhitespace(value: string, from: number) {
  let cursor = from;
  while (/\s/.test(value[cursor] ?? "")) {
    cursor += 1;
  }
  return cursor;
}

function appendCommandBlock(
  blocks: BlockInstance[],
  command: ParsedCommandUse,
  definition: BlockDefinition,
  coverTitle: string,
) {
  const data =
    definition.type === "custom-cover"
      ? createCoverData(command.args[0] ?? coverTitle)
      : definition.fields.reduce<Record<string, string>>((values, field, index) => {
          values[field.id] = command.args[index] ?? "";
          return values;
        }, {});

  blocks.push({
    id: crypto.randomUUID(),
    definitionId: definition.id,
    type: definition.type,
    variableName: definition.variableName,
    order: blocks.length,
    data,
    metadata: {
      importedFrom: "latex-command",
    },
  });
}

function appendTextSegments(blocks: BlockInstance[], value: string) {
  const cleaned = stripStandaloneComments(value);
  const segments = cleaned
    .split(/\n\s*\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const safeTextSegments: string[] = [];

  const flushSafeTextSegments = () => {
    if (safeTextSegments.length === 0) {
      return;
    }

    appendPlainTextBlock(blocks, safeTextSegments.join("\n\n"));
    safeTextSegments.length = 0;
  };

  for (const segment of segments) {
    if (isBlockPreparatoryCommand(segment)) {
      continue;
    }

    if (containsListEnvironment(segment)) {
      flushSafeTextSegments();
      const listText = convertListEnvironmentToText(segment);
      if (listText) {
        appendPlainTextBlock(blocks, listText);
      }
      continue;
    }

    if (containsUnsafeLatexCommand(segment)) {
      flushSafeTextSegments();
      appendRawBlock(blocks, segment);
    } else {
      safeTextSegments.push(segment);
    }
  }

  flushSafeTextSegments();
}

function containsListEnvironment(value: string) {
  return /\\begin\s*\{\s*(itemize|enumerate)\s*\}|\\end\s*\{\s*(itemize|enumerate)\s*\}|\\item(?:\[[^\]]*])?/.test(
    value,
  );
}

function appendPlainTextBlock(blocks: BlockInstance[], text: string) {
  blocks.push({
    id: crypto.randomUUID(),
    definitionId: "system:plain-text",
    type: "plain-text",
    variableName: "text",
    order: blocks.length,
    data: {
      text,
    },
    metadata: {
      importedFrom: "plain-text",
    },
  });
}

function appendRawBlock(blocks: BlockInstance[], rawLatex: string) {
  const normalized = rawLatex.trim();
  if (!normalized) {
    return;
  }

  blocks.push({
    id: crypto.randomUUID(),
    definitionId: "system:raw-latex",
    type: "raw-latex",
    variableName: "rawLatex",
    order: blocks.length,
    data: {
      rawLatex: normalized,
    },
    metadata: {
      importedFrom: "raw-latex",
    },
  });
}

function appendAttachedImageBlock(blocks: BlockInstance[], figureLatex: string) {
  const title = extractFirstGroup(figureLatex, "caption");
  const image = extractIncludeGraphicsPath(figureLatex);
  const subtitle = extractFigureSubtitle(figureLatex);

  blocks.push({
    id: crypto.randomUUID(),
    definitionId: "system:attached-image",
    type: "attached-image",
    variableName: "attachedImage",
    order: blocks.length,
    data: {
      title,
      image,
      subtitle,
    },
    metadata: {
      importedFrom: "figure",
    },
  });
}

function extractFirstGroup(source: string, commandName: string) {
  const index = source.search(new RegExp(`\\\\${commandName}\\s*\\{`));
  if (index === -1) {
    return "";
  }

  const openingBrace = source.indexOf("{", index);
  const parsed = parseBalancedGroup(source, openingBrace);
  return parsed?.value.trim() ?? "";
}

function extractDocumentTitle(source: string) {
  return extractFirstGroup(source, "title");
}

function extractCoverTitle(source: string) {
  const normalizedTitle = extractCoverNodeTextByNormalizedComment(source, "TITULO PRINCIPAL");
  const normalizedSubtitle = extractCoverNodeTextByNormalizedComment(source, "SUBTITULO");
  if (normalizedTitle || normalizedSubtitle) {
    return [normalizedTitle, normalizedSubtitle].filter(Boolean).join("\\\\");
  }

  const title = extractCoverNodeText(source, "T.*TULO PRINCIPAL");
  const subtitle = extractCoverNodeText(source, "SUBT.*TULO");

  if (title || subtitle) {
    return [title, subtitle].filter(Boolean).join("\\\\");
  }

  return extractDocumentTitle(source);
}

function extractCoverNodeText(source: string, commentPattern: string) {
  const match = source.match(
    new RegExp(`%\\s*${commentPattern}[\\s\\S]*?\\n\\s*\\{((?:[^{}]|\\{[^{}]*\\})*)\\};`, "i"),
  );

  return match?.[1]?.trim() ?? "";
}

function extractCoverNodeTextByNormalizedComment(source: string, normalizedComment: string) {
  const lines = source.split(/\r?\n/);
  let offset = 0;

  for (const line of lines) {
    if (!normalizeLatexComment(line).includes(normalizedComment)) {
      offset += line.length + 1;
      continue;
    }

    const nodeTextRegex = /\bat\s*\([\s\S]*?\)\s*\{((?:[^{}]|\{[^{}]*\})*)\};/g;
    nodeTextRegex.lastIndex = offset + line.length;
    const match = nodeTextRegex.exec(source);
    return match?.[1]?.trim() ?? "";
  }

  return "";
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

function createCoverData(rawTitle: string) {
  const [title, ...subtitleParts] = rawTitle
    .split(/\\\\/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    title: title ?? "",
    subtitle: subtitleParts.join("\n"),
  };
}

function extractIncludeGraphicsPath(source: string) {
  const match = source.match(/\\includegraphics(?:\[[^\]]*])?\s*\{([^}]+)\}/);
  return match?.[1]?.trim() ?? "";
}

function extractIncludeGraphicsWidth(source: string) {
  const match = source.match(/\\includegraphics\[([^\]]*)]/);
  return match?.[1]?.trim() ?? "width=0.7\\textwidth";
}

function extractFigurePlacement(source: string) {
  const match = source.match(/\\begin\s*\{\s*figure\s*\}\s*(\[[^\]]*])?/);
  return match?.[1] ?? "[H]";
}

function extractFigureSubtitle(source: string) {
  const withoutCommands = source
    .replace(/\\begin\s*\{\s*figure\s*\}(?:\[[^\]]*])?/g, "")
    .replace(/\\end\s*\{\s*figure\s*\}/g, "")
    .replace(/\\centering/g, "")
    .replace(/\\caption\s*\{(?:[^{}]|\{[^{}]*\})*\}/g, "")
    .replace(/\\includegraphics(?:\[[^\]]*])?\s*\{[^}]+\}/g, "")
    .trim();

  return withoutCommands
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function stripStandaloneComments(value: string) {
  return value
    .split("\n")
    .filter((line) => !line.trim().startsWith("%"))
    .join("\n");
}

function isBlockPreparatoryCommand(value: string) {
  return /^\\title\s*\{[\s\S]*\}$/.test(value.trim());
}
