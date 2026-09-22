import type { SupabaseClient } from '@supabase/supabase-js';

// Cache em memória de colunas que não existem no banco de dados
const missingColumnsCache = new Map<string, Set<string>>();

/**
 * SQL de todas as migrações automáticas / recomendadas para o banco
 */
export const RECOMMENDED_MIGRATIONS = `
-- 1. Colunas na tabela players
ALTER TABLE players ADD COLUMN IF NOT EXISTS nickname VARCHAR(50);
ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_goalkeeper BOOLEAN DEFAULT FALSE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2. Colunas na tabela session_teams
ALTER TABLE session_teams ADD COLUMN IF NOT EXISTS color_hex VARCHAR(7) DEFAULT '#333333';
ALTER TABLE session_teams ADD COLUMN IF NOT EXISTS captain_id UUID REFERENCES players(id);

-- 3. Colunas na tabela session_team_players
ALTER TABLE session_team_players ADD COLUMN IF NOT EXISTS is_goalkeeper BOOLEAN DEFAULT FALSE;
ALTER TABLE session_team_players ADD COLUMN IF NOT EXISTS is_loaned BOOLEAN DEFAULT FALSE;
ALTER TABLE session_team_players ADD COLUMN IF NOT EXISTS is_captain BOOLEAN DEFAULT FALSE;

-- 4. Colunas na tabela matches
ALTER TABLE matches ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS end_reason VARCHAR(20) DEFAULT 'manual';

-- 5. Colunas na tabela match_events
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS event_time_seconds INTEGER DEFAULT 0;
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS is_own_goal BOOLEAN DEFAULT FALSE;

-- 6. Colunas na tabela sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS match_duration_seconds INTEGER DEFAULT 420;
`;

export interface MissingColumn {
  column: string;
  /**
   * `ddl`  — o PostgreSQL afirmou que a coluna não existe (fato de schema, seguro cachear).
   * `cache` — o PostgREST não a encontrou no *seu* cache de schema, o que também acontece
   *           nos primeiros segundos após uma migração. Não é seguro cachear.
   */
  source: 'ddl' | 'cache';
}

/**
 * Extrai o nome da coluna ausente da mensagem de erro do PostgREST / Supabase.
 *
 * Só reconhece mensagens que afirmam que a coluna **não existe**. Violações de NOT NULL
 * ("null value in column \"x\" of relation \"y\" violates not-null constraint") citam
 * coluna e relação com as mesmas palavras e NÃO podem ser tratadas como coluna ausente —
 * fazê-lo removia o campo do payload e gravava a linha sem ele.
 */
export function extractMissingColumn(errorMessage?: string): MissingColumn | null {
  if (!errorMessage) return null;

  // PostgREST PGRST204: Could not find the 'xyz' column of 'table' in the schema cache
  const fromCache = errorMessage.match(/Could not find the '([^']+)' column/i);
  if (fromCache?.[1]) return { column: fromCache[1], source: 'cache' };

  // PostgreSQL 42703: column "xyz" of relation "table" does not exist
  const fromDdl = errorMessage.match(
    /column ["']?([^"'\s]+)["']? of relation ["']?[^"'\s]+["']? does not exist/i
  );
  if (fromDdl?.[1]) return { column: fromDdl[1], source: 'ddl' };

  return null;
}

/**
 * Executa uma operação no Supabase com autorrecuperação e adaptação automática de schema.
 * Se uma coluna não existir na tabela, ela é removida dinamicamente do payload e a operação é repetida.
 */
export async function executeWithSchemaFallback<T>(
  tableName: string,
  payload: Record<string, any> | Record<string, any>[],
  operation: (cleanPayload: any) => PromiseLike<{ data: T | null | any; error: any }>
): Promise<{ data: T | null; error: any; droppedColumns: string[] }> {
  const missingForTable = missingColumnsCache.get(tableName) || new Set<string>();
  const dropped = new Set<string>(missingForTable);

  const withoutColumns = (item: Record<string, any>, columns: Iterable<string>) => {
    const copy = { ...item };
    for (const col of columns) delete copy[col];
    return copy;
  };
  const strip = (target: typeof payload, columns: Iterable<string>) =>
    Array.isArray(target)
      ? target.map((item) => withoutColumns(item, columns))
      : withoutColumns(target, columns);

  let currentPayload = strip(payload, missingForTable);
  let result = await operation(currentPayload);

  // Autorrecuperação: até 5 colunas ausentes consecutivas.
  let attempts = 0;
  while (result.error && attempts < 5) {
    const missing = extractMissingColumn(result.error.message);
    if (!missing) break;

    // Só um erro de DDL do PostgreSQL é um fato de schema. O PGRST204 do PostgREST
    // também aparece quando o cache de schema *dele* está velho — logo após uma
    // migração — e cachear isso desligaria a coluna para sempre nesta instância.
    if (missing.source === 'ddl') {
      if (!missingColumnsCache.has(tableName)) missingColumnsCache.set(tableName, new Set());
      missingColumnsCache.get(tableName)!.add(missing.column);
    }

    dropped.add(missing.column);
    currentPayload = strip(currentPayload, [missing.column]);
    result = await operation(currentPayload);
    attempts++;
  }

  const droppedColumns = result.error ? [] : [...dropped];
  if (droppedColumns.length) {
    console.warn(
      `[schemaResilience] Gravação em "${tableName}" concluída SEM as colunas ` +
        `[${droppedColumns.join(', ')}] — esses dados foram descartados. ` +
        `Aplique as migrações pendentes (veja RECOMMENDED_MIGRATIONS).`
    );
  }

  return { ...result, droppedColumns };
}

/** Limpa o cache de colunas ausentes. Use após aplicar uma migração. */
export function resetMissingColumnsCache(tableName?: string) {
  if (tableName) missingColumnsCache.delete(tableName);
  else missingColumnsCache.clear();
}

/**
 * Tenta executar as migrações SQL automaticamente caso o Supabase possua função RPC 'exec_sql'
 */
export async function tryAutoMigrate(client: SupabaseClient): Promise<boolean> {
  try {
    const { error } = await client.rpc('exec_sql', { sql: RECOMMENDED_MIGRATIONS });
    return !error;
  } catch {
    return false;
  }
}
