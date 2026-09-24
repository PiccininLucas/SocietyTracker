-- 202609240003: encerrar e reabrir a rodada.
--
-- sessions.status existe desde o spec 04, mas nada o mudava: toda rodada ficava 'ongoing'
-- para sempre, e os relatórios mostravam todas como "(Ao Vivo)".
--
-- society_set_session_status muda o status com a rodada travada (o mesmo FOR UPDATE de
-- society_match_command), então encerrar não corre em paralelo com o início de uma
-- partida. Encerrar exige que nenhuma partida esteja em andamento.
--
-- Rodada encerrada não aceita partida nova: o trigger abaixo recusa o INSERT em matches.
-- Com isso society_match_command não precisa ser recriada pela sétima vez. O resto
-- continua liberado de propósito: corrigir as três últimas partidas, apagar uma delas e
-- ajustar goleiro ou capitão depois da rodada (o goleiro decide a imunidade ao Bola
-- Murcha). Reabrir devolve a rodada ao estado normal.
--
-- Por fim, as rodadas anteriores à mais recente, sem partida em andamento, são marcadas
-- como encerradas: todas já acabaram, e nenhuma foi encerrada porque o botão não existia.
-- A mais recente fica como está, porque pode ser a desta noite; o mesário a encerra pelo
-- botão.

BEGIN;

CREATE OR REPLACE FUNCTION society_set_session_status(p_session_id UUID, p_status TEXT)
RETURNS TEXT LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF p_status IS NULL OR p_status NOT IN ('ongoing','finished') THEN
  RAISE EXCEPTION 'Status de rodada inválido: use ongoing ou finished.';
 END IF;
 PERFORM 1 FROM sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND: Rodada não encontrada.'; END IF;
 IF p_status='finished' AND EXISTS(
  SELECT 1 FROM matches WHERE session_id=p_session_id AND deleted_at IS NULL AND status='ongoing'
 ) THEN
  RAISE EXCEPTION 'CONFLICT: Finalize a partida em andamento antes de encerrar a rodada.';
 END IF;
 UPDATE sessions SET status=p_status WHERE id=p_session_id;
 RETURN p_status;
END $$;

REVOKE ALL ON FUNCTION society_set_session_status(UUID,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION society_set_session_status(UUID,TEXT) TO service_role;

-- O 'start' de society_match_command trava a rodada antes do INSERT; o trigger lê o
-- status já sob essa trava.
CREATE OR REPLACE FUNCTION society_refuse_match_in_closed_session()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM sessions WHERE id=NEW.session_id AND status='finished') THEN
  RAISE EXCEPTION 'CONFLICT: Rodada encerrada. Reabra a rodada para iniciar outra partida.';
 END IF;
 RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION society_refuse_match_in_closed_session() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS matches_refuse_closed_session ON matches;
CREATE TRIGGER matches_refuse_closed_session BEFORE INSERT ON matches
 FOR EACH ROW EXECUTE FUNCTION society_refuse_match_in_closed_session();

UPDATE sessions s SET status='finished'
 WHERE s.status='ongoing'
   AND s.session_date < (SELECT max(session_date) FROM sessions)
   AND NOT EXISTS(
    SELECT 1 FROM matches m WHERE m.session_id=s.id AND m.deleted_at IS NULL AND m.status='ongoing'
   );

INSERT INTO public.society_schema_versions VALUES ('202609240003') ON CONFLICT DO NOTHING;

COMMIT;
