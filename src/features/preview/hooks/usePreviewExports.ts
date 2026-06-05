import type { DocumentModel } from "@/types/document";
import type { UploadedTemplate } from "@/types/latex";
import { exportDocumentJson, exportEditedProjectZip, exportTex } from "@/features/export/services/exportService";

export function usePreviewExports({
  document,
  ensureGeneratedTex,
  notify,
  onExportStart,
  uploadedTemplate,
}: {
  document: DocumentModel;
  ensureGeneratedTex: () => string;
  notify: (notification: { kind: "warning"; title: string; message: string }) => void;
  onExportStart: () => void;
  uploadedTemplate?: UploadedTemplate;
}) {
  function validateExportReady(actionLabel: string) {
    if (uploadedTemplate) {
      return true;
    }

    notify({
      kind: "warning",
      title: "Importe um arquivo primeiro",
      message: `Para ${actionLabel}, carregue um projeto .tex ou .zip na sidebar.`,
    });
    return false;
  }

  async function runExport(action: () => Promise<void>) {
    onExportStart();
    await action();
  }

  return {
    exportJson: () =>
      runExport(async () => {
        if (!validateExportReady("exportar JSON")) {
          return;
        }

        const tex = ensureGeneratedTex();
        await exportDocumentJson({
          document,
          tex,
          exportedAt: new Date().toISOString(),
        });
      }),
    exportTexFile: () =>
      runExport(async () => {
        if (!validateExportReady("exportar TEX")) {
          return;
        }

        await exportTex(ensureGeneratedTex());
      }),
    exportProjectZip: () =>
      runExport(async () => {
        if (!validateExportReady("exportar ZIP")) {
          return;
        }

        await exportEditedProjectZip(uploadedTemplate, ensureGeneratedTex());
      }),
  };
}
