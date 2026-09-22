-- 202609210003: remover grants de escrita que nenhum caminho legítimo usa.
--
-- Contexto verificado contra o banco de produção (não apenas contra os arquivos de
-- migração, que contavam outra história):
--
--   * RLS está LIGADO em todas as tabelas de public, exceto society_schema_versions.
--     Isso foi feito fora das migrações versionadas — nenhuma delas liga RLS em players,
--     sessions, session_teams ou session_team_players.
--   * Existe exatamente UMA policy no schema: historical_totals_public_read.
--   * Logo, para as tabelas de cadastro e escalação, anon/authenticated têm os grants de
--     INSERT/UPDATE/DELETE mas o RLS sem policy bloqueia tudo. Os grants são letra morta.
--   * society_schema_versions é a exceção real: RLS desligado E escrita concedida.
--
-- Esta migração remove os grants supérfluos para que a proteção não dependa apenas de o
-- RLS continuar sem policies permissivas — alguém que adicione uma policy de leitura
-- ampla amanhã reabriria a escrita junto, sem perceber.
--
-- NÃO concede SELECT a anon/authenticated: a aplicação lê pela service_role, que ignora
-- RLS. Conceder leitura aqui não teria efeito hoje e só confundiria a intenção.
--
-- Não liga RLS em society_schema_versions: ligar RLS sem policy bloqueia todo acesso, e
-- essa decisão fica com o responsável pelo projeto.

BEGIN;

REVOKE INSERT, UPDATE, DELETE
  ON players, sessions, session_teams, session_team_players
  FROM anon, authenticated;

-- Tabelas de bookkeeping das próprias migrações: nada além das migrações (postgres /
-- service_role) deveria escrever nelas.
REVOKE INSERT, UPDATE, DELETE
  ON society_schema_versions, society_migration_audit
  FROM anon, authenticated;

GRANT ALL
  ON players, sessions, session_teams, session_team_players,
     society_schema_versions, society_migration_audit
  TO service_role;

INSERT INTO public.society_schema_versions VALUES ('202609210003') ON CONFLICT DO NOTHING;

COMMIT;
