import { Download, FileArchive, FileJson, FileText } from "lucide-react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";

interface ExportMenuProps {
  buttonRef: RefObject<HTMLButtonElement>;
  menuRef: RefObject<HTMLDivElement>;
  isOpen: boolean;
  position?: { top: number; right: number };
  onToggle: () => void;
  onExportJson: () => void;
  onExportTex: () => void;
  onExportZip: () => void;
}

export function ExportMenu({
  buttonRef,
  menuRef,
  isOpen,
  position,
  onToggle,
  onExportJson,
  onExportTex,
  onExportZip,
}: ExportMenuProps) {
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="grid h-11 w-11 place-items-center rounded-2xl border border-white/16 bg-white/[0.075] text-[#22D3EE] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] transition-colors duration-200 hover:border-[#22D3EE]/45 hover:bg-white/[0.12] hover:text-white"
        aria-label="Abrir menu de download"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <Download className="h-5 w-5" />
      </button>
      {isOpen && position
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[100] w-44 rounded-2xl border border-[#2F3B59] bg-[#111936] p-1.5 text-white shadow-[0_18px_48px_rgba(0,0,0,0.52)]"
              style={{ top: position.top, right: position.right }}
            >
              <ExportMenuItem icon={FileText} label="Baixar TEX" onClick={onExportTex} />
              <ExportMenuItem icon={FileJson} label="Baixar JSON" onClick={onExportJson} />
              <ExportMenuItem icon={FileArchive} label="Baixar ZIP" onClick={onExportZip} />
            </div>,
            window.document.body,
          )
        : null}
    </>
  );
}

function ExportMenuItem({ icon: Icon, label, onClick }: { icon: typeof FileText; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold leading-none text-white transition-colors duration-200 hover:bg-[#243153]"
      onClick={onClick}
    >
      <Icon className="h-4 w-4 text-[#22D3EE]" />
      {label}
    </button>
  );
}
