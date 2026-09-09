# Revisão e implementação — SocietyTracker

Data: 09/09/2026. Alterações implementadas no projeto local, sem publicação.

## Situação da entrega

As funcionalidades estão implementadas e foram exercitadas com os componentes reais, as rotas de comandos e PostgreSQL isolado (PGlite). **A migração ainda não foi aplicada ao Supabase configurado:** a consulta remota de leitura retornou HTTP 401. A aplicação precisa da migração antes de ser disponibilizada com estas alterações. Nenhuma credencial foi alterada ou registrada neste relatório.

O repositório estava sem alterações locais no início da revisão. Nenhum arquivo de `society-tracker-specs` foi alterado ou excluído.

## Arquitetura encontrada e mantida

- Astro com renderização no servidor, adaptador Vercel e páginas públicas de classificação, histórico e relatórios.
- React para o modo mesário, modais e geração dos cards PNG; Tailwind, Lucide e componentes existentes de cronômetro, áudio, vibração e times.
- Domínio TypeScript em `src/core/domain`; casos de uso e DTOs em `src/core/application`; adaptadores Supabase e HTTP em `src/core/infrastructure`; apresentação em `src/pages` e `src/components`.
- PostgreSQL/Supabase com `players`, `sessions`, `session_teams`, `session_team_players`, `matches` e `match_events`. Autenticação de escrita pelo middleware de PIN; chave privilegiada utilizada somente no servidor.
- Cada `session_team` pertence a uma rodada. Times com o mesmo nome ou cor em outra semana têm identidades diferentes. A carreira do jogador é agregada pelo ID permanente de `players`.

Antes das mudanças, as entidades e os casos de uso mantinham parte das regras, mas a interface também alterava placares e finalizava jogos independentemente da confirmação do banco. O repositório recalculava resultados em várias requisições, e a participação histórica dependia das escalações atuais.

Agora, `CompetitionService` reúne os cálculos de classificação, confrontos, sequências e desempenho. Comandos de escrita passam por `MatchCommandUseCase` e pelo adaptador Supabase até uma transação PostgreSQL. Restrições e gatilhos protegem os invariantes no armazenamento. Os casos de uso anteriores também delegam ao comando atômico quando utilizam esse adaptador.

## Referências efetivamente consultadas

Também foi lido `AGENT.md`. As referências abaixo foram lidas pelo conteúdo, antes das alterações de implementação:

| Arquivo em `society-tracker-specs` | Influência na implementação |
| --- | --- |
| `01_PROJECT_OVERVIEW.md` | Escopo do produto, perfis, stack e uso na quadra. |
| `02_DOMAIN_AND_RULES.md` | Times renovados a cada quinta, identidade cumulativa dos jogadores, empréstimos, gols, assistências e vitória aos dois gols. |
| `03_CLEAN_ARCHITECTURE.md` | Separação de domínio, aplicação, infraestrutura e apresentação. |
| `04_DATABASE_SCHEMA.sql` | Contratos existentes, chaves, eventos, rodadas e views; base dos testes de migração. |
| `05_UI_UX_MESARIO_FLOW.md` | Interface móvel, gaveta de dois toques, feedback e preservação local do estado. |
| `05_ADD_CAPTAIN_ID.sql` | Compatibilidade com capitães e escalações. |
| `06_IMPLEMENTATION_ROADMAP.md` | Organização incremental das funcionalidades e validações. |
| `06_FIX_LEADERBOARD_MATCHES_COUNT.sql` | Diferença entre partidas jogadas e rodadas, inclusive jogadores sem gols. |
| `07_PNG_EXPORTS_AND_HIGHLIGHTS.md` | G+A, empates, cards PNG e regra automática de Bola Murcha com imunidade dos goleiros. |

## Divergências e decisões adotadas

