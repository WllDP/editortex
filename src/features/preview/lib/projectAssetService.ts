import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/infrastructure/tauri/runtime";

export async function getProjectAssetUrl(projectKey: string, assetPath: string): Promise<string> {
  if (isTauriRuntime()) {
    const path = await invoke<string>("get_project_asset", { projectKey, assetPath });
    return convertFileSrc(path);
  }

  const params = new URLSearchParams({
    projectKey,
    assetPath,
  });
  return `/api/project-asset?${params.toString()}`;
}
