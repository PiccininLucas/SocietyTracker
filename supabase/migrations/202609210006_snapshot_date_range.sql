-- 202609210006: snapshot com recorte por intervalo de datas, feito no SQL.
--
-- Os rankings e relatórios chamavam society_matches_snapshot(NULL) — o histórico inteiro —
-- e recortavam o período em JavaScript:
--
--   all.filter((m) => (!start || m.sessionDate >= start) && (!end || m.sessionDate <= end))
--
-- Medido em 21/09/2026: 22 partidas = 80 KB / 18ms. No ritmo observado de ~22 partidas por
-- quinta, isso projeta ~4 MB e ~940ms em um ano e ~8 MB em dois, transferidos e
-- desserializados a cada leitura. Num relatório mensal, ~97% era descartado em memória.
--
-- POR QUE UMA FUNÇÃO NOVA, E NÃO PARÂMETROS NA EXISTENTE:
-- acrescentar parâmetros com DEFAULT cria uma sobrecarga, e `society_matches_snapshot(x)`
-- passa a ser ambígua ("function is not unique"). Derrubar a versão de 1 argumento
-- resolveria — até alguém reexecutar uma migração antiga, que a recria e quebra o app
-- inteiro. As migrações deste projeto são reaplicáveis de propósito (há teste para isso),
-- então a assinatura antiga fica intacta e a nova convive ao lado.
--
-- society_matches_snapshot(UUID) segue existindo e é o que society_match_command usa
-- internamente no ramo remove_match. As leituras da aplicação passam a usar esta aqui.
--
-- Índices já existentes sustentam o filtro: sessions_session_date_key (session_date) e
-- matches_session_sequence (session_id, sequence_number). Nenhum índice novo é preciso.

BEGIN;

CREATE OR REPLACE FUNCTION society_matches_snapshot_ranged(
  p_session_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
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
   AND (p_start_date IS NULL OR s.session_date >= p_start_date)
   AND (p_end_date   IS NULL OR s.session_date <= p_end_date)
) q;
$$;

REVOKE ALL ON FUNCTION society_matches_snapshot_ranged(UUID,DATE,DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION society_matches_snapshot_ranged(UUID,DATE,DATE) TO service_role;

INSERT INTO public.society_schema_versions VALUES ('202609210006') ON CONFLICT DO NOTHING;

COMMIT;
