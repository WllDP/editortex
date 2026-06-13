# Latex Template Rules

Leia tambem [COMPILATION_PIPELINE.md](./COMPILATION_PIPELINE.md) e [PERFORMANCE_GUIDELINES.md](./PERFORMANCE_GUIDELINES.md).

## fastpreview

Todo TEX compilado na aba PDF (`pdf-preview`) deve receber, por padrao:

```tex
\newif\iffastpreview
\fastpreviewfalse
```

O preview rapido e uma qualidade explicita/opt-in. Apenas nesse caso `pdf-preview` deve receber:

```tex
\newif\iffastpreview
\fastpreviewtrue
```

Todo TEX compilado em `pdf-final` tambem deve receber `\fastpreviewfalse`.

O transformador atual remove flags existentes antes de reinserir a flag correta, evitando duplicacao.

## Padrao para Templates

Templates devem condicionar elementos caros:

```tex
\iffastpreview
  % versao leve ou nada
\else
  % versao final fiel
\fi
```

Nunca coloque conteudo essencial apenas no ramo final. O preview deve continuar semanticamente util.

## Diferencas Preview/Final

- Preview prioriza tempo de resposta e estabilidade.
- Final prioriza fidelidade visual.
- Preview pode omitir backgrounds, capas decorativas e overlays pesados.
- Final nao deve perder elementos visuais.

## Texto Livre Rico

O bloco `Texto Livre` pode ter conteudo serializado por Lexical em `__lexicalJson`. Quando esse JSON existir, a geracao do TEX deve usar `lexicalJsonToLatex`; quando nao existir, deve manter o fallback plain text atual.

Mapeamentos atuais:

- bold: `\textbf{texto}`
- italic: `\textit{texto}`
- underline: `\underline{texto}`
- unordered list: `\begin{itemize}` com `\item`
- link: `\href{url}{texto}`

Texto vindo do Lexical deve ser escapado antes de entrar no LaTeX. Nao use conteudo rico como LaTeX bruto.

## Fonte no Preview Visual

O preview Visual deve tentar refletir a fonte principal declarada pelo template importado. A resolucao atual le o LaTeX do template e arquivos textuais importados (`.tex`, `.sty`, `.cls`) procurando:

- `\setmainfont{...}`
- `\setsansfont{...}`
- `\newfontfamily\...{...}`
- pacotes conhecidos como `\usepackage{montserrat}`

Exemplo:

```tex
\usepackage[sfdefault]{montserrat}
```

deve aplicar `"Montserrat", Arial, sans-serif` no preview Visual.

Montserrat e suportada como fonte embutida do app via `@fontsource/montserrat` nos subsets `latin` e `latin-ext`, pesos 400, 500, 600 e 700. Para outras fontes, a deteccao pode resolver o `font-family`, mas a fonte so sera renderizada fielmente se estiver instalada no sistema, vier como asset do projeto, ou for adicionada explicitamente ao bundle.

## Fundos de Capitulo no Preview Visual

O preview Visual deve inferir fundos de capitulo a partir do LaTeX importado, nao por nomes hardcoded no componente.

Caso suportado atualmente:

```tex
\newcommand{\ChapterBackground}{%
  ...
  \includegraphics[
    width=\paperwidth,
    height=\paperheight
  ]{fundo_titulo}%
}

\pretocmd{\chapter}{%
  ...
  \ChapterBackground
}{}{}
```

Quando esse padrao existir, o preview Visual deve aplicar a imagem extraida da macro como fundo full-page do bloco `chapter`. Se houver `\reflectbox{\includegraphics...}` em capitulos especiais, o preview pode espelhar horizontalmente a imagem para aproximar o layout.

Outras imagens estruturais tambem devem ser inferidas do LaTeX quando possivel:

- imagens em `\capaCustomizada` alimentam cabecalho/logo da capa visual;
- imagens em `\titleformat{name=\chapter}` alimentam o icone de titulo de capitulo;
- referencias `\includegraphics{nome}` sem extensao devem resolver assets importados como `nome.png`, `nome.jpg`, etc.

## Elementos Caros

- TikZ overlay
- AddToShipoutPictureBG
- full page backgrounds
- imagens grandes
- bibliografia pesada
- fontes customizadas com setup caro
- capas com multiplas imagens em alta resolucao
- hooks de shipout complexos

## Heuristicas Atuais

`src/infrastructure/latex-compiler/fastPreviewLatex.ts` condiciona no preview:

- linhas com `\AddToShipoutPictureBG`;
- hooks `shipout/foreground` e `shipout/background`;
- `\PaginaFinalImagem`;
- `\capaCustomizada`;
- blocos `tikzpicture` com `remember picture` ou `overlay`.

O Tauri injeta a flag `fastpreview`; a heuristica mais rica de condicionamento esta no fluxo TypeScript/Node. Ao adicionar heuristicas no Rust, mantenha comportamento equivalente.

## Stubs Seguros no Preview

No `pdf-preview`, definicoes decorativas inteiras devem ser substituidas por stubs seguros. Nao envolva apenas a primeira linha da macro com `\iffastpreview`, porque o corpo pode continuar ativo parcialmente e executar comandos fora de ordem.

Caso real corrigido:

```txt
Undefined control sequence.
l.51 \RodapeAtivofalse
```

O erro aconteceu porque o corpo de `\capaCustomizada` continuou ativo no preview e executou:

```tex
\RodapeAtivofalse
```

antes da definicao:

```tex
\newif\ifRodapeAtivo
```

Stubs esperados no preview rapido:

```tex
\providecommand{\capaCustomizada}{}
\providecommand{\PaginaFinalImagem}[1]{}
```

Blocos de background/shipout decorativos tambem devem ser removidos no preview rapido, nao deixados parcialmente ativos.

## Preview Sem Paginas

O `pdf-preview` nunca deve gerar um TEX que compile com zero paginas. Se as heuristicas removerem toda a capa/background e o corpo efetivo ficar vazio, o transformador deve inserir uma pagina placeholder visivel:

```tex
\EditorLatexFastPreviewPlaceholder
```

Caso real:

```tex
\begin{document}
\iffastpreview\else \capaCustomizada \fi
\end{document}
```

Com `\fastpreviewtrue`, esse corpo nao produz pagina. O placeholder existe apenas para manter o PDF renderizavel no preview, deve ter texto claro para nao parecer uma pagina branca e nao deve aparecer no `pdf-final`.

## Regras para Novos Templates

- Declare assets com caminhos relativos estaveis.
- Evite paths absolutos.
- Evite depender de ordem de arquivos do ZIP.
- Referencias relativas como `\includegraphics{icone.png}` devem continuar funcionando quando `main.tex` esta em subdiretorio; o backend injeta `\graphicspath` a partir do manifest.
- Use `\iffastpreview` em elementos decorativos caros.
- Nao use data/hora atual no TEX gerado.
- Nao escreva arquivos fora do projeto.
- Mantenha `main.tex` ou um `.tex` com `\documentclass` detectavel.
