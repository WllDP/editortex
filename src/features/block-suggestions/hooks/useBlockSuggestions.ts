import { useMemo } from "react";
import { getBlockSuggestions } from "@/features/block-suggestions/suggestionEngine";
import type { GetSuggestionsParams } from "@/features/block-suggestions/types";

export function useBlockSuggestions(params: GetSuggestionsParams) {
  const { availableBlocks, currentBlock, currentIndex, documentBlocks } = params;
  return useMemo(
    () => getBlockSuggestions({ availableBlocks, currentBlock, currentIndex, documentBlocks }),
    [availableBlocks, currentBlock, currentIndex, documentBlocks],
  );
}
