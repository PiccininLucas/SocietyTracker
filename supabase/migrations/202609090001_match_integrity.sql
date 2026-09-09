-- Incremental migration. Run once before deploying the new application.
-- No historical rows are deleted. Re-running does not overwrite snapshots.
BEGIN;
CREATE TABLE IF NOT EXISTS society_schema_versions(version TEXT PRIMARY KEY);
-- Install optional fields used by older documented releases, without replacing values.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS match_duration_seconds INTEGER NOT NULL DEFAULT 420;
ALTER TABLE session_teams ADD COLUMN IF NOT EXISTS captain_id UUID REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE session_team_players ADD COLUMN IF NOT EXISTS is_goalkeeper BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS sequence_number INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS is_unattributed BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS society_migration_audit (
  match_id UUID PRIMARY KEY, original_home_score INTEGER, original_away_score INTEGER,
  event_home_score INTEGER, event_away_score INTEGER, recorded_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS match_participants (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  team_id UUID NOT NULL REFERENCES session_teams(id),
  name_snapshot TEXT NOT NULL, nickname_snapshot TEXT, avatar_snapshot TEXT,
  is_goalkeeper BOOLEAN NOT NULL DEFAULT FALSE, is_loaned BOOLEAN NOT NULL DEFAULT FALSE,
  is_captain BOOLEAN NOT NULL DEFAULT FALSE, inferred BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY(match_id, player_id)
);
CREATE TABLE IF NOT EXISTS match_operations (
  operation_id UUID PRIMARY KEY, action TEXT NOT NULL, match_id UUID NOT NULL REFERENCES matches(id),
  input JSONB NOT NULL, event_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
WITH numbered AS (SELECT id,row_number() OVER(PARTITION BY session_id ORDER BY started_at,id) AS n FROM matches)
UPDATE matches m SET sequence_number=n.n FROM numbered n WHERE n.id=m.id AND m.sequence_number IS NULL;
ALTER TABLE matches ALTER COLUMN sequence_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS matches_session_sequence ON matches(session_id,sequence_number);
-- Abort rather than silently finish or delete duplicate active matches.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM matches WHERE status='ongoing' GROUP BY session_id HAVING count(*)>1) THEN
   RAISE EXCEPTION 'Migração interrompida: existem partidas simultâneas na mesma rodada. Concilie-as antes de aplicar.';
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS matches_one_active ON matches(session_id) WHERE status='ongoing';

-- Event evidence takes precedence over the current roster for inferred legacy participation.
INSERT INTO match_participants(match_id,player_id,team_id,name_snapshot,nickname_snapshot,avatar_snapshot,is_goalkeeper,is_loaned,is_captain,inferred)
SELECT DISTINCT ON (m.id,p.id) m.id,p.id,e.team_id,p.name,p.nickname,p.avatar_url,
 COALESCE(stp.is_goalkeeper,FALSE),COALESCE(stp.is_loaned,FALSE),COALESCE(t.captain_id=p.id,FALSE),TRUE
FROM matches m JOIN match_events e ON e.match_id=m.id AND NOT e.is_own_goal
JOIN players p ON p.id=e.scorer_id OR p.id=e.assist_id
JOIN session_teams t ON t.id=e.team_id
LEFT JOIN session_team_players stp ON stp.session_team_id=e.team_id AND stp.player_id=p.id
WHERE NOT EXISTS(SELECT 1 FROM society_schema_versions WHERE version='202609090001')
ORDER BY m.id,p.id,e.created_at,e.id
ON CONFLICT DO NOTHING;
INSERT INTO match_participants(match_id,player_id,team_id,name_snapshot,nickname_snapshot,avatar_snapshot,is_goalkeeper,is_loaned,is_captain,inferred)
SELECT DISTINCT ON (m.id,p.id) m.id,p.id,t.id,p.name,p.nickname,p.avatar_url,
 COALESCE(stp.is_goalkeeper,FALSE),COALESCE(stp.is_loaned,FALSE),COALESCE(t.captain_id=p.id,FALSE),TRUE
FROM matches m JOIN session_teams t ON t.id IN (m.home_team_id,m.away_team_id)
JOIN session_team_players stp ON stp.session_team_id=t.id JOIN players p ON p.id=stp.player_id
WHERE NOT EXISTS(SELECT 1 FROM society_schema_versions WHERE version='202609090001')
ORDER BY m.id,p.id,t.id
ON CONFLICT DO NOTHING;

-- Preserve goals whose player had already been deleted and legacy score-only corrections.
UPDATE match_events SET is_unattributed=TRUE WHERE scorer_id IS NULL AND NOT is_own_goal AND NOT is_unattributed;
INSERT INTO society_migration_audit(match_id,original_home_score,original_away_score,event_home_score,event_away_score)
SELECT m.id,m.home_score,m.away_score,
 (SELECT count(*) FROM match_events e WHERE e.match_id=m.id AND ((e.team_id=m.home_team_id AND NOT e.is_own_goal) OR (e.team_id=m.away_team_id AND e.is_own_goal))),
 (SELECT count(*) FROM match_events e WHERE e.match_id=m.id AND ((e.team_id=m.away_team_id AND NOT e.is_own_goal) OR (e.team_id=m.home_team_id AND e.is_own_goal)))
FROM matches m ON CONFLICT DO NOTHING;
INSERT INTO match_events(match_id,team_id,is_unattributed,event_time_seconds)
SELECT a.match_id,m.home_team_id,TRUE,m.duration_seconds
FROM society_migration_audit a JOIN matches m ON m.id=a.match_id
CROSS JOIN LATERAL generate_series(1,GREATEST(0,a.original_home_score-(SELECT count(*)::integer FROM match_events e WHERE e.match_id=m.id AND ((e.team_id=m.home_team_id AND NOT e.is_own_goal) OR (e.team_id=m.away_team_id AND e.is_own_goal))))) n
WHERE NOT EXISTS(SELECT 1 FROM society_schema_versions WHERE version='202609090001');
INSERT INTO match_events(match_id,team_id,is_unattributed,event_time_seconds)
SELECT a.match_id,m.away_team_id,TRUE,m.duration_seconds
FROM society_migration_audit a JOIN matches m ON m.id=a.match_id
CROSS JOIN LATERAL generate_series(1,GREATEST(0,a.original_away_score-(SELECT count(*)::integer FROM match_events e WHERE e.match_id=m.id AND ((e.team_id=m.away_team_id AND NOT e.is_own_goal) OR (e.team_id=m.home_team_id AND e.is_own_goal))))) n
WHERE NOT EXISTS(SELECT 1 FROM society_schema_versions WHERE version='202609090001');
UPDATE matches m SET
 home_score=(SELECT count(*) FROM match_events e WHERE e.match_id=m.id AND ((e.team_id=m.home_team_id AND NOT e.is_own_goal) OR (e.team_id=m.away_team_id AND e.is_own_goal))),
 away_score=(SELECT count(*) FROM match_events e WHERE e.match_id=m.id AND ((e.team_id=m.away_team_id AND NOT e.is_own_goal) OR (e.team_id=m.home_team_id AND e.is_own_goal)))
WHERE m.locked_at IS NULL;
WITH ordered AS (SELECT id,row_number() OVER(PARTITION BY session_id ORDER BY sequence_number DESC) n FROM matches WHERE status='finished')
UPDATE matches m SET locked_at=COALESCE(m.locked_at,now()) FROM ordered o WHERE m.id=o.id AND o.n>3;

CREATE OR REPLACE FUNCTION society_capture_participants() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 INSERT INTO match_participants(match_id,player_id,team_id,name_snapshot,nickname_snapshot,avatar_snapshot,is_goalkeeper,is_loaned,is_captain)
 SELECT NEW.id,p.id,t.id,p.name,p.nickname,p.avatar_url,COALESCE(stp.is_goalkeeper,FALSE),COALESCE(stp.is_loaned,FALSE),COALESCE(t.captain_id=p.id,FALSE)
 FROM session_teams t JOIN session_team_players stp ON stp.session_team_id=t.id JOIN players p ON p.id=stp.player_id
 WHERE t.id IN(NEW.home_team_id,NEW.away_team_id);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS society_capture_participants ON matches;
CREATE TRIGGER society_capture_participants AFTER INSERT ON matches FOR EACH ROW EXECUTE FUNCTION society_capture_participants();

CREATE OR REPLACE FUNCTION society_roster_participation() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE sid UUID; m matches%ROWTYPE;
BEGIN
 SELECT session_id INTO sid FROM session_teams WHERE id=NEW.session_team_id;
 PERFORM 1 FROM sessions WHERE id=sid FOR UPDATE;
 SELECT * INTO m FROM matches WHERE session_id=sid AND status='ongoing';
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
DROP TRIGGER IF EXISTS society_roster_participation ON session_team_players;
CREATE TRIGGER society_roster_participation BEFORE INSERT OR UPDATE ON session_team_players FOR EACH ROW EXECUTE FUNCTION society_roster_participation();

CREATE OR REPLACE FUNCTION society_event_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE mid UUID; sid UUID; m matches%ROWTYPE;
BEGIN
 mid=CASE WHEN TG_OP='DELETE' THEN OLD.match_id ELSE NEW.match_id END;
 SELECT session_id INTO sid FROM matches WHERE id=mid;
 PERFORM 1 FROM sessions WHERE id=sid FOR UPDATE;
 SELECT * INTO m FROM matches WHERE id=mid FOR UPDATE;
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
DROP TRIGGER IF EXISTS society_event_guard ON match_events;
CREATE TRIGGER society_event_guard BEFORE INSERT OR UPDATE OR DELETE ON match_events FOR EACH ROW EXECUTE FUNCTION society_event_guard();

CREATE OR REPLACE FUNCTION society_event_score() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE mid UUID;
BEGIN
 mid=CASE WHEN TG_OP='DELETE' THEN OLD.match_id ELSE NEW.match_id END;
 UPDATE matches m SET
 home_score=(SELECT count(*) FROM match_events e WHERE e.match_id=mid AND ((e.team_id=m.home_team_id AND NOT e.is_own_goal) OR (e.team_id=m.away_team_id AND e.is_own_goal))),
 away_score=(SELECT count(*) FROM match_events e WHERE e.match_id=mid AND ((e.team_id=m.away_team_id AND NOT e.is_own_goal) OR (e.team_id=m.home_team_id AND e.is_own_goal)))
 WHERE m.id=mid;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS society_event_score ON match_events;
CREATE TRIGGER society_event_score AFTER INSERT OR UPDATE OR DELETE ON match_events FOR EACH ROW EXECUTE FUNCTION society_event_score();

CREATE OR REPLACE FUNCTION society_match_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF OLD.locked_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'MATCH_LOCKED: Partida consolidada.'; END IF;
 IF NEW.session_id<>OLD.session_id OR NEW.sequence_number<>OLD.sequence_number OR NEW.home_team_id<>OLD.home_team_id OR NEW.away_team_id<>OLD.away_team_id THEN RAISE EXCEPTION 'Identidade da partida não pode ser alterada.'; END IF;
 IF OLD.status='finished' AND (NEW.status<>'finished' OR NEW.finished_at IS DISTINCT FROM OLD.finished_at OR NEW.end_reason IS DISTINCT FROM OLD.end_reason) THEN RAISE EXCEPTION 'Partida finalizada não pode ser reaberta.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS society_match_guard ON matches;
CREATE TRIGGER society_match_guard BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION society_match_guard();

CREATE OR REPLACE FUNCTION society_match_command(p_action TEXT,p_match_id UUID,p_input JSONB,p_operation_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid UUID; m matches%ROWTYPE; op match_operations%ROWTYPE; eid UUID; tid UUID;
 target INTEGER; counted INTEGER; n INTEGER; hs UUID; aws UUID; finish_reason TEXT;
BEGIN
 IF p_operation_id IS NULL THEN RAISE EXCEPTION 'Identificador da operação obrigatório.'; END IF;
 IF p_action='start' THEN sid=(p_input->>'sessionId')::uuid;
 ELSE SELECT session_id INTO sid FROM matches WHERE id=p_match_id; END IF;
 IF sid IS NULL THEN RAISE EXCEPTION 'NOT_FOUND: Partida ou rodada não encontrada.'; END IF;
 PERFORM 1 FROM sessions WHERE id=sid FOR UPDATE;
 SELECT * INTO op FROM match_operations WHERE operation_id=p_operation_id;
 IF op.operation_id IS NOT NULL THEN
  IF op.action<>p_action OR op.input<>p_input OR (p_action<>'start' AND op.match_id<>p_match_id) THEN RAISE EXCEPTION 'CONFLICT: Identificador reutilizado com outros dados.'; END IF;
  RETURN jsonb_build_object('match_id',op.match_id,'event_id',op.event_id);
 END IF;
 IF p_action='start' THEN
  hs=(p_input->>'homeTeamId')::uuid;aws=(p_input->>'awayTeamId')::uuid;
  IF hs IS NULL OR aws IS NULL OR hs=aws OR (SELECT count(*) FROM session_teams WHERE session_id=sid AND id IN(hs,aws))<>2 THEN RAISE EXCEPTION 'Selecione dois times da rodada.'; END IF;
  SELECT * INTO m FROM matches WHERE session_id=sid AND status='ongoing';
  IF m.id IS NOT NULL THEN RAISE EXCEPTION 'CONFLICT: Finalize a partida atual antes de iniciar outra.'; END IF;
  INSERT INTO matches(session_id,home_team_id,away_team_id,sequence_number)
  VALUES(sid,hs,aws,(SELECT COALESCE(max(sequence_number),0)+1 FROM matches WHERE session_id=sid)) RETURNING * INTO m;
 ELSE
  SELECT * INTO m FROM matches WHERE id=p_match_id FOR UPDATE;
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
   UPDATE matches SET locked_at=now() WHERE session_id=sid AND status='finished' AND locked_at IS NULL
    AND id NOT IN(SELECT id FROM matches WHERE session_id=sid AND status='finished' ORDER BY sequence_number DESC LIMIT 3);
  ELSIF m.status='ongoing' AND p_input ? 'eventTimeSeconds' THEN
   UPDATE matches SET duration_seconds=GREATEST(duration_seconds,(p_input->>'eventTimeSeconds')::integer) WHERE id=m.id;
  END IF;
 END IF;
 INSERT INTO match_operations(operation_id,action,match_id,input,event_id) VALUES(p_operation_id,p_action,m.id,p_input,eid);
 RETURN jsonb_build_object('match_id',m.id,'event_id',eid);
END $$;
REVOKE ALL ON FUNCTION society_match_command(TEXT,UUID,JSONB,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION society_match_command(TEXT,UUID,JSONB,UUID) TO service_role;
ALTER TABLE match_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE society_migration_audit ENABLE ROW LEVEL SECURITY;
REVOKE INSERT,UPDATE,DELETE ON matches,match_events,match_participants,match_operations FROM anon,authenticated;

CREATE OR REPLACE FUNCTION society_participants_json(mid UUID,tid UUID)
RETURNS JSONB LANGUAGE sql STABLE SET search_path=public AS $$
SELECT COALESCE(jsonb_agg(jsonb_build_object('id',p.player_id,'name',p.name_snapshot,'nickname',p.nickname_snapshot,'avatarUrl',p.avatar_snapshot,
 'isGoalkeeper',p.is_goalkeeper,'isLoaned',p.is_loaned,'isCaptain',p.is_captain,'inferred',p.inferred,
 'goals',(SELECT count(*) FROM match_events e WHERE e.match_id=mid AND e.scorer_id=p.player_id AND NOT e.is_own_goal),
 'assists',(SELECT count(*) FROM match_events e WHERE e.match_id=mid AND e.assist_id=p.player_id AND NOT e.is_own_goal)
) ORDER BY p.name_snapshot,p.player_id),'[]'::jsonb) FROM match_participants p WHERE p.match_id=mid AND p.team_id=tid;
$$;

-- Consistent read of score, events and historical participation in one SQL statement.
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
 WHERE p_session_id IS NULL OR m.session_id=p_session_id
) q;
$$;
REVOKE ALL ON FUNCTION society_matches_snapshot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION society_matches_snapshot(UUID) TO service_role;


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
    INSERT INTO session_team_players(session_team_id,player_id,is_goalkeeper,is_loaned)
    VALUES(tid,(p->>'playerId')::uuid,COALESCE((p->>'isGoalkeeper')::boolean,FALSE),COALESCE((p->>'isLoaned')::boolean,FALSE));
   END LOOP;
  END IF;
 END LOOP;
 IF EXISTS(SELECT stp.player_id FROM session_team_players stp JOIN session_teams t ON t.id=stp.session_team_id
  WHERE t.session_id=p_session_id GROUP BY stp.player_id HAVING count(*)>1) THEN RAISE EXCEPTION 'O mesmo jogador não pode estar escalado em dois times da rodada.'; END IF;
END $$;
CREATE OR REPLACE FUNCTION society_transfer_player(p_from UUID,p_to UUID,p_player UUID,p_loaned BOOLEAN,p_goalkeeper BOOLEAN)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid UUID;
BEGIN
 SELECT session_id INTO sid FROM session_teams WHERE id=p_from;
 PERFORM 1 FROM sessions WHERE id=sid FOR UPDATE;
 IF p_from=p_to OR NOT EXISTS(SELECT 1 FROM session_teams WHERE id=p_to AND session_id=sid) THEN RAISE EXCEPTION 'Times devem ser diferentes e pertencer à mesma rodada.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM session_team_players WHERE session_team_id=p_from AND player_id=p_player) THEN RAISE EXCEPTION 'Jogador não está no time de origem.'; END IF;
 DELETE FROM session_team_players WHERE session_team_id=p_from AND player_id=p_player;
 INSERT INTO session_team_players(session_team_id,player_id,is_goalkeeper,is_loaned) VALUES(p_to,p_player,p_goalkeeper,p_loaned);
END $$;
REVOKE ALL ON FUNCTION society_update_teams(UUID,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION society_transfer_player(UUID,UUID,UUID,BOOLEAN,BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION society_update_teams(UUID,JSONB),society_transfer_player(UUID,UUID,UUID,BOOLEAN,BOOLEAN) TO service_role;
-- Existing view contract retained; statistics now use historical participation and finished matches only.
CREATE OR REPLACE VIEW vw_player_leaderboard AS
WITH pm AS (
 SELECT mp.player_id,count(DISTINCT m.id) total_matches,count(DISTINCT m.session_id) total_sessions
 FROM match_participants mp JOIN matches m ON m.id=mp.match_id WHERE m.status='finished' GROUP BY mp.player_id
), pg AS (
 SELECT e.scorer_id player_id,count(*) goals FROM match_events e JOIN matches m ON m.id=e.match_id WHERE m.status='finished' AND NOT e.is_own_goal GROUP BY e.scorer_id
), pa AS (
 SELECT e.assist_id player_id,count(*) assists FROM match_events e JOIN matches m ON m.id=e.match_id WHERE m.status='finished' AND NOT e.is_own_goal GROUP BY e.assist_id
)
SELECT p.id player_id,p.name,p.nickname,p.avatar_url,COALESCE(pg.goals,0) total_goals,COALESCE(pa.assists,0) total_assists,
 COALESCE(pg.goals,0)+COALESCE(pa.assists,0) total_contributions,COALESCE(pm.total_matches,0) total_matches_played,
 COALESCE(pm.total_sessions,0) total_sessions_played,ROUND(COALESCE(pg.goals,0)::numeric/NULLIF(pm.total_matches,0),2) goals_per_match
FROM players p LEFT JOIN pm ON pm.player_id=p.id LEFT JOIN pg ON pg.player_id=p.id LEFT JOIN pa ON pa.player_id=p.id
WHERE p.is_active OR pm.total_matches>0;

INSERT INTO society_schema_versions VALUES('202609090001') ON CONFLICT DO NOTHING;
COMMIT;


