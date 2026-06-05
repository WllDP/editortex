import { Image, Layers, Text } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";

export function ProjectSummary() {
  const uploadedTemplate = useEditorStore((state) => state.uploadedTemplate);

  if (!uploadedTemplate) {
    return null;
  }

  const { project } = uploadedTemplate;
  const visibleAssets = project.assets.slice(0, 5);
  const remainingAssets = project.assets.length - visibleAssets.length;

  return (
    <div className="metro-card mt-3 rounded-xl p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Layers className="h-4 w-4" />
        Projeto LaTeX
      </div>
      <div className="mt-3 space-y-2 text-xs font-medium text-[#D1D5DB]">
        <div className="flex items-start gap-2 rounded-2xl border border-white/14 bg-white/[0.07] px-2 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.2)] backdrop-blur-xl">
          <Text className="mt-0.5 h-3.5 w-3.5 text-[#22D3EE]" />
          <span className="min-w-0 flex-1 truncate">{project.mainTexPath}</span>
        </div>
        <div className="rounded-2xl border border-[#FF4D9D]/35 bg-[#FF4D9D]/72 px-2 py-2 font-semibold text-white shadow-[0_0_28px_rgba(255,77,157,0.18)] backdrop-blur-xl">
          {project.files.length} arquivos reconhecidos, {project.assets.length} assets
        </div>
        {visibleAssets.length > 0 ? (
          <div className="space-y-1 border-t border-white/12 pt-2">
            {visibleAssets.map((asset) => (
              <div key={asset.path} className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-white/[0.08]">
                <Image className="h-3.5 w-3.5 text-[#22D3EE]" />
                <span className="min-w-0 flex-1 truncate">{asset.path}</span>
              </div>
            ))}
            {remainingAssets > 0 ? (
              <div className="px-1.5 text-[#94A3B8]">+{remainingAssets} assets adicionais</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
