import { useCallback } from "react";
import { useEditorStore } from "@/store/editorStore";
import { readLatexUpload } from "@/features/template-upload/services/overleafZipService";
import type { UploadMode } from "@/types/document";

export function useTemplateUpload() {
  const loadTemplate = useEditorStore((state) => state.loadTemplate);

  return useCallback(
    async (file: File, mode: UploadMode) => {
      const upload = await readLatexUpload(file);
      loadTemplate(upload.fileName, upload.content, upload.project, mode);
    },
    [loadTemplate],
  );
}
