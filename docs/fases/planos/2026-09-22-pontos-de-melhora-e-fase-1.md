> **Plano original**, copiado sem alteração de `~/.claude/plans/quais-podem-ser-os-hidden-frog.md` em 24/09/2026.
> É um retrato da data em que foi escrito: números de linha, contagens e estados podem
> não valer mais, e os links são relativos à raiz do repositório. O que de fato foi feito
> está em [FASE_1.md](../FASE_1.md).

# SocietyTracker — pontos de melhora

## Contexto

Pergunta: "quais podem ser os pontos de melhora do app?". Revisei o repositório inteiro em três frentes (backend/segurança, frontend/UX, arquitetura/testes/ferramentas). Os achados mais graves eu mesmo conferi no código. Não reabri o `ADMIN_PIN=1234`, que é um risco aceito.

**O que já está bom:** o domínio não importa framework. Os use cases só dependem de interfaces. `tsc` passa e `npm test` passa 134/134. As RPCs de escrita são transacionais e idempotentes (`Idempotency-Key`) e têm testes contra PGlite com as migrations reais.

**Onde estão os problemas:** no modo mesário, gols podem se perder. Há uma brecha no limite de tentativas do PIN. O schema do banco não é reproduzível a partir do repo. Há código morto, falta CI e as páginas públicas buscam dados demais.

---

## Pontos de melhora, por prioridade

