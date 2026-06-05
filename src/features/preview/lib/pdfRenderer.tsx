import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions, Util } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

interface PdfRendererProps {
  pdfUrl?: string;
  onTextDoubleClick?: (text: string) => void;
}

interface PdfPageSize {
  width: number;
  height: number;
}

const PDF_CSS_UNITS = 96 / 72;
const PREVIEW_PADDING_X = 48;
const MIN_PREVIEW_SCALE = 0.52;

export function PdfRenderer({ pdfUrl, onTextDoubleClick }: PdfRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [message, setMessage] = useState("Aguardando PDF compilado");
  const [pdf, setPdf] = useState<any>();
  const [numPages, setNumPages] = useState(0);
  const [pageSize, setPageSize] = useState<PdfPageSize>({ width: 794, height: 1123 });
  const [viewportWidth, setViewportWidth] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageCacheRef = useRef(new Map<number, Promise<any>>());
  const pdfRef = useRef<any>();
  const pageScale = useMemo(() => {
    if (!viewportWidth) {
      return 1;
    }

    const availableWidth = Math.max(viewportWidth - PREVIEW_PADDING_X, 0);
    return Math.min(1, Math.max(MIN_PREVIEW_SCALE, availableWidth / pageSize.width));
  }, [pageSize.width, viewportWidth]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateWidth = () => setViewportWidth(container.clientWidth);
    updateWidth();
    const animationFrameId = window.requestAnimationFrame(updateWidth);

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    void pdfRef.current?.destroy?.();
    pdfRef.current = undefined;
    pageCacheRef.current.clear();
    setPdf(undefined);
    setNumPages(0);

    if (!pdfUrl) {
      setMessage("Preview PDF real sera exibido apos a compilacao LaTeX.");
      return;
    }

    let disposed = false;
    const startedAt = performance.now();
    setMessage("Carregando PDF...");

    async function loadPdf() {
      try {
        const loadingTask = getDocument({
          url: pdfUrl,
          disableRange: true,
          disableStream: true,
        });
        const loadedPdf = await loadingTask.promise;
        const firstPage = await getCachedPage(loadedPdf, pageCacheRef.current, 1);
        const firstViewport = firstPage.getViewport({ scale: PDF_CSS_UNITS });

        if (disposed) {
          void loadedPdf.destroy?.();
          return;
        }

        pdfRef.current = loadedPdf;
        setPdf(loadedPdf);
        setNumPages(loadedPdf.numPages);
        setPageSize({ width: firstViewport.width, height: firstViewport.height });
        setCurrentPage(1);
        setMessage("");
        console.info(
          `[EditorTex perf] pdf.js carregar documento: ${(performance.now() - startedAt).toFixed(1)}ms | paginas=${loadedPdf.numPages}`,
        );
      } catch (error) {
        if (!disposed) {
          setPdf(undefined);
          setNumPages(0);
          setMessage(error instanceof Error ? error.message : "Falha ao renderizar PDF.");
        }
      }
    }

    void loadPdf();

    return () => {
      disposed = true;
    };
  }, [pdfUrl]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !numPages) {
      return;
    }

    const updateVisiblePage = () => {
      const pageStep = pageSize.height * pageScale + 16;
      const nextPage = Math.min(numPages, Math.max(1, Math.round(container.scrollTop / pageStep) + 1));
      setCurrentPage(nextPage);
    };

    updateVisiblePage();
    container.addEventListener("scroll", updateVisiblePage, { passive: true });
    return () => container.removeEventListener("scroll", updateVisiblePage);
  }, [numPages, pageScale, pageSize.height]);

  const pages = useMemo(() => Array.from({ length: numPages }, (_, index) => index + 1), [numPages]);
  const getPage = useCallback((pageNumber: number) => getCachedPage(pdf, pageCacheRef.current, pageNumber), [pdf]);

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-[#eef1f7] p-6">
      <div className="mx-auto flex w-fit flex-col gap-4">
        {pages.map((pageNumber) => {
          const shouldRender = Math.abs(pageNumber - currentPage) <= 1;
          return (
            <PdfPage
              key={`${pdfUrl}-${pageNumber}`}
              active={shouldRender}
              pageNumber={pageNumber}
              pageSize={pageSize}
              pageScale={pageScale}
              pdf={pdf}
              renderTextLayer={pageNumber === currentPage}
              getPage={getPage}
              onTextDoubleClick={onTextDoubleClick}
            />
          );
        })}
      </div>
      {message ? (
        <div className="mx-auto mt-8 max-w-xs border bg-white p-4 text-center text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}
    </div>
  );
}

function PdfPage({
  active,
  pageNumber,
  pageSize,
  pageScale,
  pdf,
  renderTextLayer: shouldRenderTextLayer,
  getPage,
  onTextDoubleClick,
}: {
  active: boolean;
  pageNumber: number;
  pageSize: PdfPageSize;
  pageScale: number;
  pdf?: any;
  renderTextLayer: boolean;
  getPage: (pageNumber: number) => Promise<any>;
  onTextDoubleClick?: (text: string) => void;
}) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const renderIdRef = useRef(0);

  useEffect(() => {
    const pageContainer = pageRef.current;
    if (!pageContainer || !pdf || !active) {
      return;
    }

    let disposed = false;
    let renderTask: { promise: Promise<unknown>; cancel: () => void } | undefined;
    const renderId = renderIdRef.current + 1;
    renderIdRef.current = renderId;
    const startedAt = performance.now();
    const target = pageContainer;
    target.replaceChildren(createPageRenderMessage(`Renderizando pagina ${pageNumber}...`));

    async function renderPage() {
      const page = await getPage(pageNumber);
      const viewport = page.getViewport({ scale: PDF_CSS_UNITS * pageScale });
      const outputScale = window.devicePixelRatio || 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.className = "absolute inset-0 z-[1] bg-white shadow-none";
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const context = canvas.getContext("2d");
      if (!context || disposed || renderIdRef.current !== renderId) {
        return;
      }

      target.style.width = `${viewport.width}px`;
      target.style.height = `${viewport.height}px`;
      const task = page.render({
        canvasContext: context,
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
      });
      renderTask = task;
      await task.promise;

      if (disposed || renderIdRef.current !== renderId) {
        return;
      }

      target.replaceChildren(canvas);
      if (shouldRenderTextLayer) {
        await renderTextLayer(page, viewport, target, onTextDoubleClick);
      }
      console.info(
        `[EditorTex perf] pdf.js render pagina ${pageNumber}: ${(performance.now() - startedAt).toFixed(1)}ms | textLayer=${shouldRenderTextLayer ? "sim" : "nao"}`,
      );
    }

    void renderPage().catch((error) => {
      if (!disposed && renderIdRef.current === renderId) {
        target.replaceChildren();
        target.textContent = error instanceof Error ? error.message : "Falha ao renderizar pagina.";
      }
    });

    return () => {
      disposed = true;
      renderTask?.cancel();
      if (renderIdRef.current === renderId) {
        target.replaceChildren();
      }
    };
  }, [active, getPage, onTextDoubleClick, pageNumber, pageScale, pdf, shouldRenderTextLayer]);

  return (
    <div
      ref={pageRef}
      className="relative bg-white"
      style={{
        width: `${pageSize.width * pageScale}px`,
        height: `${pageSize.height * pageScale}px`,
      }}
    />
  );
}

