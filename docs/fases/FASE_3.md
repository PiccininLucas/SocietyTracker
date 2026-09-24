# Fase 3 — Base: ferramentas, migrations, código morto, rotas e CI (24/09/2026)

**Commits:** de `28cc92b` a `b75de6a` (24/09, 10:06–10:39) · **Plano original:**
[planos/2026-09-24-fase-3.md](planos/2026-09-24-fase-3.md)

## Contexto

A Fase 3 é a lista "base": o que dependia de cuidado manual e não de ferramenta. Até
então:

- a Vercel publicava a `main` sem rodar nada, e não havia lint;
- as migrations eram aplicadas à mão, e `society_match_command` estava redefinida inteira
  em seis delas. Reaplicar uma antiga revertia a função sem dar erro;
- o repositório não reconstruía o banco de produção: faltavam o RLS, o NOT NULL da
  duração e duas views sem uso;
- havia código de escrita que só rodava nos testes, e um `schemaResilience` que gravava
  sem uma coluna e respondia sucesso;
- cada rota tratava erro de um jeito, e cada gol fazia 3 idas ao banco.

## O que foi feito, por commit

| Commit | O quê |
|---|---|
| `28cc92b` chore | ESLint (flat config, typescript-eslint, `rules-of-hooks`, `no-explicit-any`), Prettier, `vite`, `pg` e `@types/pg` declarados, `@types/react*` em devDependencies. O `check` roda `astro sync` antes do `tsc`. `.nvmrc`, e `supabase/.temp` fora do git |
| `4a6d6b9` style | Formatação do Prettier, sem mudança de comportamento; ignorada no `git blame` (`b93fcb2`) |
| `d65b1cb` feat | `scripts/db.mjs` (`status`, `migrate`, `mark-applied`, `diff`, `grants`) com TLS verificado pela CA do Supabase. Baseline `202608140000` igual a produção, `202609240002` apagando as views e o helper de teste que monta o PGlite com os default privileges do Supabase |
| `4d76753` refactor | Remoção dos seis use cases de escrita antigos, dos DTOs e dos métodos de repositório só usados em teste, do `schemaResilience`, de componentes sem uso e do cliente Supabase público. ADR 0001 |
| `ec3a71a` feat | `http/api.ts` (`endpoint`, `HttpError`, `json` com `no-store`) e `http/validate.ts` em todas as rotas. `Idempotency-Key` obrigatória nos comandos |
| `2147b2a` perf | `202609240001`: `society_match_snapshot` e `society_match_command_with_match`. Um comando cai de 3 idas ao banco para 1 |
| `b75de6a` ci | GitHub Actions (lint, formatação, tipos, `astro check`, testes, build e e2e) e `vercel-build` rodando tipos e testes antes do build |

## Detalhes que importam

- **Migrations só por `npm run db:*`.** O script nunca reaplica o que está registrado em
  `society_schema_versions` e recusa arquivo fora de ordem. O CLI do Supabase não serve:
  `db query -f` falha com vários comandos, e `db push` reaplicaria tudo.
  `rejectUnauthorized: false` nunca.
- **`db:diff`** monta um PGlite com as migrations e compara o catálogo com o banco alvo:
  tabelas e RLS, colunas, constraints, índices, funções, views, policies, triggers e
  privilégios. **`db:grants`** falha se `anon` ou `authenticated` puder executar uma
  função de escrita ou gravar em alguma tabela.
- **ADR 0001:** as regras de escrita da partida vivem na transação SQL
  (`society_match_command`). O domínio TS fica com as regras de leitura e as constantes
  (`MATCH_RULES`). O teste dos 2 gols no SQL usa `MATCH_RULES`, e cliente e banco não
  divergem mais em silêncio.
- **Rotas:**
  - erro de validação responde 400 no formato `campo: motivo`;
  - recurso inexistente responde 404;
  - recusa do SQL é classificada pelo prefixo da mensagem;
  - todo o resto vira 503 com mensagem genérica, e o texto do Postgres só vai para o
    log.
- **Comandos:** o `input` vai ao banco sem alteração, porque o replay compara
  `op.input <> p_input`. A resposta passou a ser só `{ match, eventId }`.
- **Deploy:** com o `vercel-build`, um commit quebrado na `main` falha o deploy, e a versão
  anterior continua no ar. O teste de rotas apaga a `SUPABASE_SECRET_KEY` do próprio
  processo, então o build nunca chega ao banco de produção.

## Migrations e produção

Em 24/09 o usuário rodou no próprio terminal:

1. `db:mark-applied 202608140000`, depois de um `db:diff` sem diferenças;
2. `db:migrate`, que aplicou `202609240001` e `202609240002`;
3. o push.

O modo automático do Claude Code bloqueia `db:*` e `git push`, e os comandos contra
produção ficam com o usuário.

Conferido em produção:

- `GET /api/matches/<id>` responde pela função nova;
- as views apagadas respondem PGRST205 na REST.

## Decisões

- **As views** `vw_player_leaderboard` e `vw_matches_summary` foram apagadas (decisão do
  usuário): não tinham uso e passavam por cima do RLS.
- **Migration antes do deploy do código que depende dela**, sempre com confirmação do
  usuário.

## Testes

- **Novos arquivos:**
  - `migrations.test.ts`: formato dos arquivos, montagem do zero, RLS e grants;
  - `db-script.test.ts`;
  - `api-routes.test.ts`: validação das rotas reais sem tocar no banco;
  - `match-repository.test.ts`: uma ida ao banco por comando.
- **`transactions.test.ts`:** passou a montar o banco pelas migrations reais. Também
  confere que `society_match_command_with_match` devolve o mesmo snapshot que
  `society_matches_snapshot`.
- **Os dois e2e que falhavam desde 21/09** voltaram a passar. Nenhum era bug do produto:
  o botão passou a se chamar "Gol Contra" e precisa do adversário, e a tabela de
  jogadores ganhou a coluna "Capitão".
- **Resultado:** 151 unitários e 14 e2e, todos verdes.

## O que ficou de fora

- Previsto para a Fase 4: PWA, cache nas páginas públicas e encerrar rodada.
- Sem fase definida:
  - composition root;
  - páginas com carga completa e paginação;
  - tipos gerados do Supabase e lint dos `.astro`;
  - Sentry e `/api/health`;
  - e2e no Astro real.
