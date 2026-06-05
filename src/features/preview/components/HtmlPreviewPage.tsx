import type { ReactNode } from "react";
import { PAGE_HEIGHT, PAGE_WIDTH } from "@/features/preview/components/htmlPreviewModel";

export function HtmlPreviewPage({
  children,
  overflowHint,
  pageNumber,
  scale,
}: {
  children: ReactNode;
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
        className="relative origin-top-left overflow-hidden border border-white/25 bg-white text-zinc-950 shadow-[0_28px_90px_rgba(0,0,0,0.46)]"
        style={{
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT,
          fontFamily: "Montserrat, Arial, sans-serif",
          transform: `scale(${scale})`,
        }}
      >
        <div className="h-full px-[84px] pb-[80px] pt-[74px]">{children}</div>
        <div className="absolute bottom-6 right-10 text-[10px] text-zinc-400">{pageNumber}</div>
        {overflowHint ? (
          <div className="absolute bottom-0 left-0 right-0 bg-amber-100 px-8 py-1 text-center text-[11px] font-medium text-amber-900">
            Conteudo estimado acima da altura da pagina. Confira no PDF fiel.
          </div>
        ) : null}
      </section>
    </div>
  );
}