function createPageRenderMessage(message: string) {
  const element = document.createElement("div");
  element.className =
    "absolute inset-0 z-[3] grid place-items-center bg-white text-center text-xs font-medium text-slate-400";
  element.textContent = message;
  return element;
}

function getCachedPage(pdf: any, cache: Map<number, Promise<any>>, pageNumber: number) {
  const cached = cache.get(pageNumber);
  if (cached) {
    return cached;
  }

  const request = pdf.getPage(pageNumber);
  cache.set(pageNumber, request);
  return request;
}

async function renderTextLayer(
  page: any,
  viewport: { transform: number[]; height: number; scale: number },
  pageContainer: HTMLDivElement,
  onTextDoubleClick?: (text: string) => void,
) {
  const textContent = await page.getTextContent();
  const layer = document.createElement("div");
  layer.className = "absolute inset-0 z-[2] overflow-hidden";
  const textSpans: HTMLSpanElement[] = [];

  for (const item of textContent.items) {
    if (!("str" in item) || !item.str.trim()) {
      continue;
    }

    const transform = Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.max(Math.hypot(transform[2], transform[3]), 8);
    const width = Math.max(Number(item.width ?? 0) * viewport.scale, fontHeight);
    const span = document.createElement("span");
    span.textContent = item.str;
    span.dataset.previewText = item.str;
    span.className = "absolute cursor-pointer select-text";
    span.style.left = `${transform[4]}px`;
    span.style.top = `${transform[5] - fontHeight}px`;
    span.style.width = `${width}px`;
    span.style.height = `${fontHeight * 1.35}px`;
    span.style.fontSize = `${fontHeight}px`;
    span.style.lineHeight = "1";
    span.style.color = "rgba(0,0,0,0.01)";
    span.style.background = "rgba(0,120,215,0.001)";
    span.style.whiteSpace = "pre";
    span.style.pointerEvents = "auto";
    span.style.userSelect = "text";
    span.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onTextDoubleClick?.(item.str);
    });
    textSpans.push(span);
    layer.appendChild(span);
  }

  layer.addEventListener("dblclick", (event) => {
    if (event.target !== layer) {
      return;
    }

    const nearestText = findNearestTextSpan(event.clientX, event.clientY, textSpans);
    if (!nearestText) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onTextDoubleClick?.(nearestText);
  });

  pageContainer.appendChild(layer);
}

function findNearestTextSpan(clientX: number, clientY: number, spans: HTMLSpanElement[]) {
  let best: { text: string; distance: number } | undefined;

  for (const span of spans) {
    const rect = span.getBoundingClientRect();
    const dx = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
    const dy = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
    const distance = Math.hypot(dx, dy);

    if (distance > 48) {
      continue;
    }

    if (!best || distance < best.distance) {
      best = {
        text: span.dataset.previewText ?? "",
        distance,
      };
    }
  }

  return best?.text;
}
