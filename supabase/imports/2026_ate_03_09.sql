-- Fonte: Transicao_app (1).csv. Temporada 2026, incluindo 03/09/2026.
-- Execute após migrations/202609100001_historical_totals.sql.
-- Reutiliza nome/apelido exato, ignorando acentos, caixa e espaços repetidos.
-- Cria os nomes não encontrados. Ambiguidades abortam toda a transação.
-- Uma repetição idêntica não soma nem duplica os dados.
BEGIN;
LOCK TABLE public.players, public.historical_player_totals IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE transition_2026 (
  source_name text PRIMARY KEY, contributions integer NOT NULL,
  goals integer NOT NULL CHECK (goals >= 0), assists integer NOT NULL CHECK (assists >= 0),
  bottom_count integer NOT NULL CHECK (bottom_count >= 0),
  player_id uuid UNIQUE,
  CHECK (contributions = goals + assists)
) ON COMMIT DROP;

INSERT INTO transition_2026 (source_name, contributions, goals, assists, bottom_count) VALUES
('Barbaroto',64,41,23,0),
('Chitao',60,37,23,0),
('Arruda',47,22,25,0),
('Benzema',32,22,10,0),
('Lucao',32,20,12,0),
('Paulon',28,19,9,1),
('Enzo',26,15,11,0),
('Graciano',25,16,9,1),
('Israel',25,15,10,0),
('Gimenes',24,13,11,0),
('Japa',24,18,6,0),
('Caldas',22,8,14,0),
('Gabriel Henrique',22,15,7,0),
('Buzeto',20,11,9,1),
('Finazzi',20,10,10,0),
('Gomes',19,15,4,0),
('Pedro',19,10,9,0),
('Nathan',16,9,7,0),
('H Zampa',11,5,6,0),
('Carlos',10,5,5,0),
('Paulinho',10,6,4,2),
('Buzz',8,2,6,1),
('Chico',8,3,5,1),
('Tasca',7,2,5,0),
('Cefas',6,3,3,0),
('Vini M',5,3,2,0),
('Lucas Piccinin',4,0,4,0),
('Terciotte',4,2,2,0),
('Tibas',4,3,1,0),
('Gananca',3,2,1,0),
('Sorriso',3,1,2,3),
('Thomas',3,3,0,3),
('Brunao',2,0,2,0),
('Vieira',2,1,1,0),
('Caio',0,0,0,1),
('Fefe',0,0,0,0),
('Flauzino',0,0,0,1),
('Lucas',0,0,0,0),
('Rocha',0,0,0,1);

-- Se um apelido for diferente do cadastro, vincule explicitamente aqui, antes do DO:
-- UPDATE transition_2026 SET player_id = 'UUID-DO-JOGADOR' WHERE source_name = 'Nome no CSV';

CREATE OR REPLACE FUNCTION pg_temp.transition_name(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(trim(translate(lower(coalesce(value,'')),
    'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')), '\s+', ' ', 'g');
$$;

DO $$
DECLARE r record; candidates uuid[]; resolved uuid; previous public.historical_player_totals%ROWTYPE;
BEGIN
  FOR r IN SELECT * FROM transition_2026 ORDER BY source_name LOOP
    resolved := r.player_id;
    IF resolved IS NULL THEN
      -- Persist the original link even if a player was renamed since the first import.
      SELECT array_agg(player_id) INTO candidates FROM public.historical_player_totals
        WHERE season=2026 AND source_file='Transicao_app (1).csv' AND source_name=r.source_name;
      IF coalesce(cardinality(candidates),0)=0 THEN
        SELECT array_agg(id) INTO candidates FROM public.players
          WHERE pg_temp.transition_name(name)=pg_temp.transition_name(r.source_name)
             OR (nickname IS NOT NULL AND pg_temp.transition_name(nickname)=pg_temp.transition_name(r.source_name));
      END IF;
      IF cardinality(candidates)>1 THEN
        RAISE EXCEPTION 'Mais de um cadastro para %. Preencha player_id em transition_2026 e execute novamente.', r.source_name;
      END IF;
      resolved := candidates[1];
      IF resolved IS NULL THEN
        INSERT INTO public.players(name) VALUES(r.source_name) RETURNING id INTO resolved;
      END IF;
    END IF;
    -- The UNIQUE constraint prevents two CSV names from being attached to the same player.
    UPDATE transition_2026 SET player_id=resolved WHERE source_name=r.source_name;
    SELECT * INTO previous FROM public.historical_player_totals WHERE player_id=resolved AND season=2026;
    IF FOUND THEN
      IF previous.through_date <> DATE '2026-09-03' OR previous.source_name <> r.source_name
        OR previous.source_file <> 'Transicao_app (1).csv' OR previous.goals <> r.goals
        OR previous.assists <> r.assists OR previous.bottom_count <> r.bottom_count THEN
        RAISE EXCEPTION 'Já existe um histórico diferente para %. Nenhum dado foi sobrescrito.', r.source_name;
      END IF;
    ELSE
      INSERT INTO public.historical_player_totals
        (player_id,season,through_date,source_name,source_file,goals,assists,bottom_count)
        VALUES(resolved,2026,'2026-09-03',r.source_name,'Transicao_app (1).csv',r.goals,r.assists,r.bottom_count);
    END IF;
  END LOOP;
END $$;

SELECT t.source_name AS nome_no_csv, p.id AS player_id, p.name AS cadastro, p.nickname AS apelido,
  t.contributions AS participacoes, t.goals AS gols, t.assists AS assistencias, t.bottom_count AS bola_murcha
FROM transition_2026 t JOIN public.players p ON p.id=t.player_id
ORDER BY t.contributions DESC, t.goals DESC, t.source_name;
COMMIT;
