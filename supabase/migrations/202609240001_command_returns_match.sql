-- 202609240001: o comando de partida devolve a súmula na mesma chamada.
--
-- Cada comando do mesário fazia 3 idas ao banco: society_match_command, um SELECT do
-- session_id e society_matches_snapshot_ranged da rodada inteira, filtrada depois em
-- TypeScript. Com as duas funções abaixo o servidor faz uma chamada só, e a súmula que
-- volta sai da mesma transação da escrita.
--
-- society_match_command não é recriada: já existem seis cópias inteiras dela nas
-- migrations. A função nova chama a atual e acrescenta `match`.

BEGIN;

-- A súmula de uma partida no formato de society_matches_snapshot, que continua sendo o
-- único lugar onde esse JSON é montado (o mesmo recorte que o remove_match já faz).
-- Partida apagada ou inexistente devolve NULL.
CREATE OR REPLACE FUNCTION society_match_snapshot(p_match_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT e.value
  FROM matches m
  CROSS JOIN LATERAL jsonb_array_elements(society_matches_snapshot(m.session_id)) AS e(value)
  WHERE m.id = p_match_id AND e.value->>'matchId' = p_match_id::text
$$;

-- Mesmo contrato de society_match_command, mais `match` com a súmula depois da escrita.
-- `deleted_match` (remove_match) já traz a súmula arquivada e passa direto.
CREATE OR REPLACE FUNCTION society_match_command_with_match(
  p_action TEXT, p_match_id UUID, p_input JSONB, p_operation_id UUID)
RETURNS JSONB LANGUAGE plpgsql SET search_path=public AS $$
DECLARE result JSONB;
BEGIN
  result := society_match_command(p_action, p_match_id, p_input, p_operation_id);
  IF result ? 'deleted_match' THEN RETURN result; END IF;
  RETURN result || jsonb_build_object('match', society_match_snapshot((result->>'match_id')::uuid));
END $$;

-- No Supabase, os default privileges dão EXECUTE a anon/authenticated em função nova:
-- o REVOKE precisa citar os dois papéis.
REVOKE ALL ON FUNCTION society_match_snapshot(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION society_match_snapshot(UUID) TO service_role;
REVOKE ALL ON FUNCTION society_match_command_with_match(TEXT,UUID,JSONB,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION society_match_command_with_match(TEXT,UUID,JSONB,UUID) TO service_role;

INSERT INTO public.society_schema_versions VALUES ('202609240001') ON CONFLICT DO NOTHING;

COMMIT;
