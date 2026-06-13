import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import { INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext.js";
import { $getSelection, $isRangeSelection, $isTextNode, FORMAT_TEXT_COMMAND } from "lexical";
import { Bold, Eraser, Italic, Link, List, Underline } from "lucide-react";

const toolbarButtonClass =
  "inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/8 text-white/82 transition hover:bg-white/16 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70";

export function LexicalToolbar() {
  const [editor] = useLexicalComposerContext();

  const clearFormatting = () => {
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      for (const node of selection.getNodes()) {
        if ($isTextNode(node)) {
          node.setFormat(0);
        }
      }
    });
  };

  const createLink = () => {
    const url = window.prompt("URL do link");
    if (!url?.trim()) return;
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url.trim());
  };

  return (
    <div className="flex items-center gap-1 border-b border-white/10 px-2 py-1.5">
      <button
        type="button"
        className={toolbarButtonClass}
        title="Negrito"
        aria-label="Negrito"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={toolbarButtonClass}
        title="Itálico"
        aria-label="Itálico"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={toolbarButtonClass}
        title="Sublinhado"
        aria-label="Sublinhado"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
      >
        <Underline className="h-3.5 w-3.5" />
      </button>
      <span className="mx-1 h-4 w-px bg-white/12" />
      <button
        type="button"
        className={toolbarButtonClass}
        title="Lista com marcadores"
        aria-label="Lista com marcadores"
        onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button type="button" className={toolbarButtonClass} title="Link" aria-label="Link" onClick={createLink}>
        <Link className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={toolbarButtonClass}
        title="Limpar formatação"
        aria-label="Limpar formatação"
        onClick={clearFormatting}
      >
        <Eraser className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
