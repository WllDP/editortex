import type { BlockDefinition, BlockInstance } from "@/types/blocks";

export type EditorBlock = BlockInstance;

export type SuggestionStrength = "high" | "structural" | "generic" | "technical" | "final";

export interface BlockSuggestion {
  block: BlockDefinition;
  key: string;
  score: number;
  strength: SuggestionStrength;
  reason: string;
}

export interface GetSuggestionsParams {
  currentBlock: EditorBlock;
  availableBlocks: BlockDefinition[];
  documentBlocks: EditorBlock[];
  currentIndex: number;
}
