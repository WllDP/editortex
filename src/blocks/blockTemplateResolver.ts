import type { BlockDefinition, BlockInstance } from "@/types/blocks";

export function resolveBlockCommand(definition: BlockDefinition, block: BlockInstance): string {
  const values = definition.fields.map((field) => block.data[field.id] ?? field.defaultValue ?? "");
  return `\\${definition.variableName}${values.map((value) => `{${value}}`).join("")}`;
}
