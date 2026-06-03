import { FileUp, X } from "lucide-react";
import { ProjectSummary } from "@/components/sidebar/ProjectSummary";
import { TemplateUploader } from "@/components/sidebar/TemplateUploader";
import { useEditorStore } from "@/store/editorStore";

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const uploadedTemplate = useEditorStore((state) => state.uploadedTemplate);
  const projectFileCount = uploadedTemplate?.project.files.length ?? 0;
  const assetCount = uploadedTemplate?.project.assets.length ?? 0;

  return (
    <aside className="flex h-full min-h-0 flex-col text-white">
      <div className="border-b border-white/15 bg-white/[0.055] px-4 py-5">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-[#2563EB]/90 text-sm font-bold text-white shadow-[0_0_32px_rgba(59,130,246,0.32),inset_0_1px_0_rgba(255,255,255,0.22)]">
            ET
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">EditorTex</h1>
            <p className="truncate text-xs font-medium text-[#94A3B8]">{uploadedTemplate?.fileName ?? "Workspace sem template"}</p>
          </div>
          <button
            type="button"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[#94A3B8] transition-colors hover:bg-white/[0.08] hover:text-white"
            aria-label="Fechar menu lateral"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {uploadedTemplate ? (
          <p className="mt-4 rounded-2xl border border-white/14 bg-white/[0.075] px-3 py-2 text-xs font-semibold text-[#E5E7EB] shadow-[0_14px_38px_rgba(0,0,0,0.24)] backdrop-blur-xl">
            {projectFileCount} arquivos, {assetCount} assets
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <section className="metro-card rounded-xl">
          <Header icon={FileUp} label="Upload de Template" />
          <div className="border-t border-white/12 p-3">
            <TemplateUploader />
          </div>
        </section>

        <ProjectSummary />
      </div>
    </aside>
  );
}

function Header({
  icon: Icon,
  label,
  detail,
}: {
  icon: typeof FileUp;
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      {detail ? <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-[#FF4D9D]/35 bg-[#FF4D9D]/80 px-2 text-xs font-semibold leading-none text-white shadow-[0_0_22px_rgba(255,77,157,0.24)]">{detail}</span> : null}
    </div>
  );
}
