# Cache Strategy

Leia tambem [PERFORMANCE_GUIDELINES.md](./PERFORMANCE_GUIDELINES.md) e [PROJECT_MANIFEST.md](./PROJECT_MANIFEST.md).

## Cache de TEX

O frontend evita regenerar TEX quando `texDirty === false` e `preview.generatedTex` existe. O backend grava TEX efetivo somente quando o conteudo muda.

O TEX efetivo inclui transformacoes de compilacao, como `fastpreview`, `\graphicspath` e stubs decorativos. O cache em memoria de PDF deve comparar o hash desse TEX efetivo, nao apenas o `sourceHash` original vindo do frontend. Isso evita reutilizar um PDF antigo quando a transformacao do compilador muda sem alteracao do documento.

Arquivos:

- `source/main.preview.tex`
- `source/main.final.tex`
- `compile/main.preview.tex`
- `compile/main.final.tex`

## Cache de PDF

PDFs persistidos por modo:

- `output/preview.pdf`
- `output/final.pdf`

Preview e final nao devem compartilhar o mesmo PDF persistente.

## Cache por Modo

`manifest.lastCompiledByMode` registra:

```json
{
  "pdf-preview": {
    "sourceHash": "...",
    "pdfPath": "output/preview.pdf",
    "compiledAt": 123
  },
  "pdf-final": {
    "sourceHash": "...",
    "pdfPath": "output/final.pdf",
    "compiledAt": 456
  }
}
```

## Cache de Assets

Assets sao cacheados por `path + hash`.

Exemplo:

```json
{
  "path": "figures/chart.png",
  "hash": "abc123",
  "size": 12345,
  "kind": "asset",
  "mimeType": "image/png"
}
```

Se o hash nao mudou e o arquivo existe em `compile/`, o backend pula a escrita.

## Cache Hit

Exemplo de cache hit:

```txt
sourceHash igual
assetManifest igual
output/preview.pdf existe
lastCompiledByMode.pdf-preview.pdfPath == output/preview.pdf
sync escreveu 0 e removeu 0 arquivos
```

Para cache em memoria do preview, a equivalencia tambem exige hash igual do TEX efetivo transformado.

Resultado esperado:

```ts
metrics.cacheHit = true;
metrics.latexMs = 0;
```

## URL de PDF

A URL deve ser estavel por conteudo:

```txt
?revision={revision}&hash={sourceHash}
```

Nao usar timestamps como cache buster.

## Auxiliares LaTeX

No preview, preservar arquivos auxiliares em `compile/`:

- `.aux`
- `.toc`
- `.fdb_latexmk`
- `.fls`
- `.synctex.gz`
- `.out`
- `.bbl`
- `.blg`

No final, limpeza pode ser feita quando necessaria, mas sem afetar o cache de preview.
