import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/infrastructure/tauri/runtime";

export function openJsonDocument() {
  if (!isTauriRuntime()) {
    return Promise.resolve(undefined);
  }

  return invoke("open_json_document");
}

export function openTexDocument() {
  if (!isTauriRuntime()) {
    return Promise.resolve(undefined);
  }

  return invoke("open_tex_document");
}
