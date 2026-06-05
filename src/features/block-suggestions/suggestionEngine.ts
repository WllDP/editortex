import type { BlockDefinition } from "@/types/blocks";
import type { BlockSuggestion, GetSuggestionsParams, SuggestionStrength } from "@/features/block-suggestions/types";

const contextRecommendations: Record<string, string[]> = {
  capaCustomizada: ["tableofcontents", "newpage", "chapter"],
  tableofcontents: ["newpage", "chapter", "specialchapter"],
  newpage: ["chapter", "specialchapter", "text"],
  chapter: ["text", "section", "attachedImage", "chapter", "specialchapter"],
  specialchapter: ["text", "section", "chapter"],
  text: ["text", "section", "chapter", "specialchapter", "attachedImage"],
  section: ["text", "subsection", "attachedImage", "section"],
  subsection: ["text", "subsection", "attachedImage", "section"],
  attachedImage: ["text", "section", "chapter"],
  rawLatex: ["text", "section", "chapter"],
};

const structuralOrder = [
  "capaCustomizada",
  "tableofcontents",
  "newpage",
  "chapter",
  "specialchapter",
  "section",
  "subsection",
  "attachedImage",
  "text",
  "rawLatex",
  "PaginaFinalImagem",
];

const genericPriority: Record<string, number> = {
  text: 68,
  section: 58,
  subsection: 54,
  attachedImage: 50,
  chapter: 46,
  specialchapter: 42,
  newpage: 34,
  tableofcontents: 26,
  capaCustomizada: 18,
  rawLatex: 8,
  PaginaFinalImagem: -20,
};

export function getBlockSuggestions({
  currentBlock,
  availableBlocks,
  documentBlocks,
  currentIndex,
}: GetSuggestionsParams): BlockSuggestion[] {
  const currentKey = getBlockIdentity(currentBlock);
  const recommendations = contextRecommendations[currentKey] ?? [];
  const hasCover = documentBlocks.some((block) => getBlockIdentity(block) === "capaCustomizada");
  const hasToc = documentBlocks.some((block) => getBlockIdentity(block) === "tableofcontents");
  const isNearDocumentEnd = currentIndex >= Math.max(documentBlocks.length - 2, 0);

  return availableBlocks
    .map((block) => {
      const key = getDefinitionIdentity(block);
      const recommendationIndex = recommendations.indexOf(key);
      const isRecommended = recommendationIndex >= 0;
      const strength = getSuggestionStrength(key, isRecommended);
      const score =
        (isRecommended ? 1000 - recommendationIndex * 80 : getGenericScore(key)) +
        getDocumentContextBonus(key, { hasCover, hasToc, isNearDocumentEnd });

      return {
        block,
        key,
        score,
        strength,
        reason: getSuggestionReason(key, currentKey, strength),
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return getStructuralIndex(left.key) - getStructuralIndex(right.key);
    });
}

export function getBlockIdentity(block: { variableName?: string; definitionId?: string; type?: string }) {
  return (
    normalizeBlockKey(block.variableName) ??
    normalizeBlockKey(block.definitionId) ??
    normalizeBlockKey(block.type) ??
    "unknown"
  );
}

function getDefinitionIdentity(block: BlockDefinition) {
  return (
    normalizeBlockKey(block.variableName) ?? normalizeBlockKey(block.id) ?? normalizeBlockKey(block.type) ?? "unknown"
  );
}

function normalizeBlockKey(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/^system:/, "");
  if (normalized === "plain-text") return "text";
  if (normalized === "raw-latex") return "rawLatex";
  if (normalized === "attached-image") return "attachedImage";
  if (normalized === "final-image") return "PaginaFinalImagem";
  return normalized;
}

function getSuggestionStrength(key: string, isRecommended: boolean): SuggestionStrength {
  if (key === "PaginaFinalImagem") return "final";
  if (key === "rawLatex") return "technical";
  if (isRecommended) return "high";
  if (["chapter", "specialchapter", "section", "subsection", "newpage", "tableofcontents"].includes(key)) {
    return "structural";
  }
  return "generic";
}

function getGenericScore(key: string) {
  return genericPriority[key] ?? 20;
}

function getDocumentContextBonus(
  key: string,
  context: { hasCover: boolean; hasToc: boolean; isNearDocumentEnd: boolean },
) {
  if (key === "capaCustomizada" && context.hasCover) return -80;
  if (key === "tableofcontents" && context.hasToc) return -60;
  if (key === "PaginaFinalImagem" && context.isNearDocumentEnd) return 34;
  return 0;
}

function getStructuralIndex(key: string) {
  const index = structuralOrder.indexOf(key);
  return index === -1 ? structuralOrder.length : index;
}

function getSuggestionReason(key: string, currentKey: string, strength: SuggestionStrength) {
  if (strength === "high") {
    return `Recomendado apos ${currentKey}`;
  }
  if (strength === "structural") {
    return "Estrutura possivel";
  }
  if (strength === "technical") {
    return "Uso tecnico";
  }
  if (strength === "final") {
    return "Finalizacao";
  }
  if (key === "text") {
    return "Continuidade";
  }
  return "Disponivel";
}
