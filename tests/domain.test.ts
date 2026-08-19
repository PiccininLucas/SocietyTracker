import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Match, MATCH_RULES } from '../src/core/domain/entities/Match.ts';
import { Player } from '../src/core/domain/entities/Player.ts';
import { MatchAlreadyFinishedError } from '../src/core/domain/errors/MatchAlreadyFinishedError.ts';

describe('Player Domain Entity Rules', () => {
  it('should initialize player correctly and format fields', () => {
    const player = new Player({
      name: '  Lucas Silva  ',
      nickname: '  Lukitas  ',
      isGoalkeeper: false,
    });

    assert.equal(player.name, 'Lucas Silva');
    assert.equal(player.nickname, 'Lukitas');
    assert.equal(player.displayName, 'Lukitas');
    assert.equal(player.isGoalkeeper, false);
    assert.equal(player.isActive, true);
  });

  it('should throw error when name is empty upon instantiation', () => {
    assert.throws(
      () => new Player({ name: '   ' }),
      /Nome do jogador é obrigatório/
    );
  });

  it('should update info correctly with updateInfo method', () => {
    const player = new Player({
      name: 'Lucas Silva',
      nickname: 'Lukitas',
      isGoalkeeper: false,
    });

    player.updateInfo('Lucas Piccinin', 'Piccinin', true);

    assert.equal(player.name, 'Lucas Piccinin');
    assert.equal(player.nickname, 'Piccinin');
    assert.equal(player.displayName, 'Piccinin');
    assert.equal(player.isGoalkeeper, true);
  });

  it('should throw error when updating with empty name in updateInfo', () => {
    const player = new Player({
      name: 'Lucas Silva',
    });

    assert.throws(
      () => player.updateInfo('  '),
      /Nome do jogador é obrigatório/
    );
  });
});

describe('Match Domain Entity Rules', () => {
  it('should initialize match with 0-0 score and ongoing status', () => {
    const match = new Match({
      sessionId: 'session-1',
      homeTeamId: 'team-preto',
      awayTeamId: 'team-branco',
    });

    assert.equal(match.homeScore, 0);
    assert.equal(match.awayScore, 0);
    assert.equal(match.status, 'ongoing');
    assert.equal(match.isFinished, false);
    assert.equal(match.durationSeconds, 0);
    assert.equal(match.endReason, null);
  });

  it('should throw error when home and away teams are identical', () => {
    assert.throws(
      () =>
        new Match({
          sessionId: 'session-1',
          homeTeamId: 'team-preto',
          awayTeamId: 'team-preto',
        }),
      /O time mandante e visitante não podem ser o mesmo/
    );
  });

  it('should increment home score on goal registration', () => {
    const match = new Match({
      sessionId: 'session-1',
      homeTeamId: 'team-preto',
      awayTeamId: 'team-branco',
    });

    const result = match.registerGoal('team-preto', 120);

    assert.equal(match.homeScore, 1);
    assert.equal(match.awayScore, 0);
    assert.equal(result.finished, false);
    assert.equal(match.isFinished, false);
  });

  it('should automatically finish match when a team reaches 2 goals (Two-Goal Rule)', () => {
    const match = new Match({
      sessionId: 'session-1',
      homeTeamId: 'team-preto',
      awayTeamId: 'team-branco',
    });

    // 1st goal
    match.registerGoal('team-preto', 90);
    assert.equal(match.homeScore, 1);
    assert.equal(match.isFinished, false);

    // 2nd goal -> Victory!
    const result = match.registerGoal('team-preto', 180);
    assert.equal(match.homeScore, 2);
    assert.equal(result.finished, true);
    assert.equal(result.reason, 'two_goals');
    assert.equal(match.isFinished, true);
    assert.equal(match.endReason, 'two_goals');
    assert.ok(match.finishedAt);
  });

  it('should automatically finish match when away team reaches 2 goals', () => {
    const match = new Match({
      sessionId: 'session-1',
      homeTeamId: 'team-preto',
      awayTeamId: 'team-azul',
    });

    match.registerGoal('team-azul', 60);
    const result = match.registerGoal('team-azul', 150);

    assert.equal(match.awayScore, 2);
    assert.equal(result.finished, true);
    assert.equal(result.reason, 'two_goals');
    assert.equal(match.status, 'finished');
  });

  it('should automatically finish match when time limit (420s / 7min) is reached', () => {
    const match = new Match({
      sessionId: 'session-1',
      homeTeamId: 'team-preto',
      awayTeamId: 'team-branco',
    });

    match.updateDuration(420);

    assert.equal(match.isFinished, true);
    assert.equal(match.endReason, 'time_limit');
    assert.equal(match.durationSeconds, 420);
  });

  it('should trigger handleTimeExpired correctly', () => {
    const match = new Match({
      sessionId: 'session-1',
      homeTeamId: 'team-preto',
      awayTeamId: 'team-branco',
    });

    match.handleTimeExpired();

    assert.equal(match.isFinished, true);
    assert.equal(match.endReason, 'time_limit');
    assert.equal(match.durationSeconds, MATCH_RULES.MAX_DURATION_SECONDS);
  });

  it('should throw MatchAlreadyFinishedError if registering goal on finished match', () => {
    const match = new Match({
      sessionId: 'session-1',
      homeTeamId: 'team-preto',
      awayTeamId: 'team-branco',
    });

    match.registerGoal('team-preto', 100);
    match.registerGoal('team-preto', 200); // Finishes by 2 goals

    assert.throws(() => {
      match.registerGoal('team-branco', 210);
    }, MatchAlreadyFinishedError);
  });

  it('should throw error when goal is assigned to non-participating team', () => {
    const match = new Match({
      sessionId: 'session-1',
      homeTeamId: 'team-preto',
      awayTeamId: 'team-branco',
    });

    assert.throws(
      () => match.registerGoal('team-invalido', 50),
      /Time informado não pertence a esta partida/
    );
  });
});

