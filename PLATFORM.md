# Padrão de plataforma GOVNEX

Documento de referência para **todas** as aplicações do ecossistema (GEP, GHO, GRI, GPC, API, Hub). Fica neste repositório só porque ele é o único ponto que todos os produtos já instalam; o pacote `@govnex/ui` continua sendo exclusivamente visual (nenhuma regra deste documento vira código aqui).

Onde um `AGENTS.md`/`CLAUDE.md` de produto divergir deste documento, a divergência precisa ser registrada como decisão explícita no produto.

## 1. Princípio

As aplicações devem ser **parecidas por construção**: mesma stack, mesma arquitetura de identidade e autorização, mesmas ferramentas de qualidade e mesmas convenções. O que muda entre produtos é o domínio e as telas.

## 2. Identidade e vínculo — Govnex Hub

- O **Hub é a fonte da verdade de identidade**: quem a pessoa é, a quais entidades/unidades está vinculada e se está ativa ou desligada.
- O Hub **não decide o que a pessoa faz dentro de cada produto** e **não guarda papéis nos vínculos**: vínculo é só "esta pessoa pertence a esta entidade/unidade e pode entrar neste sistema". Durante a migração, o campo `papel` ainda pode existir no contrato, mas é ignorado pelos produtos.
- O painel do próprio Hub é gerido pelo Hub. O **root** faz tudo, sem ressalvas; não há política de concessão por papel entre administradores e operadores.
- Cada aplicação **gere seus próprios papéis** (cargo no GEP, perfil no GHO etc.), atribuídos localmente.
- Login por **OIDC (Authorization Code + PKCE S256)**; `sub` do Hub vira `users.hub_user_id` (único). E-mail é atributo, não chave.
- A aplicação mantém **espelho local** de pessoa e vínculo (nunca exclui fisicamente; desativa). Sincroniza no login (retrato completo) e por **webhook assinado** (retrato do evento citado).
- Hub fora do ar bloqueia login novo, mas não derruba sessão já aberta.
- Desligamento no Hub desativa o espelho local e encerra a sessão (middleware de usuário ativo, consultando só o espelho local).

## 3. Autorização em duas camadas

1. **Nível 1 — acesso ao contexto:** usuário ativo + vínculo vigente com a entidade/unidade do alvo. Sem isso, nada do nível 2 vale.
2. **Nível 2 — papel local do produto:** cargo/perfil, permissões e escopo, definidos e geridos no próprio produto.

Regras:

- **Um único resolvedor** decide "pode?" (ex.: `AccessResolver`). Policies e controllers consultam capacidades nomeadas; não espalham checagem de papel.
- **Falha fechada:** dado ausente nega. Perguntas de interface ("mostrar menu?") são métodos separados e nunca autorizam ação.
- Validar sempre no backend; o isolamento entre entidades/gabinetes não depende de ocultação na interface.
- Somente leitura (auditor) é um papel **local** e nunca escreve.
- Durante a migração de um produto, vínculo sem papel local pode manter o comportamento anterior, com prazo explícito para passar a negar.

### 3.1 Partida da administração de acessos (bootstrap)

Como o Hub não concede papéis, é preciso uma forma de dar o **primeiro** papel de administração de um contexto novo. O padrão é um **comando de operador** do próprio produto (ex.: `gho:gestor-acesso-conceder`, `gep:cargo-conceder`):

- só quem opera o servidor executa; não existe tela nem endpoint para isso;
- exige pessoa (`hub_user_id`) e contexto (entidade/unidade do Hub) com vínculo ativo, e `--motivo` obrigatório;
- grava **auditoria reforçada** (ator = sistema, com o motivo);
- é idempotente e não atribui papéis com ato de alto risco além do necessário (no GHO, ato assistencial só por perfil explícito).

Depois da partida, quem tem papel de administração atribui os demais pela interface. Qualquer exceção que dê poder administrativo a partir do papel do Hub (como a ADR-016 do GHO) é **transitória** e deve ser removida quando o comando de partida existir.

## 4. Root de contingência

- Conta **local**, fora do Hub, para quando o Hub cair. É a única que entra por senha.
- Acesso por senha **desligado por padrão** em produção (flag de ambiente), com limite de tentativas e **auditoria reforçada**.
- Root não é vínculo organizacional e não vale como identidade profissional (no GHO, não executa ato clínico).
- Nenhum outro usuário tem senha, 2FA ou passkeys locais quando o Hub está configurado.

## 5. Webhooks do Hub

- Validar assinatura HMAC-SHA256, `X-Hub-Timestamp` (janela configurável) e `X-Hub-Nonce`.
- **Idempotência persistente**: eventos recebidos ficam em tabela (id do evento, status, tentativas, erro), não só em cache. Com comando de reprocessamento.
- Retrato, não diferença: aplicar o bloco recebido por cima do que existe; eventos antigos (`atualizado_em` menor) são descartados.
- Evento desconhecido nunca derruba a entrega por 4xx permanente sem decisão explícita.