| Tema | Diferença encontrada | Decisão |
| --- | --- | --- |
| Cronômetro | A referência 02 e o código encerravam ao zerar. | O pedido atual prevalece: zero sinaliza fim regulamentar e permite eventos até a finalização explícita. |
| Dois gols | O texto inicial poderia ser entendido como exigindo finalização manual em todos os casos. | Mantida a vitória automática aos dois gols, conforme esclarecimento dado pelo usuário durante a tarefa. |
| Temporada | O código chamava todo o histórico de temporada. | Ano civil selecionável, com opção separada “Todo o histórico”, conforme esclarecimento do usuário. |
| Times | Reutilizar nomes/cores poderia misturar elencos de semanas diferentes. | Classificação e confronto usam IDs dos times de cada rodada. Somente estatísticas individuais atravessam rodadas. |
| Semana | Não havia definição de intervalo para a nova tabela. | Segunda a domingo, pela data da rodada, inclusive semanas que atravessam mês/ano. A seleção semanal é independente do filtro anual dos jogadores. |
| Janela de correção | Não existia bloqueio persistido. | Três partidas finalizadas mais recentes **por rodada**, mais o jogo em andamento. A quarta consolida a anterior. A política vale também na súmula do histórico e na API. |
| Desempate dos times | Não havia ordem completa na documentação. | Pontos, vitórias, saldo, gols pró, confronto direto e nome. Confronto direto usa pontos numa minitabela do grupo empatado; evita comparadores cíclicos em empates triplos. ID só resolve nomes tecnicamente idênticos. |
| Permanência | O código sugeria que o vencedor continuasse; não havia saída obrigatória após três vitórias. | Mantida a sugestão e exibida a sequência. O mesário escolhe o próximo adversário. Não foi inventada uma regra de saída na terceira vitória. |
| Bola Murcha | O pedido usa “eleito”; o produto documenta cálculo automático. | Uma ocorrência por rodada para quem participou e ficou sem G/A; goleiros imunes se atuaram nessa função na rodada. Valores de rodadas em andamento são identificados como provisórios. Não foi criado sistema de votação. |
| Gol contra | A referência 02 descreve o time beneficiado; código e registros utilizam o time que cometeu o gol contra. | Preservado o contrato efetivo: `event.teamId` é o time que cometeu; o ponto vai para o adversário. Isso evita inverter dados já existentes. |
| Tamanho/duração | Specs mencionam quatro times e sete minutos; a implementação já aceitava configurações diferentes. | Preservada a flexibilidade existente e a duração configurada na rodada. |
| Participação antiga | O banco anterior não guardava escalação por partida. | Inferência conservadora, identificada na UI: evidência dos eventos primeiro, escalação disponível depois. Não é possível reconstruir perfeitamente transferências antigas não registradas. |

## Regras e fluxos implementados

### Partida, edição e consolidação

- Placar passa a refletir os eventos persistidos, incluindo gols contra e gols sem autoria informada.
- Histórico recente mostra número do jogo na rodada, times, resultado, autores, assistências e sequências/interrupções.
- Editor compartilhado para jogo atual, três partidas recentes e histórico: trocar autor, assistência ou time, marcar gol contra, retirar assistência, remover lance e corrigir placar.
- Remover gol exige confirmação, usa texto/ícone, contraste forte e alvo de toque de pelo menos 44px.
- Aumentar o placar cria gols com autoria não informada. Para reduzir um placar com autor ou assistência conhecida, a interface orienta remover o lance correspondente. Assim, a correção não escolhe arbitrariamente qual estatística apagar.
- Correções em jogos finalizados mantêm o encerramento original. Atualizam placar, estatísticas, pontos, aproveitamento, retrospectos e sequências, sem reabrir a partida nem iniciar outro jogo.
- Gatilhos e comandos recusam mudanças em partidas consolidadas e eventos que não pertençam à partida da URL.

### Finalização e recuperação

- Zero não finaliza. O aviso regulamentar e os controles de eventos permanecem disponíveis.
- Finalização manual exige confirmação simples. Vitória aos dois gols continua automática.
- A rodada é bloqueada dentro da transação durante cada comando. Há índice para uma única partida ativa por rodada e sequência única por rodada.
- `Idempotency-Key` identifica a operação. Repetir a mesma operação devolve o resultado existente; reutilizar a chave com outro conteúdo é rejeitado.
- Finalizar repetidamente não altera o horário original nem duplica estatísticas. O servidor calcula o resultado pelos eventos, sem confiar num placar enviado no pedido de finalização.
- Operações ficam no armazenamento local antes do envio. Uma resposta perdida pode ser repetida após recarga, usando a mesma chave. O ID do novo gol coincide com a chave para evitar duplicação visual durante recuperação.
- O próximo confronto aguarda a confirmação do servidor. Há feedback, retentativa e descarte confirmado de operações pendentes.
- O cronômetro usa uma referência temporal persistida e respeita pausa/retomada e recarga. O cache novo é separado por rodada, sob `society_active_match_state:<sessionId>`.
- O cache antigo `society_active_match_state` é preservado e pode ser baixado. Seus eventos não são relançados automaticamente porque a versão anterior não registrava confirmações confiáveis nem IDs suficientes para evitar duplicações.

### Classificação e jogadores

