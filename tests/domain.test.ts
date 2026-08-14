import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Match, MATCH_RULES } from '../src/core/domain/entities/Match.ts';
import { MatchAlreadyFinishedError } from '../src/core/domain/errors/MatchAlreadyFinishedError.ts';

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