## 6. Stack e ferramentas obrigatórias

| Área | Padrão |
|---|---|
| Backend | PHP 8.4, Laravel 13, MariaDB/MySQL |
| Frontend | React 19, Inertia 3, TypeScript estrito, Vite, Tailwind 4, `@govnex/ui` |
| Testes | **Pest 4** (`pestphp/pest` + plugin Laravel) |
| Análise estática | Larastan (`phpstan.neon`) |
| Estilo PHP | Laravel Pint (`pint.json`) |
| Estilo front | ESLint 9 + Prettier |
| Script único | `composer ci:check` (lint + tipos + testes), usado pela CI |
| CI | GitHub Actions: `tests` e `lint` em todo PR |
| Ícones | somente pela ponte `@govnex/ui/icons` (ou `components/icons` do produto), nunca a biblioteca direto |
| Fila e cache | `database` por padrão; Redis só se o produto declarar |
| Idioma da interface | pt-BR; `APP_LOCALE=pt_BR` e `APP_FALLBACK_LOCALE=pt_BR`; pasta `lang/pt_BR` e `pt_BR.json` presentes |

Não adicionar Bootstrap, jQuery nem outro design system.

## 7. Convenções de código

- **Nomes de arquivos, classes, métodos, variáveis e funções em inglês**, em qualquer camada. Só o **schema do banco** (tabelas e colunas) pode ficar em português.
- Código existente em português não exige varredura: alinhar ao tocar o arquivo por outro motivo, se o custo for baixo.
- Estrutura de `app/` como monólito modular; autorização em `app/Authorization`, integração com o Hub em `app/Services/Hub`.
- Projeto em fase DEV: alterações de schema entram na **migration original** da tabela; migration incremental só depois da primeira publicação.

## 8. Operação

- Variáveis do Hub padronizadas: `HUB_BASE_URL`, `HUB_SISTEMA_CODIGO`, `HUB_OIDC_CLIENT_ID`, `HUB_OIDC_CLIENT_SECRET`, `HUB_OIDC_REDIRECT`, `HUB_API_SECRET`, `HUB_TIMEOUT`, `HUB_WEBHOOK_WINDOW_SECONDS`.
- Segredos, `.env`, uploads e dados pessoais nunca são versionados.
- Deploy e migrations em ambiente publicado só por pedido explícito.

## 9. Checklist por aplicação

- [ ] Login por OIDC; formulário local apenas para root, desligado por padrão em produção.
- [ ] `users.hub_user_id` único; espelho local de pessoa e vínculo; sem exclusão física.
- [ ] Webhook assinado, com tabela de eventos e reprocessamento.
- [ ] Um resolvedor de acesso; policies consultam capacidades; falha fechada.
- [ ] Papéis locais próprios; `papel` do Hub não interpretado como permissão.
- [ ] Comando de operador para a partida da administração (§3.1); sem exceção por papel do Hub.
- [ ] Pest 4, Larastan, Pint, ESLint/Prettier e `ci:check`.
- [ ] CI de testes e lint.
- [ ] `lang/pt_BR` completo e `APP_FALLBACK_LOCALE=pt_BR`.
- [ ] Ícones pela ponte oficial; sem biblioteca de ícones duplicada.
- [ ] Nomes de código em inglês (novos).
- [ ] Fila/cache em `database` (ou Redis declarado).

## 10. Estado de aderência (levantamento de 04/11/2026)

| Item | API | GEP | Hub | GHO |
|---|---|---|---|---|
| Pest 4 | ✘ (PHPUnit 12) | ✔ | ✘ (PHPUnit 11) | ✔ |
| Larastan | ✘ | ✔ | ✔ | ✔ |
| Pint | ✔ | ✔ | ✔ | ✘ |
| CI | lint + tests | tests + e2e | lint + tests | ✘ |
| `ci:check` | ✘ | ✔ | ✘ | ✘ |
| Login local só root | ✘ | ✔ | n/a (painel próprio) | ✔ (desligado) |
| Webhook em tabela | ✘ | ✘ (cache) | ✔ | ✔ |
| Auditoria reforçada do root | ✘ | ✘ | ✘ | ✔ |
| Fila `database` | ✘ (redis) | ✔ | ✔ | — |
| Fallback `pt_BR` | ✔ | ✘ | ✘ | ✔ |
| Ícones sem duplicação | ✔ | ✔ | ✘ (lucide) | ✔ |
| Nomes em inglês | ✔ | ✔ | parcial | ✘ (domínio em português) |
| Papéis locais | root apenas | em implementação | próprio do painel | ✔ |

Este quadro é um retrato; atualizar quando uma divergência for corrigida.
