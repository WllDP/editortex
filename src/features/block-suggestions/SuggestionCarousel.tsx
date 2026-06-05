import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SuggestionCard } from "@/features/block-suggestions/SuggestionCard";
import type { BlockSuggestion } from "@/features/block-suggestions/types";

interface SuggestionCarouselProps {
  suggestions: BlockSuggestion[];
  onSelect: (definitionId: string) => void;
}

export function SuggestionCarousel({ suggestions, onSelect }: SuggestionCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    dragFree: true,
  });

  if (!suggestions.length) {
    return null;
  }

  return (
    <div className="mt-3 rounded-2xl border border-white/12 bg-[#0A1028]/72 p-3 shadow-[0_18px_44px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-[#D1D5DB]">Proximos blocos</p>
          <p className="text-[11px] font-medium text-[#94A3B8]">Ordenados por contexto, todos continuam disponiveis.</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button className="h-8 w-8" size="icon" variant="ghost" type="button" onClick={() => emblaApi?.scrollPrev()}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button className="h-8 w-8" size="icon" variant="ghost" type="button" onClick={() => emblaApi?.scrollNext()}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex gap-2">
          {suggestions.map((suggestion) => (
            <SuggestionCard key={suggestion.block.id} suggestion={suggestion} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}
