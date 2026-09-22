-- 202609220003: a partida nasce com o id gerado no aparelho do mesario.
--
-- Antes o id vinha do DEFAULT gen_random_uuid() e so era conhecido depois da resposta do
-- servidor. Offline, o mesario nao conseguia iniciar a proxima partida nem registrar gols
-- nela: os comandos seguintes precisam do id para montar a URL.
--
-- Agora o id da partida e o proprio p_operation_id do 'start' — o mesmo padrao que o gol
-- ja usa (id do evento = p_operation_id). O replay com a mesma chave continua devolvendo a
-- mesma partida, e clientes antigos seguem funcionando: todo comando ja traz a chave.
--
-- Unica diferenca em relacao a 202609210005: a coluna id no INSERT INTO matches.

BEGIN;

CREATE OR REPLACE FUNCTION society_match_command(p_action TEXT,p_match_id UUID,p_input JSONB,p_operation_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid UUID; m matches%ROWTYPE; op match_operations%ROWTYPE; eid UUID; tid UUID;
 target INTEGER; counted INTEGER; n INTEGER; hs UUID; aws UUID; finish_reason TEXT; archived JSONB;
BEGIN
 IF p_operation_id IS NULL THEN RAISE EXCEPTION 'Identificador da operação obrigatório.'; END IF;
 IF p_action='start' THEN sid=(p_input->>'sessionId')::uuid;
 ELSE SELECT session_id INTO sid FROM matches WHERE id=p_match_id; END IF;
 IF sid IS NULL THEN RAISE EXCEPTION 'NOT_FOUND: Partida ou rodada não encontrada.'; END IF;
 PERFORM 1 FROM sessions WHERE id=sid FOR UPDATE;
 SELECT * INTO op FROM match_operations WHERE operation_id=p_operation_id;
 IF op.operation_id IS NOT NULL THEN
  IF op.action<>p_action OR op.input<>p_input OR (p_action<>'start' AND op.match_id<>p_match_id) THEN RAISE EXCEPTION 'CONFLICT: Identificador reutilizado com outros dados.'; END IF;
  SELECT * INTO m FROM matches WHERE id=op.match_id;
  IF m.deleted_at IS NOT NULL THEN
   IF p_action='remove_match' THEN RETURN jsonb_build_object('match_id',m.id,'deleted_match',m.deleted_snapshot); END IF;
   RAISE EXCEPTION 'NOT_FOUND: Partida apagada.';
  END IF;
  RETURN jsonb_build_object('match_id',op.match_id,'event_id',op.event_id);
 END IF;
 IF p_action='start' THEN
  hs=(p_input->>'homeTeamId')::uuid;aws=(p_input->>'awayTeamId')::uuid;
  IF hs IS NULL OR aws IS NULL OR hs=aws OR (SELECT count(*) FROM session_teams WHERE session_id=sid AND id IN(hs,aws))<>2 THEN RAISE EXCEPTION 'Selecione dois times da rodada.'; END IF;
  SELECT * INTO m FROM matches WHERE session_id=sid AND deleted_at IS NULL AND status='ongoing';
  IF m.id IS NOT NULL THEN RAISE EXCEPTION 'CONFLICT: Finalize a partida atual antes de iniciar outra.'; END IF;
  INSERT INTO matches(id,session_id,home_team_id,away_team_id,sequence_number)
  VALUES(p_operation_id,sid,hs,aws,(SELECT COALESCE(max(sequence_number),0)+1 FROM matches WHERE session_id=sid)) RETURNING * INTO m;
 ELSE
  SELECT * INTO m FROM matches WHERE id=p_match_id FOR UPDATE;
  IF m.deleted_at IS NOT NULL THEN
   IF p_action='remove_match' THEN
    INSERT INTO match_operations(operation_id,action,match_id,input) VALUES(p_operation_id,p_action,m.id,p_input);
    RETURN jsonb_build_object('match_id',m.id,'deleted_match',m.deleted_snapshot);
   END IF;
   RAISE EXCEPTION 'NOT_FOUND: Partida apagada.';
  END IF;
  IF p_action='remove_match' THEN
   IF m.locked_at IS NOT NULL THEN RAISE EXCEPTION 'MATCH_LOCKED: Partida consolidada não pode ser apagada.'; END IF;
   SELECT value || jsonb_build_object('deletedAt',now(),'editable',FALSE) INTO archived
    FROM jsonb_array_elements(society_matches_snapshot(sid)) WHERE value->>'matchId'=m.id::text;
   UPDATE matches SET deleted_at=now(),deleted_snapshot=archived WHERE id=m.id;
   INSERT INTO match_operations(operation_id,action,match_id,input) VALUES(p_operation_id,p_action,m.id,p_input);
   RETURN jsonb_build_object('match_id',m.id,'deleted_match',archived);
  END IF;
  IF p_action='finish' AND m.status='finished' THEN
   INSERT INTO match_operations VALUES(p_operation_id,p_action,m.id,p_input,NULL,now());
   RETURN jsonb_build_object('match_id',m.id);
  END IF;
  IF m.locked_at IS NOT NULL THEN RAISE EXCEPTION 'MATCH_LOCKED: Partida consolidada; somente as três últimas podem ser corrigidas.'; END IF;
  IF p_action IN('edit','delete') THEN
   eid=(p_input->>'eventId')::uuid;
   IF NOT EXISTS(SELECT 1 FROM match_events WHERE id=eid AND match_id=m.id) THEN RAISE EXCEPTION 'NOT_FOUND: Evento não pertence à partida.'; END IF;
  END IF;
  IF p_action='goal' THEN
   tid=(p_input->>'teamId')::uuid;
   -- Auto-add loaned participant for this match when explicit loan is indicated
   IF NOT COALESCE((p_input->>'isOwnGoal')::boolean,FALSE) AND (
     p_input ? 'loanPlayerIds' OR p_input ? 'loanPlayerId' OR
     COALESCE((p_input->>'loanScorer')::boolean,FALSE) OR COALESCE((p_input->>'loanAssist')::boolean,FALSE)
   ) THEN
    INSERT INTO match_participants(match_id, player_id, team_id, name_snapshot, nickname_snapshot, avatar_snapshot, is_goalkeeper, is_loaned, is_captain)
    SELECT m.id, p.id, tid, p.name, p.nickname, p.avatar_url, FALSE, TRUE, FALSE
    FROM players p
    WHERE (
      (p_input ? 'loanPlayerIds' AND p.id IN (SELECT (jsonb_array_elements_text(p_input->'loanPlayerIds'))::uuid))
      OR (p_input ? 'loanPlayerId' AND p.id = (p_input->>'loanPlayerId')::uuid)
      OR (COALESCE((p_input->>'loanScorer')::boolean,FALSE) AND p.id = NULLIF(p_input->>'scorerId','')::uuid)
      OR (COALESCE((p_input->>'loanAssist')::boolean,FALSE) AND p.id = NULLIF(p_input->>'assistId','')::uuid)
    )
      AND p.id IN (NULLIF(p_input->>'scorerId','')::uuid, NULLIF(p_input->>'assistId','')::uuid)
      AND NOT EXISTS (SELECT 1 FROM match_participants mp WHERE mp.match_id = m.id AND mp.player_id = p.id)
      AND EXISTS (SELECT 1 FROM session_team_players stp JOIN session_teams st ON st.id = stp.session_team_id WHERE st.session_id = sid AND stp.player_id = p.id)
    ON CONFLICT (match_id, player_id) DO NOTHING;
   END IF;
   INSERT INTO match_events(id,match_id,team_id,scorer_id,assist_id,event_time_seconds,is_own_goal,is_unattributed)
   VALUES(p_operation_id,m.id,tid,NULLIF(p_input->>'scorerId','')::uuid,NULLIF(p_input->>'assistId','')::uuid,
    COALESCE((p_input->>'eventTimeSeconds')::integer,0),COALESCE((p_input->>'isOwnGoal')::boolean,FALSE),FALSE) RETURNING id INTO eid;
  ELSIF p_action='edit' THEN
   tid=COALESCE((p_input->>'teamId')::uuid, (SELECT team_id FROM match_events WHERE id=eid));
   IF NOT COALESCE((p_input->>'isOwnGoal')::boolean,FALSE) AND (
     p_input ? 'loanPlayerIds' OR p_input ? 'loanPlayerId' OR
     COALESCE((p_input->>'loanScorer')::boolean,FALSE) OR COALESCE((p_input->>'loanAssist')::boolean,FALSE)
   ) THEN
    INSERT INTO match_participants(match_id, player_id, team_id, name_snapshot, nickname_snapshot, avatar_snapshot, is_goalkeeper, is_loaned, is_captain)
    SELECT m.id, p.id, tid, p.name, p.nickname, p.avatar_url, FALSE, TRUE, FALSE
    FROM players p
    WHERE (
      (p_input ? 'loanPlayerIds' AND p.id IN (SELECT (jsonb_array_elements_text(p_input->'loanPlayerIds'))::uuid))
      OR (p_input ? 'loanPlayerId' AND p.id = (p_input->>'loanPlayerId')::uuid)
      OR (COALESCE((p_input->>'loanScorer')::boolean,FALSE) AND p.id = NULLIF(p_input->>'scorerId','')::uuid)
      OR (COALESCE((p_input->>'loanAssist')::boolean,FALSE) AND p.id = NULLIF(p_input->>'assistId','')::uuid)
    )
      AND p.id IN (NULLIF(p_input->>'scorerId','')::uuid, NULLIF(p_input->>'assistId','')::uuid)
      AND NOT EXISTS (SELECT 1 FROM match_participants mp WHERE mp.match_id = m.id AND mp.player_id = p.id)
      AND EXISTS (SELECT 1 FROM session_team_players stp JOIN session_teams st ON st.id = stp.session_team_id WHERE st.session_id = sid AND stp.player_id = p.id)
    ON CONFLICT (match_id, player_id) DO NOTHING;
   END IF;
   UPDATE match_events SET
    team_id=tid,
    scorer_id=CASE WHEN COALESCE((p_input->>'isOwnGoal')::boolean,FALSE) THEN NULL ELSE NULLIF(p_input->>'scorerId','')::uuid END,
    assist_id=CASE WHEN COALESCE((p_input->>'isOwnGoal')::boolean,FALSE) THEN NULL ELSE NULLIF(p_input->>'assistId','')::uuid END,
    is_own_goal=COALESCE((p_input->>'isOwnGoal')::boolean,FALSE),is_unattributed=FALSE
   WHERE id=eid AND match_id=m.id;
  ELSIF p_action='delete' THEN DELETE FROM match_events WHERE id=eid AND match_id=m.id;
  ELSIF p_action='score' OR (p_action='finish' AND (p_input ? 'homeScore' OR p_input ? 'awayScore')) THEN
   FOR n IN 1..2 LOOP
    tid=CASE WHEN n=1 THEN m.home_team_id ELSE m.away_team_id END;
    target=COALESCE((p_input->>CASE WHEN n=1 THEN 'homeScore' ELSE 'awayScore' END)::integer,CASE WHEN n=1 THEN m.home_score ELSE m.away_score END);
    IF target<0 OR target>99 THEN RAISE EXCEPTION 'Placar deve ser inteiro entre 0 e 99.'; END IF;
    SELECT count(*) INTO counted FROM match_events e WHERE e.match_id=m.id AND
     ((NOT e.is_own_goal AND e.team_id=tid) OR (e.is_own_goal AND e.team_id<>tid));
    IF target>counted THEN
     INSERT INTO match_events(match_id,team_id,is_unattributed) SELECT m.id,tid,TRUE FROM generate_series(1,target-counted);
    ELSIF target<counted THEN
     IF (SELECT count(*) FROM match_events WHERE match_id=m.id AND team_id=tid AND is_unattributed AND assist_id IS NULL)<counted-target THEN
      RAISE EXCEPTION 'Remova o gol correspondente na súmula para reduzir esse placar; a autoria será preservada.';
     END IF;
     DELETE FROM match_events WHERE id IN(SELECT id FROM match_events WHERE match_id=m.id AND team_id=tid AND is_unattributed AND assist_id IS NULL ORDER BY created_at DESC,id LIMIT counted-target);
    END IF;
   END LOOP;
  ELSIF p_action<>'finish' THEN RAISE EXCEPTION 'Operação inválida.';
  END IF;
  SELECT * INTO m FROM matches WHERE id=m.id;
  IF m.status='ongoing' AND (p_action='finish' OR m.home_score>=2 OR m.away_score>=2) THEN
   finish_reason=CASE
     WHEN m.home_score>=2 OR m.away_score>=2 THEN 'two_goals'
     WHEN GREATEST(m.duration_seconds,COALESCE((p_input->>'durationSeconds')::integer,(p_input->>'eventTimeSeconds')::integer,0))
          >= COALESCE((SELECT s.match_duration_seconds FROM sessions s WHERE s.id=sid),420) THEN 'time_limit'
     ELSE 'manual' END;
   UPDATE matches SET status='finished',end_reason=finish_reason,finished_at=now(),
    duration_seconds=GREATEST(duration_seconds,COALESCE((p_input->>'durationSeconds')::integer,(p_input->>'eventTimeSeconds')::integer,0))
   WHERE id=m.id RETURNING * INTO m;
   UPDATE matches SET locked_at=now() WHERE session_id=sid AND deleted_at IS NULL AND status='finished' AND locked_at IS NULL
    AND id NOT IN(SELECT id FROM matches WHERE session_id=sid AND deleted_at IS NULL AND status='finished' ORDER BY sequence_number DESC LIMIT 3);
  ELSIF m.status='ongoing' AND p_input ? 'eventTimeSeconds' THEN
   UPDATE matches SET duration_seconds=GREATEST(duration_seconds,(p_input->>'eventTimeSeconds')::integer) WHERE id=m.id;
  END IF;
 END IF;
 INSERT INTO match_operations(operation_id,action,match_id,input,event_id) VALUES(p_operation_id,p_action,m.id,p_input,eid);
 RETURN jsonb_build_object('match_id',m.id,'event_id',eid);
END $$;

-- CREATE OR REPLACE preserva os privilegios, mas no Supabase os default privileges dao
-- EXECUTE a anon/authenticated em funcao nova; repetir o REVOKE deixa o arquivo seguro
-- mesmo num banco onde a funcao ainda nao existia.
REVOKE ALL ON FUNCTION society_match_command(TEXT,UUID,JSONB,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION society_match_command(TEXT,UUID,JSONB,UUID) TO service_role;

INSERT INTO public.society_schema_versions VALUES ('202609220003') ON CONFLICT DO NOTHING;

COMMIT;
