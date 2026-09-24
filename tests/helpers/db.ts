import { PGlite } from '@electric-sql/pglite';
import {
  BASELINE_VERSION,
  SUPABASE_ROLES_SQL,
  applyMigrations,
} from '../../scripts/lib/migrations.mjs';

export { BASELINE_VERSION };

/**
 * Banco em memória com os papéis e os privilégios padrão do Supabase, ainda sem schema.
 * Os testes aplicam as migrations com `migrate`, na ordem dos arquivos.
 */
export async function createDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_ROLES_SQL);
  return db;
}

/**
 * Aplica `supabase/migrations/*.sql` em ordem. `until` para depois da versão (inclusive) e
 * `after` começa depois dela, para testes que gravam dados antigos entre as duas etapas.
 */
export async function migrate(
  db: PGlite,
  range: { after?: string; until?: string } = {}
): Promise<void> {
  await applyMigrations((sql: string) => db.exec(sql), range);
}
