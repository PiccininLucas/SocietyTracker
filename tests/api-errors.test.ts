import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, apiError, classifyError } from '../src/core/infrastructure/http/api.ts';
import { DatabaseError } from '../src/core/infrastructure/database/DatabaseError.ts';
import { DomainError } from '../src/core/domain/errors/DomainError.ts';
import { EntityNotFoundError } from '../src/core/domain/errors/EntityNotFoundError.ts';

// O mesário descarta da fila todo comando recusado com 4xx (exceto 408/429). Por isso
// só recusas definitivas podem sair como 4xx; o resto precisa ser 5xx para ser reenviado.
describe('classifyError', () => {
  it('keeps the SQL business refusals (P0001) as 4xx, without the status prefix', () => {
    const cases: [string, number, string][] = [
      ['MATCH_LOCKED: partida consolidada.', 409, 'partida consolidada.'],
      ['CONFLICT: já existe partida em andamento.', 409, 'já existe partida em andamento.'],
      ['NOT_FOUND: partida inexistente.', 404, 'partida inexistente.'],
      ['Selecione dois times da rodada.', 400, 'Selecione dois times da rodada.'],
    ];
    for (const [raw, status, shown] of cases) {
      const result = classifyError(new DatabaseError(raw, 'P0001'));
      assert.equal(result.status, status, raw);
      assert.equal(result.message, shown);
    }
  });

  it('maps invalid data and unique violations without leaking the Postgres text', () => {
    const invalid = classifyError(
      new DatabaseError('invalid input syntax for type uuid: "x"', '22P02')
    );
    assert.equal(invalid.status, 400);
    assert.doesNotMatch(invalid.message, /syntax/);

    assert.equal(classifyError(new DatabaseError('duplicate key value', '23505')).status, 409);
  });

  it('treats domain validation and malformed JSON as definitive 400s', () => {
    assert.equal(classifyError(new DomainError('Partida obrigatória.')).status, 400);
    assert.equal(classifyError(new SyntaxError('Unexpected end of JSON input')).status, 400);
  });

  it('uses the status of route refusals and 404 for missing entities', () => {
    assert.deepEqual(classifyError(new HttpError(400, 'id: informe um UUID válido.')), {
      status: 400,
      message: 'id: informe um UUID válido.',
    });
    // Antes a rota adivinhava o 404 procurando "não encontrado" no texto.
    assert.equal(classifyError(new EntityNotFoundError('Jogador', 'x')).status, 404);
  });

  it('turns network, PostgREST and unknown failures into retryable 503s', () => {
    const transient: unknown[] = [
      new DatabaseError('TypeError: fetch failed', ''),
      new DatabaseError('canceling statement due to statement timeout', '57014'),
      new DatabaseError('Could not find the function', 'PGRST202'),
      new Error('Partida salva, mas não foi possível carregar a confirmação.'),
      new TypeError('fetch failed'),
      'algo estranho',
    ];
    for (const error of transient) {
      const result = classifyError(error);
      assert.equal(result.status, 503, String(error));
      assert.match(result.message, /indisponível/);
      assert.match(classifyError(error, 'Fica pendente.').message, /pendente/);
    }
  });

  it('reads the SQLSTATE from errors thrown directly by the driver (PGlite/pg)', () => {
    const driverError = Object.assign(new Error('NOT_FOUND: evento.'), { code: 'P0001' });
    assert.equal(classifyError(driverError).status, 404);
  });
});

describe('apiError', () => {
  it('returns the classified status and hides internal details on 5xx', async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      const response = apiError(new DatabaseError('connection refused to db.internal:5432', ''));
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.doesNotMatch(body.error, /db\.internal/);
    } finally {
      console.error = originalError;
    }
  });

  it('flags 409 responses with the MATCH_CONFLICT code', async () => {
    const response = apiError(new DatabaseError('MATCH_LOCKED: partida consolidada.', 'P0001'));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'MATCH_CONFLICT');
  });
});
