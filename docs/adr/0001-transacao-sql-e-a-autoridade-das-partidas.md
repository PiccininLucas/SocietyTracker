# ADR 0001 — A transação SQL é a autoridade das regras de escrita da partida

- **Status:** aceita
- **Data:** 24/09/2026

## Contexto

O `AGENT.md` pede que toda regra crítica (fim aos 2 gols, limite de 420 s) viva nas
entidades ou nos serviços de domínio. Na prática, desde a migração de integridade
(`202609090001`), toda escrita de partida passa por `society_match_command`: iniciar, gol,
edição e remoção de lance, placar, finalização e exclusão. A função roda numa transação,
trava a rodada, garante idempotência pela `Idempotency-Key` e é protegida por triggers.

As regras também existiam em TypeScript: a entidade `Match` (`registerGoal`, `finish`,
`handleTimeExpired`), `MatchEvent` e seis casos de uso (`RegisterGoal`, `FinishMatch`,
`UpdateMatchScore`, `StartMatch`, `UpdateMatchEvent`, `DeleteMatchEvent`). Em produção
esse código nunca rodava: os casos de uso delegavam ao comando SQL, e nenhuma rota os
usava. Eram ~600 linhas de teste cobrindo o caminho que não executa. Foi assim que
defeitos do caminho real passaram pela suíte (placar descartado ao finalizar, `update()`
que só gravava o placar).

## Decisão

- As regras de **escrita** da partida vivem em `society_match_command` e nos triggers.
  Elas são testadas contra o SQL real, em PGlite (`tests/transactions.test.ts`).
- O domínio TypeScript guarda as regras de **leitura**: classificação, confrontos,
  sequências e desempenho (`CompetitionService`, `RoundHighlightsService`). Guarda também
  as constantes que o cliente precisa para projetar a fila offline (`MATCH_RULES`).
- A escrita entra pelo port `IMatchCommands` (`MatchCommandUseCase` →
  `SupabaseMatchRepository.executeCommand`). `IMatchRepository` é só leitura.
- A entidade `Match`, `MatchEvent`, os seis casos de uso e seus DTOs foram removidos.

## Consequências

- Mudar uma regra de partida exige uma migration nova e um teste em `transactions.test.ts`.
  O teste dos 2 gols usa `MATCH_RULES.MAX_GOALS_FOR_VICTORY`, então mudar só um dos lados
  quebra a suíte.
- A projeção offline do mesário (`matchSync.ts`) continua espelhando o SQL no aparelho. Ela
  é uma previsão até a confirmação do servidor, que sempre prevalece.
- Validações de entrada (tipos, UUIDs, inteiros) ficam na rota HTTP, antes do banco. As
  regras de negócio continuam no SQL.
