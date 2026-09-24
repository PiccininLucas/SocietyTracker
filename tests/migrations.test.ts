import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { grantsProblems, migrationFiles } from '../scripts/lib/migrations.mjs';
import { createDatabase, migrate } from './helpers/db';

describe('supabase/migrations', () => {
  const files = migrationFiles();

  it('cada arquivo roda numa transação e registra a própria versão', () => {
    assert.ok(files.length > 0);
    assert.equal(new Set(files.map((f) => f.version)).size, files.length, 'versões repetidas');
    for (const f of files) {
      const sql = readFileSync(f.path, 'utf8');
      assert.match(sql, /^BEGIN;\s*$/m, f.name + ' sem BEGIN');
      assert.match(sql, /^COMMIT;\s*$/m, f.name + ' sem COMMIT');
      assert.match(
        sql,
        new RegExp(
          `INSERT INTO (public\\.)?society_schema_versions VALUES\\s*\\('${f.version}'\\)`
        ),
        f.name + ' não registra a versão ' + f.version
      );
    }
  });

  it('montam do zero o banco de produção: versões, RLS, sem views e a chave pública só lê', async () => {
    const db = await createDatabase();
    try {
      await migrate(db);
      const versions = await db.query<{ version: string }>(
        'SELECT version FROM society_schema_versions ORDER BY 1'
      );
      assert.deepEqual(
        versions.rows.map((r) => r.version),
        files.map((f) => f.version)
      );

      // Em produção só a tabela de versões fica sem RLS; ela não tem dado de ninguém.
      const withoutRls = await db.query<{ relname: string }>(
        `SELECT relname FROM pg_class WHERE relnamespace = 'public'::regnamespace
           AND relkind = 'r' AND NOT relrowsecurity ORDER BY 1`
      );
      assert.deepEqual(
        withoutRls.rows.map((r) => r.relname),
        ['society_schema_versions']
      );

      const views = await db.query(`SELECT viewname FROM pg_views WHERE schemaname = 'public'`);
      assert.deepEqual(views.rows, []);

      assert.deepEqual(
        await grantsProblems(
          async (sql: string) => (await db.query<Record<string, unknown>>(sql)).rows
        ),
        []
      );
    } finally {
      await db.close();
    }
  });

  it('o banco de teste reproduz o Supabase: função nova sem REVOKE fica aberta à chave pública', async () => {
    const db = await createDatabase();
    try {
      await migrate(db);
      await db.exec(`CREATE FUNCTION society_nova_escrita() RETURNS integer LANGUAGE sql AS 'SELECT 1';
        REVOKE ALL ON FUNCTION society_nova_escrita() FROM PUBLIC;
        CREATE TABLE society_tabela_nova(id integer);`);
      assert.deepEqual(
        await grantsProblems(
          async (sql: string) => (await db.query<Record<string, unknown>>(sql)).rows
        ),
        [
          'anon pode executar society_nova_escrita()',
          'authenticated pode executar society_nova_escrita()',
          'anon pode escrever em society_tabela_nova',
          'authenticated pode escrever em society_tabela_nova',
        ]
      );
    } finally {
      await db.close();
    }
  });
});
