import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { APIContext, APIRoute } from 'astro';
import * as sessions from '../src/pages/api/sessions/index.ts';
import * as session from '../src/pages/api/sessions/[id]/index.ts';
import * as sessionTeams from '../src/pages/api/sessions/[id]/teams.ts';
import * as sessionMatches from '../src/pages/api/sessions/[id]/matches.ts';
import * as players from '../src/pages/api/players/index.ts';
import * as player from '../src/pages/api/players/[id].ts';
import * as period from '../src/pages/api/reports/period.ts';
import * as round from '../src/pages/api/reports/round.ts';
import * as match from '../src/pages/api/matches/[id]/index.ts';
import * as goals from '../src/pages/api/matches/[id]/goals.ts';
import * as authStatus from '../src/pages/api/auth/status.ts';
import { matchCommand } from '../src/core/infrastructure/http/matchApi.ts';
import type { MatchCommand } from '../src/core/domain/repositories/IMatchCommands.ts';
import type { MatchSummary } from '../src/core/domain/repositories/IMatchRepository.ts';

// As rotas criam os repositórios reais. Sem SUPABASE_SECRET_KEY, qualquer ida ao banco
// falha com 503: um 400 prova que a entrada foi recusada antes. A chave é apagada aqui
// porque o build da Vercel roda `npm test` com ela no ambiente, e o teste não pode chegar
// ao banco de produção (o cliente lê a chave só no primeiro uso, e cada arquivo de teste
// roda no próprio processo).
delete process.env.SUPABASE_SECRET_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const ID = '6f1d2c9e-8a47-4b3e-9c1a-2f5b7d8e9a01';
const KEY = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

