import { Plus } from "lucide-react";
import type { BlockSuggestion } from "@/features/block-suggestions/types";
import { cn } from "@/utils/cn";

interface SuggestionCardProps {
  suggestion: BlockSuggestion;
  onSelect: (definitionId: string) => void;
}

export function SuggestionCard({ suggestion, onSelect }: SuggestionCardProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-24 min-w-[178px] max-w-[178px] flex-col justify-between rounded-2xl border bg-white/[0.065] p-3 text-left transition-colors hover:bg-white/[0.11]",
        suggestion.strength === "high" && "border-[#22D3EE]/45 bg-[#22D3EE]/12",
        suggestion.strength === "technical" && "border-white/10 opacity-80",
        suggestion.strength === "final" && "border-[#FF4D9D]/24",
      )}
      onClick={() => onSelect(suggestion.block.id)}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-sm font-semibold leading-tight text-white">{suggestion.block.name}</span>
        <Plus className="h-4 w-4 shrink-0 text-[#22D3EE]" />
      </span>
      <span className="truncate text-[11px] font-medium text-[#94A3B8]">{suggestion.reason}</span>
    </button>
  );
}
