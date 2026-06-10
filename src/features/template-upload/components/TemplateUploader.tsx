import { Upload } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { useTemplateUpload } from "@/features/template-upload/hooks/useTemplateUpload";
import { useNotificationStore } from "@/store/notificationStore";
import type { UploadMode } from "@/types/document";
import { cn } from "@/utils/cn";

export function TemplateUploader() {
  const uploadTemplate = useTemplateUpload();
  const notify = useNotificationStore((state) => state.notify);
  const [mode, setMode] = useState<UploadMode>("import-document");

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      await uploadTemplate(file, mode);
    } catch (err) {
      notify({
        kind: "error",
        title: "Falha ao anexar template",
        message: err instanceof Error ? err.message : "Nao foi possivel carregar o arquivo selecionado.",
      });
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <ModeButton
          active={mode === "import-document"}
          label="Editar importado"
          onClick={() => setMode("import-document")}
        />
        <ModeButton
          active={mode === "template-only"}
          label="Novo com template"
          onClick={() => setMode("template-only")}
        />
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.07] px-3 py-5 text-center text-white shadow-[0_16px_42px_rgba(0,0,0,0.26)] backdrop-blur-xl transition-colors duration-200 hover:border-[#22D3EE]/45 hover:bg-white/[0.11]">
        <Upload className="mb-2 h-6 w-6" />
        <span className="text-sm font-semibold">Selecionar .tex ou .zip</span>
        <span className="mt-1 text-xs font-medium text-[#94A3B8]">
          {mode === "import-document"
            ? "Importa blocos e textos existentes para edicao"
            : "Usa somente o preambulo para criar um novo documento"}
        </span>
        <input
          className="sr-only"
          type="file"
          accept=".tex,.zip,text/x-tex,application/zip"
          onChange={handleFileChange}
        />
      </label>
    </div>
  );
}

function ModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-11 items-center justify-center rounded-xl border px-3 py-2 text-center text-xs font-semibold leading-snug shadow-[0_10px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-colors duration-200",
        active
          ? "border-[#60A5FA]/35 bg-[#2563EB]/88 text-white shadow-[0_0_28px_rgba(59,130,246,0.22)]"
          : "border-white/14 bg-white/[0.07] text-[#D1D5DB] hover:bg-white/[0.11] hover:text-white",
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
