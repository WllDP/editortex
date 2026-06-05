export type LatexCommandKind = "newcommand" | "renewcommand" | "macro";

export interface LatexCommand {
  name: string;
  kind: LatexCommandKind;
  parameterCount: number;
  rawDefinition: string;
  body: string;
}

export interface LatexVariable {
  name: string;
  sourceCommand: string;
  parameterCount: number;
  defaultValue?: string;
}

export interface LatexEnvironment {
  name: string;
  parameterCount: number;
  beginDefinition?: string;
  endDefinition?: string;
  rawDefinition: string;
}

export interface ParsedLatexTemplate {
  id: string;
  name: string;
  rawContent: string;
  preamble: string;
  body: string;
  commands: LatexCommand[];
  variables: LatexVariable[];
  environments: LatexEnvironment[];
  parsedAt: string;
}

export type UploadedTemplateSourceType = "tex-file" | "overleaf-zip";

export type LatexProjectFileKind = "tex" | "image" | "bib" | "class" | "style" | "pdf" | "auxiliary" | "other";

export interface LatexProjectFile {
  path: string;
  name: string;
  extension: string;
  kind: LatexProjectFileKind;
  size: number;
  content?: string;
  binaryBase64?: string;
  objectUrl?: string;
  mimeType?: string;
}

export interface LatexProjectAsset {
  path: string;
  name: string;
  extension: string;
  size: number;
  mimeType: string;
  objectUrl: string;
}

export interface UploadedLatexProject {
  sourceType: UploadedTemplateSourceType;
  archiveName?: string;
  rootPath?: string;
  mainTexPath: string;
  files: LatexProjectFile[];
  assets: LatexProjectAsset[];
}

export interface UploadedTemplate {
  id: string;
  name: string;
  fileName: string;
  content: string;
  sourceType: UploadedTemplateSourceType;
  project: UploadedLatexProject;
  parsedTemplate: ParsedLatexTemplate;
  createdAt: string;
}
