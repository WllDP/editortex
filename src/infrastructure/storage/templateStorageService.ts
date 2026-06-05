import type { UploadedTemplate } from "@/types/latex";

const key = "editortex:uploaded-template";

export function persistUploadedTemplate(template: UploadedTemplate) {
  localStorage.setItem(key, JSON.stringify(template));
}

export function readPersistedTemplate(): UploadedTemplate | undefined {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as UploadedTemplate;
  } catch {
    return undefined;
  }
}
