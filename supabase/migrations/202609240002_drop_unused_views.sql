-- 202609240002: remove as views de ranking, que nenhum código usa.
--
-- vw_player_leaderboard e vw_matches_summary vinham do spec 04. O app calcula o ranking em
-- TypeScript a partir de society_matches_snapshot, e nenhuma consulta lê as views. No
-- Supabase elas ainda passavam por cima do RLS: sem security_invoker, rodam com o dono
-- (postgres), então a chave pública lia por elas o que as tabelas escondem. Em produção a
-- vw_matches_summary também estava numa versão antiga, sem away_score.
--
-- As definições continuam no histórico do git (spec 04, 202609090001 e 202609090002).

BEGIN;

DROP VIEW IF EXISTS vw_matches_summary;
DROP VIEW IF EXISTS vw_player_leaderboard;

INSERT INTO public.society_schema_versions VALUES ('202609240002') ON CONFLICT DO NOTHING;

COMMIT;
