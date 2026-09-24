// Peças do `scripts/db.mjs` que também servem aos testes: lista de migrations, plano de
// aplicação, montagem de um banco igual ao Supabase e leitura do catálogo.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
export const BASELINE_VERSION = '202608140000';

const FILE_PATTERN = /^(\d{12})_[a-z0-9_]+\.sql$/;

/**
 * Funções que anon/authenticated podem executar: só leitura, com os mesmos dados que as
 * páginas públicas mostram. Funções de trigger também passam: não dá para chamá-las fora
 * de um trigger. Qualquer outra executável pela chave pública é falha de permissão.
 */
export const PUBLIC_READ_FUNCTIONS = new Set([
  'society_matches_snapshot',
  'society_matches_snapshot_ranged',
  'society_participants_json',
]);

/**
 * Papéis e privilégios padrão do Supabase. No Supabase, toda tabela ou função nova no
 * schema public nasce com GRANT ALL para anon e authenticated; um `REVOKE ... FROM
 * PUBLIC` não tira esse acesso. Montar o banco de teste assim faz os testes pegarem uma
 * migration que esquece de revogar.
 */
export const SUPABASE_ROLES_SQL = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
`;

/**
 * @typedef {{ version: string, name: string, path: string }} MigrationFile
 */

/** @returns {MigrationFile[]} as migrations em ordem de versão. */
export function migrationFiles(dir = MIGRATIONS_DIR) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => {
      const match = FILE_PATTERN.exec(name);
      if (!match) throw new Error(`Migration fora do padrão AAAAMMDDNNNN_nome.sql: ${name}`);
      return { version: match[1], name, path: join(dir, name) };
    });
}

/** @param {MigrationFile} file */
export function readMigration(file) {
  return readFileSync(file.path, 'utf8');
}

/**
 * Compara os arquivos com as versões registradas em `society_schema_versions`.
 * - `pending`: arquivos ainda não registrados, em ordem;
 * - `outOfOrder`: pendentes mais antigos que a última versão registrada. Aplicá-los
 *   depois das mais novas pode desfazer o que elas mudaram;
 * - `unknown`: versões registradas sem arquivo no repositório.
 * @param {MigrationFile[]} files
 * @param {string[]} applied
 */
export function planMigrations(files, applied) {
  const appliedSet = new Set(applied);
  const known = new Set(files.map((f) => f.version));
  const latest = [...appliedSet].sort().at(-1) ?? null;
  const pending = files.filter((f) => !appliedSet.has(f.version));
  return {
    latest,
    pending,
    outOfOrder: latest ? pending.filter((f) => f.version < latest) : [],
    unknown: [...appliedSet].filter((v) => !known.has(v)).sort(),
  };
}

/**
 * Aplica as migrations do intervalo (`after` exclusivo, `until` inclusivo), em ordem.
 * @param {(sql: string) => Promise<unknown>} exec
 * @param {{ after?: string, until?: string, only?: Set<string> }} [range]
 */
export async function applyMigrations(exec, range = {}) {
  for (const file of migrationFiles()) {
    if (range.after && file.version <= range.after) continue;
    if (range.until && file.version > range.until) continue;
    if (range.only && !range.only.has(file.version)) continue;
    await exec(readMigration(file));
  }
}

/**
 * Lê uma variável do conteúdo de um arquivo .env, sem as aspas acidentais.
 * @param {string} text
 * @param {string} key
 */
export function readEnvValue(text, key) {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(key + '=')) continue;
    let value = trimmed.slice(key.length + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    )
      value = value.slice(1, -1).trim();
    return value || undefined;
  }
  return undefined;
}

/**
 * Consultas do catálogo, cada uma devolvendo pares (k, v). As diferenças que não vêm das
 * migrations ficam de fora: as linhas NOT NULL que o PostgreSQL 18 passou a catalogar em
 * pg_constraint, as extensões fora do schema public (as do Supabase) e o `\r` que o SQL
 * Editor preserva no corpo das funções.
 */
export const CATALOG_QUERIES = {
  relações: `SELECT c.relname AS k, c.relkind::text || ' rls=' || c.relrowsecurity AS v
    FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','v','m','p')`,
  colunas: `SELECT table_name || '.' || column_name AS k,
      data_type || ' null=' || is_nullable || ' default=' || coalesce(column_default, '') AS v
    FROM information_schema.columns WHERE table_schema = 'public'`,
  constraints: `SELECT conrelid::regclass::text || ' ' || conname AS k, pg_get_constraintdef(oid) AS v
    FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype <> 'n'`,
  índices: `SELECT indexname AS k, indexdef AS v FROM pg_indexes WHERE schemaname = 'public'`,
  funções: `SELECT p.oid::regprocedure::text AS k,
      'secdef=' || p.prosecdef || ' md5=' || md5(replace(pg_get_functiondef(p.oid), E'\\r', '')) AS v
    FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'`,
  views: `SELECT viewname AS k, md5(definition) AS v FROM pg_views WHERE schemaname = 'public'`,
  policies: `SELECT tablename || ' ' || policyname AS k,
      cmd || ' ' || roles::text || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '') AS v
    FROM pg_policies WHERE schemaname = 'public'`,
  triggers: `SELECT t.tgrelid::regclass::text || ' ' || t.tgname AS k, md5(pg_get_triggerdef(t.oid)) AS v
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE NOT t.tgisinternal AND c.relnamespace = 'public'::regnamespace`,
  extensões: `SELECT extname AS k, extversion AS v FROM pg_extension
    WHERE extnamespace = 'public'::regnamespace`,
  'privilégios de tabela': `SELECT c.relname || ' ' || r.rolname AS k,
      concat_ws(',',
        CASE WHEN has_table_privilege(r.rolname, c.oid, 'SELECT') THEN 'select' END,
        CASE WHEN has_table_privilege(r.rolname, c.oid, 'INSERT') THEN 'insert' END,
        CASE WHEN has_table_privilege(r.rolname, c.oid, 'UPDATE') THEN 'update' END,
        CASE WHEN has_table_privilege(r.rolname, c.oid, 'DELETE') THEN 'delete' END) AS v
    FROM pg_class c CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rolname)
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','v','m','p')`,
  'privilégios de função': `SELECT p.oid::regprocedure::text || ' ' || r.rolname AS k,
      has_function_privilege(r.rolname, p.oid, 'EXECUTE')::text AS v
    FROM pg_proc p CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rolname)
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'`,
};