### 1. Risco imediato (perda de dados na quadra e segurança) — conferidos no código
| # | Problema | Onde |
|---|---|---|
| 1.1 | O PIN também é aceito em claro nos headers `x-admin-pin` e `Authorization: Bearer <PIN>`. Esse caminho não passa pelo limite de tentativas. `GET /api/auth/status` com o header responde `true/false`, então dá para testar os 10 mil PINs sem limite. O app não usa esses headers; só o teste usa. | [pinAuth.ts:148-161](src/core/infrastructure/auth/pinAuth.ts#L148-L161), [auth.test.ts:80-104](tests/auth.test.ts#L80-L104) |
| 1.2 | Qualquer erro desconhecido vira HTTP 400. Isso inclui rede, timeout do Supabase e falha na leitura depois de um commit. O celular trata 4xx como recusa definitiva e **descarta o gol da fila**. | [matchApi.ts:10-21](src/core/infrastructure/http/matchApi.ts#L10-L21), [SupabaseMatchRepository.ts:83](src/core/infrastructure/repositories/SupabaseMatchRepository.ts#L83), [matchSync.ts:55-87](src/components/live/matchSync.ts#L55-L87), [useMatchSession.ts:56-66](src/components/live/useMatchSession.ts#L56-L66) |
| 1.3 | Quando o cookie de 24h expira no meio da rodada, o 401 também descarta os gols pendentes. | [middleware.ts:26-38](src/middleware.ts#L26-L38), mesmos arquivos de 1.2 |
| 1.4 | Sem `SESSION_SECRET`, o app assina os cookies com um segredo que está no repositório e só registra um log. | [pinAuth.ts:50-55](src/core/infrastructure/auth/pinAuth.ts#L50-L55) |
| 1.5 | A criação da rodada não é atômica: são 9 inserts em sequência. Uma falha no meio deixa uma sessão órfã, e como a data é única, as tentativas seguintes dão erro de chave duplicada. | [SupabaseSessionRepository.ts:159-294](src/core/infrastructure/repositories/SupabaseSessionRepository.ts#L159-L294) |
| 1.6 | O horário das partidas no histórico sai em UTC, 3h adiantado. O mesmo vale para o ano e a data padrão calculados no servidor. | [MatchHistoryCard.astro:42-47](src/components/ui/MatchHistoryCard.astro#L42-L47), `index.astro:24,30,50`, `relatorios.astro:110` |

### 2. Modo mesário na quadra (offline, celular)
- **Tela apaga durante o cronômetro:** não há Wake Lock, e o apito de fim de tempo só toca com a tela ligada. iOS não vibra. Falta um alerta visual em tela cheia e o aviso de 1 minuto (`hapticFeedback.timerWarning` existe, mas ninguém chama).
- **Sem PWA:** não há manifest, service worker nem ícones. Se a página recarregar sem rede, a tela some, embora a fila continue guardada no localStorage.
- **Offline não dá para iniciar nem finalizar partida:** o `start` depende do id gerado pelo servidor. Gerar o UUID no cliente destrava a fila.
- **Fila parada:** o intervalo de 10s só recarrega os dados e não reenvia os pendentes. Os erros aparecem crus e em inglês ("Failed to fetch", `Unexpected token '<'`).
- **Duas abas abertas** sobrescrevem a fila uma da outra. Falta `navigator.locks` ou `BroadcastChannel`.
- **Sem "Desfazer"** depois de um gol, e o gol contra entra com um toque só.
- O rascunho do montador de times não é salvo: um reload ou um toque na navegação perde tudo.
- A sugestão do próximo confronto se perde no reload. Com dois aparelhos, elencos e cronômetro não são compartilhados.
- A navegação de baixo continua visível durante a partida, e não há aviso ao sair com operações pendentes.

### 3. Banco e migrations
- `society_match_command` é redefinida inteira em 5 migrations. **Reaplicar uma migration antiga reverte silenciosamente** comportamentos novos, como empréstimo, limite de tempo e placar na finalização.
- O repo não reconstrói o banco de produção: a base está em `society-tracker-specs/04_*.sql`, o RLS foi ligado fora das migrations, e `06_FIX_*.sql` recriaria uma view antiga.
- Não há script para aplicar migrations, e a lista delas está escrita à mão em dois testes. Proposta: `scripts/db-migrate.mjs` com `pg` + `SUPABASE_DB_URL`, que lê `society_schema_versions`, e um helper de teste que aplica `supabase/migrations/*.sql` em ordem.
- `schemaResilience.ts` descarta colunas "ausentes" e grava assim mesmo, perdendo dados sem erro. `tryAutoMigrate`/`exec_sql` não são usados.
- Toda consulta usa a service role, então o RLS não protege nada. Falta escolher um modelo, só servidor ou chave pública com policies. Views `vw_*` não são usadas pelo app.

### 4. Arquitetura e código morto
- **Código morto:** os use cases antigos (`RegisterGoal`, `FinishMatch`, `UpdateMatchScore`, `StartMatch`, `Update/DeleteMatchEvent`), seus DTOs e cerca de 11 métodos do repositório só servem aos testes (cerca de 600 linhas de `use-cases.test.ts`). Também não são usados `QuickPlayerTransferModal.tsx`, `LeaderboardTable.astro`, os tipos antigos em `live/types.ts` e `dev-server.mjs`.
- **Regras de negócio em SQL e cópia em TS que só roda em teste:** registrar em ADR que a transação do banco é a autoridade, e tipar `MatchCommand` como união discriminada.
- Lógica e busca excessiva nas páginas: `index.astro` reimplementa o ranking, e `relatorios.astro`/`historico.astro` carregam o histórico inteiro. Mover para use cases e fazer paginação.
- Não há composition root: cada rota faz `new Supabase*Repository()`.
- As rotas não validam entrada, cada uma trata erro de um jeito e mensagens internas do Postgres chegam à UI pública.
- `TeamBuilderIsland.tsx` (1278 linhas) e `EditNightTeamsModal.tsx` duplicam as regras de capitão, goleiro, limites e busca, e já divergem entre si. Extrair um `useTeamDraft` e um `teamRules.ts`.
- Utilitários duplicados: datas (sem fuso), `nickname || name` em mais de 20 lugares, cores dos times, fetch/erro copiado em 8 componentes. Extrair `src/lib/format.ts` e `src/lib/http.ts`.
- A rodada nunca é encerrada: `updateStatus` não tem quem chame, então todas as rodadas aparecem "(Ao Vivo)".

### 5. Desempenho
- Cada comando do mesário faz 3 idas ao banco: RPC, `session_id` e o snapshot da rodada inteira. A RPC poderia devolver a partida.
- Não há cache nas páginas públicas. O `Layout` checa o cookie em toda página, o que impede cache na CDN.
- `html-to-image` é carregado logo de início, e as fontes do Google vêm duas vezes. `LiveScoreboard` re-renderiza tudo a cada 250 ms.

### 6. UX e acessibilidade
- Alvos de toque menores que 44px (botão "+", capitão/goleiro, lixeira). Inputs com fonte menor que 16px fazem o iOS dar zoom.
- A busca não ignora acentos ("joao" não encontra "João").
- Modais e toasts fora do portal ficam atrás do header e da navegação: novo avulso, `EditPlayerModal` e toasts de export.
- O erro do montador aparece no topo, longe do botão Salvar, e mostra a mensagem do Postgres em inglês quando a data se repete.
- "7 min" está fixo no texto, embora a duração seja configurável. Não há logout no celular, o ponto "ao vivo" pisca sempre e o preview do WhatsApp está quebrado (`og-*.png` não existe).
- Faltam labels ligados aos inputs, `aria-pressed`/`aria-current`, `motion-reduce` e opção de desligar o som.

### 7. Qualidade e ferramentas
- **Sem CI e sem lint:** a Vercel publica `main` sem rodar `check`/`test`. Criar um GitHub Actions (`npm ci`, `check`, `check:astro`, `test`, Playwright) e adicionar typescript-eslint e Prettier.
- Tipagem: não há tipos gerados do Supabase, há `catch (e: any)` em 10 rotas e 29 `!`.
- Testes: `middleware.ts` e as rotas de API não têm teste. O e2e roda num SPA Vite com roteador escrito à mão, não no Astro real. O glob `tests/*.test.ts` não é recursivo.
- Observabilidade: os erros não são registrados, não há Sentry nem `/api/health`, e o app não confere a versão do schema.
- Docs: `README.md` ainda é o do starter do Astro, e `AGENT.md` e as specs divergem do código atual. `supabase/.temp` está commitado, `@types/*` estão em `dependencies`, `vite` não está declarado e não há `.nvmrc`.

---

## Execução recomendada — Fase 1 (itens 1.1 a 1.6)

São mudanças pequenas e localizadas, que tiram o risco de perder gols e fecham a brecha do PIN.

1. **Autenticação só por cookie** ([pinAuth.ts](src/core/infrastructure/auth/pinAuth.ts))
   - Remover os ramos `x-admin-pin` e `Bearer` de `isAuthenticatedFromRequest`.
   - Tipar `cookies` como `AstroCookies`.
   - Trocar a comparação `===` em `verifyPin` por `timingSafeEqual` sobre o HMAC, usando o `createHmac` que já é importado.
   - `getSessionSecret()` em produção sem a variável passa a **lançar erro** em vez de usar o valor do repo. `ADMIN_PIN` não muda.
   - ⚠️ Antes do deploy, confirmar no painel da Vercel que `SESSION_SECRET` está definida. Não há Vercel CLI aqui para eu conferir.
   - Atualizar [auth.test.ts:80-104](tests/auth.test.ts#L80-L104): os headers passam a dar `false`, e sem secret em produção deve lançar erro.

2. **Status HTTP corretos para os comandos**
   - Criar um erro tipado de infraestrutura, por exemplo `DatabaseError { code, message }`, em `src/core/infrastructure/database/`.
   - Em `SupabaseMatchRepository.executeCommand`, preservar `error.code`. A falha na leitura depois do commit deve sair como erro transitório.
   - `apiError` passa a mapear pelo código:
     - `P0001` (os `RAISE EXCEPTION` do SQL): mantém os prefixos `MATCH_LOCKED`/`CONFLICT` → 409, `NOT_FOUND` → 404, e o resto → 400.
     - Classes `22`/`23`: 23505 → 409, as demais → 400.
     - Sem código, `08*`/`53*`/`57*`, `PGRST5*` ou erro desconhecido → **503**. O cliente então reenvia com a mesma `Idempotency-Key`, o que é seguro.
   - Registrar `console.error` no servidor e devolver mensagem genérica quando for 5xx.

3. **Mesário mantém a fila no 401**
   - Em [matchSync.ts](src/components/live/matchSync.ts), criar um `AuthRequiredError` para status 401.
   - Em [useMatchSession.ts](src/components/live/useMatchSession.ts), o `flush` para sem descartar e expõe `needsLogin`.
   - Em [MesarioSessionWrapper.tsx](src/components/live/MesarioSessionWrapper.tsx), mostrar um aviso "Sessão expirada — entre de novo" com link para `/login?redirect=/rodada/mesario`, reaproveitando `PinLoginPad`.
   - No retorno, o `refresh().then(flush)` que já existe no mount reenvia a fila.
   - Aproveitar para usar `res.json().catch(() => null)` no `refresh` (linha 34) e traduzir erros de rede para português.

4. **Criar rodada atômica**
   - Nova migration `supabase/migrations/2026092200xx_create_session_rpc.sql` com `society_create_session(p_date, p_notes, p_duration, p_teams jsonb)`, no mesmo molde de `society_update_teams`. Registrar em `society_schema_versions`.
   - `SupabaseSessionRepository.create` passa a chamar a RPC.
   - A rota [sessions/index.ts](src/pages/api/sessions/index.ts) responde 409 com mensagem amigável para data repetida.
   - Aplicar manualmente com `pg` + `SUPABASE_DB_URL`, conferindo o estado real do banco antes e depois, como na memória do projeto.
   - Incluir a migration nas listas de [transactions.test.ts](tests/transactions.test.ts) e [tests/ui/server.ts](tests/ui/server.ts).

5. **Fuso horário**
   - Criar um helper `src/lib/format.ts` com `Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' })` e funções de data e ano "de hoje" em BRT.
   - Usar em `MatchHistoryCard.astro`, `index.astro` e `relatorios.astro`.

### Verificação
- `npm run check`, `npm run check:astro`, `npm test` e `npm run test:e2e`.
- Novos testes:
  - `apiError`: P0001 → 400/409/404, erro de rede → 503.
  - `sendCommand`/`flush`: 503 mantém o item na fila, 401 mantém e sinaliza login, 400 descarta.
  - `society_create_session` no PGlite: sucesso, rollback em falha no meio e data duplicada.
  - Formatação de horário em BRT.
- Manual, com `npm run dev` e DevTools em modo offline e depois online:
  - registrar um gol e confirmar que ele sincroniza;
  - apagar o cookie e registrar um gol: o gol deve continuar pendente e o aviso de login deve aparecer;
  - entrar de novo e confirmar que o gol sincroniza;
  - `curl -H "x-admin-pin: 1234" /api/auth/status` deve retornar `false`.

### Próximas fases (depois da Fase 1)
- **Fase 2 — quadra:** Wake Lock e alertas do cronômetro, reenvio automático com backoff, UUID de partida gerado no cliente, lock entre abas, "Desfazer" gol, rascunho do montador salvo.
- **Fase 3 — base:** CI com lint, script de migrations e baseline do schema, remoção do código morto e do `schemaResilience`, handler e validação comuns nas rotas, RPC devolvendo a partida.
- **Fase 4 — UX e desempenho:** PWA, cache nas páginas públicas, `useTeamDraft`, toques ≥ 44px e inputs ≥ 16px, busca sem acento, encerrar rodada, README e docs.
