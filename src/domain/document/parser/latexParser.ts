import type { ParsedLatexTemplate } from "@/types/latex";
import { parseLatexCommands } from "@/domain/document/parser/commandParser";
import { parseLatexEnvironments } from "@/domain/document/parser/environmentParser";
import { splitPreambleAndBody, normalizeLatexSource } from "@/domain/document/parser/templateNormalizer";
import { extractVariablesFromCommands } from "@/domain/document/parser/variableExtractor";

export function parseLatexTemplate(content: string, name = "Template LaTeX"): ParsedLatexTemplate {
  const rawContent = normalizeLatexSource(content);
  const { preamble, body } = splitPreambleAndBody(rawContent);
  const commands = parseLatexCommands(preamble);
  const environments = parseLatexEnvironments(preamble);

  return {
    id: crypto.randomUUID(),
    name,
    rawContent,
    preamble,
    body,
    commands,
    variables: extractVariablesFromCommands(commands),
    environments,
    parsedAt: new Date().toISOString(),
  };
}
