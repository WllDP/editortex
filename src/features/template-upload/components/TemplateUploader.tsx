import { Upload } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { useTemplateUpload } from "@/features/template-upload/hooks/useTemplateUpload";
import type { UploadMode } from "@/types/document";
import { cn } from "@/utils/cn";

export function TemplateUploader() {
  const uploadTemplate = useTemplateUpload();
  const [error, setError] = useState<string>();
  const [mode, setMode] = useState<UploadMode>("import-document");

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setError(undefined);
      await uploadTemplate(file, mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar template.");
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
      {error ? (
        <span className="mt-2 block rounded-xl border border-[#FB7185]/40 bg-[#F43F5E]/75 px-2 py-1 text-xs font-semibold text-white shadow-[0_0_24px_rgba(244,63,94,0.18)]">
          {error}
        </span>
      ) : null}
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
