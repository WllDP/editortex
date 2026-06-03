import Editor, { type Monaco } from "@monaco-editor/react";
import { useEffect } from "react";
import { useGeneratedLatex } from "@/hooks/useGeneratedLatex";
import { useEditorStore } from "@/store/editorStore";

export function TexSourcePanel() {
  const generatedTex = useGeneratedLatex();
  const texDirty = useEditorStore((state) => state.preview.texDirty);
  const refreshGeneratedTex = useEditorStore((state) => state.refreshGeneratedTex);

  useEffect(() => {
    if (texDirty) {
      refreshGeneratedTex();
    }
  }, [refreshGeneratedTex, texDirty]);

  return (
    <section className="relative z-20 flex min-h-0 flex-1 flex-col bg-[#050816]">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/14 bg-white/[0.055] px-4 text-xs font-semibold text-white backdrop-blur-xl">
        <span>TEX gerado</span>
        <span className="rounded-full border border-white/14 bg-white/[0.075] px-2.5 py-1 text-[#D1D5DB]">somente leitura</span>
      </div>
      <div className="tex-source-monaco min-h-0 flex-1 bg-[#050816]">
        <Editor
          height="100%"
          language="latex"
          theme="editortex-dark"
          value={generatedTex}
          beforeMount={configureTexEditorTheme}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 12,
            wordWrap: "on",
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </section>
  );
}

function configureTexEditorTheme(monaco: Monaco) {
  monaco.editor.defineTheme("editortex-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#050816",
      "editorGutter.background": "#050816",
      "editorLineNumber.foreground": "#64748B",
      "editorLineNumber.activeForeground": "#CBD5E1",
      "editorCursor.foreground": "#22D3EE",
    },
  });
}
