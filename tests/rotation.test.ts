import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { waitingOrder } from '../src/components/live/MesarioSessionWrapper.tsx';
import type { LiveTeam } from '../src/components/live/types.ts';
import type { MatchSummary } from '../src/core/domain/repositories/IMatchRepository.ts';

const team = (id: string): LiveTeam => ({ id, name: id, colorHex: '#000', players: [] });
const A = team('A'),
  B = team('B'),
  C = team('C'),
  D = team('D');

const match = (seq: number, home: string, away: string): MatchSummary =>
  ({
    matchId: 'm' + seq,
    sequence: seq,
    homeTeamId: home,
    awayTeamId: away,
    status: 'finished',
  }) as unknown as MatchSummary;

describe('Fila de espera dos times', () => {
  it('põe na frente quem nunca jogou na rodada', () => {
    const order = waitingOrder([A, B, C, D], [match(1, 'A', 'B')]);
    assert.deepEqual(
      order
        .map((t) => t.id)
        .slice(0, 2)
        .sort(),
      ['C', 'D']
    );
  });

  it('ordena pelo tempo desde a última partida', () => {
    // A jogou na 1 e na 3; B na 1; C na 2; D na 2 e na 3.
    const matches = [match(1, 'A', 'B'), match(2, 'C', 'D'), match(3, 'A', 'D')];
    const order = waitingOrder([A, B, C, D], matches);
    assert.deepEqual(
      order.map((t) => t.id),
      ['B', 'C', 'A', 'D']
    );
  });

  it('deixa quem acabou de jogar no fim da fila', () => {
    const matches = [match(1, 'A', 'B'), match(2, 'C', 'D')];
    const order = waitingOrder([A, B, C, D], matches);
    assert.deepEqual(
      order
        .map((t) => t.id)
        .slice(-2)
        .sort(),
      ['C', 'D']
    );
  });

  it('ignora partidas em andamento — só conta o que terminou', () => {
    const ongoing = { ...match(2, 'C', 'D'), status: 'ongoing' } as MatchSummary;
    const order = waitingOrder([A, B, C, D], [match(1, 'A', 'B'), ongoing]);
    assert.deepEqual(
      order
        .map((t) => t.id)
        .slice(0, 2)
        .sort(),
      ['C', 'D']
    );
  });

  it('o adversário sugerido nunca é quem acabou de perder, havendo alguém esperando', () => {
    // A venceu B na partida 2; C e D jogaram na 1. Quem espera mais é C ou D, não B.
    const matches = [match(1, 'C', 'D'), match(2, 'A', 'B')];
    const queue = waitingOrder([A, B, C, D], matches);
    const proximo = queue.find((t) => t.id !== 'A');
    assert.notEqual(proximo?.id, 'B', 'o perdedor não pode furar a fila');
    assert.ok(['C', 'D'].includes(proximo!.id));
  });

  it('funciona com 3 times', () => {
    const order = waitingOrder([A, B, C], [match(1, 'A', 'B')]);
    assert.equal(order[0].id, 'C');
  });
});
