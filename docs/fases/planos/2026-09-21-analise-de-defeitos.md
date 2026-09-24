> **Plano original**, copiado sem alteração de `~/.claude/plans/an-lise-o-c-digo-e-async-rabin.md` em 24/09/2026.
> É um retrato da data em que foi escrito: números de linha, contagens e estados podem
> não valer mais, e os links são relativos à raiz do repositório. O que de fato foi feito
> está em [ANALISE_2026-09-21.md](../ANALISE_2026-09-21.md).

# Análise de defeitos — SocietyTracker

## Contexto

Pedido: analisar o código e apontar os pontos de erro. O projeto é um app Astro 7 SSR
(Vercel) + ilhas React 19 + Supabase/Postgres, ~12.6k linhas em `src/`, organizado em
Clean Architecture (`src/core/{domain,application,infrastructure}`).

Estado base verificado nesta análise:

- `npx tsc --noEmit` → **0 erros**
- `npx astro check` (128 arquivos) → **0 erros, 0 warnings, 6 hints**
- `npm test` (node:test via tsx) → **87 testes, 87 passando**

Ou seja: não há erro de compilação nem de teste. Os defeitos abaixo são **bugs de
lógica, de regra de negócio e de robustez** que passam pelos gates atuais.

> Este arquivo é o relatório da análise. A seção final propõe a ordem de correção.

---

## A. Confirmados — camada de apresentação (ilhas React)

### A1. CRÍTICO — Data da rodada gravada em UTC vira o dia seguinte à noite

