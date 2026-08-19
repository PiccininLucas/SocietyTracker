import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RegisterGoalUseCase } from '../src/core/application/use-cases/RegisterGoalUseCase.ts';
import { StartMatchUseCase } from '../src/core/application/use-cases/StartMatchUseCase.ts';
import { FinishMatchUseCase } from '../src/core/application/use-cases/FinishMatchUseCase.ts';
import { TransferPlayerUseCase } from '../src/core/application/use-cases/TransferPlayerUseCase.ts';
import { GetRoundHighlightsUseCase } from '../src/core/application/use-cases/GetRoundHighlightsUseCase.ts';
import { GetPeriodLeaderboardUseCase } from '../src/core/application/use-cases/GetPeriodLeaderboardUseCase.ts';
import { UpdatePlayerUseCase } from '../src/core/application/use-cases/UpdatePlayerUseCase.ts';
import { CreateSessionUseCase } from '../src/core/application/use-cases/CreateSessionUseCase.ts';
import { Match } from '../src/core/domain/entities/Match.ts';
import { MatchEvent } from '../src/core/domain/entities/MatchEvent.ts';
import { Player } from '../src/core/domain/entities/Player.ts';
import type { IMatchRepository, MatchSummary, LeaderboardItem } from '../src/core/domain/repositories/IMatchRepository.ts';
import type { ISessionRepository, CreateSessionTeamInput } from '../src/core/domain/repositories/ISessionRepository.ts';
import type { IPlayerRepository } from '../src/core/domain/repositories/IPlayerRepository.ts';
import { Session } from '../src/core/domain/entities/Session.ts';
import { Team } from '../src/core/domain/entities/Team.ts';

// In-Memory Mock Repositories for Testing
class MockPlayerRepository implements IPlayerRepository {
  public players: Map<string, Player> = new Map();

  async findAll(activeOnly?: boolean): Promise<Player[]> {
    const list = Array.from(this.players.values());
    if (activeOnly) return list.filter((p) => p.isActive);
    return list;
  }

  async findById(id: string): Promise<Player | null> {
    return this.players.get(id) || null;
  }

  async create(player: Player): Promise<Player> {
    const id = player.id || `p-${Date.now()}`;
    const saved = new Player({ ...player.state, id });
    this.players.set(id, saved);
    return saved;
  }

  async update(player: Player): Promise<Player> {
    if (!player.id) throw new Error('ID is required');
    this.players.set(player.id, player);
    return player;
  }
}
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

  async getLeaderboardByDateRange(
    _startDate?: string,
    _endDate?: string
  ): Promise<LeaderboardItem[]> {
    return [
      {
        playerId: 'p-1',
        name: 'Craque Silva',
        nickname: 'Silva',
        avatarUrl: null,
        totalGoals: 5,
        totalAssists: 3,
        totalContributions: 8,
        totalSessionsPlayed: 2,
      },
      {
        playerId: 'p-2',
        name: 'Goleador Souza',
        nickname: null,
        avatarUrl: null,
        totalGoals: 6,
        totalAssists: 0,
        totalContributions: 6,
        totalSessionsPlayed: 2,
      },
      {
        playerId: 'p-3',
        name: 'Garcom Santos',
        nickname: null,
        avatarUrl: null,
        totalGoals: 1,
        totalAssists: 6,
        totalContributions: 7,
        totalSessionsPlayed: 2,
      },
    ];
  }
}

class MockSessionRepository implements ISessionRepository {
  public sessions: Session[] = [];
  public transferred: any[] = [];

