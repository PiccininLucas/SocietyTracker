// Migrations do banco do Supabase, sem SQL Editor e sem reaplicar arquivo antigo.
//
//   npm run db:status                      aplicadas, pendentes e fora de ordem
//   npm run db:migrate -- --yes            aplica as pendentes, em ordem
//   npm run db:mark-applied -- <v> --yes   registra uma versão sem executar (a baseline)
//   npm run db:diff                        compara o banco com as migrations do repositório
//   npm run db:grants                      confere o que a chave pública pode fazer
//
// A conexão usa SUPABASE_DB_URL (ambiente ou .env) com TLS sempre verificado pela CA raiz
// do Supabase (supabase/certs/supabase-root-ca.crt; PG_CA troca o arquivo).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import {
  ROOT,
  BASELINE_VERSION,
  SUPABASE_ROLES_SQL,
  applyMigrations,
  catalog,
  catalogDiff,
  grantsProblems,
  migrationFiles,
  planMigrations,
  readEnvValue,
  readMigration,
} from './lib/migrations.mjs';

const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith('--')));
const args = rest.filter((a) => !a.startsWith('--'));

function databaseUrl() {
  const fromEnv = process.env.SUPABASE_DB_URL?.trim();
  const envFile = join(ROOT, '.env');
  const value =
    fromEnv ||
    (existsSync(envFile)
      ? readEnvValue(readFileSync(envFile, 'utf8'), 'SUPABASE_DB_URL')
      : undefined);
  if (!value) throw new Error('Defina SUPABASE_DB_URL no ambiente ou no .env.');
  const url = new URL(value);
  // Um `sslmode` na URL faz o pg ignorar a CA abaixo e validar pela lista do sistema.
  url.searchParams.delete('sslmode');
  return url;
}

async function connect() {
  const url = databaseUrl();
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  const caFile = process.env.PG_CA || join(ROOT, 'supabase', 'certs', 'supabase-root-ca.crt');
  const client = new pg.Client({
    connectionString: url.toString(),
    ssl: local ? false : { ca: readFileSync(caFile, 'utf8') },
  });
  await client.connect();
  return client;
}

/** @param {pg.Client} client */
async function appliedVersions(client) {
  const exists = await client.query(`SELECT to_regclass('public.society_schema_versions') AS t`);
  if (!exists.rows[0].t) return [];
  const { rows } = await client.query('SELECT version FROM society_schema_versions ORDER BY 1');
  return rows.map((r) => r.version);
}

/** Consulta só de leitura: nada do que roda aqui pode gravar. */
async function readOnly(fn) {
  const client = await connect();
  try {
    await client.query('BEGIN READ ONLY');
    return await fn(client);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }
}

function printPlan(plan) {
  console.log(`Última versão registrada: ${plan.latest ?? '(nenhuma)'}`);
  if (!plan.pending.length) console.log('Nenhuma migration pendente.');
  for (const f of plan.pending) {
    const late = plan.outOfOrder.includes(f);
    const hint =
      late && f.version === BASELINE_VERSION
        ? '  ← baseline: registre com db:mark-applied depois de um db:diff sem diferenças'
        : late
          ? '  ← fora de ordem: mais antiga que a última registrada'
          : '';
    console.log(`pendente: ${f.name}${hint}`);
  }
  for (const v of plan.unknown) console.log(`registrada sem arquivo no repositório: ${v}`);
}

async function status() {
  const applied = await readOnly(appliedVersions);
  printPlan(planMigrations(migrationFiles(), applied));
}

async function grants() {
  const problems = await readOnly((client) =>
    grantsProblems(async (sql) => (await client.query(sql)).rows)
  );
  if (!problems.length) return console.log('Permissões ok: a chave pública só lê.');
  for (const p of problems) console.log('PROBLEMA: ' + p);
  process.exitCode = 1;
}

async function diff() {
  const { applied, target } = await readOnly(async (client) => ({
    applied: await appliedVersions(client),
    target: await catalog(async (sql) => (await client.query(sql)).rows),
  }));
  // Mesmo conjunto de migrations do alvo, mais a baseline, que descreve o que já existia
  // antes delas mesmo quando ainda não foi registrada.
  const lite = new PGlite();
  await lite.exec(SUPABASE_ROLES_SQL);
  await applyMigrations((sql) => lite.exec(sql), {
    only: new Set([BASELINE_VERSION, ...applied]),
  });
  const repo = await catalog(async (sql) => (await lite.query(sql)).rows);
  await lite.close();
  const lines = catalogDiff(target, repo);
  if (!lines.length)
    return console.log('Sem diferenças entre o banco e as migrations registradas.');
  for (const line of lines) console.log(line);
  console.log(`\n${lines.length} diferença(s).`);
  process.exitCode = 1;
}

async function migrate() {
  const client = await connect();
  try {
    const plan = planMigrations(migrationFiles(), await appliedVersions(client));
    printPlan(plan);
    if (!plan.pending.length) return;
    if (plan.outOfOrder.length && !flags.has('--allow-out-of-order')) {
      throw new Error(
        'Há migrations fora de ordem. Aplicá-las depois das mais novas pode desfazer o que ' +
          'elas mudaram. Confira com db:diff; se for a baseline, use db:mark-applied.'
      );
    }
    if (!flags.has('--yes')) {
      console.log('\nNada foi aplicado. Rode de novo com --yes para aplicar as pendentes acima.');
      return;
    }
    for (const file of plan.pending) {
      console.log(`aplicando ${file.name}...`);
      try {
        // Cada arquivo tem o próprio BEGIN/COMMIT e registra a própria versão.
        await client.query(readMigration(file));
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`${file.name} falhou e foi desfeita: ${error.message}`, { cause: error });
      }
      const check = await client.query('SELECT 1 FROM society_schema_versions WHERE version = $1', [
        file.version,
      ]);
      if (!check.rowCount)
        throw new Error(`${file.name} rodou mas não registrou a versão ${file.version}.`);
      console.log(`ok ${file.version}`);
    }
  } finally {
    await client.end();
  }
  await grants();
}

async function markApplied() {
  const version = args[0];
  const file = migrationFiles().find((f) => f.version === version);
  if (!file) throw new Error(`Não há migration com a versão ${version ?? '(vazia)'}.`);
  const client = await connect();
  try {
    const applied = await appliedVersions(client);
    if (applied.includes(version)) return console.log(`${version} já está registrada.`);
    if (!flags.has('--yes')) {
      console.log(`Registraria ${file.name} sem executar. Rode de novo com --yes.`);
      return;
    }
    await client.query('INSERT INTO society_schema_versions VALUES ($1)', [version]);
    console.log(`${version} registrada sem executar.`);
  } finally {
    await client.end();
  }
}

const commands = { status, migrate, 'mark-applied': markApplied, diff, grants };
const run = commands[command];
if (!run) {
  console.error(`Uso: node scripts/db.mjs <${Object.keys(commands).join('|')}>`);
  process.exit(2);
}
run().catch((error) => {
  console.error('ERRO: ' + error.message);
  process.exit(1);
});
