import { invoke } from "@tauri-apps/api/core";
import JSZip from "jszip";
import type { ExportPayload } from "@/types/document";
import type { UploadedTemplate } from "@/types/latex";
import { isTauriRuntime } from "@/tauri/runtime";

export async function exportDocumentJson(payload: ExportPayload) {
  if (!isTauriRuntime()) {
    downloadTextFile("documento.json", JSON.stringify(payload, null, 2), "application/json");
    return "documento.json";
  }

  return invoke("save_json_document", { payload });
}

export async function exportTex(tex: string) {
  if (!isTauriRuntime()) {
    downloadTextFile("documento.tex", tex, "text/x-tex");
    return "documento.tex";
  }

  return invoke("save_tex_document", { tex });
}

export async function exportEditedProjectZip(template: UploadedTemplate | undefined, tex: string) {
  const zip = new JSZip();
  const fileName = `${sanitizeFileName(template?.name ?? "projeto-editado")}.zip`;

  if (!template) {
    zip.file("main.tex", tex);
    downloadBlobFile(fileName, await zip.generateAsync({ type: "blob" }));
    return fileName;
  }

  const mainTexPath = template.project.mainTexPath || template.fileName || "main.tex";
  let hasMainTex = false;

  for (const file of template.project.files) {
    if (file.kind === "auxiliary" || file.kind === "pdf") {
      continue;
    }

    if (file.path === mainTexPath) {
      zip.file(file.path, tex);
      hasMainTex = true;
      continue;
    }

    if (file.content !== undefined) {
      zip.file(file.path, file.content);
      continue;
    }

    if (file.binaryBase64) {
      zip.file(file.path, file.binaryBase64, { base64: true });
    }
  }

  if (!hasMainTex) {
    zip.file(mainTexPath, tex);
  }

  downloadBlobFile(fileName, await zip.generateAsync({ type: "blob" }));
  return fileName;
}

function downloadTextFile(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  downloadBlobFile(fileName, blob);
}

function downloadBlobFile(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function sanitizeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim() || "projeto-editado";
}
