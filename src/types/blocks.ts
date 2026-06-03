export type BlockFieldType = "text" | "textarea" | "number" | "select";

export interface BlockFieldDefinition {
  id: string;
  label: string;
  type: BlockFieldType;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  options?: string[];
}

export interface BlockDefinition {
  id: string;
  name: string;
  type: string;
  category: string;
  variableName: string;
  latexTemplate: string;
  fields: BlockFieldDefinition[];
  metadata: Record<string, unknown>;
}

export interface BlockInstance {
  id: string;
  definitionId: string;
  type: string;
  variableName: string;
  order: number;
  data: Record<string, string>;
  metadata: Record<string, unknown>;
}

export interface BlockRegistry {
  definitions: BlockDefinition[];
  byId: Record<string, BlockDefinition>;
}
