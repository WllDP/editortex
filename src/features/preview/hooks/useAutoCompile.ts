import { useEffect } from "react";

export function useAutoCompile({
  canCompilePreview,
  compilePreview,
  compiledRevision,
  documentRevision,
  enabled,
  status,
}: {
  canCompilePreview: boolean;
  compilePreview: (mode?: "preview" | "final") => Promise<void>;
  compiledRevision?: number;
  documentRevision: number;
  enabled: boolean;
  status: "idle" | "queued" | "rendering" | "ready" | "error";
}) {
  useEffect(() => {
    if (!canCompilePreview || !enabled) {
      return;
    }

    const hasPendingRevision = compiledRevision !== documentRevision;
    if (status !== "queued" && !(status === "ready" && hasPendingRevision)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void compilePreview("preview");
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [canCompilePreview, compilePreview, compiledRevision, documentRevision, enabled, status]);
}
