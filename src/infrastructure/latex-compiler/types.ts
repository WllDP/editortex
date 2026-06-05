import type { ChildProcess } from "node:child_process";

export interface PreviewProjectFilePayload {
  path: string;
  kind: string;
  content?: string;
  binaryBase64?: string;
}

export interface PreviewCompileRequest {
  tex: string;
  mainTexPath?: string;
  projectKey?: string;
  compileMode?: "preview" | "final";
  revision?: number;
  projectFiles?: PreviewProjectFilePayload[];
}

export interface CompileSession {
  isCompiling: boolean;
  currentProcess?: ChildProcess;
  pending?: QueuedCompile;
}

export interface QueuedCompile {
  payload: PreviewCompileRequest;
  resolve: (result: PreviewCompileResult) => void;
  reject: (error: unknown) => void;
}

export interface PreviewCompileResult {
  pdfPath?: string;
  pdfUrl?: string;
  revision?: number;
  diagnostics: string[];
}
