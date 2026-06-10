import { createBlockRegistry } from "@/domain/blocks/blockRegistry";
import { importTemplateBodyAsBlocks } from "@/domain/document/parser/documentBlockImporter";
import { parseLatexTemplate } from "@/domain/document/parser/latexParser";
import { saveRecentTemplate } from "@/features/template-library/recentTemplates";
import { initialPreview } from "@/store/initialState";
import type { EditorStore, EditorStoreGet, EditorStoreSet } from "@/store/editorStoreTypes";
import type { UploadedLatexProject, UploadedTemplate } from "@/types/latex";

type TemplateSlice = Pick<EditorStore, "loadTemplate">;

export function createTemplateSlice(set: EditorStoreSet, _get: EditorStoreGet): TemplateSlice {
  return {
    loadTemplate: (fileName, content, project, mode = "template-only") => {
      const parsedTemplate = parseLatexTemplate(content, fileName);
      const uploadedProject =
        project ??
        ({
          sourceType: "tex-file",
          mainTexPath: fileName,
          files: [
            {
              path: fileName,
              name: fileName,
              extension: "tex",
              kind: "tex",
              size: content.length,
              content,
            },
          ],
          assets: [],
        } satisfies UploadedLatexProject);
      const uploadedTemplate: UploadedTemplate = {
        id: crypto.randomUUID(),
        name: fileName.replace(/\.tex$/i, ""),
        fileName,
        content,
        sourceType: uploadedProject.sourceType,
        project: uploadedProject,
        parsedTemplate,
        createdAt: new Date().toISOString(),
      };
      const registry = createBlockRegistry(parsedTemplate);
      const importedBlocks =
        mode === "import-document" ? importTemplateBodyAsBlocks(parsedTemplate, registry.definitions) : [];
      saveRecentTemplate({
        fileName: uploadedTemplate.fileName,
        name: uploadedTemplate.name,
        content: uploadedTemplate.content,
        project: uploadedTemplate.project,
        mode,
        sourceType: uploadedTemplate.sourceType,
      });

      set((state) => ({
        uploadedTemplate,
        availableBlocks: registry.definitions,
        selectedBlockId: importedBlocks[0]?.id,
        preview: {
          ...initialPreview,
          autoCompile: state.preview.autoCompile,
          status: "queued",
          documentRevision: state.preview.documentRevision + 1,
          updatedAt: new Date().toISOString(),
        },
        document: {
          ...state.document,
          title: mode === "import-document" ? uploadedTemplate.name : "Novo documento",
          uploadedTemplate: uploadedTemplate.id,
          blocks: importedBlocks,
          metadata: {
            ...state.document.metadata,
            uploadMode: mode,
            mainTexPath: uploadedProject.mainTexPath,
            sourceType: uploadedProject.sourceType,
            projectFileCount: uploadedProject.files.length,
            assetCount: uploadedProject.assets.length,
          },
          updatedAt: new Date().toISOString(),
        },
      }));
    },
  };
}
