import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  projectPending,
  sendCommand,
  CommandRejectedError,
  type PendingCommand,
} from '../src/components/live/matchSync.ts';
import type { MatchSummary } from '../src/core/domain/repositories/IMatchRepository.ts';
import { resolveMatchesPlayed } from '../src/core/application/dtos/performanceLeaderboard.ts';

const HOME = 'team-home';
const AWAY = 'team-away';

function matchFixture(): MatchSummary {
  return {
    matchId: 'match-1',
    sessionId: 'session-1',
    sessionDate: '2026-09-24',
    sequence: 1,
    homeTeamId: HOME,
    awayTeamId: AWAY,
    homeTeamName: 'Time Casa',
    awayTeamName: 'Time Fora',
    homeTeamColor: '#111111',
    awayTeamColor: '#222222',
    homeScore: 0,
    awayScore: 0,
    status: 'ongoing',
    durationSeconds: 0,
    homePlayers: [{ id: 'p-1', name: 'Titular', goals: 0, assists: 0 }],
    awayPlayers: [],
    events: [],
  } as unknown as MatchSummary;
}

describe('projectPending', () => {
  it('must not mutate the confirmed cache when projecting a loaned scorer', () => {
    // A projeção insere o jogador emprestado em homePlayers. Com cópia rasa isso
    // alterava o array do cache, que é persistido no localStorage e alimenta ranking,
    // classificação e "últimas partidas" — criando um jogador fantasma permanente.
    const matches = [matchFixture()];
    const pending: PendingCommand[] = [
      {
        operationId: 'op-1',
        action: 'goal',
        matchId: 'match-1',
        input: { teamId: HOME, scorerId: 'emprestado-9', scorerName: 'Visitante' },
      },
    ];

    const projected = projectPending(matches, pending);

    assert.deepEqual(
      matches[0].homePlayers?.map((p) => p.id),
      ['p-1'],
      'o cache confirmado não pode ganhar o jogador emprestado'
    );
    assert.equal(matches[0].events?.length, 0);
    assert.equal(matches[0].homeScore, 0);

    // A projeção em si continua mostrando o lance para o mesário.
    assert.ok(projected[0].homePlayers?.some((p) => p.id === 'emprestado-9'));
    assert.equal(projected[0].homeScore, 1);
  });

  it('stays stable when called repeatedly with the same input', () => {
    const matches = [matchFixture()];
    const pending: PendingCommand[] = [
      {
        operationId: 'op-1',
        action: 'goal',
        matchId: 'match-1',
        input: { teamId: HOME, scorerId: 'emprestado-9' },
      },
    ];

    const first = projectPending(matches, pending);
    const second = projectPending(matches, pending);

    assert.equal(first[0].homeScore, second[0].homeScore);
    assert.equal(first[0].homePlayers?.length, second[0].homePlayers?.length);
  });
});

describe('sendCommand error classification', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const command: PendingCommand = {
    operationId: 'op-1',
    action: 'goal',
    matchId: 'match-1',
    input: { teamId: HOME },
  };

  const respondWith = (status: number, body: unknown, ok = status < 400) => {
    globalThis.fetch = (async () => ({
      ok,
      status,
      json: async () => {
        if (body === undefined) throw new SyntaxError('Unexpected token <');
        return body;
      },
    })) as unknown as typeof fetch;
  };

  it('marks 4xx as a definitive rejection so the queue can drop it', async () => {
    respondWith(400, { error: 'Gol inválido para esta partida.' });
    await assert.rejects(sendCommand(command), (e: Error) => {
      assert.ok(e instanceof CommandRejectedError);
      assert.equal((e as CommandRejectedError).status, 400);
      assert.match(e.message, /Gol inválido/);
      return true;
    });
  });

  it('keeps 5xx retryable so an outage does not discard the goal', async () => {
    respondWith(503, { error: 'Banco indisponível.' });
    await assert.rejects(sendCommand(command), (e: Error) => {
      assert.ok(!(e instanceof CommandRejectedError), '5xx deve continuar retentável');
      return true;
    });
  });

  it('keeps 429 and 408 retryable', async () => {
    for (const status of [408, 429]) {
      respondWith(status, { error: 'Tente novamente.' });
      await assert.rejects(sendCommand(command), (e: Error) => {
        assert.ok(!(e instanceof CommandRejectedError), `${status} deve ser retentável`);
        return true;
      });
    }
  });

  it('gives a readable message when the gateway returns HTML instead of JSON', async () => {
    // 502/504 da Vercel devolvem uma página HTML: antes o res.json() lançava
    // SyntaxError e o mesário via "Unexpected token '<'".
    respondWith(502, undefined);
    await assert.rejects(sendCommand(command), (e: Error) => {
      assert.doesNotMatch(e.message, /Unexpected token/);
      assert.match(e.message, /indispon/i);
      return true;
    });
  });

  it('fails clearly when a 200 response has no match payload', async () => {
    respondWith(200, {});
    await assert.rejects(sendCommand(command), /incompleta/i);
  });
});

describe('resolveMatchesPlayed', () => {
  it('never substitutes rounds for matches when the match count is unknown', () => {
    // `partidas` (mini-jogos, ~8-12 por noite) e `rodadas` (1 por quinta) são métricas
    // diferentes. O fallback antigo testava só `=== null`, então `undefined` escorregava
    // para totalSessionsPlayed e inflava o G/J em ~5x.
    assert.equal(
      resolveMatchesPlayed({ totalMatchesPlayed: undefined, totalSessionsPlayed: 3 } as any),
      null
    );
    assert.equal(
      resolveMatchesPlayed({ totalMatchesPlayed: null, totalSessionsPlayed: 3 } as any),
      null
    );
  });

  it('keeps the real match count, including zero', () => {
    assert.equal(resolveMatchesPlayed({ totalMatchesPlayed: 15 }), 15);
    assert.equal(resolveMatchesPlayed({ totalMatchesPlayed: '15' }), 15);
    assert.equal(resolveMatchesPlayed({ totalMatchesPlayed: 0 }), 0);
  });

  it('returns null for players carrying historical totals', () => {
    assert.equal(
      resolveMatchesPlayed({ hasHistoricalTotals: true, totalMatchesPlayed: 15 }),
      null
    );
  });
});
