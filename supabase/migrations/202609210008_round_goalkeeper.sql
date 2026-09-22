-- 202609210008: expor "goleiro nesta rodada" no snapshot, ao lado do goleiro congelado.
--
-- Havia duas fontes para a mesma pergunta:
--
--   session_team_players.is_goalkeeper  -> a escalação da rodada (muda se o mesário edita)
--   match_participants.is_goalkeeper    -> o retrato tirado quando a partida foi criada
--
-- E dois lugares liam fontes diferentes para a MESMA regra (imunidade do goleiro no
-- "Bola Murcha"): GetRoundHighlightsUseCase usava a escalação, CompetitionService usava o
-- retrato. Medido em 21/09/2026: 12 linhas divergentes, todas do único goleiro escalado,
-- que aparecia imune no card da rodada e não-imune no ranking geral.
--
-- O retrato não está errado — ele congela o que era verdade quando a partida começou, e é
-- isso que se quer no histórico. Faltava a outra informação.
--
-- Decisão do responsável pelo produto: a função de goleiro vale POR NOITE. Então o
-- snapshot passa a trazer também `isRoundGoalkeeper`, lido ao vivo da escalação, e a
-- regra de imunidade usa esse. `isGoalkeeper` continua intacto para o histórico.
--
-- O join extra é sustentado por idx_session_team_players_player_id (202609210004).

BEGIN;

CREATE OR REPLACE FUNCTION society_participants_json(mid UUID,tid UUID)
RETURNS JSONB LANGUAGE sql STABLE SET search_path=public AS $$
SELECT COALESCE(jsonb_agg(jsonb_build_object('id',p.player_id,'name',p.name_snapshot,'nickname',p.nickname_snapshot,'avatarUrl',p.avatar_snapshot,
 'isGoalkeeper',p.is_goalkeeper,'isLoaned',p.is_loaned,'isCaptain',p.is_captain,'inferred',p.inferred,
 'isRoundGoalkeeper',COALESCE((
   SELECT bool_or(stp.is_goalkeeper)
   FROM session_team_players stp
   JOIN session_teams st ON st.id=stp.session_team_id
   JOIN matches m2 ON m2.id=mid
   WHERE st.session_id=m2.session_id AND stp.player_id=p.player_id
 ),p.is_goalkeeper),
 'goals',(SELECT count(*) FROM match_events e WHERE e.match_id=mid AND e.scorer_id=p.player_id AND NOT e.is_own_goal),
 'assists',(SELECT count(*) FROM match_events e WHERE e.match_id=mid AND e.assist_id=p.player_id AND NOT e.is_own_goal)
) ORDER BY p.name_snapshot,p.player_id),'[]'::jsonb) FROM match_participants p WHERE p.match_id=mid AND p.team_id=tid;
$$;

INSERT INTO public.society_schema_versions VALUES ('202609210008') ON CONFLICT DO NOTHING;

COMMIT;