function call(
  route: APIRoute | undefined,
  path: string,
  init: RequestInit & { params?: Record<string, string> } = {}
) {
  assert.ok(route, 'rota não exportada: ' + path);
  const url = new URL(path, 'http://localhost');
  const request = new Request(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  return route({
    request,
    url,
    params: init.params ?? {},
    cookies: { get: () => undefined },
  } as unknown as APIContext);
}

async function expectRefused(response: Response | Promise<Response>, field: RegExp) {
  const res = await response;
  const body = await res.json();
  assert.equal(res.status, 400, JSON.stringify(body));
  assert.match(body.error, field);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  // Nada do Postgres ou do driver chega ao corpo.
  assert.doesNotMatch(body.error, /syntax|relation|constraint|violates|PGRST/i);
}

describe('validação das rotas', () => {
  it('controle: entrada válida passa da validação e só então cai no banco ausente (503)', async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      assert.equal((await call(sessions.GET, '/api/sessions?id=' + ID)).status, 503);
      assert.equal((await call(period.GET, '/api/reports/period?type=year&year=2026')).status, 503);
    } finally {
      console.error = originalError;
    }
  });

  it('ids e datas inválidos na URL respondem 400, não 500 com o erro do Postgres', async () => {
    await expectRefused(call(sessions.GET, '/api/sessions?id=abc'), /^id: /);
    await expectRefused(call(sessions.GET, '/api/sessions?date=2026-02-30'), /^date: /);
    await expectRefused(call(round.GET, '/api/reports/round?sessionId=abc'), /^sessionId: /);
    await expectRefused(call(round.GET, '/api/reports/round?date=24/09/2026'), /^date: /);
    await expectRefused(call(match.GET, '/api/matches/abc', { params: { id: 'abc' } }), /partida/);
    await expectRefused(
      call(sessionMatches.GET, '/api/sessions/abc/matches', { params: { id: 'abc' } }),
      /rodada/
    );
  });

  it('reports/period exige o mês ou o ano do recorte pedido', async () => {
    // Antes `type=month` sem mês devolvia o histórico inteiro rotulado como mês.
    await expectRefused(call(period.GET, '/api/reports/period?type=month'), /^yearMonth: /);
    await expectRefused(
      call(period.GET, '/api/reports/period?type=month&yearMonth=2026-13'),
      /^yearMonth: /
    );
    // Antes era 500.
    await expectRefused(call(period.GET, '/api/reports/period?type=year&year=20x'), /^year: /);
    await expectRefused(call(period.GET, '/api/reports/period?type=semana'), /^type: /);
  });

  it('corpo inválido, nulo ou com tipos errados responde 400', async () => {
    await expectRefused(call(players.POST, '/api/players', { method: 'POST', body: '{' }), /Corpo/);
    await expectRefused(
      call(players.POST, '/api/players', { method: 'POST', body: 'null' }),
      /Corpo/
    );
    await expectRefused(
      call(players.POST, '/api/players', { method: 'POST', body: JSON.stringify({ name: 123 }) }),
      /^name: /
    );
    await expectRefused(
      call(player.PATCH, '/api/players/abc', {
        method: 'PATCH',
        params: { id: 'abc' },
        body: JSON.stringify({ name: 'João' }),
      }),
      /jogador/
    );
    await expectRefused(
      call(player.PATCH, '/api/players/' + ID, {
        method: 'PATCH',
        params: { id: ID },
        body: JSON.stringify({ isGoalkeeper: 'sim' }),
      }),
      /^isGoalkeeper: /
    );
    // Antes "abc" virava NaN e a rodada era criada sem a duração escolhida.
    await expectRefused(
      call(sessions.POST, '/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ sessionDate: '2026-09-24', matchDurationSeconds: 'abc' }),
      }),
      /^matchDurationSeconds: /
    );
    await expectRefused(
      call(sessions.POST, '/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          sessionDate: '2026-09-24',
          teams: [{ name: 'Time A', players: [{ playerId: 'x' }] }],
        }),
      }),
      /^teams\[0\]\.players\[0\]\.playerId: /
    );
    await expectRefused(
      call(sessionTeams.PUT, `/api/sessions/${ID}/teams`, {
        method: 'PUT',
        params: { id: ID },
        body: JSON.stringify({ teams: [{ id: 'x', name: 'Time A', players: [] }] }),
      }),
      /^teams\[0\]\.id: /
    );
  });

  it('encerrar ou reabrir a rodada: id e status validados antes do banco', async () => {
    const patch = (id: string, body: unknown) =>
      call(session.PATCH, `/api/sessions/${id}`, {
        method: 'PATCH',
        params: { id },
        body: JSON.stringify(body),
      });
    await expectRefused(patch('abc', { status: 'finished' }), /rodada/);
    await expectRefused(patch(ID, { status: 'closed' }), /^status: /);
    await expectRefused(patch(ID, {}), /^status: /);
    const originalError = console.error;
    console.error = () => {};
    try {
      assert.equal((await patch(ID, { status: 'finished' })).status, 503);
    } finally {
      console.error = originalError;
    }
  });

  it('teams só aceita PUT: a escalação é regravada inteira', () => {
    assert.equal((sessionTeams as Record<string, unknown>).POST, undefined);
  });

  it('comandos de partida exigem Idempotency-Key e tipos corretos', async () => {
    const goal = (headers: Record<string, string>, input: Record<string, unknown>) =>
      call(goals.POST, `/api/matches/${ID}/goals`, {
        method: 'POST',
        params: { id: ID },
        headers,
        body: JSON.stringify(input),
      });
    // Sem a chave o servidor sorteava uma, e um reenvio gravava o gol duas vezes.
    await expectRefused(goal({}, { teamId: ID }), /^Idempotency-Key: /);
    await expectRefused(goal({ 'Idempotency-Key': 'abc' }, { teamId: ID }), /^Idempotency-Key: /);
    await expectRefused(goal({ 'Idempotency-Key': KEY }, { teamId: 'x' }), /^teamId: /);
    await expectRefused(
      goal({ 'Idempotency-Key': KEY }, { teamId: ID, eventTimeSeconds: -1 }),
      /^eventTimeSeconds: /
    );
    await expectRefused(
      goal({ 'Idempotency-Key': KEY }, { teamId: ID, isOwnGoal: 'sim' }),
      /^isOwnGoal: /
    );
    await expectRefused(
      goal({ 'Idempotency-Key': KEY }, { teamId: ID, loanPlayerIds: ['x'] }),
      /^loanPlayerIds\[0\]: /
    );
    await expectRefused(
      call(match.PATCH, `/api/matches/${ID}`, {
        method: 'PATCH',
        params: { id: ID },
        headers: { 'Idempotency-Key': KEY },
        body: JSON.stringify({ homeScore: -1 }),
      }),
      /^homeScore: /
    );
  });

  it('auth/status não pode ficar em cache: a resposta depende do cookie', async () => {
    const res = await call(authStatus.GET, '/api/auth/status');
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await res.json(), { isAuthenticated: false });
  });
});

describe('matchCommand', () => {
  const summary = { matchId: ID, sessionId: ID, status: 'ongoing' } as MatchSummary;
  const request = (body: unknown, method = 'POST') =>
    ({
      request: new Request('http://localhost/api/matches/' + ID + '/goals', {
        method,
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': KEY },
        body: JSON.stringify(body),
      }),
      params: { id: ID },
    }) as unknown as APIContext;

  it('repassa o input sem tirar chaves e devolve só { match, eventId }', async () => {
    let received: MatchCommand | undefined;
    const input = { teamId: ID, scorerId: null, scorerName: 'Fulano', eventTimeSeconds: 30 };
    const res = await matchCommand(request(input), 'goal', {
      async executeCommand(command) {
        received = command;
        return { match: summary, eventId: KEY };
      },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { match: summary, eventId: KEY });
    // O replay compara o input gravado com o novo: qualquer chave a menos daria CONFLICT.
    assert.deepEqual(received, { action: 'goal', operationId: KEY, matchId: ID, input });
  });

  it('falha desconhecida vira 503 com o texto de operação pendente', async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      const res = await matchCommand(request({ teamId: ID }), 'goal', {
        async executeCommand() {
          throw new Error('socket hang up');
        },
      });
      assert.equal(res.status, 503);
      assert.match((await res.json()).error, /pendente/);
    } finally {
      console.error = originalError;
    }
  });
});
