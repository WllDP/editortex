import { arrayMove } from "@dnd-kit/sortable";
import type { BlockInstance } from "@/types/blocks";
import type { EditorStore, EditorStoreGet, EditorStoreSet } from "@/store/editorStoreTypes";
import { normalizeDocumentOrder, normalizeSearchText, scoreBlockPreviewMatch } from "@/store/storeHelpers";

type BlockSlice = Pick<
  EditorStore,
  | "addBlock"
  | "insertBlockAt"
  | "insertBlockAfter"
  | "updateBlockData"
  | "duplicateBlock"
  | "removeBlock"
  | "reorderBlocks"
  | "selectBlock"
  | "clearPendingBlockFocus"
  | "selectBlockByPreviewText"
>;

export function createBlockSlice(set: EditorStoreSet, get: EditorStoreGet): BlockSlice {
  function createBlockInstance(definitionId: string): BlockInstance | undefined {
    const definition = get().availableBlocks.find((block) => block.id === definitionId);
    if (!definition) {
      return undefined;
    }

    const data = definition.fields.reduce<Record<string, string>>((values, field) => {
      values[field.id] = field.defaultValue ?? "";
      return values;
    }, {});

    return {
      id: crypto.randomUUID(),
      definitionId: definition.id,
      type: definition.type,
      variableName: definition.variableName,
      order: get().document.blocks.length,
      data,
      metadata: {},
    };
  }

  return {
    addBlock: (definitionId) => {
      get().insertBlockAt(definitionId, get().document.blocks.length);
    },
    insertBlockAt: (definitionId, index) => {
      const instance = createBlockInstance(definitionId);
      if (!instance) {
        return;
      }

      set((state) => ({
        selectedBlockId: instance.id,
        pendingFocusBlockId: instance.id,
        document: normalizeDocumentOrder({
          ...state.document,
          blocks: insertBlockAtIndex(state.document.blocks, instance, index),
          updatedAt: new Date().toISOString(),
        }),
      }));
      get().markPreviewDirty();
      return instance.id;
    },
    insertBlockAfter: (anchorBlockId, definitionId) => {
      const blocks = [...get().document.blocks].sort((a, b) => a.order - b.order);
      const anchorIndex = blocks.findIndex((block) => block.id === anchorBlockId);
      if (anchorIndex === -1) {
        return undefined;
      }

      return get().insertBlockAt(definitionId, anchorIndex + 1);
    },
    updateBlockData: (blockId, data) => {
      set((state) => ({
        document: {
          ...state.document,
          blocks: state.document.blocks.map((block) =>
            block.id === blockId ? { ...block, data: { ...block.data, ...data } } : block,
          ),
          updatedAt: new Date().toISOString(),
        },
      }));
      get().markPreviewDirty();
    },
    duplicateBlock: (blockId) => {
      const source = get().document.blocks.find((block) => block.id === blockId);
      if (!source) {
        return;
      }

      const duplicate: BlockInstance = {
        ...source,
        id: crypto.randomUUID(),
        order: get().document.blocks.length,
        data: { ...source.data },
        metadata: { ...source.metadata },
      };

      set((state) => ({
        selectedBlockId: duplicate.id,
        pendingFocusBlockId: duplicate.id,
        document: normalizeDocumentOrder({
          ...state.document,
          blocks: [...state.document.blocks, duplicate],
          updatedAt: new Date().toISOString(),
        }),
      }));
      get().markPreviewDirty();
    },
    removeBlock: (blockId) => {
      set((state) => {
        const remainingBlocks = state.document.blocks.filter((block) => block.id !== blockId);
        const nextSelectedBlockId =
          state.selectedBlockId === blockId
            ? [...remainingBlocks].sort((a, b) => a.order - b.order).at(-1)?.id
            : state.selectedBlockId;

        return {
          selectedBlockId: nextSelectedBlockId,
          document: normalizeDocumentOrder({
            ...state.document,
            blocks: remainingBlocks,
            updatedAt: new Date().toISOString(),
          }),
        };
      });
      get().markPreviewDirty();
    },
    reorderBlocks: (activeId, overId) => {
      if (activeId === overId) {
        return;
      }

      set((state) => {
        const blocks = [...state.document.blocks].sort((a, b) => a.order - b.order);
        const activeIndex = blocks.findIndex((block) => block.id === activeId);
        const overIndex = blocks.findIndex((block) => block.id === overId);

        if (activeIndex === -1 || overIndex === -1) {
          return state;
        }

        const reorderedBlocks = arrayMove(blocks, activeIndex, overIndex).map((block, index) => ({
          ...block,
          order: index,
        }));

        return {
          document: normalizeDocumentOrder({
            ...state.document,
            blocks: reorderedBlocks,
            updatedAt: new Date().toISOString(),
          }),
        };
      });
      get().markPreviewDirty();
    },
    selectBlock: (blockId) => set({ selectedBlockId: blockId }),
    clearPendingBlockFocus: (blockId) => {
      if (get().pendingFocusBlockId === blockId) {
        set({ pendingFocusBlockId: undefined });
      }
    },
    selectBlockByPreviewText: (text) => {
      const query = normalizeSearchText(text);
      if (query.length < 3) {
        return;
      }

      const blocks = [...get().document.blocks].sort((a, b) => a.order - b.order);
      const scoredBlocks = blocks
        .map((block) => ({
          block,
          score: scoreBlockPreviewMatch(query, block.data),
        }))
        .filter((candidate) => candidate.score > 0)
        .sort((a, b) => b.score - a.score);

      const [best] = scoredBlocks;
      if (best) {
        set({ selectedBlockId: best.block.id });
      }
    },
  };
}

function insertBlockAtIndex(blocks: BlockInstance[], blockToInsert: BlockInstance, index: number) {
  const orderedBlocks = [...blocks].sort((a, b) => a.order - b.order);
  const insertionIndex = Math.min(Math.max(index, 0), orderedBlocks.length);
  orderedBlocks.splice(insertionIndex, 0, blockToInsert);

  return orderedBlocks.map((block, blockIndex) => ({
    ...block,
    order: blockIndex,
  }));
}
