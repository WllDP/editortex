import type { ParsedLatexTemplate } from "@/types/latex";
import { parseLatexCommands } from "@/parser/commandParser";
import { parseLatexEnvironments } from "@/parser/environmentParser";
import { splitPreambleAndBody, normalizeLatexSource } from "@/parser/templateNormalizer";
import { extractVariablesFromCommands } from "@/parser/variableExtractor";

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
