-- 202609220001: criar a rodada (sessão, times e escalações) numa única transação.
--
-- SupabaseSessionRepository.create fazia um insert por vez: a sessão, depois cada time,
-- depois as escalações de cada time — 9 idas ao banco para 4 times, sem transação. Uma
-- falha no meio deixava uma sessão órfã, e como session_date é UNIQUE, toda nova
-- tentativa para a mesma data passava a falhar com chave duplicada até alguém apagar a
-- sessão pela metade manualmente.
--
-- Mesmo molde de society_update_teams: tudo ou nada, validação dentro da transação e
-- is_captain derivado de captain_id (nunca do que o cliente mandou).
--
-- Recusas de regra usam RAISE EXCEPTION (SQLSTATE P0001); a data repetida leva o prefixo
-- CONFLICT para a API responder 409.

BEGIN;

CREATE OR REPLACE FUNCTION society_create_session(
  p_date DATE,
  p_notes TEXT,
  p_duration INTEGER,
  p_teams JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid UUID; t JSONB; p JSONB; tid UUID; cap UUID;
BEGIN
 IF p_date IS NULL THEN RAISE EXCEPTION 'Data da rodada é obrigatória.'; END IF;
 IF p_duration IS NOT NULL AND (p_duration < 60 OR p_duration > 3600) THEN
  RAISE EXCEPTION 'Duração da partida deve ficar entre 1 e 60 minutos.';
 END IF;
 IF jsonb_typeof(COALESCE(p_teams,'[]'::jsonb))<>'array' THEN RAISE EXCEPTION 'Times inválidos.'; END IF;
 -- A checagem dá a mensagem amigável; a UNIQUE continua protegendo a corrida entre dois
 -- envios simultâneos (23505, que a API também responde como 409).
 IF EXISTS(SELECT 1 FROM sessions WHERE session_date=p_date) THEN
  RAISE EXCEPTION 'CONFLICT: Já existe uma rodada em %. Abra o mesário ou edite os times dela.', to_char(p_date,'DD/MM/YYYY');
 END IF;

 INSERT INTO sessions(session_date,status,notes,match_duration_seconds)
 VALUES(p_date,'ongoing',NULLIF(btrim(p_notes),''),COALESCE(p_duration,420))
 RETURNING id INTO sid;

 FOR t IN SELECT * FROM jsonb_array_elements(COALESCE(p_teams,'[]'::jsonb)) LOOP
  IF NULLIF(btrim(t->>'name'),'') IS NULL THEN RAISE EXCEPTION 'Todo time precisa de um nome.'; END IF;
  cap=NULLIF(t->>'captainId','')::uuid;
  INSERT INTO session_teams(session_id,name,color_hex,captain_id)
  VALUES(sid,btrim(t->>'name'),COALESCE(NULLIF(t->>'colorHex',''),'#333333'),cap)
  RETURNING id INTO tid;
  FOR p IN SELECT * FROM jsonb_array_elements(COALESCE(t->'players','[]'::jsonb)) LOOP
   INSERT INTO session_team_players(session_team_id,player_id,is_goalkeeper,is_loaned,is_captain)
   VALUES(tid,(p->>'playerId')::uuid,COALESCE((p->>'isGoalkeeper')::boolean,FALSE),
    COALESCE((p->>'isLoaned')::boolean,FALSE),COALESCE(cap=(p->>'playerId')::uuid,FALSE));
  END LOOP;
 END LOOP;

 IF EXISTS(SELECT stp.player_id FROM session_team_players stp JOIN session_teams st ON st.id=stp.session_team_id
  WHERE st.session_id=sid GROUP BY stp.player_id HAVING count(*)>1) THEN
  RAISE EXCEPTION 'O mesmo jogador não pode estar escalado em dois times da rodada.';
 END IF;

 RETURN sid;
END $$;

-- REVOKE FROM PUBLIC não basta no Supabase: os default privileges concedem EXECUTE
-- explicitamente a anon e authenticated em toda função nova. Sem o segundo REVOKE, a
-- função (SECURITY DEFINER) podia ser chamada pela API pública, sem PIN.
REVOKE ALL ON FUNCTION society_create_session(DATE,TEXT,INTEGER,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION society_create_session(DATE,TEXT,INTEGER,JSONB) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION society_create_session(DATE,TEXT,INTEGER,JSONB) TO service_role;

INSERT INTO public.society_schema_versions VALUES ('202609220001') ON CONFLICT DO NOTHING;

COMMIT;
