import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEAM_TEMPLATES,
  addPlayer,
  canAddPlayer,
  defaultTeamName,
  isAutoName,
  movePlayer,
  removePlayer,
  saveProblems,
  toggleCaptain,
  toggleGoalkeeper,
  updatePlayer,
  type RulePlayer,
  type RuleTeam,
} from '../src/components/live/teamRules.ts';

const PRETO = '#1f2937';
const BRANCO = '#e5e7eb';
const AZUL = '#3b82f6';

const player = (id: string, nickname: string | null = null): RulePlayer => ({
  id,
  name: 'Jogador ' + id,
  nickname,
});
const squad = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => player(prefix + i));

function team(id: string, colorHex: string, players = squad(id, 0), extra = {}): RuleTeam {
  return {
    id,
    colorHex,
    name: defaultTeamName(colorHex) ?? 'Sem cor',
    captainId: null,
    players,
    ...extra,
  };
}

describe('defaultTeamName', () => {
  it('names the team by its vest color, ignoring case', () => {
    assert.equal(defaultTeamName(PRETO), 'Time Preto');
    assert.equal(defaultTeamName('#E5E7EB'), 'Time Branco');
    assert.equal(defaultTeamName('#10b981'), undefined);
    assert.deepEqual(
      TEAM_TEMPLATES.map((t) => t.colorName),
      ['Preto', 'Branco', 'Azul', 'Vermelho']
    );
  });
});

describe('canAddPlayer', () => {
  it('refuses the 7th player of a team', () => {
    const teams = [team('a', PRETO, squad('a', 6)), team('b', BRANCO)];
    assert.equal(
      canAddPlayer(teams, 'a', 'novo'),
      'Time Preto já está completo com 6 jogadores. Tire alguém antes de adicionar outro.'
    );
    assert.equal(canAddPlayer(teams, 'b', 'novo'), null);
  });

  it('refuses the 25th player of the round, but not a move between teams', () => {
    const teams = [
      team('a', PRETO, squad('a', 6)),
      team('b', BRANCO, squad('b', 6)),
      team('c', AZUL, squad('c', 6)),
      team('d', '#ef4444', squad('d', 5)),
      team('e', '#10b981', squad('e', 1)),
    ];
    assert.equal(canAddPlayer(teams, 'd', 'novo'), 'A rodada já tem os 24 jogadores do limite.');
    assert.equal(canAddPlayer(teams, 'd', 'e0'), null);
  });

  it('has nothing to refuse for a player already in the target team', () => {
    const teams = [team('a', PRETO, squad('a', 6))];
    assert.equal(canAddPlayer(teams, 'a', 'a0'), null);
  });
});

describe('addPlayer, removePlayer and movePlayer', () => {
  it('adds only players who are not in any team yet', () => {
    const teams = [team('a', PRETO, [player('x')]), team('b', BRANCO)];
    assert.equal(addPlayer(teams, 'b', player('x')), teams);
    const next = addPlayer(teams, 'b', player('y'));
    assert.deepEqual(
      next[1].players.map((p) => [p.id, p.isGoalkeeper]),
      [['y', false]]
    );
  });

  it('moves a player and keeps the goalkeeper flag', () => {
    const teams = [
      team('a', PRETO, [{ ...player('x'), isGoalkeeper: true }, player('y')]),
      team('b', BRANCO),
    ];
    const next = movePlayer(teams, 'x', 'b');
    assert.deepEqual(
      next.map((t) => t.players.map((p) => p.id)),
      [['y'], ['x']]
    );
    assert.equal(next[1].players[0].isGoalkeeper, true);
    assert.equal(movePlayer(teams, 'x', 'a'), teams);
    assert.equal(movePlayer(teams, 'x', 'nenhum'), teams);
  });

  it('removes a player from whichever team has them', () => {
    const teams = [team('a', PRETO, [player('x')]), team('b', BRANCO, [player('y')])];
    const next = removePlayer(teams, 'y');
    assert.deepEqual(
      next.map((t) => t.players.length),
      [1, 0]
    );
    assert.equal(next[0], teams[0]);
  });
});

