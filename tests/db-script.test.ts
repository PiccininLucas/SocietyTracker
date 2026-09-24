import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planMigrations, readEnvValue } from '../scripts/lib/migrations.mjs';

const file = (version: string) => ({ version, name: version + '_x.sql', path: version });

describe('planMigrations', () => {
  const files = ['202608140000', '202609090001', '202609220003', '202609240001'].map(file);

  it('lista como pendentes só as versões não registradas, em ordem', () => {
    const plan = planMigrations(files, ['202608140000', '202609090001']);
    assert.deepEqual(
      plan.pending.map((f) => f.version),
      ['202609220003', '202609240001']
    );
    assert.deepEqual(plan.outOfOrder, []);
    assert.equal(plan.latest, '202609090001');
  });

  it('marca como fora de ordem a pendente mais antiga que a última registrada', () => {
    // Situação da baseline em produção: tudo registrado, menos o arquivo mais antigo.
    const plan = planMigrations(files, ['202609090001', '202609220003']);
    assert.deepEqual(
      plan.outOfOrder.map((f) => f.version),
      ['202608140000']
    );
    assert.deepEqual(
      plan.pending.map((f) => f.version),
      ['202608140000', '202609240001']
    );
  });

  it('aponta versão registrada sem arquivo e banco sem nenhuma versão', () => {
    assert.deepEqual(planMigrations(files, ['202609090001', '202601010001']).unknown, [
      '202601010001',
    ]);
    const empty = planMigrations(files, []);
    assert.equal(empty.latest, null);
    assert.equal(empty.pending.length, files.length);
    assert.deepEqual(empty.outOfOrder, []);
  });
});

describe('readEnvValue', () => {
  it('lê a variável sem aspas acidentais e ignora as demais linhas', () => {
    const text = [
      '# comentário',
      'SUPABASE_DB_URL_OLD=nao',
      'SUPABASE_DB_URL="postgresql://u:p@db.x.supabase.co:5432/postgres"',
      'OUTRA=1',
    ].join('\r\n');
    assert.equal(
      readEnvValue(text, 'SUPABASE_DB_URL'),
      'postgresql://u:p@db.x.supabase.co:5432/postgres'
    );
    assert.equal(readEnvValue("A='b'", 'A'), 'b');
    assert.equal(readEnvValue('A=', 'A'), undefined);
    assert.equal(readEnvValue('B=1', 'A'), undefined);
  });
});
