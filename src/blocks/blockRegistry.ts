import type { BlockDefinition, BlockRegistry } from "@/types/blocks";
import type { ParsedLatexTemplate } from "@/types/latex";
import { createBlockDefinitionFromVariable } from "@/blocks/dynamicBlockFactory";
import { systemBlockDefinitions } from "@/blocks/systemBlockDefinitions";

export function createBlockRegistry(template?: ParsedLatexTemplate): BlockRegistry {
  if (!template) {
    return { definitions: [], byId: {} };
  }

  const definitions = [
    ...systemBlockDefinitions,
    ...template.variables
      .filter((variable) => !systemBlockDefinitions.some((definition) => definition.variableName === variable.name))
      .map((variable) =>
        createBlockDefinitionFromVariable(
          variable,
          template.commands.find((command) => command.name === variable.sourceCommand),
        ),
      ),
  ];

  return {
    definitions,
    byId: indexDefinitions(definitions),
  };
}

function indexDefinitions(definitions: BlockDefinition[]) {
  return definitions.reduce<Record<string, BlockDefinition>>((index, definition) => {
    index[definition.id] = definition;
    return index;
  }, {});
}
