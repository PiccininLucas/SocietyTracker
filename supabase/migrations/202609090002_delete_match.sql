-- Apply after 202609090001. Logical deletion preserves events and idempotency receipts.
BEGIN;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS deleted_snapshot JSONB;
DROP INDEX IF EXISTS matches_one_active;
CREATE UNIQUE INDEX matches_one_active ON matches(session_id) WHERE status='ongoing' AND deleted_at IS NULL;
CREATE OR REPLACE FUNCTION society_roster_participation() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE sid UUID; m matches%ROWTYPE;
BEGIN
 SELECT session_id INTO sid FROM session_teams WHERE id=NEW.session_team_id;
 PERFORM 1 FROM sessions WHERE id=sid FOR UPDATE;
 SELECT * INTO m FROM matches WHERE session_id=sid AND deleted_at IS NULL AND status='ongoing';
 IF m.id IS NOT NULL AND NEW.session_team_id IN(m.home_team_id,m.away_team_id) THEN
  IF EXISTS(SELECT 1 FROM match_participants WHERE match_id=m.id AND player_id=NEW.player_id AND team_id<>NEW.session_team_id) THEN
   RAISE EXCEPTION 'O jogador já participou pelo adversário. Faça essa troca antes da próxima partida.';
  END IF;
  INSERT INTO match_participants(match_id,player_id,team_id,name_snapshot,nickname_snapshot,avatar_snapshot,is_goalkeeper,is_loaned,is_captain)
  SELECT m.id,p.id,NEW.session_team_id,p.name,p.nickname,p.avatar_url,COALESCE(NEW.is_goalkeeper,FALSE),COALESCE(NEW.is_loaned,FALSE),COALESCE(t.captain_id=p.id,FALSE)
  FROM players p JOIN session_teams t ON t.id=NEW.session_team_id WHERE p.id=NEW.player_id
  ON CONFLICT(match_id,player_id) DO UPDATE SET is_goalkeeper=match_participants.is_goalkeeper OR excluded.is_goalkeeper;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION society_event_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE mid UUID; sid UUID; m matches%ROWTYPE;
