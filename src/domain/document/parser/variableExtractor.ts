import type { LatexCommand, LatexVariable } from "@/types/latex";

const ignoredCommands = new Set(["documentclass", "usepackage", "begin", "end", "label", "ref", "cite"]);

export function extractVariablesFromCommands(commands: LatexCommand[]): LatexVariable[] {
  return commands
    .filter((command) => !ignoredCommands.has(command.name))
    .map((command) => ({
      name: command.name,
      sourceCommand: command.name,
      parameterCount: Math.max(command.parameterCount, inferParameterCount(command.body)),
    }));
}

function inferParameterCount(body: string): number {
  const matches = Array.from(body.matchAll(/#(?<index>\d+)/g));
  return matches.reduce((highest, match) => {
    const index = Number(match.groups?.index ?? 0);
    return Math.max(highest, index);
  }, 0);
}