[TeamBuilderIsland.tsx:53-56](src/components/live/TeamBuilderIsland.tsx#L53-L56)

```ts
const [sessionDate, setSessionDate] = useState(() => {
  const today = new Date();
  return today.toISOString().split('T')[0];   // ← data UTC, não local
});
```

`toISOString()` devolve a data em UTC. No Brasil (UTC−3), **das 21:00 em diante a data
avança um dia**. O produto inteiro é a "pelada das quintas", jogada à noite: uma rodada
montada às 21:30 de quinta nasce gravada como **sexta-feira**.

`sessionDate` é lido em 48 pontos. Impacto real, verificado:

- **Data exibida errada** em histórico, cards PNG e cabeçalho do mesário — a rodada de
  quinta aparece como sexta.
- **Virada de mês**: quinta que cai no último dia do mês é contabilizada no mês seguinte
  em `relatorios.astro` / `GetPeriodLeaderboardUseCase`.
- **Virada de ano**: quinta 31/12 vira 01/01 → rodada cai na **temporada errada** (o
  filtro de temporada é por ano civil).
- **Filtro por data** em [historico.astro:231](src/pages/historico.astro#L231) não casa
  com a data que o usuário viu na quadra.

O agrupamento semanal (`weekRange`, segunda→domingo) **sobrevive**, porque quinta e sexta
caem na mesma semana — é o único consumidor que o deslocamento de um dia não quebra.

Agrava o fato de que o resto do código **já usa o padrão correto** e só este ponto
destoa: [CompetitionService.ts:335](src/core/domain/services/CompetitionService.ts#L335)
e [historico.astro:231](src/pages/historico.astro#L231) usam `new Date(date + 'T12:00:00Z')`
(ancorado ao meio-dia UTC), e os componentes de exibição usam `new Date(year, month, day)`
(construção local). A correção é alinhar com esse padrão, não inventar outro.

Mesmo defeito, impacto menor (só o fallback quando não há nenhuma rodada):
[index.astro:46](src/pages/index.astro#L46).

### A2. ALTO — Rodada pode ser criada com times vazios

[TeamBuilderIsland.tsx:471](src/components/live/TeamBuilderIsland.tsx#L471)

```ts
if (totalAssigned < teamCount * 2) { ... }
```

`totalAssigned` é o **total global** de escalados (`assignedPlayerIds.size`), não um
mínimo por time. Com 4 times, uma distribuição 8/0/0/0 passa na validação. Não há:

- mínimo por time (hoje o piso efetivo é 2 jogadores/time, longe de qualquer regra de society);
- teto de 24 jogadores, apesar de a spec declarar o limite;
- aviso quando o sorteio deixa times sem goleiro.

Cenário: rodada salva com um time vazio → o mesário inicia uma partida contra um time
sem elenco → a gaveta de gol abre sem nenhum jogador para selecionar.

### A3. ALTO — Operação que falha com 4xx trava a fila de sincronização inteira

[useMatchSession.ts:45-69](src/components/live/useMatchSession.ts#L45-L69)

O `flush()` processa `pending[0]` em laço. Se essa operação falhar, o `catch` só registra
o erro — **a operação continua na cabeça da fila**. `sendCommand` lança o mesmo `Error`
genérico para falha de rede (retentável) e para 400/409 do servidor (não retentável),
então não há como distinguir.

Cenário: um registro de gol é rejeitado pelo servidor com 400. Todo gol, edição e
finalização posteriores ficam enfileirados atrás dele e **nunca sincronizam** — o `flush`
sempre reprocessa a operação quebrada primeiro. A única saída é o botão "Descartar
operação pendente", que o mesário não tem motivo para associar ao sintoma.

### A4. ALTO — Gol pendente com placar 2 trava a partida offline

[MesarioSessionWrapper.tsx:132-137](src/components/live/MesarioSessionWrapper.tsx#L132-L137)

```ts
finishing={
  sync.cache.pending.some(p => p.matchId === current.matchId && p.action === 'finish') ||
  (current.status === 'ongoing' && (current.homeScore >= 2 || current.awayScore >= 2))
}
```

O placar aqui vem de `projected` — inclui gols **pendentes, ainda não confirmados**. Com
`finishing = true`, [LiveScoreboard.tsx:129](src/components/live/LiveScoreboard.tsx#L129)
esconde os botões "+ Gol" e [:164](src/components/live/LiveScoreboard.tsx#L164) desabilita
"Finalizar partida".

Cenário offline (o cenário que a spec prioriza — quadra sem sinal): o 2º gol é registrado
localmente, fica pendente, e a UI trava sem botão de gol e sem botão de finalizar. O
encerramento automático aos 2 gols é do servidor
([Match.ts:141-145](src/core/domain/entities/Match.ts#L141-L145)), que nunca é alcançado.

Secundário: o limite `2` está hardcoded aqui, enquanto o domínio o expõe como
`MATCH_RULES.MAX_GOALS_FOR_VICTORY` — e existe também
`MAX_GOALS_FOR_VICTORY` em [types.ts:68](src/components/live/types.ts#L68). Três cópias
da mesma regra.

### A5. ALTO — `projectPending` corrompe o cache persistido

[matchSync.ts:62-96](src/components/live/matchSync.ts#L62-L96)

```ts
const byId = new Map(matches.map(m => [m.matchId, { ...m, events: [...(m.events ?? [])] }]));
...
const teamPlayerList = isHome ? (m.homePlayers ??= []) : (m.awayPlayers ??= []);
teamPlayerList.push({ ... isLoaned: true ... });
```

A cópia é rasa: só `events` é clonado. `m.homePlayers` / `m.awayPlayers` continuam
apontando para os **mesmos arrays** de `cache.matches`. O `push` do jogador emprestado
mutação o cache original in-place.

Como `projectPending` é chamado **em todo render**, sem memo
([MesarioSessionWrapper.tsx:33](src/components/live/MesarioSessionWrapper.tsx#L33)), e o
cache é gravado em `localStorage` no próximo `commit`, o jogador fantasma (marcado
`isLoaned: true`) se torna permanente e vaza para `TeamStandings`, `recentMatches` e para
o estado salvo no dispositivo.

### A6. MÉDIO — "Gol Contra" inverte o time em relação ao fluxo da tela

[GoalDrawer.tsx:85-99](src/components/live/GoalDrawer.tsx#L85-L99)

O mesário toca "**+ Gol Time A**", a gaveta abre com o cabeçalho "Quem marcou o gol?" do
Time A, e uma das opções é "Registrar Gol Contra (Adversário)". O payload envia
`teamId: team.id` (Time A) com `isOwnGoal: true`.

Por decisão documentada em `docs/IMPLEMENTATION_REVIEW.md`, `event.teamId` é o time que
**cometeu** o gol contra e o ponto vai para o adversário. Então o toque em "+ Gol Time A"
resulta em **ponto para o Time B**. O contrato de dados está coerente; a rotulagem da tela
é que contradiz o fluxo ("+ Gol Time A" → ponto para B). Em campo, com pressa, é um erro
de digitação de placar esperando para acontecer.

### A7. MÉDIO — `res.json()` sem proteção quebra a mensagem de erro

[matchSync.ts:57](src/components/live/matchSync.ts#L57) e
[TeamBuilderIsland.tsx:522](src/components/live/TeamBuilderIsland.tsx#L522)

```ts
const body = await res.json();          // 502/504 da Vercel devolve HTML
if (!res.ok) throw new Error(body.error ?? '...');
```

Quando o gateway devolve HTML (502/504) ou um corpo vazio, `res.json()` lança
`SyntaxError` **antes** do `if (!res.ok)`. O mesário vê `Unexpected token '<'` em vez da
mensagem amigável. O mesmo arquivo já faz certo em outro ponto
([TeamBuilderIsland.tsx:450](src/components/live/TeamBuilderIsland.tsx#L450):
`await res.json().catch(() => ({}))`) — é inconsistência, não desconhecimento.

### A8. MÉDIO — Sorteio "equilibrado" usa embaralhamento enviesado

[TeamBuilderIsland.tsx:334-336](src/components/live/TeamBuilderIsland.tsx#L334-L336)

```ts
// 2. Embaralha ambos os grupos (Fisher-Yates)
const shuffledGKs = [...goalkeepers].sort(() => Math.random() - 0.5);
```

O comentário diz Fisher-Yates, mas é o comparador aleatório — que **não** produz
permutação uniforme (o TimSort do V8 preserva parcialmente a ordem original). Num sorteio
semanal em que a imparcialidade é o ponto, jogadores tendem a cair sistematicamente nos
mesmos times.

### A9. BAIXO — Pendências menores

- `teamError` / `setTeamError` em [MesarioSessionWrapper.tsx:30](src/components/live/MesarioSessionWrapper.tsx#L30): `setTeamError` nunca é chamado; o ramo de erro de time é inalcançável (confirmado pelo hint do `astro check`).
- `next()` em [MesarioSessionWrapper.tsx:55-64](src/components/live/MesarioSessionWrapper.tsx#L55-L64): `teams.find(t => t.id !== winner)` sugere como próximo adversário o **primeiro** time que não venceu — tipicamente o que acabou de perder, em vez de quem está esperando.
- `refresh()` em [useMatchSession.ts:35-38](src/components/live/useMatchSession.ts#L35-L38): quando a guarda de revisão descarta a resposta, `setReady(true)` roda mesmo assim — a tela sai de "Carregando" com a lista vazia.
- Timers de partidas finalizadas nunca são removidos de `cache.timers` ([matchSync.ts:139](src/components/live/matchSync.ts#L139) só limpa em exclusão); chaves `society_active_match_state:<id>` acumulam uma por rodada, indefinidamente.
- `alert()` para erros em [TeamBuilderIsland.tsx:326](src/components/live/TeamBuilderIsland.tsx#L326) e [:463](src/components/live/TeamBuilderIsland.tsx#L463), enquanto o resto do componente usa `setErrorMessage`.
- `handlePlayerUpdated` ([:417-421](src/components/live/TeamBuilderIsland.tsx#L417-L421)) sobrescreve nome de time customizado com `Time <capitão>` sempre que o capitão é editado.

---

## B. Transversais (processo / configuração)

- **`any` em 41 pontos** de `src/`, contra a regra explícita do `AGENT.md` ("Nunca use `any`"). Concentrados em `catch (error: any)`, `supabaseClient.ts`, `pinAuth.ts` e `PeriodLeaderboardDTO` (`matches: any[]`, `historical: any[]` — DTO sem contrato).
- **Sem lint e sem CI**: não há ESLint/Prettier/Biome nem `.github/workflows`. `tsc --noEmit`, `astro check` e `npm test` existem mas dependem de execução manual — nada impede um push que quebre os três.
- **E2E não exercita o app real**: `playwright.config.ts` sobe `tests/ui/server.ts` (harness próprio com PGlite) em vez do app Astro. Middleware de PIN, rotas de API reais e páginas `.astro` ficam fora da cobertura end-to-end.
- **Migrações aplicadas à mão** pelo SQL Editor do Supabase (`supabase/README.md`), sem ferramenta de migração. O `docs/IMPLEMENTATION_REVIEW.md` (09/09/2026) registra que a migração ainda **não tinha sido aplicada** no Supabase configurado; desde então entraram mais duas (`202609100001_historical_totals`, `202609210001_loan_in_goal`). Há risco real de divergência schema↔código em produção — o `schemaResilience.ts` é justamente o paliativo para isso.
- **Duplicidade de variáveis de ambiente**: `.env` carrega os dois nomes para a mesma coisa (`PUBLIC_SUPABASE_ANON_KEY` + `PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_SECRET_KEY`). `.env` está corretamente no `.gitignore` e não é rastreado.

---

## C. Infraestrutura, autenticação e permissões de banco

### C0. CRÍTICO — `ADMIN_PIN` é congelado no build e gravado em texto claro no artefato

[pinAuth.ts:9](src/core/infrastructure/auth/pinAuth.ts#L9) e [:18](src/core/infrastructure/auth/pinAuth.ts#L18)

```ts
import.meta.env?.ADMIN_PIN || (… g.process?.env?.ADMIN_PIN) || '1234';
```

`import.meta.env.X` é substituído **estaticamente pelo Vite em tempo de build**.
Verificado no artefato real desta árvore:

```
$ grep -rl "<valor do ADMIN_PIN>" .vercel/
.vercel/output/functions/_render.func/dist/server/chunks/pinAuth_CFeztWsc.mjs
.vercel/output/_functions/chunks/pinAuth_CFeztWsc.mjs
```

Duas consequências:

1. **Trocar o PIN no painel da Vercel não tem efeito sem redeploy.** Se o PIN vazar, a
   rotação silenciosamente não acontece e o responsável acredita que aconteceu.
2. O PIN fica materializado em texto claro no bundle de servidor (só no servidor —
   conferido que não aparece em `.vercel/output/static/` nem em `dist/client/`).

Note a inconsistência interna: [supabaseClient.ts:7](src/core/infrastructure/database/supabaseClient.ts#L7)
faz o **oposto** (tenta `process.env` primeiro, que é o correto para leitura em runtime).
As duas camadas de infraestrutura têm precedência de ambiente invertida.

### C0b. ALTO — `SESSION_SECRET` nunca foi configurado; o fallback do repositório é o segredo em uso

[pinAuth.ts:20](src/core/infrastructure/auth/pinAuth.ts#L20)

```ts
|| 'society_salt_2026_default_secret_key';
```

`SESSION_SECRET` **não existe** no `.env`, no `.env.example` nem no `src/env.d.ts` — logo
esse literal, versionado no repositório, é a chave efetivamente em uso. A chave HMAC é
`${pin}:${secret}` ([:33-37](src/core/infrastructure/auth/pinAuth.ts#L33-L37)), então toda
a segurança dos tokens de sessão passa a depender **exclusivamente do sigilo do PIN** —
o mesmo PIN que o C0 grava em claro no artefato de build.

> Ressalva de precisão: o PIN configurado tem 9 caracteres, não 4. A forja offline de
> token por enumeração de 10.000 combinações **não se aplica** aqui. O defeito é o
> colapso do segredo em um único fator, não uma exploração imediata.

Mesma classe de problema: o fallback `'1234'` do `ADMIN_PIN` em
[:11](src/core/infrastructure/auth/pinAuth.ts#L11). Ambos deveriam falhar no arranque em
produção, não assumir um default.

### C1. ALTO — Chave secreta ausente cai silenciosamente para a chave pública

[supabaseClient.ts:105-108](src/core/infrastructure/database/supabaseClient.ts#L105-L108)

```ts
const secretKey = getServerSecretKey();
const activeKey = secretKey || supabasePublishableKey;   // ← fallback silencioso
return createClient(supabaseUrl, activeKey);
```

Se `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` faltar ou estiver com nome errado
na Vercel, `getSupabaseAdminClient()` **não falha** — devolve um cliente com privilégio
`anon`. Combinado com o `REVOKE` da migração
(`supabase/migrations/202609090001_match_integrity.sql:247`), o resultado é um estado
meio-quebrado e difícil de diagnosticar **em pleno jogo**:

- escritas em `matches` / `match_events` passam a falhar (revogadas para `anon`);
- escritas em `sessions` / `players` continuam funcionando (não revogadas);
- nenhum log diz que a chave sumiu.

O mesmo vale para a URL: [:32-35](src/core/infrastructure/database/supabaseClient.ts#L32-L35)
cai para `https://society-tracker-placeholder.supabase.co` em vez de falhar. Existe
`isSupabaseConfigured`, mas ele não é consultado nesse caminho.

### C2. MÉDIO — `REVOKE` de escrita cobre só metade das tabelas

`supabase/migrations/202609090001_match_integrity.sql:247` protege quatro tabelas:

```sql
REVOKE INSERT,UPDATE,DELETE ON matches,match_events,match_participants,match_operations
  FROM anon,authenticated;
```

Ficam **sem `REVOKE` e sem RLS**: `players`, `sessions`, `session_teams`,
`session_team_players` (DDL em `society-tracker-specs/04_DATABASE_SCHEMA.sql:9-51`). Pela
chave publicável, essas quatro tabelas são graváveis direto no endpoint REST do Supabase,
contornando o middleware de PIN — que só cobre `/api/*`.

**Nuance importante, verificada:** hoje isso **não** está exposto. `supabaseClient.ts` só
é importado pelos repositórios em `src/core/infrastructure/repositories/`, que rodam
apenas no servidor; `grep` por `eyJhbGciOi` e por `supabase.co` em `dist/client/` não
retorna nada — a chave não entra no bundle do navegador. É um buraco **latente**: basta
alguém importar um repositório (ou o export `supabase`) dentro de uma ilha React para que
a chave passe a ser publicada e a lacuna vire exploração real.

### C3. BAIXO — Leitura de env por índice dinâmico não funciona com Vite

[supabaseClient.ts:8](src/core/infrastructure/database/supabaseClient.ts#L8)

```ts
(import.meta.env as any)?.[key]
```

O Vite substitui `import.meta.env.FOO` **estaticamente**; um acesso por índice dinâmico
não é substituído e resolve para `undefined` no bundle. Na prática funciona porque
`process.env` é tentado primeiro no servidor — mas esse ramo é código morto que passa a
falsa impressão de cobrir o caso do cliente.

---

## D. Rotas de API e casos de uso

Auditoria dos 18 endpoints de `src/pages/api/**`. Os itens abaixo foram conferidos contra
o código e as migrations.

### D1. CRÍTICO — Cache de "coluna ausente" envenenado por erro de NOT NULL

[schemaResilience.ts:49](src/core/infrastructure/database/schemaResilience.ts#L49)

```ts
// Padrão 2: column "xyz" of relation "table" does not exist
const match2 = errorMessage.match(/column ["']?([^"'\s]+)["']? of relation/i);
```

O comentário diz `does not exist`, mas **o regex não exige esse sufixo**. A mensagem de
NOT NULL do PostgreSQL é `null value in column "x" of relation "y" violates not-null
constraint` — e casa. O nome da coluna vai para o `missingColumnsCache`
([:4](src/core/infrastructure/database/schemaResilience.ts#L4)), que é **module-level, sem
TTL e sem invalidação**: a coluna é removida de todos os payloads futuros daquela tabela
pelo resto da vida da instância.

Cenário reproduzível: `POST /api/sessions` com `matchDurationSeconds: "abc"` →
`Number("abc")` = `NaN` → serializado como `null` → viola o NOT NULL de
`match_duration_seconds` → a coluna é cacheada como "ausente" → o insert é repetido sem
ela e **retorna 201**. A partir daí, toda rodada criada nessa instância ignora
silenciosamente a duração escolhida.

Variante pior: um `playerId` nulo envenena `player_id` em `session_team_players` — daí em
diante **nenhuma escalação consegue ser salva** até o container reciclar.

Relacionado: [:80-103](src/core/infrastructure/database/schemaResilience.ts#L80-L103)
reexecuta a operação até 5 vezes, e nas chamadas reais a operação é um `INSERT` — se um
timeout de rede trouxer uma mensagem que case no regex depois de o insert ter sido
aplicado, gera linha duplicada.

### D2. ALTO — `PATCH /api/players/[id]` apaga o apelido e exige `name`

[players/[id].ts:25](src/pages/api/players/[id].ts#L25) → [Player.ts:68](src/core/domain/entities/Player.ts#L68)

```ts
nickname: body.nickname,                                  // undefined se omitido
this.props.nickname = nickname ? nickname.trim() : null;  // undefined → null
```

`PATCH` com `{"name":"João","isGoalkeeper":true}` — semântica legítima de atualização
parcial — **zera o apelido no banco**, sem recuperação. E
[UpdatePlayerUseCase.ts:15-17](src/core/application/use-cases/UpdatePlayerUseCase.ts#L15-L17)
rejeita com 400 se `name` faltar, então o PATCH se comporta como PUT: ou o cliente
reenvia o objeto inteiro, ou destrói dados.

### D3. ALTO — Transferência de jogador perde a flag de goleiro

[sessions/[id]/transfer.ts:15-21](src/pages/api/sessions/[id]/transfer.ts#L15-L21)

A rota monta o input com `fromTeamId`, `toTeamId`, `playerId`, `isLoaned` — e **omite
`isGoalkeeper`**, embora o use-case o leia e a RPC o grave. Transferir um goleiro o
insere no time de destino com `is_goalkeeper = false`; o `match_participants` da próxima
partida herda o valor errado e contamina as estatísticas de goleiro. A resposta ecoa
`isGoalkeeper: undefined`, que o `JSON.stringify` omite — o cliente não percebe nada.

### D4. ALTO — Criação de rodada sem transação deixa rodada órfã que bloqueia a retentativa

[SupabaseSessionRepository.ts:159-294](src/core/infrastructure/repositories/SupabaseSessionRepository.ts#L159-L294)

São N+1+N inserts independentes (`sessions`, depois cada `session_teams`, depois cada
`session_team_players`), cada falha fazendo `throw` e deixando o que já foi gravado.

Cenário: um `playerId` inexistente no 3º time → violação de FK → sessão e 2 times ficam no
banco. O usuário corrige e reenvia → agora bate em `session_date DATE NOT NULL UNIQUE` →
400 de chave duplicada. **A rodada fica impossível de criar pela UI**, exigindo limpeza
manual no banco.

Contraste: `society_update_teams` e `society_transfer_player` são RPCs transacionais. Só o
`create` ficou fora do padrão.

### D5. ALTO — `type=month` sem `yearMonth` devolve o histórico inteiro rotulado como mês

[reports/period.ts:13-20](src/pages/api/reports/period.ts#L13-L20) →
[GetPeriodLeaderboardUseCase.ts:27](src/core/application/use-cases/GetPeriodLeaderboardUseCase.ts#L27)

```ts
if (input.type === 'month' && input.yearMonth) {   // sem else
```

Nenhum `startDate`/`endDate` é definido, mas `periodType: 'month'` volta na resposta. A
tela de relatórios exibe a artilharia de **todo o histórico** apresentada como sendo do
mês — erro de dado silencioso, sem 400 e sem aviso.

### D6. MÉDIO — Erros crus do Postgres vazados em todas as rotas

`matchApi.ts:11,20`; `players/index.ts:28,54`; `sessions/index.ts:61,86`;
`sessions/[id]/teams.ts:32`; `transfer.ts:29`; `reports/*`; `leaderboard/index.ts:19`

Todas repassam `error.message` ao corpo. `GET /api/sessions?id=abc` devolve
`invalid input syntax for type uuid: "abc"`; um insert duplicado devolve o nome exato da
constraint e da tabela. Como **todas as rotas GET são públicas**, isso entrega nomes de
tabelas, colunas, constraints e funções a quem não está autenticado.

### D7. MÉDIO — Códigos HTTP invertidos nas duas direções

- **Infra → 4xx**: [matchApi.ts:12-19](src/core/infrastructure/http/matchApi.ts#L12-L19)
  reconhece 409/404/503 por substring e cai em **400** para todo o resto. Supabase fora do
  ar vira 400 — e o cliente em `matchSync.ts` o trata como falha permanente (ver A3). Gols
  perdidos na quadra e monitoramento cego.
- **Validação → 500**: `reports/period.ts:26-32` e `reports/round.ts:30-35` devolvem
  **500** para erro de entrada. `GET /api/reports/period?type=year` sem `year` → 500.
- **Sem type guard**: `login.ts:18` faz `pin = body.pin` sem checar tipo;
  `{"pin":1234}` (número) → `inputPin.trim()` lança `TypeError` → **500** em vez de 401.
  Mesmo padrão em `players/index.ts:41` com `{"name":123}`.
- **UUID não validado** em `sessions/index.ts:16,18`, `sessions/[id]/matches.ts:7`,
  `matches/[id]/index.ts:9`: o valor chega cru ao banco e o erro do Postgres é que define
  o status.

### D8. MÉDIO — Sem rate limiting no login por PIN

[login.ts:11-29](src/pages/api/auth/login.ts#L11-L29); `src/middleware.ts:23` isenta
`/api/auth/` de qualquer verificação. Não há atraso, bloqueio, CAPTCHA nem log de
tentativa. Além disso, [pinAuth.ts:117-128](src/core/infrastructure/auth/pinAuth.ts#L117-L128)
aceita o PIN cru como credencial de API (`x-admin-pin: <pin>` e `Authorization: Bearer
<pin>`), então a credencial de longa duração trafega em toda chamada e tende a acabar em
logs de proxy/CDN.

> Ressalva: com PIN de 9 caracteres, força bruta não é o risco imediato que seria com 4
> dígitos. O que importa aqui é a ausência de qualquer registro de tentativa.

### D9. MÉDIO — Idempotência anulada quando o header falta

[matchApi.ts:32-34](src/core/infrastructure/http/matchApi.ts#L32-L34)

```ts
request.headers.get('Idempotency-Key') ?? ... ?? crypto.randomUUID();
```

O cliente oficial sempre envia o header, então hoje funciona. Mas o servidor **gera uma
chave nova a cada retentativa** quando ele falta: um retry de proxy ou service worker
registra o mesmo gol duas vezes, e a tabela `match_operations` — criada exatamente para
impedir isso — não tem como detectar. Em ação mutante, a ausência de chave deveria ser
400.

### D10. Itens menores

- **Logout não revoga**: [logout.ts:7-9](src/pages/api/auth/logout.ts#L7-L9) só apaga o cookie; o token HMAC segue válido por 24h via `Authorization: Bearer`. Sem denylist nem `jti`.
- **Open redirect**: [login.astro:8,13](src/pages/login.astro#L8) faz `Astro.redirect(searchParams.get('redirect'))` sem exigir destino relativo.
- **`/api/leaderboard` público sem cache nem paginação**: [leaderboard/index.ts:7-11](src/pages/api/leaderboard/index.ts#L7-L11) invoca `society_matches_snapshot(NULL)`, que agrega em JSONB **todas** as partidas, eventos e participantes da história, a cada requisição. As rotas de relatório definem `Cache-Control`; esta não.
- **`POST` aliased para `PUT`** em [sessions/[id]/teams.ts:38](src/pages/api/sessions/[id]/teams.ts#L38): a RPC apaga e reinsere toda a escalação, então um `POST` que o chamador imagina aditivo zera o elenco. (A RPC é transacional — o problema é de contrato, não de corrida.)
- **`tryAutoMigrate` é código morto** ([schemaResilience.ts:111-118](src/core/infrastructure/database/schemaResilience.ts#L111-L118)): não é chamada em lugar nenhum, engole o erro sem log, e deixa exposta uma função que executa DDL arbitrário via RPC `exec_sql`.
- **`/api/auth/status` sem `Cache-Control: no-store`**, ao contrário de todas as outras respostas.
- **`isSupabaseConfigured` e `supabaseAnonKey` nunca são referenciados** — a flag existe para detectar o placeholder e nada a consulta.
- **`sessionId` da URL ignorado** em `/transfer`: a RPC deriva a rodada de `p_from`, então `POST /api/sessions/<uuid-inexistente>/transfer` funciona normalmente.

### O que está bem construído (verificado, não é defeito)

- As 18 rotas declaram `prerender = false` e definem `Content-Type`; `output: 'server'` está correto.
- Cookie de sessão com `httpOnly` + `sameSite: 'lax'` + `secure` em produção — bloqueia POST cross-site sem precisar de token CSRF.
- A chave secreta do Supabase **não** vaza para o navegador (nenhum componente importa `supabaseClient`; conferido em `dist/client/`).
- As operações de partida (`start/goal/score/finish/edit/delete/remove_match`) são genuinamente atômicas: `society_match_command` é `SECURITY DEFINER` com `SELECT … FOR UPDATE`, índice único `matches_one_active`, tabela `match_operations` para idempotência e triggers de guarda. Os defeitos de integridade (D1, D4, D9) estão **fora** dessa camada.

---

## E. Domínio, casos de uso e schema

### E1. CRÍTICO — `end_reason = 'time_limit'` é inalcançável

Verificado por busca em toda a árvore: a string `time_limit` aparece **em um único lugar**,
a união de tipos em [Match.ts:3](src/core/domain/entities/Match.ts#L3). Nunca é gravada.

As três migrations decidem o motivo assim (`202609090001:229`, `202609090002:162`,
`202609210001:127`):

```sql
finish_reason = CASE WHEN m.home_score>=2 OR m.away_score>=2 THEN 'two_goals' ELSE 'manual' END;
```

E a cadeia que deveria produzir o outro valor está inteiramente desligada:

- `Match.handleTimeExpired()` ([Match.ts:156](src/core/domain/entities/Match.ts#L156)) só
  escreve `durationSeconds`; **nunca chama `finish('time_limit')`** — e é código morto:
  nenhum arquivo a invoca.
- `MatchTimer` expõe `onTimeExpired` ([MatchTimer.tsx:54](src/components/live/MatchTimer.tsx#L54)),
  mas `LiveScoreboard` **não passa a prop** ([LiveScoreboard.tsx:95-106](src/components/live/LiveScoreboard.tsx#L95-L106)).

Consequência: uma partida 1×1 que chega a 00:00 e é encerrada pelo mesário grava
`manual`. `LiveScoreboard.tsx:152` mostra "Finalização manual" e o ramo `time_limit` de
[MatchHistoryCard.astro:80](src/components/ui/MatchHistoryCard.astro#L80) nunca renderiza.
O relatório não distingue "acabou o tempo" de "mesário encerrou por outro motivo".

> Contexto importante: `docs/IMPLEMENTATION_REVIEW.md` registra que **não** encerrar
> automaticamente aos 0:00 foi decisão deliberada ("zero sinaliza fim regulamentar e
> permite eventos até a finalização explícita"). Isso é intencional e não deve ser
> revertido. O defeito é o efeito colateral: perdeu-se também o *rótulo* `time_limit`,
> deixando um valor de enum, um método de domínio e um ramo de UI todos mortos.

### E2. ALTO — Placar enviado junto com `status: 'finished'` é descartado em silêncio

[UpdateMatchScoreUseCase.ts:12](src/core/application/use-cases/UpdateMatchScoreUseCase.ts#L12)

```ts
action: input.status === 'finished' ? 'finish' : 'score',
```

Na RPC (`202609210001:107-124`), o bloco que aplica `homeScore`/`awayScore` é **exclusivo
de `p_action='score'`**; com `'finish'` ele é pulado e a execução vai direto ao
encerramento.

Cenário: o mesário corrige 1×0 → 2×1 **e** marca finalizada no mesmo PATCH. A API devolve
200 com o placar **antigo** e a partida é encerrada 1×0. O caminho não-RPC do mesmo use
case faz o correto — dois comportamentos para a mesma entrada.

Mesma classe: [FinishMatchUseCase.ts:11-16](src/core/application/use-cases/FinishMatchUseCase.ts#L11-L16)
monta `input: { durationSeconds }` e descarta `reason`, `homeScore` e `awayScore`, que o
DTO declara. Um chamador que passe `reason: 'time_limit'` recebe `'manual'` sem erro.

### E3. ALTO — `SupabaseMatchRepository.update()` persiste só o placar

[SupabaseMatchRepository.ts:98-106](src/core/infrastructure/repositories/SupabaseMatchRepository.ts#L98-L106)

Assina `IMatchRepository.update(match): Promise<Match>`, mas emite um comando `'score'`
com apenas `homeScore`/`awayScore` — descartando `status`, `endReason`, `durationSeconds`
e `finishedAt`.

Cenário: `FinishMatchUseCase` no caminho não-RPC chama `match.finish()` e depois
`update(match)`. A partida **não é finalizada no banco**, mas o retorno reporta
`status: 'finished'` lido do objeto em memória — mentira silenciosa para o chamador.

### E4. ALTO — `totalMatchesPlayed` cai para `totalSessionsPlayed`: denominador errado no G/J

[GetLeaderboardUseCase.ts:12-13](src/core/application/use-cases/GetLeaderboardUseCase.ts#L12-L13),
repetido em `GetPeriodLeaderboardUseCase.ts:79`, `:96` e `:135`.

```ts
item.totalMatchesPlayed === null ? null : Number(item.totalMatchesPlayed ?? item.totalSessionsPlayed) || 0
```

**Partidas** (mini-jogos, ~8-12 por noite) e **rodadas** (1 por quinta) são métricas
diferentes. O teste é `=== null`, então `undefined` escorrega para o fallback. Um jogador
com 15 partidas em 3 rodadas passa a exibir "3 jogos • 2.33 G/J" no lugar de
"15 jogos • 0.47 G/J" — inflação de 5×. A mesma lógica está escrita 4 vezes.

Há uma migração dedicada a exatamente essa distinção
(`society-tracker-specs/06_FIX_LEADERBOARD_MATCHES_COUNT.sql`), o que sugere que o bug já
foi corrigido no SQL e reintroduzido no TypeScript.

### E5. ALTO — Sem índice nas colunas mais quentes

Todo o SQL do projeto cria **2 índices**, ambos em `matches`. FKs no Postgres não criam
índice. Ficam sem cobertura: `match_events(match_id)`, `match_events(scorer_id)`,
`match_events(assist_id)`, `session_teams(session_id)`, `session_team_players(player_id)`.

`society_participants_json` (`202609090001:253-254`) faz **duas subqueries correlatas com
`count(*)` por participante**, e é chamada 2× por partida. Com 12 participantes × 10
partidas, são ~240 seq scans em `match_events` por chamada de `society_matches_snapshot` —
que roda em **todo** comando de partida (ver E6). A latência cresce com o quadrado do
histórico da rodada.

### E6. ALTO — "Carrega tudo e filtra em JS" em três caminhos

- **Por comando**: [SupabaseMatchRepository.ts:67-82](src/core/infrastructure/repositories/SupabaseMatchRepository.ts#L67-L82) — registrar **1 gol** dispara a RPC do comando + um SELECT em `matches` + `society_matches_snapshot(session_id)`, que devolve **todas** as partidas da rodada com todos os eventos e participantes, para descartar tudo menos uma em JS.
- **Por período**: [:173-190](src/core/infrastructure/repositories/SupabaseMatchRepository.ts#L173-L190) — `getMatchesSummary()` sem filtro (`p_session_id = NULL` → histórico inteiro), e o recorte de datas é feito com `all.filter(...)` em memória. `society_matches_snapshot` não aceita intervalo de datas. Um relatório de 30 dias transfere e desserializa todas as temporadas.
- **Por página**: `historico.astro:14` e `index.astro:35-40` repetem a carga completa a cada render SSR (`prerender = false`), e `SupabaseSessionRepository.findAll()` usa embed aninhado sem `limit`. `relatorios.astro` chama o use case de período 4×.

Somado a E5, é o principal risco de a aplicação degradar conforme o histórico cresce.

### E7. ALTO — `executeWithSchemaFallback` converte erro de schema em corrupção silenciosa

Complementa o D1 (regex). Mesmo com o regex corrigido, o mecanismo tem um problema de
desenho: quando remove uma coluna do payload, a operação retorna `{ data, error: null }` —
o chamador recebe sucesso. `SupabasePlayerRepository.create` devolve o `Player` como se
tudo tivesse sido gravado; um cadastro de goleiro numa base sem `is_goalkeeper` grava um
jogador de linha e responde **201**.

O gatilho mais provável não é nem coluna ausente de verdade: o PostgREST responde
`PGRST204 "Could not find the 'X' column ... in the schema cache"` quando o **cache de
schema dele** está velho — exatamente nos primeiros segundos após uma migração. A primeira
request que chegar nessa janela marca a coluna como inexistente **para o resto da vida
daquela instância serverless**.

### E8. MÉDIO — Duas definições de "goleiro" para a mesma regra "Bola Murcha"

- [GetRoundHighlightsUseCase.ts:46-48](src/core/application/use-cases/GetRoundHighlightsUseCase.ts#L46-L48) prefere o elenco da sessão (`session_team_players.is_goalkeeper`).
- [CompetitionService.ts:284](src/core/domain/services/CompetitionService.ts#L284) usa **só** o snapshot (`match_participants.is_goalkeeper`).

E `202609210001:64,87` insere empréstimos com `is_goalkeeper` **hardcoded FALSE**. Logo um
goleiro que entrou por empréstimo é **excluído** do "Bola Murcha" no card da rodada e
**incluído** no ranking geral — o mesmo jogador, a mesma regra, duas telas divergentes.

### E9. MÉDIO — `session_team_players.is_captain` não está nas migrations versionadas

O código lê ([SupabaseSessionRepository.ts:56](src/core/infrastructure/repositories/SupabaseSessionRepository.ts#L56))
e escreve ([:216](src/core/infrastructure/repositories/SupabaseSessionRepository.ts#L216), [:245](src/core/infrastructure/repositories/SupabaseSessionRepository.ts#L245))
essa coluna. Ela existe apenas em `society-tracker-specs/05_ADD_CAPTAIN_ID.sql` — arquivo
de **spec**, fora de `supabase/migrations/` — e no `RECOMMENDED_MIGRATIONS` do
`schemaResilience.ts`, que só roda via `tryAutoMigrate()` (código morto, ver D10).

Provisionar um banco novo a partir de `supabase/migrations/` produz um schema sem a coluna;
todo insert em `session_team_players` falha e é "salvo" pelo fallback do E7,
silenciosamente. (Atenção: `match_participants.is_captain` — tabela **diferente** — existe
normalmente em `202609090001:22`.)

Além disso, `society_update_teams` (`202609090001:306-307`) insere apenas
`(session_team_id, player_id, is_goalkeeper, is_loaned)`: o `is_captain` que a UI envia
atravessa três camadas e **nunca chega ao banco** por esse caminho.

### E10. MÉDIO — Validações do domínio são código morto em produção

`RegisterGoalUseCase`, `FinishMatchUseCase`, `UpdateMatchScoreUseCase`,
`UpdateMatchEventUseCase` e `DeleteMatchEventUseCase` começam todos com:

```ts
if (this.matchRepository.executeCommand) { ...; return; }
```

`SupabaseMatchRepository` **sempre** implementa `executeCommand`, então em produção o
caminho abaixo — incluindo `new MatchEvent({...})` e `match.registerGoal(...)` — nunca
executa. As validações `InvalidGoalEventError` ("autor ≠ assistência", "gol contra sem
assistência") de [MatchEvent.ts:28-40](src/core/domain/entities/MatchEvent.ts#L28-L40)
não rodam; a única defesa real são os triggers SQL, cujas mensagens cruas viram 400
genérico.

Isso também significa que **os 87 testes que passam exercitam o caminho morto**, não o
produtivo — o que explica como E2 e E3 sobreviveram à suíte.

### E11. MÉDIO — Regra dos 2 gols e dos 420s definida em 6 lugares independentes

| Local | Forma |
|---|---|
| `Match.ts:6-9` | `MATCH_RULES = { MAX_GOALS_FOR_VICTORY: 2, MAX_DURATION_SECONDS: 420 }` |
| `types.ts:67-68` | `DEFAULT_MATCH_DURATION_SECONDS = 420`, `MAX_GOALS_FOR_VICTORY = 2` |
| `MesarioSessionWrapper.tsx:136` | literal `>= 2` |
| 3 migrations | literal `m.home_score>=2 OR m.away_score>=2` |
| 8 pontos | `?? 420` espalhado |

`MATCH_RULES` **só é usado dentro do próprio `Match.ts`** — a constante canônica não
governa nenhum caminho real. Mudar para 3 gols exige editar 5 arquivos e 3 migrations;
esquecer a SQL faz o banco encerrar aos 2 enquanto a UI espera 3.

### E12. Itens menores do domínio

- **Sem teto algum de times/jogadores** (`CreateSessionUseCase.ts:11-23`, `Session.addTeam`): é possível criar rodada com 1 time e 40 jogadores. *Nuance:* a flexibilidade 3-ou-4 times é decisão documentada em `IMPLEMENTATION_REVIEW.md` e **não** é o defeito; o defeito é não haver limite superior nenhum.
- **Gols de jogador ausente de `rows` somem sem aviso** ([CompetitionService.ts:295-303](src/core/domain/services/CompetitionService.ts#L295-L303), sem `else`): o gol continua no placar mas sai da artilharia, e `totalGoalsAll` deixa de bater com a soma da coluna "G".
- **`totalGoals` da rodada mistura agregações** (`GetRoundHighlightsUseCase.ts:83` inclui gols contra; `stats[].goals` exclui): o card mostra "14 gols" com 11 na lista.
- **`RoundHighlights` devolve nomes, não IDs** (`RoundHighlightsService.ts:34-40`): dois "Gabriel" viram entradas indistinguíveis.
- **`CompetitionService.ts:31` ordena por `startedAt.localeCompare`** — comparação léxica de `timestamptz`; só é desempate secundário, mas quebra se o offset da conexão variar.
- **`playerPerformance` usa `find()` linear dentro de laço** (`CompetitionService.ts:252,272`) e `filter` O(n²) para ranquear (`:320-326`, repetido 3× em `GetPeriodLeaderboardUseCase`). Com 60 jogadores e 800 partidas são centenas de milhares de comparações por leaderboard, multiplicadas por E6.
- **Violação de camada**: `SupabaseMatchRepository.ts:15,19` importa `playerPerformance` (domínio) e `performanceLeaderboard` (aplicação) — infra executando regra de negócio. A agregação passa a ter dois pontos de entrada com filtros diferentes, que já divergem em E4.
- **`vw_player_leaderboard` existe em 3 versões e não é consultada** por nenhum TypeScript; o ranking real é calculado em JS, com um critério de "jogador elegível" diferente do da view.

> **Positivo, verificado:** `src/core/domain/**` está limpo — zero imports de `@supabase`,
> `react`, `astro` ou das camadas de infra/aplicação. A regra de pureza do `AGENT.md` está
> respeitada.

---

## F. Ordem de correção sugerida

**Corrompem dados a cada rodada — primeiro:**

1. **A1** (data UTC) — uma linha; erra a data de toda rodada jogada após as 21h. Alinhar
   com o padrão local já usado no resto do código. Dados gravados precisam de conferência.
2. **D1** (regex do `schemaResilience`) — ancorar em `does not exist`. Hoje um `NaN` em
   `matchDurationSeconds` faz a instância inteira parar de gravar a duração das rodadas.
3. **E7** (o fallback em si) — fazer a remoção de coluna **falhar ruidosamente**, ou
   remover o mecanismo. Ele transforma erro de schema em corrupção silenciosa.
4. **E2 + E3** (placar descartado ao finalizar; `update()` parcial) — o mesário corrige o
   placar e finaliza, e a correção some.
5. **D2** (apelido apagado no PATCH) — distinguir `undefined` de `null`.

**Quebram o uso na quadra:**

6. **A3 + A4** — juntos travam exatamente o cenário que a spec prioriza (mesário offline).
   A3: distinguir 4xx de falha de rede em `sendCommand`. A4: `finishing` deve usar o placar
   **confirmado**, não o projetado.
7. **A5** — clonar `homePlayers`/`awayPlayers` em `projectPending` e memoizar a chamada.
8. **D3** (goleiro perdido na transferência) e **E8** (dois critérios de goleiro).

**Configuração e segurança:**

9. **C0 + C0b** — ler `ADMIN_PIN` e `SESSION_SECRET` via `process.env` (nunca
   `import.meta.env`), declarar `SESSION_SECRET` no `.env.example` e no `env.d.ts`, e
   falhar no arranque em produção em vez de usar default.
10. **C1** — erro explícito quando `SUPABASE_SECRET_KEY` falta, em vez de degradar para a
    chave pública.
11. **C2** — completar o `REVOKE` em `players`, `sessions`, `session_teams`,
    `session_team_players`.
12. **D8** — registrar e limitar tentativas de PIN.

**Estrutura e escala (não urgentes, mas crescem com o histórico):**

13. **E5** — criar os índices em `match_events(match_id, scorer_id, assist_id)` e
    `session_teams(session_id)`. É a correção de menor esforço e maior efeito da lista.
14. **E6** — dar a `society_matches_snapshot` parâmetros de intervalo de datas e criar uma
    variante de partida única.
15. **E10 + E11** — decidir se o domínio é a fonte de verdade ou se a SQL é. Hoje são
    ambos, e os testes cobrem o lado que não roda.
16. **A2, E12, D4..D10, A6..A9, C3** e os itens transversais da seção B.

**Decisões que precisam de você (não corrigir sozinho):**

- **A6** — o rótulo do "Gol Contra". O contrato de dados está correto e documentado; é a
  tela que contradiz o fluxo.
- **E1** — se vale reintroduzir o rótulo `time_limit` (sem voltar o encerramento
  automático, que foi decisão deliberada) ou remover o valor morto do enum e da UI.
- **E12** — qual é o teto real de times e de jogadores por rodada.

---

## Verificação

Após cada correção:

```
npx tsc --noEmit && npx astro check && npm test
```

Atenção ao ponto levantado em **E10**: os 87 testes atuais exercitam em boa parte o
caminho **não-RPC**, que não roda em produção. Testes novos para E2, E3 e D1 precisam ir
pelo caminho `executeCommand` — o harness PGlite em `tests/transactions.test.ts` e
`tests/ui/server.ts` já dá a base para isso.

Casos que valem teste automatizado:

- **A1**: relógio fixo em quinta 23:00 BRT → `sessionDate` deve ser a quinta.
- **D1**: erro de NOT NULL não pode marcar a coluna como ausente.
- **E2**: PATCH com placar novo **e** `status: 'finished'` deve persistir o placar novo.
- **A3**: comando rejeitado com 400 não pode bloquear o comando seguinte.
- **A4**: 2º gol pendente deve manter "Finalizar partida" habilitado.
- **A5**: `projectPending` não pode alterar `matches[0].homePlayers`.

Ponta a ponta: `npm run dev` → `/rodada/nova` (montar rodada à noite e conferir a data
gravada) → `/rodada/mesario` (registrar gols com a rede desligada no DevTools e religar).
