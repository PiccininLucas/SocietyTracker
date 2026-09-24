import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  projectPending,
  remapMatchId,
  retryDelay,
  sendCommand,
  CommandRejectedError,
  AuthRequiredError,
  type PendingCommand,
  type ProjectionContext,
  type SessionCache,
} from '../src/components/live/matchSync.ts';
import type { MatchSummary } from '../src/core/domain/repositories/IMatchRepository.ts';
import { resolveMatchesPlayed } from '../src/core/application/dtos/performanceLeaderboard.ts';

// `totalSessionsPlayed` não faz parte do parâmetro: é o campo que o fallback antigo usava.
type MatchesPlayedInput = Parameters<typeof resolveMatchesPlayed>[0];

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

describe('projectPending offline (início, dois gols e finalização)', () => {
  const ctx: ProjectionContext = {
    sessionId: 'session-1',
    sessionDate: '2026-09-24',
    durationSeconds: 420,
    now: Date.parse('2026-09-24T23:00:00Z'),
    teams: [
      {
        id: HOME,
        name: 'Time Casa',
        colorHex: '#111111',
        captainId: 'c-1',
        players: [
          { id: 'c-1', name: 'Capitão' },
          { id: 'g-1', name: 'Goleiro', isGoalkeeper: true },
        ],
      },
      { id: AWAY, name: 'Time Fora', colorHex: '#222222', players: [{ id: 'f-1', name: 'Fora' }] },
    ],
  };
  const start: PendingCommand = {
    operationId: 'start-op',
    action: 'start',
    input: { sessionId: 'session-1', homeTeamId: HOME, awayTeamId: AWAY },
  };
  const goal = (
    id: string,
    teamId = HOME,
    extra: Record<string, unknown> = {}
  ): PendingCommand => ({
    operationId: id,
    action: 'goal',
    matchId: 'start-op',
    input: { teamId, scorerId: teamId === HOME ? 'c-1' : 'f-1', eventTimeSeconds: 100, ...extra },
  });

  it('turns a pending start into an ongoing match whose id is the operation id', () => {
    const finished = { ...matchFixture(), status: 'finished' as const, sequence: 3 };
    const [, projected] = projectPending([finished], [start], ctx);
    assert.equal(projected.matchId, 'start-op');
    assert.equal(projected.status, 'ongoing');
    assert.equal(projected.sequence, 4);
    assert.equal(projected.homeTeamName, 'Time Casa');
    assert.equal(projected.homeScore, 0);
    assert.deepEqual(
      projected.homePlayers?.map((p) => [p.id, p.isCaptain, p.isGoalkeeper]),
      [
        ['c-1', true, false],
        ['g-1', false, true],
      ]
    );
  });

  it('does not project a start without the round context', () => {
    assert.deepEqual(projectPending([], [start]), []);
  });

  it('skips the start once the confirmed match with that id is already cached', () => {
    // Recarga depois do commit, com o ack ainda perdido: a partida não pode aparecer duas vezes.
    const confirmed = { ...matchFixture(), matchId: 'start-op' };
    const projected = projectPending([confirmed], [start], ctx);
    assert.deepEqual(
      projected.map((m) => m.matchId),
      ['start-op']
    );
    assert.equal(projected[0].homeTeamName, 'Time Casa');
  });

  it('closes the match on the second goal, and reopens it when that goal is taken back', () => {
    const pending = [start, goal('g1'), goal('g2')];
    const closed = projectPending([], pending, ctx)[0];
    assert.equal(closed.homeScore, 2);
    assert.equal(closed.status, 'finished');
    assert.equal(closed.endReason, 'two_goals');
    // "Desfazer": tirar o gol ainda retido da fila devolve a partida em andamento.
    const reopened = projectPending([], pending.slice(0, 2), ctx)[0];
    assert.equal(reopened.homeScore, 1);
    assert.equal(reopened.status, 'ongoing');
  });

  it('labels a finish by time limit or as manual, like the server', () => {
    const finish = (durationSeconds: number): PendingCommand => ({
      operationId: 'finish-' + durationSeconds,
      action: 'finish',
      matchId: 'start-op',
      input: { durationSeconds },
    });
    const byTime = projectPending([], [start, goal('g1'), finish(425)], ctx)[0];
    assert.equal(byTime.status, 'finished');
    assert.equal(byTime.endReason, 'time_limit');
    assert.equal(byTime.durationSeconds, 425);
    const manual = projectPending([], [start, finish(200)], ctx)[0];
    assert.equal(manual.endReason, 'manual');
  });

  it('never touches the confirmed cache while projecting a start', () => {
    const matches = [{ ...matchFixture(), status: 'finished' as const }];
    const snapshot = JSON.stringify(matches);
    projectPending(matches, [start, goal('g1'), goal('g2')], ctx);
    assert.equal(JSON.stringify(matches), snapshot);
  });
});

