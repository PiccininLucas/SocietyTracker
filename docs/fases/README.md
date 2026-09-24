# Fases de melhoria do SocietyTracker

Registro do trabalho feito em fases desde setembro de 2026: o que cada fase resolveu, as
decisões tomadas, as migrations e o que ficou pendente. Os planos originais estão em
[planos/](planos/), copiados sem alteração.

## Linha do tempo

| Data | Etapa | Commits | Documento |
|---|---|---|---|
| 09/09 | Revisão funcional, integridade das partidas, apagar partida e filtros do histórico | até `4ab37a6` | [IMPLEMENTATION_REVIEW.md](../IMPLEMENTATION_REVIEW.md), [DELETE_MATCH.md](../DELETE_MATCH.md) |
| 10/09 | Importação dos totais de 2026 até 03/09 | `646851e`, `c7bc980` | [supabase/README.md](../../supabase/README.md) |
| 21/09 | Montagem de times, relatórios e cards, empréstimo no gol | `d824931`, `53079ed` | — |
| 21/09 | Análise de defeitos e correções | `44c8e3a` | [ANALISE_2026-09-21.md](ANALISE_2026-09-21.md) |
| 22/09 | Levantamento de pontos de melhora | — | [planos/2026-09-22-pontos-de-melhora-e-fase-1.md](planos/2026-09-22-pontos-de-melhora-e-fase-1.md) |
| 22/09 | **Fase 1** — Risco imediato: gols perdidos e segurança | `c686a09` | [FASE_1.md](FASE_1.md) |
| 22/09 | **Fase 2** — Modo mesário na quadra | `e166717` | [FASE_2.md](FASE_2.md) |
| 24/09 | Correção avulsa: domínio de produção na URL canônica e nos cards | `304f325` | — |
| 24/09 | **Fase 3** — Base: ferramentas, migrations, código morto, rotas e CI | `28cc92b`…`b75de6a` | [FASE_3.md](FASE_3.md) |
| 24/09 | **Fase 4** — UX e desempenho | `014f9fc`…`c8c0083` | [FASE_4.md](FASE_4.md) |
| — | **Fase 5** — Times, saída segura do mesário e acabamento (planejada) | — | [FASE_5.md](FASE_5.md) |

## Migrations por etapa

| Etapa | Migrations | Em produção |
|---|---|---|
| 21/09 | `202609210001` a `202609210008` | Sim |
| Fase 1 | `202609220001_create_session_rpc`, `202609220002_revoke_public_rpc_execute` | Sim (22/09) |
| Fase 2 | `202609220003_client_match_id` | Sim |
| Fase 3 | `202608140000_baseline` (só registrada), `202609240001_command_returns_match`, `202609240002_drop_unused_views` | Sim (24/09) |
| Fase 4 | `202609240003_close_session` | Pendente no fim da fase: aplicar antes do push |

As migrations são aplicadas só por `npm run db:*`. Como e por quê: ver
[supabase/README.md](../../supabase/README.md).

## Situação dos pontos do levantamento de 22/09

"F1" a "F4" são as fases feitas. "Fase 5" é a planejada. "Pendente" ainda não tem fase.

### 1. Risco imediato

| Ponto | Situação |
|---|---|
| PIN aceito em headers, sem limite de tentativas | F1 |
| Erro desconhecido virava 400 e descartava o gol | F1 |
| 401 descartava os gols pendentes | F1 |
| Sem `SESSION_SECRET`, sessão assinada com o segredo do repositório | F1 |
| Criação da rodada sem transação | F1 |
| Horários e datas em UTC | F1 |

### 2. Mesário na quadra

| Ponto | Situação |
|---|---|
| Tela apaga, sem aviso de 1 minuto, sem alerta no iPhone | F2 |
| Sem PWA: recarregar sem rede tirava a tela | F4 |
| Offline não dava para iniciar ou finalizar partida | F2 |
| Fila parada e erros crus em inglês | F1 (mensagens) e F2 (reenvio automático) |
| Duas abas sobrescrevendo a fila | F2 |
| Sem "Desfazer" gol | F2 |
| Rascunho do montador perdido no reload | F2 |
| Sugestão do próximo confronto perdida no reload | F2 |
| Elencos e cronômetro não compartilhados entre dois aparelhos | Pendente |
| Navegação de baixo visível durante a partida, sem aviso ao sair com pendências | Fase 5 |

### 3. Banco e migrations

| Ponto | Situação |
|---|---|
| Reaplicar migration antiga revertia `society_match_command` | F3 (o script recusa) |
| Repositório não reconstruía o banco de produção | F3 (baseline) |
| Sem script de migrations | F3 |
| `schemaResilience` gravando sem coluna | F3 (removido) |
| Views sem uso passando pelo RLS | F3 (apagadas) |
| Modelo de RLS: tudo pela service role | Pendente |

### 4. Arquitetura

| Ponto | Situação |
|---|---|
| Use cases e métodos de repositório só usados em teste | F3 |
| Regras da partida em SQL e cópia em TS | F3 (ADR 0001) |
| `MatchCommand` como união discriminada | Pendente |
| Páginas com lógica e carga do histórico inteiro, sem paginação | Pendente |
| Sem composition root | Pendente |
| Rotas sem validação e com erro do Postgres na UI | F3 |
| Regras duplicadas entre o montador e o editor de times (`useTeamDraft`) | Fase 5 |
| Utilitários duplicados (datas, `nickname \|\| name`, cores, fetch) | Parcial: fuso (F1) e busca (F4) |
| Rodada nunca encerrada | F4 |

### 5. Desempenho

| Ponto | Situação |
|---|---|
| 3 idas ao banco por comando do mesário | F3 |
| Sem cache nas páginas públicas | F4 |
| `html-to-image` carregado de início e fontes do Google em dobro | Pendente |

### 6. UX e acessibilidade

| Ponto | Situação |
|---|---|
| Alvos de toque menores que 44px e campos menores que 16px | F4 |
| Busca não ignorava acentos | F4 |
| Modais e avisos atrás do cabeçalho e da navegação | Fase 5 |
| Mensagem do Postgres em inglês na data repetida | F1 (409 com mensagem própria) |
| Erro do montador longe do botão Salvar | Pendente |
| "7 min" fixo no texto | Fase 5 |
| Sem "Sair" no celular, ponto "ao vivo" sempre piscando, preview do WhatsApp quebrado | Pendente |
| Labels, `aria-pressed`, `motion-reduce` e desligar o som | Parcial: labels e `aria-pressed` nos botões alterados na F4 |

### 7. Qualidade e ferramentas

| Ponto | Situação |
|---|---|
| Sem CI e sem lint; a Vercel publicava sem checar | F3 |
| `any` explícito | F3 (`no-explicit-any` no lint) |
| Sem tipos gerados do Supabase, e asserções não nulas (`!`) espalhadas | Pendente |
| Rotas de API sem teste | F3 (`api-routes.test.ts`) |
| Middleware sem teste | Pendente |
| E2E num SPA do Vite, não no Astro real | Pendente |
| Glob `tests/*.test.ts` não recursivo | Pendente |
| Sem Sentry, sem `/api/health`, sem checagem da versão do schema | Pendente |
| README do starter do Astro, `AGENT.md` e specs divergentes | Fase 5 |
| `supabase/.temp` no git, `@types/*` em dependencies, `vite` não declarado, sem `.nvmrc` | F3 |
