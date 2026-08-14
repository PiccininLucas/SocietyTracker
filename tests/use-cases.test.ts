import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RegisterGoalUseCase } from '../src/core/application/use-cases/RegisterGoalUseCase.ts';
import { StartMatchUseCase } from '../src/core/application/use-cases/StartMatchUseCase.ts';
import { FinishMatchUseCase } from '../src/core/application/use-cases/FinishMatchUseCase.ts';
import { TransferPlayerUseCase } from '../src/core/application/use-cases/TransferPlayerUseCase.ts';
import { Match } from '../src/core/domain/entities/Match.ts';
import { MatchEvent } from '../src/core/domain/entities/MatchEvent.ts';
import type { IMatchRepository, MatchSummary, LeaderboardItem } from '../src/core/domain/repositories/IMatchRepository.ts';
import type { ISessionRepository, CreateSessionTeamInput } from '../src/core/domain/repositories/ISessionRepository.ts';
import type { Session } from '../src/core/domain/entities/Session.ts';
import type { Team } from '../src/core/domain/entities/Team.ts';

// In-Memory Mock Repository for Testing
class MockMatchRepository implements IMatchRepository {
  public matches: Map<string, Match> = new Map();
  public events: MatchEvent[] = [];

  async findById(id: string): Promise<Match | null> {
    return this.matches.get(id) || null;
  }

  async findBySessionId(sessionId: string): Promise<Match[]> {
    return Array.from(this.matches.values()).filter((m) => m.sessionId === sessionId);
  }

  async findActiveMatch(sessionId: string): Promise<Match | null> {
    for (const match of this.matches.values()) {
      if (match.sessionId === sessionId && !match.isFinished) {
        return match;
      }
    }
    return null;
  }

  async create(match: Match): Promise<Match> {
    const id = match.id || `m-${Date.now()}`;
    const savedMatch = new Match({ ...match.state, id });
    this.matches.set(id, savedMatch);
    return savedMatch;
  }

  async update(match: Match): Promise<Match> {
    const id = match.id || `m-${Date.now()}`;
    this.matches.set(id, match);
    return match;
  }

  async addEvent(event: MatchEvent): Promise<MatchEvent> {
    this.events.push(event);
    return event;
  }

  async getEventsByMatchId(matchId: string): Promise<MatchEvent[]> {
    return this.events.filter((e) => e.matchId === matchId);
  }

  async getMatchesSummary(_sessionId?: string): Promise<MatchSummary[]> {
    return [];
  }

  async getLeaderboard(): Promise<LeaderboardItem[]> {
    return [];
  }
}

class MockSessionRepository implements ISessionRepository {
  public transferred: any[] = [];

  async findById(_id: string): Promise<Session | null> {
    return null;
  }
  async findLatest(): Promise<Session | null> {
    return null;
  }
  async findByDate(_date: string): Promise<Session | null> {
    return null;
  }
  async create(session: Session, _teams?: CreateSessionTeamInput[]): Promise<Session> {
    return session;
  }
  async updateStatus(_id: string, _status: any): Promise<void> {}
  async getTeamsBySessionId(_sessionId: string): Promise<Team[]> {
    return [];
  }
  async addPlayerToTeam(_teamId: string, _playerId: string, _isLoaned?: boolean): Promise<void> {}
  async removePlayerFromTeam(_teamId: string, _playerId: string): Promise<void> {}
  async transferPlayer(
    fromTeamId: string,
    toTeamId: string,
    playerId: string,
    isLoaned?: boolean
  ): Promise<void> {
    this.transferred.push({ fromTeamId, toTeamId, playerId, isLoaned });
  }
}

