-- 202608140000: baseline — as tabelas que existiam antes das migrations versionadas.
--
-- Produção nasceu do society-tracker-specs/04_DATABASE_SCHEMA.sql, rodado à mão no SQL
-- Editor, e recebeu depois ajustes fora das migrations. Sem este arquivo,
-- `supabase/migrations/` sozinho não reconstruía o banco real. Ele reproduz o estado de
-- produção conferido com `npm run db:diff` em 24/09/2026:
-- - as seis tabelas do spec 04, sem as views (a 202609240002 remove as de produção);
-- - sessions.match_duration_seconds NOT NULL, como está em produção;
-- - RLS ligado nas seis tabelas e sem policies: o app lê e grava só pela service_role.
--
-- Tudo aqui é idempotente e não recria nada que já exista. Num banco que já tem essas
-- tabelas (produção), a baseline só é registrada, com `npm run db:mark-applied
-- 202608140000`, depois de um `npm run db:diff` sem diferenças.

BEGIN;

CREATE TABLE IF NOT EXISTS society_schema_versions(version TEXT PRIMARY KEY);

CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    nickname VARCHAR(50),
    avatar_url TEXT,
    is_goalkeeper BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_date DATE NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'finished')),
    notes TEXT,
    match_duration_seconds INTEGER NOT NULL DEFAULT 420,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color_hex VARCHAR(7) DEFAULT '#333333',
    captain_id UUID REFERENCES players(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_team_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_team_id UUID NOT NULL REFERENCES session_teams(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    is_goalkeeper BOOLEAN DEFAULT FALSE,
    is_loaned BOOLEAN DEFAULT FALSE,
    UNIQUE(session_team_id, player_id)
);

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

-- Ligado em produção pelo painel do Supabase, fora das migrations (ver 202609210003).
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_team_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;

INSERT INTO public.society_schema_versions VALUES ('202608140000') ON CONFLICT DO NOTHING;

COMMIT;
