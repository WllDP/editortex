import { escapeLatex } from "@/domain/latex/escapeLatex";

const inlineTextCommandSpecs: Record<string, number> = {
  textbf: 1,
  textit: 1,
  emph: 1,
  textsc: 1,
  texttt: 1,
  underline: 1,
  textsuperscript: 1,
  textsubscript: 1,
  mbox: 1,
  url: 1,
  href: 2,
  textcolor: 2,
  cite: 1,
  citep: 1,
  citet: 1,
  ref: 1,
  autoref: 1,
  nameref: 1,
  LaTeX: 0,
  TeX: 0,
};

export function containsUnsafeLatexCommand(value: string) {
  for (const match of value.matchAll(/\\([a-zA-Z@][\w@]*)/g)) {
    const commandName = match[1] ?? "";
    if (!(commandName in inlineTextCommandSpecs)) {
      return true;
    }
  }

  return false;
}

export function escapeLatexPreservingInlineCommands(value: string): string {
  return renderInlineLatex(value);
}

function renderInlineLatex(value: string): string {
  let output = "";
  let cursor = 0;
  const commandRegex = /\\([a-zA-Z@][\w@]*)/g;
  let match: RegExpExecArray | null;

  while ((match = commandRegex.exec(value)) !== null) {
    const commandName = match[1] ?? "";
    const argCount = inlineTextCommandSpecs[commandName];

    if (argCount === undefined) {
      continue;
    }

    output += escapeLatex(value.slice(cursor, match.index));

    if (argCount === 0) {
      output += `\\${commandName}`;
      cursor = match.index + match[0].length;
      continue;
    }

    let commandCursor = match.index + match[0].length;
    const args: string[] = [];
    let parseFailed = false;

    for (let index = 0; index < argCount; index += 1) {
      commandCursor = skipWhitespace(value, commandCursor);
      if (value[commandCursor] !== "{") {
        parseFailed = true;
        break;
      }

      const parsed = parseBalancedGroup(value, commandCursor);
      if (!parsed) {
        parseFailed = true;
        break;
      }

      args.push(parsed.value);
      commandCursor = parsed.end;
    }

    if (parseFailed) {
      output += escapeLatex(match[0]);
      cursor = match.index + match[0].length;
      continue;
    }

    output += `\\${commandName}${args.map((arg) => `{${renderInlineLatex(arg)}}`).join("")}`;
    cursor = commandCursor;
    commandRegex.lastIndex = commandCursor;
  }

  output += escapeLatex(value.slice(cursor));
  return output;
}

function parseBalancedGroup(value: string, from: number) {
  let depth = 0;
  let groupValue = "";

  for (let index = from; index < value.length; index += 1) {
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
        return { value: groupValue.trim(), end: index + 1 };
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

function skipWhitespace(value: string, from: number) {
  let cursor = from;
  while (/\s/.test(value[cursor] ?? "")) {
    cursor += 1;
  }
  return cursor;
}