describe('remapMatchId', () => {
  it('points queued commands and the timer at the id the server returned', () => {
    const cache: SessionCache = {
      version: 2,
      sessionId: 'session-1',
      matches: [],
      timers: { 'temp-id': { remaining: 300, elapsed: 120, running: true, anchor: 1 } },
      pending: [
        { operationId: 'g1', action: 'goal', matchId: 'temp-id', input: {} },
        { operationId: 'x', action: 'goal', matchId: 'other', input: {} },
      ],
    };
    const next = remapMatchId(cache, 'temp-id', 'real-id');
    assert.deepEqual(
      next.pending.map((p) => p.matchId),
      ['real-id', 'other']
    );
    assert.deepEqual(Object.keys(next.timers), ['real-id']);
    assert.equal(cache.pending[0].matchId, 'temp-id');
    assert.equal(remapMatchId(cache, 'same', 'same'), cache);
  });
});

describe('retryDelay', () => {
  it('grows from about 2s and never waits more than 30s', () => {
    assert.equal(
      retryDelay(0, () => 0.5),
      2000
    );
    assert.equal(
      retryDelay(1, () => 0.5),
      4000
    );
    assert.equal(
      retryDelay(2, () => 0.5),
      8000
    );
    for (const attempt of [5, 10, 50])
      for (const r of [0, 0.5, 0.999]) assert.ok(retryDelay(attempt, () => r) <= 30000);
  });

  it('spreads retries within ±20%', () => {
    assert.equal(
      retryDelay(0, () => 0),
      1600
    );
    assert.equal(
      retryDelay(0, () => 1),
      2400
    );
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

  it('treats 401 as "login again", never as a rejection that drops the goal', async () => {
    respondWith(401, { error: 'Acesso não autorizado.' });
    await assert.rejects(sendCommand(command), (e: Error) => {
      assert.ok(e instanceof AuthRequiredError);
      assert.ok(!(e instanceof CommandRejectedError));
      return true;
    });
  });

  it('reports network failures in Portuguese and keeps them retryable', async () => {
    const cases: [unknown, RegExp][] = [
      [new TypeError('Failed to fetch'), /Sem conexão/],
      [new DOMException('signal timed out', 'TimeoutError'), /demorou/],
    ];
    for (const [failure, expected] of cases) {
      globalThis.fetch = (async () => {
        throw failure;
      }) as unknown as typeof fetch;
      await assert.rejects(sendCommand(command), (e: Error) => {
        assert.ok(!(e instanceof CommandRejectedError));
        assert.match(e.message, expected);
        return true;
      });
    }
  });
});

describe('resolveMatchesPlayed', () => {
  it('never substitutes rounds for matches when the match count is unknown', () => {
    // `partidas` (mini-jogos, ~8-12 por noite) e `rodadas` (1 por quinta) são métricas
    // diferentes. O fallback antigo testava só `=== null`, então `undefined` escorregava
    // para totalSessionsPlayed e inflava o G/J em ~5x.
    assert.equal(
      resolveMatchesPlayed({
        totalMatchesPlayed: undefined,
        totalSessionsPlayed: 3,
      } as MatchesPlayedInput),
      null
    );
    assert.equal(
      resolveMatchesPlayed({
        totalMatchesPlayed: null,
        totalSessionsPlayed: 3,
      } as MatchesPlayedInput),
      null
    );
  });

  it('keeps the real match count, including zero', () => {
    assert.equal(resolveMatchesPlayed({ totalMatchesPlayed: 15 }), 15);
    assert.equal(resolveMatchesPlayed({ totalMatchesPlayed: '15' }), 15);
    assert.equal(resolveMatchesPlayed({ totalMatchesPlayed: 0 }), 0);
  });

  it('returns null for players carrying historical totals', () => {
    assert.equal(resolveMatchesPlayed({ hasHistoricalTotals: true, totalMatchesPlayed: 15 }), null);
  });
});
