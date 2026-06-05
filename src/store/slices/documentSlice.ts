import { initialDocument } from "@/store/initialState";
import type { EditorStore } from "@/store/editorStoreTypes";

type DocumentSlice = Pick<EditorStore, "document" | "uploadedTemplate" | "availableBlocks" | "selectedBlockId">;

export function createDocumentSlice(): DocumentSlice {
  return {
    document: initialDocument,
    uploadedTemplate: undefined,
    availableBlocks: [],
    selectedBlockId: undefined,
  };
}