BEGIN
 mid=CASE WHEN TG_OP='DELETE' THEN OLD.match_id ELSE NEW.match_id END;
 SELECT session_id INTO sid FROM matches WHERE id=mid;
 PERFORM 1 FROM sessions WHERE id=sid FOR UPDATE;
 SELECT * INTO m FROM matches WHERE id=mid FOR UPDATE;
 IF m.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'NOT_FOUND: Partida apagada.'; END IF;
 IF m.locked_at IS NOT NULL THEN RAISE EXCEPTION 'MATCH_LOCKED: Partida consolidada; somente as três últimas podem ser corrigidas.'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND (NEW.match_id<>OLD.match_id OR NEW.id<>OLD.id) THEN RAISE EXCEPTION 'Evento não pode mudar de partida.'; END IF;
 IF NEW.team_id NOT IN(m.home_team_id,m.away_team_id) THEN RAISE EXCEPTION 'Time não pertence à partida.'; END IF;
 IF NEW.event_time_seconds<0 THEN RAISE EXCEPTION 'Tempo inválido.'; END IF;
 IF NEW.is_own_goal AND NEW.assist_id IS NOT NULL THEN RAISE EXCEPTION 'Gol contra não tem assistência.'; END IF;
 IF NEW.scorer_id=NEW.assist_id THEN RAISE EXCEPTION 'Autor e assistência devem ser diferentes.'; END IF;
 IF NOT NEW.is_own_goal AND NEW.scorer_id IS NULL AND NOT NEW.is_unattributed THEN RAISE EXCEPTION 'Informe o autor do gol.'; END IF;
 IF NEW.is_unattributed AND (NEW.scorer_id IS NOT NULL OR NEW.is_own_goal) THEN RAISE EXCEPTION 'Gol sem autoria não pode informar autor nem ser gol contra.'; END IF;
 IF NOT NEW.is_own_goal AND EXISTS(
  SELECT 1 FROM (VALUES(NEW.scorer_id),(NEW.assist_id)) x(id) WHERE x.id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM match_participants p WHERE p.match_id=mid AND p.player_id=x.id AND p.team_id=NEW.team_id)
 ) THEN RAISE EXCEPTION 'Jogador não participou por esse time nesta partida.'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION society_match_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF OLD.deleted_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'NOT_FOUND: Partida apagada.'; END IF;
 IF OLD.locked_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'MATCH_LOCKED: Partida consolidada.'; END IF;
 IF NEW.session_id<>OLD.session_id OR NEW.sequence_number<>OLD.sequence_number OR NEW.home_team_id<>OLD.home_team_id OR NEW.away_team_id<>OLD.away_team_id THEN RAISE EXCEPTION 'Identidade da partida não pode ser alterada.'; END IF;
 IF OLD.status='finished' AND (NEW.status<>'finished' OR NEW.finished_at IS DISTINCT FROM OLD.finished_at OR NEW.end_reason IS DISTINCT FROM OLD.end_reason) THEN RAISE EXCEPTION 'Partida finalizada não pode ser reaberta.'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION society_matches_snapshot(p_session_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT COALESCE(jsonb_agg(row_data ORDER BY started_at DESC,id),'[]'::jsonb) FROM (
 SELECT m.id,m.started_at,jsonb_build_object(
  'matchId',m.id,'sessionId',m.session_id,'sessionDate',s.session_date,'sessionStatus',s.status,
  'sequence',m.sequence_number,'lockedAt',m.locked_at,'editable',m.locked_at IS NULL,
  'homeTeamId',m.home_team_id,'awayTeamId',m.away_team_id,'homeTeamName',h.name,'awayTeamName',a.name,
  'homeTeamColor',h.color_hex,'awayTeamColor',a.color_hex,'homeScore',m.home_score,'awayScore',m.away_score,
  'durationSeconds',m.duration_seconds,'status',m.status,'endReason',m.end_reason,'startedAt',m.started_at,'finishedAt',m.finished_at,
  'events',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'matchId',e.match_id,'teamId',e.team_id,
   'scorerId',e.scorer_id,'assistId',e.assist_id,'scorerName',CASE WHEN e.is_own_goal THEN 'Gol contra' WHEN e.is_unattributed THEN 'Autoria não informada' ELSE COALESCE(sp.nickname_snapshot,sp.name_snapshot,'Jogador removido') END,
   'assistName',COALESCE(ap.nickname_snapshot,ap.name_snapshot),'eventTimeSeconds',e.event_time_seconds,'isOwnGoal',e.is_own_goal,'isUnattributed',e.is_unattributed)
   ORDER BY e.event_time_seconds,e.created_at,e.id)
   FROM match_events e LEFT JOIN match_participants sp ON sp.match_id=m.id AND sp.player_id=e.scorer_id
   LEFT JOIN match_participants ap ON ap.match_id=m.id AND ap.player_id=e.assist_id WHERE e.match_id=m.id),'[]'::jsonb),
  'homePlayers',society_participants_json(m.id,m.home_team_id),
  'awayPlayers',society_participants_json(m.id,m.away_team_id)
 ) row_data
 FROM matches m JOIN sessions s ON s.id=m.session_id JOIN session_teams h ON h.id=m.home_team_id JOIN session_teams a ON a.id=m.away_team_id
 WHERE m.deleted_at IS NULL AND (p_session_id IS NULL OR m.session_id=p_session_id)
) q;
$$;
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
  INSERT INTO matches(session_id,home_team_id,away_team_id,sequence_number)
  VALUES(sid,hs,aws,(SELECT COALESCE(max(sequence_number),0)+1 FROM matches WHERE session_id=sid)) RETURNING * INTO m;
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
   INSERT INTO match_events(id,match_id,team_id,scorer_id,assist_id,event_time_seconds,is_own_goal,is_unattributed)
   VALUES(p_operation_id,m.id,(p_input->>'teamId')::uuid,NULLIF(p_input->>'scorerId','')::uuid,NULLIF(p_input->>'assistId','')::uuid,
    COALESCE((p_input->>'eventTimeSeconds')::integer,0),COALESCE((p_input->>'isOwnGoal')::boolean,FALSE),FALSE) RETURNING id INTO eid;
  ELSIF p_action='edit' THEN
   UPDATE match_events SET
    team_id=COALESCE((p_input->>'teamId')::uuid,team_id),
    scorer_id=CASE WHEN COALESCE((p_input->>'isOwnGoal')::boolean,FALSE) THEN NULL ELSE NULLIF(p_input->>'scorerId','')::uuid END,
    assist_id=CASE WHEN COALESCE((p_input->>'isOwnGoal')::boolean,FALSE) THEN NULL ELSE NULLIF(p_input->>'assistId','')::uuid END,
    is_own_goal=COALESCE((p_input->>'isOwnGoal')::boolean,FALSE),is_unattributed=FALSE
   WHERE id=eid AND match_id=m.id;
  ELSIF p_action='delete' THEN DELETE FROM match_events WHERE id=eid AND match_id=m.id;
  ELSIF p_action='score' THEN
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
   finish_reason=CASE WHEN m.home_score>=2 OR m.away_score>=2 THEN 'two_goals' ELSE 'manual' END;
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
CREATE OR REPLACE VIEW vw_player_leaderboard AS
WITH pm AS (
 SELECT mp.player_id,count(DISTINCT m.id) total_matches,count(DISTINCT m.session_id) total_sessions
 FROM match_participants mp JOIN matches m ON m.id=mp.match_id WHERE m.status='finished' AND m.deleted_at IS NULL GROUP BY mp.player_id
), pg AS (
 SELECT e.scorer_id player_id,count(*) goals FROM match_events e JOIN matches m ON m.id=e.match_id WHERE m.status='finished' AND m.deleted_at IS NULL AND NOT e.is_own_goal GROUP BY e.scorer_id
), pa AS (
 SELECT e.assist_id player_id,count(*) assists FROM match_events e JOIN matches m ON m.id=e.match_id WHERE m.status='finished' AND m.deleted_at IS NULL AND NOT e.is_own_goal GROUP BY e.assist_id
)
SELECT p.id player_id,p.name,p.nickname,p.avatar_url,COALESCE(pg.goals,0) total_goals,COALESCE(pa.assists,0) total_assists,
 COALESCE(pg.goals,0)+COALESCE(pa.assists,0) total_contributions,COALESCE(pm.total_matches,0) total_matches_played,
 COALESCE(pm.total_sessions,0) total_sessions_played,ROUND(COALESCE(pg.goals,0)::numeric/NULLIF(pm.total_matches,0),2) goals_per_match
FROM players p LEFT JOIN pm ON pm.player_id=p.id LEFT JOIN pg ON pg.player_id=p.id LEFT JOIN pa ON pa.player_id=p.id
WHERE p.is_active OR pm.total_matches>0;


INSERT INTO society_schema_versions VALUES('202609090002') ON CONFLICT DO NOTHING;
COMMIT;
