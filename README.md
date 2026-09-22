# @govnex/ui

Nucleo visual compartilhado dos produtos GOVNEX.

O pacote contem somente componentes e tokens independentes de produto,
roteamento, autorizacao e transporte. Integracoes com Laravel/Inertia devem
ficar nos aplicativos ou em adaptadores separados.

## Camadas atuais

- `components`: primitivos visuais, incluindo campos, dialogs, alert dialogs,
  sheets, drawers, superficies, cards, tabelas e feedback de progresso.
- `patterns`: composicoes GOVNEX para cabecalho de pagina, estado vazio,
  indicadores e acoes de tabela.
- `icons`: ponte oficial para Solar Icons; consumidores nao devem importar a
  biblioteca de icones diretamente.
- `styles.css`: tokens claro/escuro, tipografia e escala de raios GOVNEX.

Componentes de produto, chamadas HTTP, rotas, permissoes e estado do Inertia
nao pertencem a este pacote.

## Instalacao

Repositorio privado, instalado via dependencia Git (sem registry por enquanto):

```json
"dependencies": {
    "@govnex/ui": "git+https://github.com/juniorjmenezes/govnex-ui.git"
}
```

O `npm install` roda o script `prepare` automaticamente apos clonar,
compilando `dist/` (nao versionado) antes de disponibilizar o pacote.

## Uso

```tsx
import { Button, Input } from '@govnex/ui';
```

Icones podem ser importados pela entrada dedicada:

```tsx
import { CalendarIcon } from '@govnex/ui/icons';
```

No CSS principal do consumidor, importe o tema depois do Tailwind e do
shadcn:

```css
@import 'tailwindcss';
@import 'shadcn/tailwind.css';
@import '@govnex/ui/styles.css';
```

### `@source` obrigatorio (Tailwind v4)

A deteccao automatica de conteudo do Tailwind v4 ignora o que estiver no
`.gitignore` do consumidor — e `node_modules` normalmente esta la. Sem o
`@source` abaixo, as classes usadas dentro de `dist/index.js` (ex.:
`tracking-widest`, `group/button`) nunca sao geradas, e a interface fica
sem estilo nenhum: bordas, cores e radius somem, sobra so texto puro.

```css
@source '../../node_modules/@govnex/ui/dist';
```

(ajuste o caminho relativo conforme a posicao do `app.css` no projeto).
Isso so se aplica a quem instala via `node_modules` — o GOVNEX GAB, que
consome `packages/govnex-ui/src` direto do proprio repositorio (nao
ignorado pelo git), nao precisa disso.

Enquanto o pacote estiver em `0.x`, novas extracoes devem ser validadas no
GOVNEX GAB e em pelo menos outro produto GOVNEX antes de estabilizar a API.
