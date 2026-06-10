import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, type KeyboardEvent, type WheelEvent } from "react";
import { Button } from "@/components/ui/button";
import { SuggestionCard } from "@/features/block-suggestions/SuggestionCard";
import type { BlockSuggestion } from "@/features/block-suggestions/types";

interface SuggestionCarouselProps {
  suggestions: BlockSuggestion[];
  onSelect: (definitionId: string) => void;
}

export function SuggestionCarousel({ suggestions, onSelect }: SuggestionCarouselProps) {
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const lastWheelNavigationAt = useRef(0);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    dragFree: true,
  });

  if (!suggestions.length) {
    return null;
  }

  function focusSuggestion(index: number) {
    const nextIndex = (index + suggestions.length) % suggestions.length;
    emblaApi?.scrollTo(nextIndex);
    cardRefs.current[nextIndex]?.focus();
  }

  function handleSuggestionKeyDown(index: number, event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusSuggestion(index + 1);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusSuggestion(index - 1);
      return;
    }

    if (event.key === "Tab") {
      if (!event.shiftKey && index === suggestions.length - 1) {
        event.preventDefault();
        if (focusNextEditorBlock()) {
          return;
        }

        focusFirstPreviewOption();
        return;
      }

      if (event.shiftKey && index === 0) {
        event.preventDefault();
        focusSuggestion(suggestions.length - 1);
      }
      return;
    }
  }

  function focusNextEditorBlock() {
    const currentBlockCard = carouselRef.current?.closest("[data-editor-block-card]");
    if (!currentBlockCard) {
      return false;
    }

    const editorBlockCards = Array.from(document.querySelectorAll<HTMLElement>("[data-editor-block-card]"));
    const currentBlockIndex = editorBlockCards.indexOf(currentBlockCard as HTMLElement);
    const nextBlockCard = editorBlockCards[currentBlockIndex + 1];
    const nextFocusable =
      nextBlockCard?.querySelector<HTMLElement>(
        'textarea:not([disabled]), input:not([type="hidden"]):not([disabled])',
      ) ?? nextBlockCard?.querySelector<HTMLElement>("[data-editor-block-surface]");

    if (!nextFocusable) {
      return false;
    }

    nextFocusable.focus();
    return true;
  }

  function focusFirstPreviewOption() {
    const firstPreviewOption = document.querySelector<HTMLElement>(
      "[data-preview-tabs] button:not([disabled]), [data-preview-tabs] input:not([disabled])",
    );
    firstPreviewOption?.focus();
  }

  function handleCarouselWheel(event: WheelEvent<HTMLDivElement>) {
    if (!emblaApi) {
      return;
    }

    const horizontalDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : 0;
    const shiftedVerticalDelta = event.shiftKey ? event.deltaY : 0;
    const scrollDelta = horizontalDelta || shiftedVerticalDelta;

    if (!scrollDelta) {
      return;
    }

    event.preventDefault();

    const now = window.performance.now();
    if (now - lastWheelNavigationAt.current < 140) {
      return;
    }

    lastWheelNavigationAt.current = now;
    if (scrollDelta > 0) {
      emblaApi.scrollNext();
      return;
    }

    emblaApi.scrollPrev();
  }

  return (
    <div
      ref={carouselRef}
      className="mt-3 rounded-2xl border border-white/12 bg-[#0A1028]/72 p-3 shadow-[0_18px_44px_rgba(0,0,0,0.28)] backdrop-blur-xl"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-[#D1D5DB]">Proximos blocos</p>
          <p className="text-[11px] font-medium text-[#94A3B8]">Ordenados por contexto, todos continuam disponiveis.</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            className="h-8 w-8"
            size="icon"
            variant="ghost"
            type="button"
            tabIndex={-1}
            onClick={() => emblaApi?.scrollPrev()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            className="h-8 w-8"
            size="icon"
            variant="ghost"
            type="button"
            tabIndex={-1}
            onClick={() => emblaApi?.scrollNext()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div ref={emblaRef} className="overflow-hidden" onWheel={handleCarouselWheel}>
        <div className="flex gap-2">
          {suggestions.map((suggestion, index) => (
            <SuggestionCard
              key={suggestion.block.id}
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              suggestion={suggestion}
              onFocus={() => {
                emblaApi?.scrollTo(index);
              }}
              onKeyDown={(event) => handleSuggestionKeyDown(index, event)}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
