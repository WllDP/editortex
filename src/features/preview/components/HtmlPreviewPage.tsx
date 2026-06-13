import type { CSSProperties, ReactNode } from "react";
import {
  PAGE_CONTENT_PADDING_BOTTOM,
  PAGE_CONTENT_PADDING_TOP,
  PAGE_HEIGHT,
  PAGE_WIDTH,
} from "@/features/preview/components/htmlPreviewModel";
import { cn } from "@/utils/cn";

export function HtmlPreviewPage({
  backgroundImageUrl,
  backgroundMirrored,
  children,
  fontFamily,
  footerImageUrl,
  overflowHint,
  pageNumber,
  scale,
}: {
  backgroundImageUrl?: string;
  backgroundMirrored?: boolean;
  children: ReactNode;
  fontFamily: string;
  footerImageUrl?: string;
  overflowHint?: boolean;
  pageNumber: number;
  scale: number;
}) {
  return (
    <div
      style={{
        width: PAGE_WIDTH * scale,
        height: PAGE_HEIGHT * scale,
      }}
    >
      <section
        className="latex-visual-page relative origin-top-left overflow-hidden border border-white/25 bg-white text-zinc-950 shadow-[0_28px_90px_rgba(0,0,0,0.46)]"
        style={
          {
            "--latex-preview-font-family": fontFamily,
            width: PAGE_WIDTH,
            height: PAGE_HEIGHT,
            fontFamily,
            transform: `scale(${scale})`,
          } as CSSProperties
        }
      >
        {backgroundImageUrl ? (
          <img
            className={cn("absolute inset-0 z-0 h-full w-full", backgroundMirrored && "-scale-x-100")}
            src={backgroundImageUrl}
            alt=""
          />
        ) : null}
        <div
          className="relative z-[1] box-border h-full px-[84px]"
          style={{
            paddingBottom: PAGE_CONTENT_PADDING_BOTTOM,
            paddingTop: PAGE_CONTENT_PADDING_TOP,
          }}
        >
          {children}
        </div>
        {footerImageUrl ? (
          <img className="absolute inset-x-0 bottom-0 z-[2] w-full opacity-50" src={footerImageUrl} alt="" />
        ) : null}
        <div className="absolute bottom-6 right-10 z-[2] text-[10px] text-zinc-400">{pageNumber}</div>
        {overflowHint ? (
          <div className="absolute bottom-0 left-0 right-0 z-[3] bg-amber-100 px-8 py-1 text-center text-[11px] font-medium text-amber-900">
            Conteudo estimado acima da altura da pagina. Confira no PDF fiel.
          </div>
        ) : null}
      </section>
    </div>
  );
}
