export type NativeTemplate = {
  id: string;
  name: string;
  description: string;
  fileName: string;
  assetUrl: string;
};

export const nativeTemplates: NativeTemplate[] = [
  {
    id: "relatorio-maturidade",
    name: "Relatorio de maturidade",
    description: "Template nativo para relatorios de maturidade com capa, capitulos e pagina final.",
    fileName: "relatorio-de-maturidade-template-nativo.zip",
    assetUrl: `${import.meta.env.BASE_URL}templates/relatorio-de-maturidade-template-nativo.zip`,
  },
];
