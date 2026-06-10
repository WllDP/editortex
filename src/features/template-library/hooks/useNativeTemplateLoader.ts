import { useCallback } from "react";
import { useTemplateUpload } from "@/features/template-upload/hooks/useTemplateUpload";
import type { NativeTemplate } from "@/features/template-library/nativeTemplates";

export function useNativeTemplateLoader() {
  const uploadTemplate = useTemplateUpload();

  return useCallback(
    async (template: NativeTemplate) => {
      const response = await fetch(template.assetUrl);
      if (!response.ok) {
        throw new Error("Nao foi possivel carregar o template nativo.");
      }

      const blob = await response.blob();
      const file = new File([blob], template.fileName, { type: "application/zip" });
      await uploadTemplate(file, "template-only");
    },
    [uploadTemplate],
  );
}
