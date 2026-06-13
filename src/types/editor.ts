export const lexicalTextDataKey = "__lexicalJson";

export type SerializedLexicalNode = {
  type?: string;
  text?: string;
  format?: number;
  url?: string;
  listType?: string;
  children?: SerializedLexicalNode[];
};

export type SerializedLexicalEditorState = {
  root?: SerializedLexicalNode;
};

export type RichTextValue = {
  plainText: string;
  lexicalJson: string;
};
