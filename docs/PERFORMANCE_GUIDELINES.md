# Performance Guidelines

Leia tambem [CACHE_STRATEGY.md](./CACHE_STRATEGY.md), [PROJECT_MANIFEST.md](./PROJECT_MANIFEST.md) e [AGENT_RULES.md](../AGENT_RULES.md).

## Regras Obrigatorias

- Nunca usar `Date.now()` como cache key ou cache buster de PDF.
- Nunca armazenar `binaryBase64` permanente no estado global.
- Assets devem ser sincronizados por hash.
- Preview deve usar cache persistente.
- `pdf-preview` nunca deve remover auxiliares a cada compilacao.
- A aba PDF deve renderizar preview fiel por padrao: `previewQuality=faithful` e `\fastpreviewfalse`.
- `fastpreview` deve ser opt-in para preview rapido, nao o comportamento padrao do PDF visivel ao usuario.
- `pdf-final` deve ficar separado do preview.
- pdf.js deve usar range/stream loading.
- Cache hit deve evitar chamada LaTeX.
- Node/Vite e Tauri devem permanecer funcionalmente equivalentes.
- No fluxo Vite/dev com projeto importado, compilar com `usePersistedProject=true` e payload minimo.
- FastPreview deve remover/substituir blocos decorativos inteiros por stubs seguros, nunca deixar corpo de macro parcialmente ativo.
- Cache/preview de PDF so pode reutilizar arquivo renderizavel: tamanho maior que zero e assinatura `%PDF-`.
- `pdf-preview` deve produzir ao menos uma pagina renderizavel; se as heuristicas deixarem o corpo vazio, usar placeholder visivel com aviso explicito.
- Resolucao de assets LaTeX deve usar manifest/`\graphicspath` no backend quando `main.tex` vem de subdiretorio.
- O viewer PDF nao deve depender de `viewportWidth > 0` para iniciar renderizacao; largura zero inicial deve ter fallback.

## Anti-patterns Proibidos

- URL de PDF com `?t=${Date.now()}`.
- Nome de TEX preview com revisao, como `.preview.${revision}.tex`.
- Apagar `.aux`, `.toc`, `.fdb_latexmk`, `.fls` em toda compilacao preview.
- Reenviar todos os assets em base64 a cada compilacao.
- Enviar ZIP/assets grandes dentro de JSON monolitico para `/api/compile-preview`.
- Guardar imagens importadas como base64 permanente na store.
- Fazer o frontend decidir que arquivos persistidos devem ser escritos/removidos.
- Misturar PDF de preview e final no mesmo caminho persistente.
- Recalcular TEX em todo clique quando `texDirty === false`.
- Envolver apenas a primeira linha de macros decorativas no `fastpreview` e deixar o corpo ativo no preview.
- Tratar `output.pdf` vazio ou sem assinatura PDF como sucesso/cache hit.
- Deixar `pdf-preview` compilar com `No pages of output`.
- Corrigir `\includegraphics` reintroduzindo base64 ou reescrevendo paths no frontend.

## Medicao

Metricas esperadas em `CompileMetrics`:

- `texGenerationMs`
- `zipReadMs`
- `zipExtractMs`
- `zipClassifyMs`
- `mainTexDetectionMs`
- `assetHashMs`
- `requestSerializeMs`
- `requestRoundTripMs`
- `requestSizeMb`
- `importMs`
- `importZipReadMs`
- `importZipExtractMs`
- `importManifestSaveMs`
- `importRequestBytes`
- `importRequestRoundTripMs`
- `compileRequestBytes`
- `manifestLoadMs`
- `manifestSaveMs`
- `assetSyncMs`
- `syncMs`
- `writeFilesMs`
- `latexMs`
- `pdfReadMs`
- `totalMs`
- `pdfSizeMb`
- `pageCount`
- `cacheHit`
- `filesWritten`
- `filesSkipped`
- `filesRemoved`
- `assetsPayloadCount`
- `manifestLoaded`
- `fastPreview`

Logs de dev devem seguir formato semelhante:

```txt
[EditorLatex Compile] mode=pdf-preview fastPreview=true cacheHit=false syncMs=42.0 latexMs=1600.0 filesWritten=1 filesSkipped=8 assetsPayloadCount=1 pdfSizeMb=8.4
```

## Prioridades de Performance

1. Evitar chamada LaTeX quando cache hit for valido.
2. Evitar reescrita de arquivos sem mudanca.
3. Evitar payload base64.
4. Preservar auxiliares no preview.
5. Reduzir custo do template via `\iffastpreview`.
6. Renderizar PDF sem reload desnecessario.

## Gargalos Confirmados

Resultado atual de `npm run benchmark:latex` com `c:\Users\Testing Company\Downloads\overleaf-main.zip`:

1. Antes da Etapa 9, o fluxo Vite/dev gerava request JSON de aproximadamente 96.7 MB para compilacao e expirava em cerca de 20 s antes de LaTeX.
2. Depois da Etapa 9, a importacao usa `POST /api/import-project-zip` com `application/octet-stream`: request de importacao ~49.6 MB.
3. Depois da importacao persistente, o request de compilacao tem ~310-314 bytes e `assetsPayloadCount=0`.
4. Preview rapido sem cache: LaTeX ~7134.7 ms, total backend ~7710.5 ms.
5. Preview rapido cache hit: LaTeX 0 ms, total backend ~17.1 ms.
6. Preview final sem cache: LaTeX ~7441.1 ms, total backend ~7486.3 ms.
7. Preview final cache hit: LaTeX 0 ms, total backend ~34.4 ms.
8. Importacao inicial ainda e pesada: `writeFilesMs` ~100608.4 ms em `overleaf-main.zip`.

Gargalos dominantes confirmados apos Etapa 9:

1. Importacao inicial Vite/dev: escrita/leitura de arquivos persistidos (`writeFilesMs`) em ZIP grande.
2. Compilacao sem cache: LaTeX (`latexMs`).
3. Cache hit: custo residual de manifest load/save em poucos milissegundos.

A proxima otimizacao deve mirar importacao persistente/escrita de arquivos antes de novas heuristicas LaTeX.
