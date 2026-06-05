import { create } from "zustand";
import { initialPreview } from "@/store/initialState";
import { createAssetSlice } from "@/store/slices/assetSlice";
import { createBlockSlice } from "@/store/slices/blockSlice";
import { createDocumentSlice } from "@/store/slices/documentSlice";
import { createPreviewSlice } from "@/store/slices/previewSlice";
import { createTemplateSlice } from "@/store/slices/templateSlice";
import type { EditorStore } from "@/store/editorStoreTypes";

export const useEditorStore = create<EditorStore>((set, get) => ({
  ...createDocumentSlice(),
  preview: initialPreview,
  ...createTemplateSlice(set, get),
  ...createBlockSlice(set, get),
  ...createAssetSlice(set, get),
  ...createPreviewSlice(set, get),
}));

export type { EditorStore };