  async findAll(): Promise<Session[]> {
    return this.sessions;
  }
  async findById(id: string): Promise<Session | null> {
    return this.sessions.find((s) => s.id === id) || null;
  }
  async findLatest(): Promise<Session | null> {
    return this.sessions.length > 0 ? this.sessions[this.sessions.length - 1] : null;
  }
  async findByDate(date: string): Promise<Session | null> {
    return this.sessions.find((s) => s.sessionDate === date) || null;
  }
  async create(session: Session, teams?: CreateSessionTeamInput[]): Promise<Session> {
    const id = session.id || `session-${Date.now()}`;
    const createdTeams: Team[] = (teams || []).map((t, idx) => {
      const team = new Team({
        id: `team-${idx + 1}`,
        sessionId: id,
        name: t.name,
        colorHex: t.colorHex || '#333333',
      });
      if (t.players) {
        for (const p of t.players) {
          if (typeof p === 'string') {
            team.addPlayer(p, false, false);
          } else {
            team.addPlayer(p.playerId, p.isLoaned, p.isGoalkeeper);
          }
        }
      } else if (t.playerIds) {
        for (const pid of t.playerIds) {
          team.addPlayer(pid, false, false);
        }
      }
      return team;
    });

    const saved = new Session({
      id,
      sessionDate: session.sessionDate,
      status: session.status,
      notes: session.notes,
      matchDurationSeconds: session.matchDurationSeconds,
      teams: createdTeams,
    });
    this.sessions.push(saved);
    return saved;
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

  describe('GetRoundHighlightsUseCase', () => {
    it('should aggregate round stats, compute highlights and order ranked players', async () => {
      const matchRepo = new MockMatchRepository();
      const sessionRepo = new MockSessionRepository();

      const teamPreto = new Team({
        id: 't-preto',
        sessionId: 's-1',
        name: 'Preto',
        colorHex: '#000000',
        players: [
          { playerId: 'p-1', isGoalkeeper: false, player: { name: 'Artilheiro Silva', nickname: null, avatarUrl: null } },
          { playerId: 'p-2', isGoalkeeper: false, player: { name: 'Garcom Santos', nickname: null, avatarUrl: null } },
          { playerId: 'p-5', isGoalkeeper: true, player: { name: 'Goleiro Preto', nickname: null, avatarUrl: null } },
        ],
      });

      const teamBranco = new Team({
        id: 't-branco',
        sessionId: 's-1',
        name: 'Branco',
        colorHex: '#FFFFFF',
        players: [
          { playerId: 'p-3', isGoalkeeper: false, player: { name: 'Craque Lima', nickname: null, avatarUrl: null } },
          { playerId: 'p-4', isGoalkeeper: false, player: { name: 'Bola Murcha Costa', nickname: null, avatarUrl: null } },
          { playerId: 'p-6', isGoalkeeper: true, player: { name: 'Goleiro Branco', nickname: null, avatarUrl: null } },
        ],
      });

      const session = new Session({
        id: 's-1',
        sessionDate: '2026-08-13',
        status: 'finished',
        teams: [teamPreto, teamBranco],
      });

      sessionRepo.sessions.push(session);

      const match1 = await matchRepo.create(
        new Match({
          id: 'm-1',
          sessionId: 's-1',
          homeTeamId: 't-preto',
          awayTeamId: 't-branco',
          homeScore: 2,
          awayScore: 1,
        })
      );

      // Event 1: p-1 scores, p-2 assists
      await matchRepo.addEvent(
        new MatchEvent({
          matchId: 'm-1',
          teamId: 't-preto',
          scorerId: 'p-1',
          assistId: 'p-2',
          eventTimeSeconds: 60,
        })
      );

      // Event 2: p-1 scores (no assist)
      await matchRepo.addEvent(
        new MatchEvent({
          matchId: 'm-1',
          teamId: 't-preto',
          scorerId: 'p-1',
          assistId: null,
          eventTimeSeconds: 120,
        })
      );

      // Event 3: p-3 scores (no assist)
      await matchRepo.addEvent(
        new MatchEvent({
          matchId: 'm-1',
          teamId: 't-branco',
          scorerId: 'p-3',
          assistId: null,
          eventTimeSeconds: 180,
        })
      );

      const useCase = new GetRoundHighlightsUseCase(sessionRepo, matchRepo);
      const result = await useCase.execute({ sessionId: 's-1' });

      assert.ok(result);
      assert.equal(result.sessionId, 's-1');
      assert.equal(result.totalGoals, 3);
      assert.equal(result.totalMatches, 1);

      // Highlights
      assert.deepEqual(result.highlights.topScorers, ['Artilheiro Silva']); // 2 goals
      assert.deepEqual(result.highlights.topAssisters, ['Garcom Santos']); // 1 assist
      assert.deepEqual(result.highlights.mvps, ['Artilheiro Silva']); // 2 G+A
      // Bottom players: apenas Bola Murcha Costa (Goleiros p-5 e p-6 têm 0G/0A mas estão imunes)
      assert.deepEqual(result.highlights.bottomPlayers, ['Bola Murcha Costa']);

      // Players table ordering and fields
      assert.equal(result.players.length, 6);
      assert.equal(result.players[0].name, 'Artilheiro Silva');
      assert.equal(result.players[0].rank, 1);
      assert.equal(result.players.find((p) => p.playerId === 'p-5')?.isGoalkeeper, true);
      assert.equal(result.players.find((p) => p.playerId === 'p-1')?.isGoalkeeper, false);
    });
  });

  describe('GetPeriodLeaderboardUseCase', () => {
    it('should correctly format and rank 3 tables for monthly period', async () => {
      const matchRepo = new MockMatchRepository();
      const useCase = new GetPeriodLeaderboardUseCase(matchRepo);

      const result = await useCase.execute({
        type: 'month',
        yearMonth: '2026-08',
      });

      assert.equal(result.periodType, 'month');
      assert.equal(result.periodLabel, 'Agosto/2026');
      assert.equal(result.totalPlayers, 3);

      // Table 1: Craque G+A
      assert.equal(result.byContributions[0].name, 'Craque Silva');
      assert.equal(result.byContributions[0].value, 8);
      assert.equal(result.byContributions[0].rank, 1);

      // Table 2: Artilheiro Gols
      assert.equal(result.byGoals[0].name, 'Goleador Souza');
      assert.equal(result.byGoals[0].value, 6);
      assert.equal(result.byGoals[0].rank, 1);

      // Table 3: Garçom Assists
      assert.equal(result.byAssists[0].name, 'Garcom Santos');
      assert.equal(result.byAssists[0].value, 6);
      assert.equal(result.byAssists[0].rank, 1);
    });
  });

  describe('UpdatePlayerUseCase', () => {
    it('should successfully update player name, nickname and goalkeeper status', async () => {
      const playerRepo = new MockPlayerRepository();
      const existing = new Player({
        id: 'p-1',
        name: 'Carlos Alberto',
        nickname: 'Carlinhos',
        isGoalkeeper: false,
      });
      await playerRepo.create(existing);

      const useCase = new UpdatePlayerUseCase(playerRepo);
      const result = await useCase.execute({
        id: 'p-1',
        name: 'Carlos Alberto Santos',
        nickname: 'Capita',
        isGoalkeeper: true,
      });

      assert.equal(result.id, 'p-1');
      assert.equal(result.name, 'Carlos Alberto Santos');
      assert.equal(result.nickname, 'Capita');
      assert.equal(result.isGoalkeeper, true);

      const fromDb = await playerRepo.findById('p-1');
      assert.equal(fromDb?.name, 'Carlos Alberto Santos');
      assert.equal(fromDb?.nickname, 'Capita');
      assert.equal(fromDb?.isGoalkeeper, true);
    });

    it('should throw error when updating non-existent player', async () => {
      const playerRepo = new MockPlayerRepository();
      const useCase = new UpdatePlayerUseCase(playerRepo);

      await assert.rejects(
        () =>
          useCase.execute({
            id: 'non-existent-id',
            name: 'Qualquer Nome',
          }),
        /Jogador com ID non-existent-id não encontrado/
      );
    });

    it('should throw error when name is empty', async () => {
      const playerRepo = new MockPlayerRepository();
      const useCase = new UpdatePlayerUseCase(playerRepo);

      await assert.rejects(
        () =>
          useCase.execute({
            id: 'p-1',
            name: '   ',
          }),
        /Nome do jogador é obrigatório/
      );
    });
  });

  describe('CreateSessionUseCase (Flexible Format & Custom Duration)', () => {
    it('should create session with 3 teams and 8 min (480s) match duration', async () => {
      const sessionRepo = new MockSessionRepository();
      const useCase = new CreateSessionUseCase(sessionRepo);

      const result = await useCase.execute({
        sessionDate: '2026-08-20',
        matchDurationSeconds: 480,
        notes: 'Rodada com 3 times e 8 min',
        teams: [
          { name: 'Time Preto', colorHex: '#1f2937', playerIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'] },
          { name: 'Time Branco', colorHex: '#e5e7eb', playerIds: ['p8', 'p9', 'p10', 'p11', 'p12', 'p13'] },
          { name: 'Time Azul', colorHex: '#3b82f6', playerIds: ['p14', 'p15', 'p16', 'p17', 'p18', 'p19'] },
        ],
      });

      assert.ok(result.id);
      assert.equal(result.sessionDate, '2026-08-20');
      assert.equal(result.matchDurationSeconds, 480);
      assert.equal(result.teams.length, 3);
      assert.equal(result.teams[0].playersCount, 7);
      assert.equal(result.teams[1].playersCount, 6);
      assert.equal(result.teams[2].playersCount, 6);
    });

    it('should create session with 4 teams and 7 min (420s) default duration', async () => {
      const sessionRepo = new MockSessionRepository();
      const useCase = new CreateSessionUseCase(sessionRepo);

      const result = await useCase.execute({
        sessionDate: '2026-08-27',
        matchDurationSeconds: 420,
        teams: [
          { name: 'Time Preto', playerIds: ['p1', 'p2', 'p3', 'p4', 'p5'] },
          { name: 'Time Branco', playerIds: ['p6', 'p7', 'p8', 'p9', 'p10'] },
          { name: 'Time Azul', playerIds: ['p11', 'p12', 'p13', 'p14', 'p15'] },
          { name: 'Time Vermelho', playerIds: ['p16', 'p17', 'p18', 'p19', 'p20'] },
        ],
      });

      assert.ok(result.id);
      assert.equal(result.matchDurationSeconds, 420);
      assert.equal(result.teams.length, 4);
    });
  });
});

