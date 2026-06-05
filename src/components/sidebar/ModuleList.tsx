import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import type { BlockDefinition } from "@/types/blocks";
import { useEditorStore } from "@/store/editorStore";
import { cn } from "@/utils/cn";

export function ModuleList() {
  const blocks = useEditorStore((state) => state.availableBlocks);

  if (blocks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.07] p-3 text-xs font-medium leading-5 text-[#D1D5DB] shadow-[0_12px_32px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        Envie um template com <code>\newcommand</code> para gerar modulos.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {blocks.map((block) => (
        <DraggableModule key={block.id} block={block} />
      ))}
    </div>
  );
}

function DraggableModule({ block }: { block: BlockDefinition }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library:${block.id}`,
    data: {
      type: "library-block",
      definitionId: block.id,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 80 : undefined,
      }
    : undefined;

  return (
    <button
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-white/14 bg-white/[0.07] px-3 py-2 text-left text-sm font-semibold leading-none text-white shadow-[0_10px_28px_rgba(0,0,0,0.24)] backdrop-blur-xl transition-colors duration-200 hover:bg-white/[0.11]",
        isDragging && "scale-[0.98] border-[#60A5FA]/40 bg-[#2563EB]/70",
      )}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="h-4 w-4" />
      <span className="min-w-0 flex-1 truncate">{block.name}</span>
      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-[#FF4D9D]/35 bg-[#FF4D9D]/75 px-2 text-xs font-semibold leading-none text-white">
        {block.fields.length}
      </span>
    </button>
  );
}
