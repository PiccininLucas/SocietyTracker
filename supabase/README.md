# Migração de integridade das partidas

## Importação dos totais de 2026 até 03/09

O CSV `Transicao_app (1).csv` foi conferido linha a linha: 39 jogadores, 357 gols,
258 assistências, 615 participações e 16 ocorrências de Bola Murcha. A última coluna
é Bola Murcha, não gols contra. O período é a temporada de 2026 até 03/09/2026, inclusive.

No SQL Editor do projeto Supabase, execute nesta ordem:

1. `migrations/202609100001_historical_totals.sql` completo, para criar a tabela.
2. `imports/2026_ate_03_09.sql` completo, para importar os dados.
3. Publique a versão do aplicativo que lê os totais antigos. A importação sozinha não
   altera o comportamento de uma versão anterior do site.

O segundo arquivo reutiliza cadastros cujo nome ou apelido coincide com o CSV,
ignorando acentos, caixa e espaços repetidos. Nomes não encontrados geram novos
cadastros. **Antes de executar, confira se algum jogador já existe com outro apelido**:
nesse caso, preencha o vínculo `player_id` no ponto indicado no próprio SQL.
Mais de um candidato, dois nomes associados ao mesmo jogador ou um histórico
anterior com valores diferentes abortam a transação inteira. Reexecutar o mesmo
arquivo não soma valores nem duplica jogadores, inclusive após renomear um cadastro.
Cadastros existentes preservam nome, apelido, status ativo e demais atributos.

O resultado da importação lista o vínculo de cada nome. Confirme os totais:

```sql
SELECT count(*) AS jogadores, sum(goals) AS gols, sum(assists) AS assistencias,
       sum(goals + assists) AS participacoes, sum(bottom_count) AS bola_murcha
FROM historical_player_totals
WHERE season = 2026 AND through_date = DATE '2026-09-03'
  AND source_file = 'Transicao_app (1).csv';
-- Esperado: 39 | 357 | 258 | 615 | 16
```

No aplicativo, o Histórico apresenta o levantamento separado das súmulas.
Rankings anuais e gerais usam o acumulado mais os eventos posteriores ao corte,
por jogador. Eventos até 03/09 não somam novamente gols, assistências ou Bola Murcha
de quem consta no levantamento. As partidas e seus detalhes permanecem disponíveis.
Jogadores sem totais importados continuam usando todos os seus eventos registrados.

Jogos, rodadas e médias históricas são desconhecidos (`null` na API), inclusive
quando o CSV informa zero gols. Jogos/vitórias/empates/derrotas/aproveitamento da
tabela e médias identificadas como “no app” usam somente registros do app. O
numerador dessas médias usa apenas os gols registrados, nunca o total importado.
Relatórios mensais e semanais mantêm somente dados registrados, pois o acumulado
não permite distribuir eventos por mês ou dia. `vw_player_leaderboard` permanece
uma consulta das partidas; a combinação usada no app está no serviço de domínio.

Migração e importação validadas localmente com PostgreSQL isolado, incluindo
reexecução e rollback. **Não aplicadas remotamente**: a chave do ambiente local foi
recusada pelo Supabase com `Legacy API keys are disabled`. Atualize as credenciais
somente nas configurações de ambiente; não cole chaves em mensagens.

`migrations/202609090001_match_integrity.sql` é a migração inicial de integridade. O responsável informou que a aplicou com sucesso após conciliar as partidas simultâneas.

## Nova migração: apagar partida

Antes do deploy desta funcionalidade, execute **o arquivo completo** `migrations/202609090002_delete_match.sql` no SQL Editor do mesmo projeto Supabase. A migração inicial já aplicada não precisa ser repetida. Em um banco novo, aplique os dois arquivos na ordem numérica.

Confirme com `SELECT * FROM society_schema_versions WHERE version = '202609090002';`.

O botão “Apagar partida” exige autenticação de administrador e confirmação. Pode apagar a partida atual ou uma recente ainda editável; partidas consolidadas continuam bloqueadas, inclusive após outras exclusões.

A exclusão é lógica: `matches.deleted_at` e `deleted_snapshot` preservam a súmula para auditoria e confirmação de tentativas repetidas. Os eventos e participantes permanecem armazenados, mas a partida deixa de aparecer nos históricos, classificações, rankings e relatórios do aplicativo. Consultas SQL próprias devem filtrar `deleted_at IS NULL`. Não há restauração pelo aplicativo.

Os números de sequência não são reutilizados: apagar a partida #5 faz a próxima ser #6. A exclusão não altera times nem jogadores da rodada. O cliente só retira a partida após confirmação do servidor; uma falha de rede mantém a operação pendente para nova tentativa.

A migração foi validada em PostgreSQL isolado e não foi executada remotamente pelo agente.

## Aplicação

1. Corrija as variáveis do ambiente local/deploy para o projeto Supabase correto. Não envie a chave de serviço em mensagens nem a disponibilize ao navegador.
2. Faça backup do banco e aplique primeiro numa cópia com os dados existentes, especialmente para revisar as participações inferidas e divergências de placar registradas em `society_migration_audit`.
3. Use o SQL Editor do projeto correto, uma conexão PostgreSQL administrativa ou o fluxo de migrações Supabase já utilizado pela equipe. Execute o arquivo completo, incluindo `BEGIN` e `COMMIT`.
4. Se houver partidas simultâneas legadas na mesma rodada, a migração abortará sem descartar dados. Concilie esses registros com o responsável pela rodada antes de repetir. Não há comando automático de exclusão.
5. Confirme o marcador e as funções:

```sql
SELECT * FROM society_schema_versions WHERE version = '202609090001';
SELECT to_regprocedure('public.society_match_command(text,uuid,jsonb,uuid)');
SELECT to_regprocedure('public.society_matches_snapshot(uuid)');
SELECT * FROM society_migration_audit;
```

6. Disponibilize a aplicação e valide leitura, início, gol, correção, finalização e recarga em uma rodada de teste autorizada. A confirmação remota dessa etapa está pendente.

## Dados antigos e reversibilidade

A migração mantém jogos e eventos. Diferenças entre placar e eventos são preservadas como gols de autoria não informada e registradas para auditoria. Escalações antigas são inferidas a partir dos eventos e elencos disponíveis; a informação nova passa a ser registrada por partida.

A reaplicação é protegida por marcador de versão e não restaura gols já corrigidos. Erros antes do `COMMIT` fazem rollback integral. Não existe script destrutivo de downgrade: após novas partidas, remover os novos campos apagaria informações históricas que o schema anterior não comporta.

## Validação local

```text
npm test
npm run check
npm run check:astro
npm run build
npm run test:e2e
```

No Windows, a configuração utiliza Edge instalado. Em outro sistema, instale o Chromium do Playwright, ou defina `PLAYWRIGHT_CHANNEL` para um navegador compatível instalado. O fixture roda apenas em `127.0.0.1:4322`, usa banco em memória e não grava dados reais. Se o ambiente restringir a configuração global de telemetria do Astro, use `ASTRO_TELEMETRY_DISABLED=1` no processo de verificação/build.
