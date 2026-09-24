# Banco de dados (Supabase)

## Como aplicar migrations

As migrations são aplicadas pelo `scripts/db.mjs`, nunca à mão no SQL Editor. Várias
delas redefinem `society_match_command` inteira. Rodar um arquivo antigo depois dos mais
novos desfaz o que eles mudaram, sem erro nenhum. O script só aplica o que ainda não está
registrado em `society_schema_versions` e recusa arquivo fora de ordem.

Pré-requisito: `SUPABASE_DB_URL` no `.env` (Supabase Dashboard > Connect > Direct
connection). O TLS é sempre verificado com a CA raiz do Supabase, em
`certs/supabase-root-ca.crt` (certificado público; `PG_CA` aponta para outro arquivo).

```text
npm run db:status                   # aplicadas, pendentes e fora de ordem (só leitura)
npm run db:diff                     # banco x migrations do repositório (só leitura)
npm run db:migrate -- --yes         # aplica as pendentes em ordem e confere as permissões
npm run db:grants                   # o que a chave pública consegue fazer (só leitura)
npm run db:mark-applied -- <v> --yes  # registra sem executar (usado só na baseline)
```

Sem `--yes`, `db:migrate` só mostra o que faria. Aplique a migration **antes** do deploy
do código que depende dela.

Regras para uma migration nova:

- nome `AAAAMMDDNNNN_descricao.sql`, com `BEGIN;` e `COMMIT;` e registrando a própria
  versão (`INSERT INTO public.society_schema_versions VALUES ('…') ON CONFLICT DO NOTHING;`);
- toda função nova termina com `REVOKE ALL ON FUNCTION … FROM PUBLIC, anon, authenticated;`
  e `GRANT EXECUTE … TO service_role;`. No Supabase, `REVOKE … FROM PUBLIC` não basta: os
  default privileges dão EXECUTE a `anon` e `authenticated` em toda função nova;
- `tests/migrations.test.ts` monta o banco do zero com esses default privileges e falha se
  a chave pública puder executar função de escrita ou gravar em alguma tabela.

### Baseline

`migrations/202608140000_baseline.sql` recria as tabelas que existiam antes das migrations
versionadas: as seis do `society-tracker-specs/04_DATABASE_SCHEMA.sql`, como estão em
produção, com o RLS que foi ligado pelo painel. Num banco novo ela roda como qualquer
outra. Em produção ela é só registrada, com `db:mark-applied 202608140000`, depois de um
`db:diff` sem diferenças. Os testes e o `db:diff` montam o banco a partir dela, e não do
spec 04.

## Importação dos totais de 2026 até 03/09

O CSV `Transicao_app (1).csv` foi conferido linha a linha: 39 jogadores, 357 gols,
258 assistências, 615 participações e 16 ocorrências de Bola Murcha. A última coluna
é Bola Murcha, não gols contra. O período é a temporada de 2026 até 03/09/2026, inclusive.

A tabela vem de `migrations/202609100001_historical_totals.sql`. Os dados vêm de
`imports/2026_ate_03_09.sql`, executado depois da migration. Os dois já estão em produção.

O arquivo de importação reutiliza cadastros cujo nome ou apelido coincide com o CSV,
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
não permite distribuir eventos por mês ou dia. A combinação usada no app está no
serviço de domínio; as views de ranking do spec 04 foram removidas em `202609240002`.

## Integridade das partidas (202609090001)

A migração inicial de integridade. O responsável a aplicou em produção depois de conciliar
as partidas simultâneas. Se houver partidas simultâneas legadas na mesma rodada, ela aborta
sem descartar dados; não há comando automático de exclusão.

A migração mantém jogos e eventos. Diferenças entre placar e eventos são preservadas como
gols de autoria não informada e registradas em `society_migration_audit`. Escalações
antigas são inferidas a partir dos eventos e elencos disponíveis; a informação nova passa a
ser registrada por partida. Não existe script de downgrade: depois de novas partidas,
remover os novos campos apagaria informações que o schema anterior não comporta.

## Apagar partida (202609090002)

O botão “Apagar partida” exige autenticação de administrador e confirmação. Pode apagar a partida atual ou uma recente ainda editável; partidas consolidadas continuam bloqueadas, inclusive após outras exclusões.

A exclusão é lógica: `matches.deleted_at` e `deleted_snapshot` preservam a súmula para auditoria e confirmação de tentativas repetidas. Os eventos e participantes permanecem armazenados, mas a partida deixa de aparecer nos históricos, classificações, rankings e relatórios do aplicativo. Consultas SQL próprias devem filtrar `deleted_at IS NULL`. Não há restauração pelo aplicativo.

Os números de sequência não são reutilizados: apagar a partida #5 faz a próxima ser #6. A exclusão não altera times nem jogadores da rodada. O cliente só retira a partida após confirmação do servidor; uma falha de rede mantém a operação pendente para nova tentativa.

## Encerrar rodada (202609240003)

O mesário encerra a rodada pelo botão “Encerrar rodada”, que só aparece sem partida em
andamento. `society_set_session_status` trava a rodada, recusa encerrar com partida em
andamento (409) e grava `sessions.status`. Um trigger em `matches` recusa partida nova em
rodada encerrada, inclusive um início que estava na fila do celular. Corrigir e apagar as
três últimas partidas e ajustar goleiro ou capitão continuam liberados. “Reabrir rodada”
desfaz o encerramento.

Ao ser aplicada, a migration encerra as rodadas anteriores à mais recente que não têm
partida em andamento. Todas já acabaram, e nenhuma tinha sido encerrada porque o botão não
existia. A mais recente fica como está, porque pode ser a da noite. Aplique antes do deploy:
sem a função, o botão responde 503.

## Validação local

```text
npm run lint
npm run format:check
npm run check
npm run check:astro
npm test
npm run test:e2e
npm run build
```

No Windows, a configuração utiliza Edge instalado. Em outro sistema, instale o Chromium do Playwright, ou defina `PLAYWRIGHT_CHANNEL` para um navegador compatível instalado. O fixture roda apenas em `127.0.0.1:4322`, usa banco em memória e não grava dados reais. Se o ambiente restringir a configuração global de telemetria do Astro, use `ASTRO_TELEMETRY_DISABLED=1` no processo de verificação/build.
