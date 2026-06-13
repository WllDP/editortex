import { ListItemNode, ListNode } from "@lexical/list";
import { LinkNode } from "@lexical/link";
import { LexicalComposer } from "@lexical/react/LexicalComposer.js";
import { ContentEditable } from "@lexical/react/LexicalContentEditable.js";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary.js";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin.js";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin.js";
import { ListPlugin } from "@lexical/react/LexicalListPlugin.js";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin.js";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin.js";
import { $createParagraphNode, $createTextNode, $getRoot, type EditorState, type LexicalEditor } from "lexical";
import { useMemo } from "react";

import { LexicalToolbar } from "./LexicalToolbar";
import type { RichTextValue } from "@/types/editor";

type LexicalTextEditorProps = {
  value: string;
  lexicalJson?: string;
  placeholder?: string;
  onFocus?: () => void;
  onChange: (value: RichTextValue) => void;
};

const theme = {
  paragraph: "my-2 first:mt-0 last:mb-0",
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline underline-offset-2",
  },
  list: {
    ul: "my-2 list-disc space-y-1 pl-5",
    listitem: "pl-1",
  },
  link: "text-cyan-200 underline underline-offset-2",
};

export function LexicalTextEditor({ value, lexicalJson, placeholder, onFocus, onChange }: LexicalTextEditorProps) {
  const initialConfig = useMemo(
    () => ({
      namespace: "EditorLatexPlainText",
      nodes: [ListNode, ListItemNode, LinkNode],
      theme,
      onError(error: Error) {
        throw error;
      },
      editorState: (editor: LexicalEditor) => initializeEditor(editor, lexicalJson, value),
    }),
    [lexicalJson, value],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        className="overflow-hidden rounded-2xl border border-white/12 bg-black/15 shadow-inner shadow-black/20 focus-within:border-cyan-300/45 focus-within:ring-2 focus-within:ring-cyan-300/15"
        onFocus={onFocus}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <LexicalToolbar />
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="min-h-[104px] w-full resize-y overflow-auto px-3 py-2.5 text-sm leading-relaxed text-white/88 outline-none" />
            }
            placeholder={
              <div className="pointer-events-none absolute left-3 top-2.5 text-sm text-white/35">
                {placeholder ?? "Digite o texto..."}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
      </div>
      <HistoryPlugin />
      <ListPlugin />
      <LinkPlugin />
      <OnChangePlugin onChange={(editorState) => emitChange(editorState, onChange)} />
    </LexicalComposer>
  );
}

function initializeEditor(editor: LexicalEditor, lexicalJson: string | undefined, plainText: string) {
  if (lexicalJson?.trim()) {
    try {
      editor.setEditorState(editor.parseEditorState(lexicalJson));
      return;
    } catch {
      // Fallback below keeps older/plain documents editable if a serialized state is invalid.
    }
  }

  editor.update(() => {
    const root = $getRoot();
    root.clear();

    const paragraph = $createParagraphNode();
    if (plainText) {
      paragraph.append($createTextNode(plainText));
    }
    root.append(paragraph);
  });
}

function emitChange(editorState: EditorState, onChange: (value: RichTextValue) => void) {
  let plainText = "";
  editorState.read(() => {
    plainText = $getRoot().getTextContent();
  });

  onChange({
    plainText,
    lexicalJson: JSON.stringify(editorState.toJSON()),
  });
}