/**
 * @param {(sql: string) => Promise<{ k: string, v: string }[]>} query
 * @returns {Promise<Record<string, Record<string, string>>>}
 */
export async function catalog(query) {
  /** @type {Record<string, Record<string, string>>} */
  const out = {};
  for (const [name, sql] of Object.entries(CATALOG_QUERIES)) {
    out[name] = Object.fromEntries((await query(sql)).map((row) => [row.k, row.v]));
  }
  return out;
}

/**
 * Diferenças entre dois catálogos, em texto, uma por linha. Vazio quando são iguais.
 * @param {Record<string, Record<string, string>>} target
 * @param {Record<string, Record<string, string>>} repo
 */
export function catalogDiff(target, repo) {
  const lines = [];
  for (const name of Object.keys(CATALOG_QUERIES)) {
    const a = target[name] ?? {};
    const b = repo[name] ?? {};
    for (const k of Object.keys(a).sort()) {
      if (!(k in b)) lines.push(`[${name}] só no banco: ${k} => ${a[k]}`);
      else if (a[k] !== b[k])
        lines.push(`[${name}] diferente: ${k}\n    banco: ${a[k]}\n    repo:  ${b[k]}`);
    }
    for (const k of Object.keys(b).sort()) {
      if (!(k in a)) lines.push(`[${name}] só no repositório: ${k} => ${b[k]}`);
    }
  }
  return lines;
}

/**
 * Permissões que a chave pública não pode ter: executar função que não seja de leitura ou
 * de trigger, e escrever em qualquer tabela ou view.
 * @param {(sql: string) => Promise<Record<string, unknown>[]>} query
 * @returns {Promise<string[]>}
 */
export async function grantsProblems(query) {
  const problems = [];
  const functions = await query(`SELECT p.proname AS name, p.oid::regprocedure::text AS signature,
      p.prorettype = 'trigger'::regtype AS is_trigger,
      has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated
    FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
    ORDER BY 2`);
  for (const f of functions) {
    if (f.is_trigger || PUBLIC_READ_FUNCTIONS.has(String(f.name))) continue;
    for (const role of ['anon', 'authenticated']) {
      if (f[role]) problems.push(`${role} pode executar ${f.signature}`);
    }
  }
  const relations = await query(`SELECT c.relname AS name, r.rolname AS role
    FROM pg_class c CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rolname)
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','v','m','p')
      AND (has_table_privilege(r.rolname, c.oid, 'INSERT')
        OR has_table_privilege(r.rolname, c.oid, 'UPDATE')
        OR has_table_privilege(r.rolname, c.oid, 'DELETE'))
    ORDER BY 1, 2`);
  for (const r of relations) problems.push(`${r.role} pode escrever em ${r.name}`);
  return problems;
}
