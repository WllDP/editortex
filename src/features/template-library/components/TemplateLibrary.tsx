import { ChevronDown, FileArchive, FolderHeart, Library } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { nativeTemplates, type NativeTemplate } from "@/features/template-library/nativeTemplates";
import { useNativeTemplateLoader } from "@/features/template-library/hooks/useNativeTemplateLoader";
import { cn } from "@/utils/cn";

export function TemplateLibrary() {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingTemplateId, setLoadingTemplateId] = useState<string>();
  const [error, setError] = useState<string>();
  const loadNativeTemplate = useNativeTemplateLoader();

  async function handleLoadNativeTemplate(template: NativeTemplate) {
    try {
      setError(undefined);
      setLoadingTemplateId(template.id);
      await loadNativeTemplate(template);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar template nativo.");
    } finally {
      setLoadingTemplateId(undefined);
    }
  }

  return (
    <section className="metro-card rounded-xl">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <Library className="h-4 w-4" />
          Biblioteca de Templates
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-[#94A3B8] transition-transform duration-200", isOpen && "rotate-180")}
        />
      </button>

      <div
        className={cn(
          "grid border-t border-white/12 transition-[grid-template-rows,opacity] duration-300 ease-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-4 p-3">
            <TemplateGroup icon={FileArchive} title="Templates nativos">
              <div className="space-y-2">
                {nativeTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="w-full rounded-2xl border border-white/14 bg-white/[0.07] px-3 py-3 text-left shadow-[0_12px_30px_rgba(0,0,0,0.22)] transition-colors duration-200 hover:border-[#22D3EE]/40 hover:bg-white/[0.11]"
                    disabled={loadingTemplateId === template.id}
                    onClick={() => void handleLoadNativeTemplate(template)}
                  >
                    <span className="block text-sm font-semibold text-white">{template.name}</span>
                    <span className="mt-1 block text-xs font-medium leading-snug text-[#94A3B8]">
                      {loadingTemplateId === template.id ? "Carregando template..." : template.description}
                    </span>
                  </button>
                ))}
              </div>
            </TemplateGroup>

            <TemplateGroup icon={FolderHeart} title="Templates salvos">
              <div className="rounded-2xl border border-dashed border-white/16 bg-white/[0.045] px-3 py-3 text-xs font-medium leading-snug text-[#94A3B8]">
                Nenhum template salvo ainda.
              </div>
            </TemplateGroup>

            {error ? (
              <span className="block rounded-xl border border-[#FB7185]/40 bg-[#F43F5E]/75 px-2 py-1 text-xs font-semibold text-white shadow-[0_0_24px_rgba(244,63,94,0.18)]">
                {error}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function TemplateGroup({
  children,
  icon: Icon,
  title,
}: {
  children: ReactNode;
  icon: typeof FileArchive;
  title: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-[#D1D5DB]">
        <Icon className="h-3.5 w-3.5 text-[#22D3EE]" />
        {title}
      </div>
      {children}
    </div>
  );
}
