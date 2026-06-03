import type { LatexCommand } from "@/types/latex";

const commandRegex =
  /\\(?<kind>re)?newcommand\s*\{?\\(?<name>[a-zA-Z@][\w@]*)\}?\s*(?:\[(?<params>\d+)])?\s*\{(?<body>(?:[^{}]|\{[^{}]*\})*)\}/g;

export function parseLatexCommands(preamble: string): LatexCommand[] {
  const commands: LatexCommand[] = [];

  for (const match of preamble.matchAll(commandRegex)) {
    const groups = match.groups;
    if (!groups?.name) {
      continue;
    }

    const kind = groups.kind ? "renewcommand" : "newcommand";
    commands.push({
      name: groups.name,
      kind,
      parameterCount: Number(groups.params ?? 0),
      rawDefinition: match[0],
      body: groups.body ?? "",
    });
  }

  return commands;
}
