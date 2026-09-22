-- 202609210007: criar session_team_players.is_captain, preencher o histórico e passar a
-- gravá-la.
--
-- O código escrevia `is_captain` em SupabaseSessionRepository desde sempre, mas a coluna
-- nunca existiu no banco — só no arquivo de spec 05_ADD_CAPTAIN_ID.sql, que está fora de
-- supabase/migrations/ e nunca foi aplicado. O executeWithSchemaFallback removia o campo
-- e o insert passava, em silêncio. Agora que esse mecanismo é audível, toda gravação de
-- escalação passaria a logar um aviso.
--
-- `session_teams.captain_id` continua sendo a FONTE DA VERDADE para leitura — é o que a
-- aplicação já usa e está preenchido em todos os times. `is_captain` é derivada dele, e
-- esta migração garante que não possam divergir: o backfill vem de captain_id, e
-- society_update_teams passa a gravar comparando com captain_id em vez de confiar no que
-- o cliente mandou.

BEGIN;

ALTER TABLE session_team_players
  ADD COLUMN IF NOT EXISTS is_captain BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill a partir da fonte real, para o histórico já gravado.
UPDATE session_team_players stp
   SET is_captain = TRUE
  FROM session_teams t
 WHERE t.id = stp.session_team_id
   AND t.captain_id = stp.player_id
   AND NOT stp.is_captain;

-- Idem: garante que ninguém ficou marcado indevidamente.
UPDATE session_team_players stp
   SET is_captain = FALSE
  FROM session_teams t
 WHERE t.id = stp.session_team_id
   AND (t.captain_id IS NULL OR t.captain_id <> stp.player_id)
   AND stp.is_captain;

-- Passa a gravar is_captain. Derivado de captain_id, que é atualizado logo acima no mesmo
-- laço da função — nunca do que o cliente enviou, para as duas não divergirem.
CREATE OR REPLACE FUNCTION society_update_teams(p_session_id UUID,p_teams JSONB) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t JSONB; p JSONB; tid UUID;
BEGIN
 PERFORM 1 FROM sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Rodada não encontrada.'; END IF;
 FOR t IN SELECT * FROM jsonb_array_elements(p_teams) LOOP
  tid=(t->>'id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM session_teams WHERE id=tid AND session_id=p_session_id) THEN RAISE EXCEPTION 'Time não pertence à rodada.'; END IF;
 END LOOP;
 -- Delete first inside the transaction; additions validate the preserved match snapshots.
 FOR t IN SELECT * FROM jsonb_array_elements(p_teams) LOOP
  tid=(t->>'id')::uuid;
  IF t ? 'players' THEN DELETE FROM session_team_players WHERE session_team_id=tid; END IF;
 END LOOP;
 FOR t IN SELECT * FROM jsonb_array_elements(p_teams) LOOP
  tid=(t->>'id')::uuid;
  UPDATE session_teams SET name=COALESCE(t->>'name',name),color_hex=COALESCE(t->>'colorHex',color_hex),
   captain_id=CASE WHEN t ? 'captainId' THEN NULLIF(t->>'captainId','')::uuid ELSE captain_id END WHERE id=tid;
  IF t ? 'players' THEN
   FOR p IN SELECT * FROM jsonb_array_elements(t->'players') LOOP
    INSERT INTO session_team_players(session_team_id,player_id,is_goalkeeper,is_loaned,is_captain)
    VALUES(tid,(p->>'playerId')::uuid,COALESCE((p->>'isGoalkeeper')::boolean,FALSE),COALESCE((p->>'isLoaned')::boolean,FALSE),
     COALESCE((SELECT st.captain_id FROM session_teams st WHERE st.id=tid)=(p->>'playerId')::uuid,FALSE));
   END LOOP;
  END IF;
 END LOOP;
 IF EXISTS(SELECT stp.player_id FROM session_team_players stp JOIN session_teams t ON t.id=stp.session_team_id
  WHERE t.session_id=p_session_id GROUP BY stp.player_id HAVING count(*)>1) THEN RAISE EXCEPTION 'O mesmo jogador não pode estar escalado em dois times da rodada.'; END IF;
END $$;

REVOKE ALL ON FUNCTION society_update_teams(UUID,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION society_update_teams(UUID,JSONB) TO service_role;

-- Consulta do painel de capitães: quem foi capitão e quantas vezes.
CREATE INDEX IF NOT EXISTS idx_session_teams_captain_id ON session_teams(captain_id)
  WHERE captain_id IS NOT NULL;

INSERT INTO public.society_schema_versions VALUES ('202609210007') ON CONFLICT DO NOTHING;

COMMIT;
