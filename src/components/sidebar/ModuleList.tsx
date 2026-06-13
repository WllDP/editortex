import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { useMemo } from "react";
import type { BlockDefinition, BlockInstance } from "@/types/blocks";
import { useEditorStore } from "@/store/editorStore";
import { cn } from "@/utils/cn";

const fallbackBlockOrder = [
  "capaCustomizada",
  "tableofcontents",
  "chapter",
  "specialchapter",
  "section",
  "subsection",
  "subsubsection",
  "text",
  "attachedImage",
  "rawLatex",
  "newpage",
  "PaginaFinalImagem",
];

export function ModuleList() {
  const blocks = useEditorStore((state) => state.availableBlocks);
  const documentBlocks = useEditorStore((state) => state.document.blocks);
  const templateBody = useEditorStore((state) => state.uploadedTemplate?.parsedTemplate.body ?? "");
  const orderedBlocks = useMemo(
    () => orderBlocksByIntegratedLatex(blocks, documentBlocks, templateBody),
    [blocks, documentBlocks, templateBody],
  );

  if (blocks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.07] p-3 text-xs font-medium leading-5 text-[#D1D5DB] shadow-[0_12px_32px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        Envie um template com <code>\newcommand</code> para gerar modulos.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {orderedBlocks.map((block) => (
        <DraggableModule key={block.id} block={block} />
      ))}
    </div>
  );
}

function DraggableModule({ block }: { block: BlockDefinition }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library:${block.id}`,
    data: {
      type: "library-block",
      definitionId: block.id,
    },
  });

  return (
    <button
      ref={setNodeRef}
      className={cn(
        "relative grid aspect-square w-full place-items-center rounded-xl border border-white/14 bg-white/[0.07] p-3 text-center text-sm font-semibold leading-tight text-white shadow-[0_10px_28px_rgba(0,0,0,0.24)] backdrop-blur-xl transition-colors duration-200 hover:bg-white/[0.11]",
        isDragging && "border-[#60A5FA]/40 bg-[#2563EB]/40 opacity-55",
      )}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="absolute left-3 top-3 h-4 w-4 text-white/65" />
      <span className="line-clamp-3 max-w-full text-balance break-words px-1">{block.name}</span>
    </button>
  );
}

function orderBlocksByIntegratedLatex(
  definitions: BlockDefinition[],
  documentBlocks: BlockInstance[],
  templateBody: string,
) {
  const documentOrderByVariable = new Map<string, number>();
  for (const block of [...documentBlocks].sort((left, right) => left.order - right.order)) {
    const key = getBlockOrderKey(block.variableName);
    if (key && !documentOrderByVariable.has(key)) {
      documentOrderByVariable.set(key, documentOrderByVariable.size);
    }
  }

  const bodyOrderByVariable = createBodyOrderByVariable(templateBody, definitions);

  return [...definitions].sort((left, right) => {
    const leftKey = getBlockOrderKey(left.variableName);
    const rightKey = getBlockOrderKey(right.variableName);

    return (
      getDefinitionOrder(leftKey, documentOrderByVariable, bodyOrderByVariable) -
        getDefinitionOrder(rightKey, documentOrderByVariable, bodyOrderByVariable) ||
      left.name.localeCompare(right.name)
    );
  });
}

function createBodyOrderByVariable(templateBody: string, definitions: BlockDefinition[]) {
  const bodyOrderByVariable = new Map<string, number>();
  if (!templateBody.trim()) {
    return bodyOrderByVariable;
  }

  for (const definition of definitions) {
    const key = getBlockOrderKey(definition.variableName);
    if (!key) {
      continue;
    }

    const commandIndex = templateBody.search(new RegExp(`\\\\${escapeRegExp(definition.variableName)}\\b`));
    if (commandIndex >= 0) {
      bodyOrderByVariable.set(key, commandIndex);
    }
  }

  return bodyOrderByVariable;
}

function getDefinitionOrder(
  key: string,
  documentOrderByVariable: Map<string, number>,
  bodyOrderByVariable: Map<string, number>,
) {
  const documentOrder = documentOrderByVariable.get(key);
  if (documentOrder !== undefined) {
    return documentOrder;
  }

  const bodyOrder = bodyOrderByVariable.get(key);
  if (bodyOrder !== undefined) {
    return 10_000 + bodyOrder;
  }

  const fallbackOrder = fallbackBlockOrder.indexOf(key);
  return 1_000_000 + (fallbackOrder === -1 ? fallbackBlockOrder.length : fallbackOrder);
}

function getBlockOrderKey(variableName?: string) {
  return variableName ?? "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
