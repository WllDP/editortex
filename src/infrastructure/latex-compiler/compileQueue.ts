import { cancelCurrentCompile, compileLatexPreview } from "./latexCompiler";
import { sanitizeCacheKey } from "./pdfCache";
import type { CompileSession, PreviewCompileRequest, PreviewCompileResult } from "./types";

const compileSessions = new Map<string, CompileSession>();

export function enqueueLatexPreviewCompile(payload: PreviewCompileRequest): Promise<PreviewCompileResult> {
  const projectKey = sanitizeCacheKey(payload.projectKey ?? "standalone");
  const session = compileSessions.get(projectKey) ?? { isCompiling: false };
  compileSessions.set(projectKey, session);

  if (!session.isCompiling) {
    session.isCompiling = true;
    return runCompileSession(session, payload);
  }

  cancelCurrentCompile(session, `revisao nova ${payload.revision ?? "-"}`);
  session.pending?.resolve({
    diagnostics: ["Compilacao substituida por uma revisao mais recente."],
  });

  return new Promise((resolve, reject) => {
    session.pending = {
      payload,
      resolve,
      reject,
    };
  });
}

async function runCompileSession(
  session: CompileSession,
  payload: PreviewCompileRequest,
): Promise<PreviewCompileResult> {
  try {
    return await compileLatexPreview(payload, session);
  } finally {
    session.currentProcess = undefined;
    const pending = session.pending;
    if (pending) {
      session.pending = undefined;
      void runCompileSession(session, pending.payload).then(pending.resolve, pending.reject);
    } else {
      session.isCompiling = false;
    }
  }
}
