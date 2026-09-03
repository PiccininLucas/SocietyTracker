-- Migração: Suporte a capitães de times
ALTER TABLE session_teams ADD COLUMN IF NOT EXISTS captain_id UUID REFERENCES players(id);
ALTER TABLE session_team_players ADD COLUMN IF NOT EXISTS is_captain BOOLEAN DEFAULT FALSE;