import {
  RoundHighlightsService,
  type PlayerRoundStats,
} from '../src/core/domain/services/RoundHighlightsService.ts';

describe('RoundHighlightsService Pure Domain Rules', () => {
  it('should return empty highlights when stats list is empty', () => {
    const highlights = RoundHighlightsService.calculate([]);
    assert.deepEqual(highlights.topScorers, []);
    assert.deepEqual(highlights.topAssisters, []);
    assert.deepEqual(highlights.mvps, []);
    assert.deepEqual(highlights.bottomPlayers, []);
  });

  it('should accurately calculate topScorers, topAssisters, mvps and bottomPlayers excluding goalkeepers from bottomPlayers', () => {
    const stats: PlayerRoundStats[] = [
      { playerId: 'p-1', name: 'Neymar', isGoalkeeper: false, goals: 3, assists: 1, contributions: 4 },
      { playerId: 'p-2', name: 'Messi', isGoalkeeper: false, goals: 2, assists: 3, contributions: 5 },
      { playerId: 'p-3', name: 'Suarez', isGoalkeeper: false, goals: 1, assists: 0, contributions: 1 },
      { playerId: 'p-4', name: 'Casemiro', isGoalkeeper: false, goals: 0, assists: 0, contributions: 0 },
      { playerId: 'p-5', name: 'Alisson (Goleiro)', isGoalkeeper: true, goals: 0, assists: 0, contributions: 0 },
    ];

    const result = RoundHighlightsService.calculate(stats);

    // MVP: Messi (5 G+A)
    assert.deepEqual(result.mvps, ['Messi']);
    // Top Scorer: Neymar (3 goals)
    assert.deepEqual(result.topScorers, ['Neymar']);
    // Top Assister: Messi (3 assists)
    assert.deepEqual(result.topAssisters, ['Messi']);
    // Bottom Players ("Bola Murcha"): APENAS Casemiro (Alisson é goleiro e está imune)
    assert.deepEqual(result.bottomPlayers, ['Casemiro']);
  });

  it('should allow goalkeepers who score or assist to be MVP, top scorer and top assister', () => {
    const stats: PlayerRoundStats[] = [
      { playerId: 'p-1', name: 'Rogério Ceni (Goleiro)', isGoalkeeper: true, goals: 2, assists: 1, contributions: 3 },
      { playerId: 'p-2', name: 'Zagueiro', isGoalkeeper: false, goals: 0, assists: 0, contributions: 0 },
      { playerId: 'p-3', name: 'Goleiro B', isGoalkeeper: true, goals: 0, assists: 0, contributions: 0 },
    ];

    const result = RoundHighlightsService.calculate(stats);

    assert.deepEqual(result.mvps, ['Rogério Ceni (Goleiro)']);
    assert.deepEqual(result.topScorers, ['Rogério Ceni (Goleiro)']);
    assert.deepEqual(result.topAssisters, ['Rogério Ceni (Goleiro)']);
    assert.deepEqual(result.bottomPlayers, ['Zagueiro']);
  });

  it('should handle ties for top scorer, assister, and MVP', () => {
    const stats: PlayerRoundStats[] = [
      { playerId: 'p-1', name: 'Jogador A', isGoalkeeper: false, goals: 2, assists: 1, contributions: 3 },
      { playerId: 'p-2', name: 'Jogador B', isGoalkeeper: false, goals: 2, assists: 1, contributions: 3 },
      { playerId: 'p-3', name: 'Jogador C', isGoalkeeper: false, goals: 0, assists: 0, contributions: 0 },
    ];

    const result = RoundHighlightsService.calculate(stats);

    assert.deepEqual(result.topScorers, ['Jogador A', 'Jogador B']);
    assert.deepEqual(result.topAssisters, ['Jogador A', 'Jogador B']);
    assert.deepEqual(result.mvps, ['Jogador A', 'Jogador B']);
    assert.deepEqual(result.bottomPlayers, ['Jogador C']);
  });

  it('should not award MVP or top scorer if all players scored 0 and only list line players as bottomPlayers', () => {
    const stats: PlayerRoundStats[] = [
      { playerId: 'p-1', name: 'Jogador 1', isGoalkeeper: false, goals: 0, assists: 0, contributions: 0 },
      { playerId: 'p-2', name: 'Goleiro 1', isGoalkeeper: true, goals: 0, assists: 0, contributions: 0 },
      { playerId: 'p-3', name: 'Jogador 2', isGoalkeeper: false, goals: 0, assists: 0, contributions: 0 },
    ];

    const result = RoundHighlightsService.calculate(stats);

    assert.deepEqual(result.topScorers, []);
    assert.deepEqual(result.topAssisters, []);
    assert.deepEqual(result.mvps, []);
    assert.deepEqual(result.bottomPlayers, ['Jogador 1', 'Jogador 2']);
  });
});

