import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertValidRoundFormat, ROUND_RULES } from '../src/core/domain/entities/Session.ts';

const team = (name: string, n: number, offset = 0) => ({
  name,
  playerIds: Array.from({ length: n }, (_, i) => `p${offset + i}`),
});

describe('Formato da rodada', () => {
  it('aceita a rodada cheia: 4 times de 6 = 24 jogadores', () => {
    assert.doesNotThrow(() =>
      assertValidRoundFormat([team('A', 6, 0), team('B', 6, 6), team('C', 6, 12), team('D', 6, 18)])
    );
  });

  it('aceita 3 times de 6', () => {
    assert.doesNotThrow(() =>
      assertValidRoundFormat([team('A', 6, 0), team('B', 6, 6), team('C', 6, 12)])
    );
  });

  it('aceita time incompleto — 6 é teto, não obrigação', () => {
    assert.doesNotThrow(() =>
      assertValidRoundFormat([team('A', 6, 0), team('B', 5, 6), team('C', 4, 12)])
    );
  });

  it('recusa 7 jogadores num time', () => {
    assert.throws(
      () => assertValidRoundFormat([team('A', 7, 0), team('B', 6, 7), team('C', 6, 13)]),
      /no máximo 6 jogadores.*A \(7\)/s
    );
  });

  it('recusa mais de 24 jogadores na rodada', () => {
    // 4 times de 6 já é o teto; um 5º time estouraria tanto o número de times quanto o total.
    assert.throws(
      () =>
        assertValidRoundFormat([
          team('A', 6, 0),
          team('B', 6, 6),
          team('C', 6, 12),
          team('D', 6, 18),
          team('E', 6, 24),
        ]),
      /3 ou 4 times/
    );
  });

  it('recusa menos de 3 ou mais de 4 times', () => {
    assert.throws(() => assertValidRoundFormat([team('A', 6, 0), team('B', 6, 6)]), /3 ou 4 times/);
    assert.throws(() => assertValidRoundFormat([]), /3 ou 4 times/);
    assert.throws(() => assertValidRoundFormat(undefined), /3 ou 4 times/);
  });

  it('recusa time vazio — era o buraco que deixava salvar 8/0/0/0', () => {
    assert.throws(
      () =>
        assertValidRoundFormat([team('A', 6, 0), team('B', 2, 6), { name: 'C', playerIds: [] }]),
      /pelo menos um jogador.*C/s
    );
  });

  it('recusa o mesmo jogador em dois times', () => {
    assert.throws(
      () =>
        assertValidRoundFormat([
          { name: 'A', playerIds: ['x', 'y'] },
          { name: 'B', playerIds: ['x', 'z'] },
          { name: 'C', playerIds: ['w'] },
        ]),
      /não pode estar em dois times/
    );
  });

  it('aceita jogadores na forma de objeto, como os DTOs de edição enviam', () => {
    assert.doesNotThrow(() =>
      assertValidRoundFormat([
        { name: 'A', players: [{ playerId: 'a1' }, { playerId: 'a2' }] },
        { name: 'B', players: [{ playerId: 'b1' }] },
        { name: 'C', players: [{ playerId: 'c1' }] },
      ])
    );
  });

  it('expõe os limites como fonte única', () => {
    assert.equal(ROUND_RULES.MAX_PLAYERS_PER_TEAM, 6);
    assert.equal(ROUND_RULES.MAX_PLAYERS_PER_ROUND, 24);
    assert.equal(ROUND_RULES.MIN_TEAMS, 3);
    assert.equal(ROUND_RULES.MAX_TEAMS, 4);
    assert.equal(
      ROUND_RULES.MAX_TEAMS * ROUND_RULES.MAX_PLAYERS_PER_TEAM,
      ROUND_RULES.MAX_PLAYERS_PER_ROUND
    );
  });
});
