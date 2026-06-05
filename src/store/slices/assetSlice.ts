import type { EditorStore, EditorStoreGet, EditorStoreSet } from "@/store/editorStoreTypes";
import {
  createProjectAssetPath,
  getBaseName,
  getFileExtension,
  getImageMimeType,
  readFileAsBase64,
} from "@/store/storeHelpers";

type AssetSlice = Pick<EditorStore, "attachImageToBlock">;

export function createAssetSlice(set: EditorStoreSet, get: EditorStoreGet): AssetSlice {
  return {
    attachImageToBlock: async (blockId, file) => {
      if (!file.type.startsWith("image/")) {
        return;
      }

      const state = get();
      const template = state.uploadedTemplate;
      const binaryBase64 = await readFileAsBase64(file);
      const extension = getFileExtension(file.name);
      const imagePath = createProjectAssetPath(template?.project.rootPath, file.name, template?.project.files ?? []);
      const objectUrl = URL.createObjectURL(file);
      const asset = {
        path: imagePath,
        name: getBaseName(imagePath),
        extension,
        kind: "image" as const,
        size: file.size,
        binaryBase64,
        objectUrl,
        mimeType: file.type || getImageMimeType(extension),
      };

      set((current) => {
        const currentTemplate = current.uploadedTemplate;
        const nextBlocks = current.document.blocks.map((block) =>
          block.id === blockId ? { ...block, data: { ...block.data, image: asset.name } } : block,
        );

        if (!currentTemplate) {
          return {
            document: {
              ...current.document,
              blocks: nextBlocks,
              updatedAt: new Date().toISOString(),
            },
          };
        }

        const nextProject = {
          ...currentTemplate.project,
          files: [...currentTemplate.project.files, asset],
          assets: [...currentTemplate.project.assets, asset],
        };

        return {
          uploadedTemplate: {
            ...currentTemplate,
            project: nextProject,
          },
          document: {
            ...current.document,
            blocks: nextBlocks,
            metadata: {
              ...current.document.metadata,
              assetCount: nextProject.assets.length,
              projectFileCount: nextProject.files.length,
            },
            updatedAt: new Date().toISOString(),
          },
        };
      });
      get().markPreviewDirty();
    },
  };
}
