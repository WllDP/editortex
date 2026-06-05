import type { BlockDefinition, BlockFieldDefinition } from "@/types/blocks";
import type { LatexCommand, LatexVariable } from "@/types/latex";

export function createBlockDefinitionFromVariable(variable: LatexVariable, command?: LatexCommand): BlockDefinition {
  const fieldCount = Math.max(variable.parameterCount, 1);
  const fields: BlockFieldDefinition[] = Array.from({ length: fieldCount }, (_, index) => ({
    id: `arg${index + 1}`,
    label: fieldCount === 1 ? "Texto" : `ParÃ¢metro ${index + 1}`,
    type: "textarea",
    placeholder: "Digite o texto do bloco",
    required: index === 0,
    defaultValue: "",
  }));

  return {
    id: `command:${variable.name}`,
    name: variable.name,
    type: "latex-command",
    category: "MÃ³dulos de Texto",
    variableName: variable.name,
    latexTemplate: command?.rawDefinition ?? `\\${variable.name}{#1}`,
    fields,
    metadata: {
      sourceCommand: variable.sourceCommand,
      parameterCount: variable.parameterCount,
      commandBody: command?.body,
    },
  };
}
