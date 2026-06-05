import type { LatexEnvironment } from "@/types/latex";

const environmentRegex =
  /\\newenvironment\s*\{(?<name>[a-zA-Z*][\w*:-]*)\}\s*(?:\[(?<params>\d+)])?\s*\{(?<begin>(?:[^{}]|\{[^{}]*\})*)\}\s*\{(?<end>(?:[^{}]|\{[^{}]*\})*)\}/g;

export function parseLatexEnvironments(preamble: string): LatexEnvironment[] {
  const environments: LatexEnvironment[] = [];

  for (const match of preamble.matchAll(environmentRegex)) {
    const groups = match.groups;
    if (!groups?.name) {
      continue;
    }

    environments.push({
      name: groups.name,
      parameterCount: Number(groups.params ?? 0),
      beginDefinition: groups.begin ?? "",
      endDefinition: groups.end ?? "",
      rawDefinition: match[0],
    });
  }

  return environments;
}