describe('captain and team name', () => {
  const withCaptain = () =>
    toggleCaptain([team('a', PRETO, [player('x', 'Xande'), player('y')])], 'a', 'x');

  it('names the team after the captain while the name is automatic', () => {
    const [t] = withCaptain();
    assert.equal(t.captainId, 'x');
    assert.equal(t.name, 'Time Xande');
    assert.equal(isAutoName(t), true);
    // Trocar de capitão com o nome automático troca o nome junto.
    assert.equal(toggleCaptain([t], 'a', 'y')[0].name, 'Time Jogador y');
  });

  it('goes back to the vest color when the captain is unmarked, removed or moved', () => {
    const teams = [...withCaptain(), team('b', BRANCO)];
    for (const next of [
      toggleCaptain(teams, 'a', 'x'),
      removePlayer(teams, 'x'),
      movePlayer(teams, 'x', 'b'),
    ]) {
      assert.equal(next[0].captainId, null);
      assert.equal(next[0].name, 'Time Preto');
    }
    // Quem chega a outro time chega sem a braçadeira.
    assert.equal(movePlayer(teams, 'x', 'b')[1].captainId, null);
  });

  it('keeps a hand-typed name when the captain leaves or a new one is marked', () => {
    const [t] = withCaptain();
    const typed = [{ ...t, name: 'Galácticos' }, team('b', BRANCO)];
    assert.equal(isAutoName(typed[0]), false);
    assert.equal(toggleCaptain(typed, 'a', 'x')[0].name, 'Galácticos');
    assert.equal(removePlayer(typed, 'x')[0].name, 'Galácticos');
    assert.equal(movePlayer(typed, 'x', 'b')[0].name, 'Galácticos');
    assert.equal(toggleCaptain(typed, 'a', 'y')[0].name, 'Galácticos');
  });

  it('keeps the name of a team whose color is not a vest', () => {
    const teams = toggleCaptain([team('a', '#10b981', [player('x')])], 'a', 'x');
    assert.equal(teams[0].name, 'Sem cor');
    const named = [{ ...teams[0], name: 'Time Jogador x' }];
    assert.equal(removePlayer(named, 'x')[0].name, 'Time Jogador x');
  });

  it('follows the captain renamed in the registry, but not a hand-typed name', () => {
    const teams = withCaptain();
    const renamed = updatePlayer(teams, { id: 'x', name: 'Alexandre', nickname: 'Xandão' });
    assert.equal(renamed[0].name, 'Time Xandão');
    assert.equal(renamed[0].players[0].nickname, 'Xandão');

    const typed = [{ ...teams[0], name: 'Galácticos' }];
    assert.equal(updatePlayer(typed, { id: 'x', name: 'Alexandre' })[0].name, 'Galácticos');
  });

  it('toggles the goalkeeper of one player only', () => {
    const teams = [team('a', PRETO, [player('x'), player('y')])];
    const next = toggleGoalkeeper(teams, 'a', 'y');
    assert.deepEqual(
      next[0].players.map((p) => !!p.isGoalkeeper),
      [false, true]
    );
  });
});

describe('saveProblems', () => {
  it('lists what blocks the save, in order', () => {
    const teams = [
      team('a', PRETO, squad('a', 7), { captainId: 'a0', name: '  ' }),
      team('b', BRANCO, [], {}),
      team('c', AZUL, squad('c', 2)),
    ];
    assert.deepEqual(saveProblems(teams), [
      'Todos os times devem ter um nome válido.',
      'Todo time precisa de pelo menos um jogador. Sem ninguém: Time Branco.',
      'Cada time pode ter no máximo 6 jogadores. Acima do limite: Time Preto (7).',
      'Defina um capitão para cada time antes de salvar. Sem capitão: Time Branco, Time Azul.',
    ]);
  });

  it('counts the round limit by distinct players', () => {
    const teams = ['a', 'b', 'c', 'd', 'e'].map((id) =>
      team(id, PRETO, squad(id, 5), { captainId: id + '0', name: 'Time ' + id })
    );
    assert.deepEqual(saveProblems(teams), [
      'A rodada comporta no máximo 24 jogadores (escalados: 25).',
    ]);
  });

  it('refuses a captain who is no longer in the team', () => {
    const teams = [team('a', PRETO, [player('x')], { captainId: 'saiu' })];
    assert.deepEqual(saveProblems(teams), [
      'Defina um capitão para cada time antes de salvar. Sem capitão: Time Preto.',
    ]);
  });

  it('has nothing to say about a valid round', () => {
    const teams = toggleCaptain(
      toggleCaptain([team('a', PRETO, [player('x')]), team('b', BRANCO, [player('y')])], 'a', 'x'),
      'b',
      'y'
    );
    assert.deepEqual(saveProblems(teams), []);
  });
});