- Times: posição, P/J/V/E/D, GP/GC/SG e aproveitamento; vitória 3, empate 1, derrota 0. Somente jogos finalizados da semana selecionada.
- Retrospecto: vitórias de cada lado, empates, jogos e gols; a interface explicita o escopo semanal. Havendo mais de uma rodada na semana, os times permanecem separados e recebem a data no nome exibido.
- Jogadores: jogos, V/E/D, aproveitamento, G+A, gols, assistências, três posições de ranking e Bola Murcha, com ordenação por colunas principais.
- Aproveitamento individual: `(3 × vitórias + empates) / (3 × jogos) × 100`. Zero jogos resulta em 0%, sem divisão por zero.
- Empates compartilham posição de competição (1, 1, 3). Critérios secundários ordenam a apresentação sem desfazer o empate numérico.
- Participação é registrada por partida. Um jogador conta uma vez em cada jogo, mesmo sem G/A; mudanças entre partidas não reescrevem partidas anteriores. Jogadores inativos com participação continuam presentes.
- Entradas numa equipe durante um jogo são incorporadas à participação desse jogo. Troca para o adversário durante a mesma partida é recusada; pode ocorrer entre partidas. Uma falha na troca reverte toda a operação.
- Tabelas têm rolagem horizontal; o nome do jogador fica fixo para permitir leitura no celular. Páginas e modais têm estados de erro/carregamento/vazio e feedback de salvamento.

## Causa reproduzida do bug de assistência

A gaveta estava dentro do `<main>` com `position: relative` e `z-index: 10`. A navegação móvel era fixa, fora desse contexto, com `z-index: 50`. Aumentar apenas o `z-index` interno da gaveta não a colocava acima da navegação.

No cenário de 360 × 640, o último jogador da assistência aparecia na área ocupada pela navegação. O Playwright reproduziu o clique interceptado pelo link “Jogos”; `document.elementFromPoint` também mostrou que o botão não recebia o toque. Não se tratava de erro de índice nem de um ID diferente do selecionado.

A correção usa portal para `document.body`, altura baseada em `dvh`, área segura, rolagem com `min-height: 0` e cabeçalho que não encolhe. O editor de correções também recebeu nomes acessíveis explícitos para os seletores. Testes verificam o último jogador por ID e nome, listas vazias/unitárias, ausência de assistência e telas em retrato/paisagem/desktop.

## Migração e compatibilidade

Arquivo: `supabase/migrations/202609090001_match_integrity.sql`. Instruções de aplicação em `supabase/README.md`.

- Migração incremental dentro de transação; sem exclusão de jogos/eventos históricos.
- Acrescenta sequência, bloqueio, autoria não informada e campos opcionais de versões anteriores quando ausentes.
- Cria `match_participants`, `match_operations`, `society_migration_audit` e marcador de versão.
- Cria comandos transacionais e consulta consistente da súmula, além de atualização de times e transferências transacionais.
- Preserva eventos antigos e diferenças de placar criando gols sem autoria, com placar original registrado para auditoria. Assistências de gols cujo autor já foi removido continuam preservadas.
- A reaplicação não recria gols removidos em correções nem substitui escalações históricas.
- Havendo mais de uma partida ativa legada na mesma rodada, aborta com mensagem e rollback, sem escolher qual registro eliminar.
- Mantém as rotas existentes e os campos antigos das respostas, acrescentando a súmula canônica. A view de ranking mantém seu contrato, passando a contar participação histórica e apenas jogos finalizados.
- Não há fallback que ignore os campos de integridade se a migração estiver ausente.

## Áreas e arquivos alterados

| Área | Arquivos principais |
| --- | --- |
| Domínio | `CompetitionService.ts`, `Match.ts`, `MatchEvent.ts`, `IMatchRepository.ts`, `IMatchCommands.ts` |
| Aplicação | `MatchCommandUseCase.ts`, `matchOutput.ts`, DTO de períodos, casos de uso de gol/finalização/placar/eventos, `GetPeriodLeaderboardUseCase.ts`, `GetRoundHighlightsUseCase.ts` |
| Persistência/HTTP | `SupabaseMatchRepository.ts`, `SupabaseSessionRepository.ts`, `matchApi.ts`, rotas de início/gols/finalização/placar/eventos, consulta de partidas por sessão e relatório de período |
| Modo mesário | `MesarioSessionWrapper.tsx`, `LiveScoreboard.tsx`, `GoalDrawer.tsx`, novos `MatchEditor.tsx`, `matchSync.ts` e `useMatchSession.ts` |
| Histórico/modais | `ModalPortal.tsx`, `MatchDetailsModal.tsx`, `MatchHistoryCard.astro` e `historico.astro`; texto de eventos escapado na atualização dinâmica do card |
| Classificação | `TeamStandings.tsx`, `PlayerPerformanceTable.tsx`, `index.astro` |
| Relatórios e layout | `ReportsIsland.tsx`, `PeriodLeaderboardCard.tsx`, `relatorios.astro`, `rodada/mesario.astro`, `Layout.astro` |
| Banco | Migração incremental em `supabase/migrations` |
| Validação | `competition.test.ts`, `transactions.test.ts`, testes de domínio/casos de uso, `tests/ui`, `playwright.config.ts`, scripts e dependências de desenvolvimento |

