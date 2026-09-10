BEGIN;

-- One season-to-date snapshot per player. Unknown games/sessions are deliberately absent.
CREATE TABLE IF NOT EXISTS public.historical_player_totals (
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  season integer NOT NULL CHECK (season BETWEEN 1900 AND 9999),
  through_date date NOT NULL CHECK (EXTRACT(YEAR FROM through_date) = season),
  source_name text NOT NULL CHECK (length(trim(source_name)) > 0),
  source_file text NOT NULL,
  goals integer NOT NULL CHECK (goals >= 0),
  assists integer NOT NULL CHECK (assists >= 0),
  bottom_count integer NOT NULL CHECK (bottom_count >= 0),
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, season)
);

ALTER TABLE public.historical_player_totals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS historical_totals_public_read ON public.historical_player_totals;
CREATE POLICY historical_totals_public_read ON public.historical_player_totals
  FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.historical_player_totals TO anon, authenticated;
GRANT ALL ON public.historical_player_totals TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.historical_player_totals FROM anon, authenticated;

INSERT INTO public.society_schema_versions VALUES ('202609100001') ON CONFLICT DO NOTHING;
COMMIT;
