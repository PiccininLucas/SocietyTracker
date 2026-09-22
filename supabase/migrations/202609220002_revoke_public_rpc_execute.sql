-- 202609220002: tirar o EXECUTE de anon/authenticated das RPCs de escrita.
--
-- As migrations anteriores faziam `REVOKE ALL ... FROM PUBLIC` e `GRANT ... TO
-- service_role`. No Supabase isso não basta: os default privileges concedem EXECUTE
-- explicitamente a anon e authenticated em toda função criada em public. Medido no banco
-- real em 22/09/2026: as três funções abaixo (SECURITY DEFINER, gravam dados) eram
-- executáveis por anon. Com a URL do projeto e a chave publicável, dava para registrar
-- gols, apagar partidas e mudar escalações pela API REST, sem passar pelo PIN do app.
--
-- authenticated sai junto: se o cadastro do Supabase Auth estiver aberto, qualquer um
-- obtém um token authenticated. O app não usa Supabase Auth; todas as RPCs são chamadas
-- pelo servidor com a service_role, que continua com EXECUTE.
--
-- CREATE OR REPLACE preserva os privilégios, então reaplicar uma migration antiga não
-- devolve o acesso. As funções de leitura (society_matches_snapshot*) continuam como
-- estão: expõem os mesmos dados que as páginas públicas.

BEGIN;

REVOKE ALL ON FUNCTION society_match_command(TEXT,UUID,JSONB,UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION society_update_teams(UUID,JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION society_transfer_player(UUID,UUID,UUID,BOOLEAN,BOOLEAN) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION society_match_command(TEXT,UUID,JSONB,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION society_update_teams(UUID,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION society_transfer_player(UUID,UUID,UUID,BOOLEAN,BOOLEAN) TO service_role;

INSERT INTO public.society_schema_versions VALUES ('202609220002') ON CONFLICT DO NOTHING;

COMMIT;
