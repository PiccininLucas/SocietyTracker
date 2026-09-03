-- Migração: Adicionar captain_id na tabela session_teams
ALTER TABLE session_teams ADD COLUMN IF NOT EXISTS captain_id UUID REFERENCES players(id);
