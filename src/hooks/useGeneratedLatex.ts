import { useEditorStore } from "@/store/editorStore";

export function useGeneratedLatex() {
  return useEditorStore((state) => state.preview.generatedTex);
}
