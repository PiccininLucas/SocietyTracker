-- 202609210004: índices nas colunas dos caminhos quentes.
--
-- Chaves estrangeiras no PostgreSQL NÃO criam índice automaticamente. Até aqui todo o
-- projeto tinha apenas 2 índices, ambos em `matches`.
--
-- O caso mais caro é society_participants_json: duas subqueries correlatas com count(*)
-- sobre match_events por participante, e a função é chamada 2x por partida dentro de
-- society_matches_snapshot — que por sua vez roda em TODO comando de partida. Sem índice
-- em match_events(match_id) cada uma dessas contagens é um seq scan, e o custo cresce com
-- o quadrado do histórico da rodada.

BEGIN;

-- society_participants_json, society_event_score, society_matches_snapshot e o ramo
-- 'score' de society_match_command filtram todos por match_id.
CREATE INDEX IF NOT EXISTS idx_match_events_match_id ON match_events(match_id);

-- Joins de autoria em vw_player_leaderboard e no snapshot. Parcial: a maioria dos
-- eventos tem autor, e gols contra / sem autoria gravam NULL.
CREATE INDEX IF NOT EXISTS idx_match_events_scorer_id ON match_events(scorer_id)
  WHERE scorer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_match_events_assist_id ON match_events(assist_id)
  WHERE assist_id IS NOT NULL;

-- getTeamsBySessionId e todos os embeds session_teams(*) do PostgREST.
CREATE INDEX IF NOT EXISTS idx_session_teams_session_id ON session_teams(session_id);

-- O UNIQUE(session_team_id, player_id) já cobre buscas por session_team_id, mas não por
-- player_id, usado em society_update_teams e society_roster_participation.
CREATE INDEX IF NOT EXISTS idx_session_team_players_player_id ON session_team_players(player_id);

-- society_participants_json filtra por (match_id, team_id); a PK cobre só o prefixo.
CREATE INDEX IF NOT EXISTS idx_match_participants_match_team
  ON match_participants(match_id, team_id);

INSERT INTO public.society_schema_versions VALUES ('202609210004') ON CONFLICT DO NOTHING;

COMMIT;
