import type { PreviewState } from "@/types/document";
import { cn } from "@/utils/cn";

interface CompileStatusProps {
  preview: PreviewState;
  visible: boolean;
}

export function CompileStatus({ preview, visible }: CompileStatusProps) {
  const hasMessage = Boolean(preview.error || preview.diagnostics.length);

  if (!hasMessage) {
    return null;
  }

  return (
    <div
      className={cn(
        "overflow-hidden px-4 transition-[max-height,opacity,margin] duration-300 ease-out",
        visible ? "mt-2 max-h-24 opacity-100" : "mt-0 max-h-0 opacity-0",
      )}
      aria-hidden={!visible}
    >
      <div className="max-h-24 overflow-auto rounded-2xl border border-white/14 bg-white/[0.075] px-3 py-2 text-xs font-medium text-[#D1D5DB] shadow-[0_12px_32px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        {preview.error ? <p className="font-medium text-destructive">{preview.error}</p> : null}
        {preview.diagnostics.slice(0, 4).map((diagnostic, index) => (
          <p key={`${diagnostic}-${index}`} className="truncate">
            {diagnostic}
          </p>
        ))}
      </div>
    </div>
  );
}