describe('Use Cases Business Logic', () => {
  describe('StartMatchUseCase', () => {
    it('should create and save a new match between two teams', async () => {
      const matchRepo = new MockMatchRepository();
      const useCase = new StartMatchUseCase(matchRepo);

      const result = await useCase.execute({
        sessionId: 'session-1',
        homeTeamId: 'team-preto',
        awayTeamId: 'team-branco',
      });

      assert.ok(result.id);
      assert.equal(result.homeScore, 0);
      assert.equal(result.awayScore, 0);
      assert.equal(result.status, 'ongoing');
    });

    it('should throw error when starting match with identical teams', async () => {
      const matchRepo = new MockMatchRepository();
      const useCase = new StartMatchUseCase(matchRepo);

      await assert.rejects(
        () =>
          useCase.execute({
            sessionId: 'session-1',
            homeTeamId: 'team-preto',
            awayTeamId: 'team-preto',
          }),
        /Os dois times selecionados devem ser diferentes/
      );
    });
  });

  describe('RegisterGoalUseCase', () => {
    it('should record a goal event and update score', async () => {
      const matchRepo = new MockMatchRepository();
      const initialMatch = await matchRepo.create(
        new Match({
          id: 'm-1',
          sessionId: 's-1',
          homeTeamId: 'team-preto',
          awayTeamId: 'team-branco',
        })
      );

      const useCase = new RegisterGoalUseCase(matchRepo);
      const result = await useCase.execute({
        matchId: 'm-1',
        teamId: 'team-preto',
        scorerId: 'p-1',
        assistId: 'p-2',
        eventTimeSeconds: 120,
      });

      assert.equal(result.match.homeScore, 1);
      assert.equal(result.match.awayScore, 0);
      assert.equal(result.isMatchFinished, false);
      assert.equal(matchRepo.events.length, 1);
      assert.equal(matchRepo.events[0].scorerId, 'p-1');
      assert.equal(matchRepo.events[0].assistId, 'p-2');
    });

    it('should end match on 2nd goal via Use Case', async () => {
      const matchRepo = new MockMatchRepository();
      await matchRepo.create(
        new Match({
          id: 'm-1',
          sessionId: 's-1',
          homeTeamId: 'team-preto',
          awayTeamId: 'team-branco',
        })
      );

      const useCase = new RegisterGoalUseCase(matchRepo);
      await useCase.execute({
        matchId: 'm-1',
        teamId: 'team-preto',
        scorerId: 'p-1',
        eventTimeSeconds: 60,
      });

      const secondGoalResult = await useCase.execute({
        matchId: 'm-1',
        teamId: 'team-preto',
        scorerId: 'p-3',
        eventTimeSeconds: 150,
      });

      assert.equal(secondGoalResult.match.homeScore, 2);
      assert.equal(secondGoalResult.isMatchFinished, true);
      assert.equal(secondGoalResult.matchEndReason, 'two_goals');
    });
  });

  describe('FinishMatchUseCase', () => {
    it('should manually finish an ongoing match', async () => {
      const matchRepo = new MockMatchRepository();
      await matchRepo.create(
        new Match({
          id: 'm-1',
          sessionId: 's-1',
          homeTeamId: 'team-preto',
          awayTeamId: 'team-branco',
        })
      );

      const useCase = new FinishMatchUseCase(matchRepo);
      const finished = await useCase.execute({
        matchId: 'm-1',
        reason: 'time_limit',
        durationSeconds: 420,
      });

      assert.equal(finished.status, 'finished');
      assert.equal(finished.endReason, 'time_limit');
      assert.equal(finished.durationSeconds, 420);
    });
  });

  describe('TransferPlayerUseCase', () => {
    it('should delegate transfer to session repository', async () => {
      const sessionRepo = new MockSessionRepository();
      const useCase = new TransferPlayerUseCase(sessionRepo);

      const result = await useCase.execute({
        fromTeamId: 'team-preto',
        toTeamId: 'team-branco',
        playerId: 'p-1',
        isLoaned: true,
      });

      assert.equal(result.success, true);
      assert.equal(sessionRepo.transferred.length, 1);
      assert.equal(sessionRepo.transferred[0].playerId, 'p-1');
      assert.equal(sessionRepo.transferred[0].isLoaned, true);
    });
  });
});
