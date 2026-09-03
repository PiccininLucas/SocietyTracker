-- Migração 06: Correção no cálculo de partidas disputadas na View de Classificação Geral
-- Desvincula a contagem de jogos de match_events e calcula pela presença real do atleta na quadra (session_team_players + matches finalizadas)

-- Remove a versão anterior da view para permitir a mudança na ordem/nome das colunas
DROP VIEW IF EXISTS vw_player_leaderboard CASCADE;

CREATE VIEW vw_player_leaderboard AS
WITH player_matches AS (
    -- Partidas únicas finalizadas que o jogador efetivamente disputou pelo seu time
    SELECT 
        stp.player_id,
        COUNT(DISTINCT m.id) AS total_matches_played
    FROM session_team_players stp
    JOIN matches m ON (m.home_team_id = stp.session_team_id OR m.away_team_id = stp.session_team_id)
    WHERE m.status = 'finished'
    GROUP BY stp.player_id
),
player_sessions AS (
    -- Rodadas/sessões distintas em que o jogador participou
    SELECT 
        stp.player_id,
        COUNT(DISTINCT st.session_id) AS total_sessions_played
    FROM session_team_players stp
    JOIN session_teams st ON st.id = stp.session_team_id
    GROUP BY stp.player_id
),
player_goals AS (
    SELECT 
        scorer_id AS player_id,
        COUNT(id) AS total_goals
    FROM match_events
    WHERE is_own_goal = FALSE
    GROUP BY scorer_id
),
player_assists AS (
    SELECT 
        assist_id AS player_id,
        COUNT(id) AS total_assists
    FROM match_events
    WHERE assist_id IS NOT NULL AND is_own_goal = FALSE
    GROUP BY assist_id
)
SELECT 
    p.id AS player_id,
    p.name,
    p.nickname,
    p.avatar_url,
    COALESCE(pg.total_goals, 0) AS total_goals,
    COALESCE(pa.total_assists, 0) AS total_assists,
    (COALESCE(pg.total_goals, 0) + COALESCE(pa.total_assists, 0)) AS total_contributions,
    COALESCE(pm.total_matches_played, 0) AS total_matches_played,
    COALESCE(ps.total_sessions_played, 0) AS total_sessions_played,
    ROUND(
        COALESCE(pg.total_goals, 0)::NUMERIC / NULLIF(COALESCE(pm.total_matches_played, 0), 0), 
        2
    ) AS goals_per_match
FROM players p
LEFT JOIN player_matches pm ON pm.player_id = p.id
LEFT JOIN player_sessions ps ON ps.player_id = p.id
LEFT JOIN player_goals pg ON pg.player_id = p.id
LEFT JOIN player_assists pa ON pa.player_id = p.id
WHERE p.is_active = TRUE
ORDER BY total_contributions DESC, total_goals DESC;