## Validação

Os testes de navegador usam Edge no Windows, viewports móveis e PostgreSQL PGlite com o schema de referência e a migração real. A autenticação no fixture é simulada; o adaptador remoto Supabase e o ambiente Vercel não foram exercitados em produção por causa do HTTP 401.

| Comando/verificação | Resultado final em 09/09/2026 |
| --- | --- |
| `npm test` | **73 testes passaram**, 19 suítes, zero falhas ou testes ignorados. A linha de base tinha 58 testes. |
| `npm run check` | `tsc --noEmit` aprovado. |
| `npm run check:astro` | 122 arquivos analisados: **zero erros, zero warnings**, 24 sugestões de limpeza/depreciação. |
| `npm run build` | Build SSR e bundle do adaptador Vercel concluídos com sucesso. |
| `npx playwright test` / `npm run test:e2e` | **8 testes passaram**: cinco tamanhos de tela para assistência, listas vazias/unitárias, fluxo completo integrado ao banco e relatório anual com recuperação de erro. |
| Viewports | 360×640, 390×844, 430×740, 740×360 e 1280×800. Fluxo completo no menor viewport móvel. |
| Revisão visual | Mesário, correção recente, tabelas, súmula consolidada e relatórios revisados em capturas do navegador. Cabeçalho do relatório corrigido após detectar overflow horizontal. |
| `git diff --check` | Sem erros de whitespace. |
| Documentação original | `git diff -- society-tracker-specs` vazio; nove referências preservadas. |

O projeto não tinha ESLint nem outro comando de lint configurado. A análise estática disponível foi realizada com TypeScript e Astro; os arquivos TypeScript alterados também foram formatados. Para os comandos Astro foi necessário desativar a telemetria no processo, pois o sandbox não permite gravar a configuração global do usuário. Testes Node/Edge precisaram ser executados fora desse sandbox devido a restrições do processo, sem acesso de escrita ao banco real.

Cobertura de negócio e integração: vitória/empate/derrota; gols com e sem assistência; gol contra; último jogador; exclusão e redução até zero; alteração de autoria; correção de resultado finalizado; atualização de classificação, confrontos, sequências e aproveitamento; quarto jogo consolidando o primeiro; rejeição pela API e por gatilho; tempo zerado; dois gols; finalização manual; cliques repetidos; recarga; conexão interrompida; resposta perdida após commit; reaplicação/rollback da migração; transferências e jogadores inativos; autor removido preservando assistência; rankings empatados; seleção anual e semana atravessando ano.

Capturas revisadas visualmente ficam em `test-results` (ignoradas pelo Git). Nenhuma validação dependeu de gravar dados no Supabase real.

## Limitações e pontos a confirmar no ambiente

1. **Aplicar a migração e validar o ambiente real após corrigir a credencial do Supabase.** O HTTP 401 impediu inspeção do schema implantado e teste com os dados reais. Não foi feita publicação.
2. Participação anterior à migração é inferida: não há informação suficiente para recuperar com certeza todas as trocas antigas. A interface sinaliza isso; o novo modelo registra as próximas participações.
3. A janela foi definida por rodada. As últimas três de uma rodada anterior continuam disponíveis para correção no histórico; o fechamento da janela é provocado pela quarta partida daquela mesma rodada.
4. Registros locais da versão antiga exigem conferência antes de eventual relançamento; o original permanece preservado e exportável.
5. Persistência offline cobre a página já carregada e a recuperação ao reconectar. Não foi adicionado um service worker para abrir o aplicativo do zero inteiramente sem rede.
6. Não foi possível testar em aparelhos físicos/iOS; foram usados viewports móveis no navegador Edge. Áudio/vibração dependem das permissões e capacidades do aparelho.

## Melhorias futuras fora do escopo implementado

- Auditoria de cada correção com usuário, antes/depois e motivo; a tabela atual de operações garante idempotência, não substitui uma auditoria editorial completa.
- Reconciliação assistida das escalações históricas inferidas, utilizando os registros originais da pelada quando disponíveis.
- Paginação/agregação no banco para temporadas com volume elevado; a versão atual calcula os rankings a partir de súmulas consistentes.
- Sincronização explícita de cronômetro entre dispositivos e teste concorrente com múltiplos mesários conectados ao Supabase real.
- PWA com abertura offline e validação em Safari/iOS físico.
- Criação da rodada inteira em uma única transação; a integridade de partidas, eventos, edição de times e transferências já foi tratada nesta entrega.
- Revisão dos avisos de dependências emitidos pelo npm antes de futuros upgrades; não foram feitas atualizações automáticas potencialmente incompatíveis de dependências de produção.
