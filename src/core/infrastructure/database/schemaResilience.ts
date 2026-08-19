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

-- 3. Colunas na tabela session_team_players
ALTER TABLE session_team_players ADD COLUMN IF NOT EXISTS is_goalkeeper BOOLEAN DEFAULT FALSE;
ALTER TABLE session_team_players ADD COLUMN IF NOT EXISTS is_loaned BOOLEAN DEFAULT FALSE;

-- 4. Colunas na tabela matches
ALTER TABLE matches ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS end_reason VARCHAR(20) DEFAULT 'manual';

-- 5. Colunas na tabela match_events
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS event_time_seconds INTEGER DEFAULT 0;
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS is_own_goal BOOLEAN DEFAULT FALSE;

-- 6. Colunas na tabela sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS notes TEXT;
`;

/**
 * Extrai o nome da coluna ausente da mensagem de erro do PostgREST / Supabase
 */
export function extractMissingColumn(errorMessage?: string): string | null {
  if (!errorMessage) return null;

  // Padrão 1: Could not find the 'xyz' column of 'table' in the schema cache
  const match1 = errorMessage.match(/Could not find the '([^']+)' column/i);
  if (match1 && match1[1]) return match1[1];

  // Padrão 2: column "xyz" of relation "table" does not exist
  const match2 = errorMessage.match(/column ["']?([^"'\s]+)["']? of relation/i);
  if (match2 && match2[1]) return match2[1];

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
): Promise<{ data: T | null; error: any }> {
  const missingForTable = missingColumnsCache.get(tableName) || new Set<string>();

  const clean = (item: Record<string, any>) => {
    const copy = { ...item };
    for (const col of missingForTable) {
      delete copy[col];
    }
    return copy;
  };

  let currentPayload = Array.isArray(payload) ? payload.map(clean) : clean(payload);

  let result = await operation(currentPayload);

  // Tentativas de autorrecuperação (até 5 colunas ausentes consecutivas)
  let attempts = 0;
  while (result.error && attempts < 5) {
    const missingCol = extractMissingColumn(result.error.message);
    if (!missingCol) break;

    // Registra a coluna ausente no cache para operações futuras
    if (!missingColumnsCache.has(tableName)) {
      missingColumnsCache.set(tableName, new Set<string>());
    }
    missingColumnsCache.get(tableName)!.add(missingCol);

    // Remove a coluna ausente e tenta novamente
    if (Array.isArray(currentPayload)) {
      currentPayload = currentPayload.map((item) => {
        const copy = { ...item };
        delete copy[missingCol];
        return copy;
      });
    } else {
      delete currentPayload[missingCol];
    }

    result = await operation(currentPayload);
    attempts++;
  }

  return result;
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
