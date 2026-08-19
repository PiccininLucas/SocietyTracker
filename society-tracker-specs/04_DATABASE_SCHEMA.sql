-- ==========================================================
-- SCHEMA POSTGRESQL / SUPABASE: SOCIETY MATCH TRACKER
-- ==========================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabela de Jogadores Cadastrados
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    nickname VARCHAR(50),
    avatar_url TEXT,
    is_goalkeeper BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Sessões (As quintas-feiras)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_date DATE NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'finished')),
    notes TEXT,
    match_duration_seconds INTEGER DEFAULT 420,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela dos Times da Noite (4 times por rodada)
CREATE TABLE IF NOT EXISTS session_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL, -- Ex: 'Preto', 'Branco', 'Azul', 'Vermelho'
    color_hex VARCHAR(7) DEFAULT '#333333',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Escalação dos Jogadores nos Times da Noite
CREATE TABLE IF NOT EXISTS session_team_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_team_id UUID NOT NULL REFERENCES session_teams(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    is_goalkeeper BOOLEAN DEFAULT FALSE,
    is_loaned BOOLEAN DEFAULT FALSE,
    UNIQUE(session_team_id, player_id)
);

-- Migração rápida para bases existentes:
-- ALTER TABLE players ADD COLUMN IF NOT EXISTS is_goalkeeper BOOLEAN DEFAULT FALSE;
-- ALTER TABLE session_team_players ADD COLUMN IF NOT EXISTS is_goalkeeper BOOLEAN DEFAULT FALSE;

-- 5. Partidas (Mini-jogos de 7 min / 2 gols)
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    home_team_id UUID NOT NULL REFERENCES session_teams(id),
    away_team_id UUID NOT NULL REFERENCES session_teams(id),
    home_score INTEGER DEFAULT 0 CHECK (home_score >= 0),
    away_score INTEGER DEFAULT 0 CHECK (away_score >= 0),
    duration_seconds INTEGER DEFAULT 0,
    end_reason VARCHAR(20) CHECK (end_reason IN ('two_goals', 'time_limit', 'manual')),
    status VARCHAR(20) DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'finished')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

-- 6. Eventos do Jogo (Gols e Assistências)
CREATE TABLE IF NOT EXISTS match_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES session_teams(id),
    scorer_id UUID REFERENCES players(id) ON DELETE SET NULL,
    assist_id UUID REFERENCES players(id) ON DELETE SET NULL,
    event_time_seconds INTEGER DEFAULT 0,
    is_own_goal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================
-- VIEWS DE ESTATÍSTICAS E RANKINGS AUTOMÁTICOS
-- ==========================================================

-- View: Ranking Geral de Artilharia e Assistências
CREATE OR REPLACE VIEW vw_player_leaderboard AS
SELECT 
    p.id AS player_id,
    p.name,
    p.nickname,
    p.avatar_url,
    COALESCE(COUNT(DISTINCT m_ev.id) FILTER (WHERE m_ev.is_own_goal = FALSE), 0) AS total_goals,
    COALESCE(COUNT(DISTINCT a_ev.id), 0) AS total_assists,
    (
        COALESCE(COUNT(DISTINCT m_ev.id) FILTER (WHERE m_ev.is_own_goal = FALSE), 0) + 
        COALESCE(COUNT(DISTINCT a_ev.id), 0)
    ) AS total_contributions,
    COUNT(DISTINCT stp.session_team_id) AS total_sessions_played
FROM players p
LEFT JOIN match_events m_ev ON m_ev.scorer_id = p.id
LEFT JOIN match_events a_ev ON a_ev.assist_id = p.id
LEFT JOIN session_team_players stp ON stp.player_id = p.id
WHERE p.is_active = TRUE
GROUP BY p.id, p.name, p.nickname, p.avatar_url
ORDER BY total_goals DESC, total_assists DESC, total_contributions DESC;

-- View: Histórico Completo de Partidas com Nomes dos Times
CREATE OR REPLACE VIEW vw_matches_summary AS
SELECT 
    m.id AS match_id,
    m.session_id,
    s.session_date,
    ht.name AS home_team_name,
    ht.color_hex AS home_team_color,
    m.home_score,
    at.name AS away_team_name,
    at.color_hex AS away_team_color,
    m.away_score,
    m.duration_seconds,
    m.end_reason,
    m.status,
    m.started_at,
    m.finished_at
FROM matches m
JOIN sessions s ON s.id = m.session_id
JOIN session_teams ht ON ht.id = m.home_team_id
JOIN session_teams at ON at.id = m.away_team_id
ORDER BY m.started_at DESC;
