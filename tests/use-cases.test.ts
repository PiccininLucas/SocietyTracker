import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RegisterGoalUseCase } from '../src/core/application/use-cases/RegisterGoalUseCase.ts';
import { UpdateMatchEventUseCase } from '../src/core/application/use-cases/UpdateMatchEventUseCase.ts';
import { DeleteMatchEventUseCase } from '../src/core/application/use-cases/DeleteMatchEventUseCase.ts';
import { UpdateMatchScoreUseCase } from '../src/core/application/use-cases/UpdateMatchScoreUseCase.ts';
import { StartMatchUseCase } from '../src/core/application/use-cases/StartMatchUseCase.ts';
import { FinishMatchUseCase } from '../src/core/application/use-cases/FinishMatchUseCase.ts';
import { TransferPlayerUseCase } from '../src/core/application/use-cases/TransferPlayerUseCase.ts';
import { GetRoundHighlightsUseCase } from '../src/core/application/use-cases/GetRoundHighlightsUseCase.ts';
import { GetPeriodLeaderboardUseCase } from '../src/core/application/use-cases/GetPeriodLeaderboardUseCase.ts';
import { GetLeaderboardUseCase } from '../src/core/application/use-cases/GetLeaderboardUseCase.ts';
import { UpdatePlayerUseCase } from '../src/core/application/use-cases/UpdatePlayerUseCase.ts';
import { CreateSessionUseCase } from '../src/core/application/use-cases/CreateSessionUseCase.ts';
import { UpdateSessionTeamsUseCase } from '../src/core/application/use-cases/UpdateSessionTeamsUseCase.ts';
import { Match } from '../src/core/domain/entities/Match.ts';
import { MatchEvent, type MatchEventProps } from '../src/core/domain/entities/MatchEvent.ts';

import { Player } from '../src/core/domain/entities/Player.ts';
import type {
  IMatchRepository,
  MatchSummary,
  LeaderboardItem,
} from '../src/core/domain/repositories/IMatchRepository.ts';
import type {
  ISessionRepository,
  CreateSessionTeamInput,
  UpdateSessionTeamInput,
} from '../src/core/domain/repositories/ISessionRepository.ts';
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
    const id = event.id || `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const saved = new MatchEvent({ ...event.state, id });
    this.events.push(saved);
    return saved;
  }

  async findEventById(eventId: string): Promise<MatchEvent | null> {
    return this.events.find((e) => e.id === eventId) || null;
  }

  async updateEvent(eventId: string, data: Partial<MatchEventProps>): Promise<void> {
    const idx = this.events.findIndex((e) => e.id === eventId);
    if (idx >= 0) {
      const current = this.events[idx];
      const updated = new MatchEvent({
        id: current.id,
        matchId: current.matchId,
        teamId: data.teamId ?? current.teamId,
        scorerId: data.scorerId !== undefined ? data.scorerId : current.scorerId,
        assistId: data.assistId !== undefined ? data.assistId : current.assistId,
        eventTimeSeconds: data.eventTimeSeconds ?? current.eventTimeSeconds,
        isOwnGoal: data.isOwnGoal ?? current.isOwnGoal,
        createdAt: current.createdAt,
      });
      this.events[idx] = updated;
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    this.events = this.events.filter((e) => e.id !== eventId);
  }

  async recalculateMatchScore(matchId: string): Promise<{ homeScore: number; awayScore: number }> {
    const match = this.matches.get(matchId);
    if (!match) return { homeScore: 0, awayScore: 0 };

    const norm = (id?: string | null) => (id ? id.trim().toLowerCase() : '');
    const hId = norm(match.homeTeamId);
    const aId = norm(match.awayTeamId);

    const matchEvents = this.events.filter((e) => e.matchId === matchId);
    const homeScore = matchEvents.filter((e) => {
      const tId = norm(e.teamId);
      return (!e.isOwnGoal && tId === hId) || (e.isOwnGoal && tId === aId);
    }).length;

    const awayScore = matchEvents.filter((e) => {
      const tId = norm(e.teamId);
      return (!e.isOwnGoal && tId === aId) || (e.isOwnGoal && tId === hId);
    }).length;

    match.setScores(homeScore, awayScore);
    return { homeScore, awayScore };
  }

  async getEventsByMatchId(matchId: string): Promise<MatchEvent[]> {
    return this.events.filter((e) => e.matchId === matchId);
  }

  public customLeaderboard: LeaderboardItem[] = [];

  async getMatchesSummary(_sessionId?: string): Promise<MatchSummary[]> {
    return [];
  }

  async getMatchById(_matchId: string): Promise<MatchSummary | null> {
    return null;
  }

  async getLeaderboard(): Promise<LeaderboardItem[]> {
    return this.customLeaderboard;
  }

  async getLeaderboardByDateRange(
    _startDate?: string,
    _endDate?: string
  ): Promise<LeaderboardItem[]> {
    if (this.customLeaderboard.length > 0) return this.customLeaderboard;
    return [
      {
        playerId: 'p-1',
        name: 'Craque Silva',
        nickname: 'Silva',
        avatarUrl: null,
        totalGoals: 5,
        totalAssists: 3,
        totalContributions: 8,
        totalMatchesPlayed: 10,
        totalSessionsPlayed: 2,
        goalsPerMatch: 0.5,
      },
      {
        playerId: 'p-2',
        name: 'Goleador Souza',
        nickname: null,
        avatarUrl: null,
        totalGoals: 6,
        totalAssists: 0,
        totalContributions: 6,
        totalMatchesPlayed: 8,
        totalSessionsPlayed: 2,
        goalsPerMatch: 0.75,
      },
      {
        playerId: 'p-3',
        name: 'Garcom Santos',
        nickname: null,
        avatarUrl: null,
        totalGoals: 1,
        totalAssists: 6,
        totalContributions: 7,
        totalMatchesPlayed: 6,
        totalSessionsPlayed: 2,
        goalsPerMatch: 0.17,
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
        captainId: t.captainId || null,
      });
      if (t.players) {
        for (const p of t.players) {
          if (typeof p === 'string') {
            team.addPlayer(p, false, false, t.captainId === p);
          } else {
            team.addPlayer(
              p.playerId,
              p.isLoaned,
              p.isGoalkeeper,
              t.captainId === p.playerId || p.isCaptain
            );
          }
        }
      } else if (t.playerIds) {
        for (const pid of t.playerIds) {
          team.addPlayer(pid, false, false, t.captainId === pid);
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
  async getTeamsBySessionId(sessionId: string): Promise<Team[]> {
    const session = this.sessions.find((s) => s.id === sessionId);
    return session ? session.teams : [];
  }
  async updateTeams(sessionId: string, teams: UpdateSessionTeamInput[]): Promise<Team[]> {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) return [];

    for (const update of teams) {
      const existingTeam = session.teams.find((t) => t.id === update.id);
      if (existingTeam) {
        if (update.name) (existingTeam as any).props.name = update.name;
        if (update.captainId !== undefined)
          (existingTeam as any).props.captainId = update.captainId || null;
        if (update.colorHex) (existingTeam as any).props.colorHex = update.colorHex;

        if (update.players) {
          (existingTeam as any).props.players = update.players.map((p) => ({
            playerId: p.playerId,
            isLoaned: p.isLoaned ?? false,
            isGoalkeeper: p.isGoalkeeper ?? false,
            isCaptain: p.isCaptain ?? (update.captainId ? update.captainId === p.playerId : false),
          }));
        }
      }
    }

    return session.teams;
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
          {
            playerId: 'p-1',
            isGoalkeeper: false,
            player: { name: 'Artilheiro Silva', nickname: null, avatarUrl: null },
          },
          {
            playerId: 'p-2',
            isGoalkeeper: false,
            player: { name: 'Garcom Santos', nickname: null, avatarUrl: null },
          },
          {
            playerId: 'p-5',
            isGoalkeeper: true,
            player: { name: 'Goleiro Preto', nickname: null, avatarUrl: null },
          },
        ],
      });

      const teamBranco = new Team({
        id: 't-branco',
        sessionId: 's-1',
        name: 'Branco',
        colorHex: '#FFFFFF',
        players: [
          {
            playerId: 'p-3',
            isGoalkeeper: false,
            player: { name: 'Craque Lima', nickname: null, avatarUrl: null },
          },
          {
            playerId: 'p-4',
            isGoalkeeper: false,
            player: { name: 'Bola Murcha Costa', nickname: null, avatarUrl: null },
          },
          {
            playerId: 'p-6',
            isGoalkeeper: true,
            player: { name: 'Goleiro Branco', nickname: null, avatarUrl: null },
          },
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

      match1.finish('manual');
      matchRepo.getMatchesSummary = async () => [
        {
          matchId: 'm-1',
          sessionId: 's-1',
          sessionDate: '2026-08-13',
          status: 'finished',
          homeScore: 2,
          awayScore: 1,
          homeTeamId: 't-preto',
          awayTeamId: 't-branco',
          homeTeamName: 'Preto',
          awayTeamName: 'Branco',
          homeTeamColor: '#000',
          awayTeamColor: '#fff',
          durationSeconds: 180,
          endReason: 'manual',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          events: matchRepo.events.map((e, i) => ({
            id: 'event-' + i,
            matchId: e.matchId,
            teamId: e.teamId,
            scorerId: e.scorerId,
            assistId: e.assistId,
            eventTimeSeconds: e.eventTimeSeconds,
            isOwnGoal: e.isOwnGoal,
          })),
          homePlayers: teamPreto.players.map((p) => ({
            id: p.playerId,
            name: p.player!.name,
            nickname: null,
            isCaptain: false,
            isGoalkeeper: !!p.isGoalkeeper,
            isLoaned: false,
            goals: 0,
            assists: 0,
          })),
          awayPlayers: teamBranco.players.map((p) => ({
            id: p.playerId,
            name: p.player!.name,
            nickname: null,
            isCaptain: false,
            isGoalkeeper: !!p.isGoalkeeper,
            isLoaned: false,
            goals: 0,
            assists: 0,
          })),
        },
      ];
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
          {
            name: 'Time Preto',
            colorHex: '#1f2937',
            playerIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'],
          },
          {
            name: 'Time Branco',
            colorHex: '#e5e7eb',
            playerIds: ['p8', 'p9', 'p10', 'p11', 'p12', 'p13'],
          },
          {
            name: 'Time Azul',
            colorHex: '#3b82f6',
            playerIds: ['p14', 'p15', 'p16', 'p17', 'p18', 'p19'],
          },
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

  describe('Match Summary and Scoreboard Card Rules', () => {
    it('should safely preserve 0 for scores and map events per team', () => {
      const summary: MatchSummary = {
        matchId: 'm-100',
        sessionId: 's-1',
        sessionDate: '2026-09-03',
        homeTeamId: 't-preto',
        homeTeamName: 'Time Preto',
        homeTeamColor: '#1f2937',
        homeScore: 1,
        awayTeamId: 't-branco',
        awayTeamName: 'Time Branco',
        awayTeamColor: '#e5e7eb',
        awayScore: 0,
        durationSeconds: 420,
        endReason: 'time_limit',
        status: 'finished',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        events: [
          {
            id: 'ev-1',
            matchId: 'm-100',
            teamId: 't-preto',
            scorerId: 'p-1',
            scorerName: 'Lucas',
            assistId: 'p-2',
            assistName: 'Gabriel',
            eventTimeSeconds: 150,
            isOwnGoal: false,
          },
        ],
      };

      // 1. Validação de nunca perder o 0 do placar visitante
      const homeScore = summary.homeScore ?? 0;
      const awayScore = summary.awayScore ?? 0;
      const scoreString = `${homeScore} x ${awayScore}`;
      assert.equal(scoreString, '1 x 0');

      // 2. Filtro dos eventos por time
      const homeEvents = (summary.events || []).filter((e) => e.teamId === summary.homeTeamId);
      const awayEvents = (summary.events || []).filter((e) => e.teamId === summary.awayTeamId);

      assert.equal(homeEvents.length, 1);
      assert.equal(awayEvents.length, 0);

      // 3. Formatação do lance com assistência
      const ev = homeEvents[0];
      const formatted = ev.isOwnGoal
        ? '⚠️ Gol Contra'
        : `⚽ ${ev.scorerName}${ev.assistName ? ` (${ev.assistName})` : ''}`;
      assert.equal(formatted, '⚽ Lucas (Gabriel)');
    });

    it('should format individual goals and own goals correctly', () => {
      const individualEv = {
        isOwnGoal: false,
        scorerName: 'Mateus',
        assistName: undefined,
      };
      const formattedInd = individualEv.isOwnGoal
        ? '⚠️ Gol Contra'
        : `⚽ ${individualEv.scorerName}${individualEv.assistName ? ` (${individualEv.assistName})` : ''}`;
      assert.equal(formattedInd, '⚽ Mateus');

      const ownGoalEv = {
        isOwnGoal: true,
        scorerName: 'Gol Contra',
        assistName: undefined,
      };
      const formattedOwn = ownGoalEv.isOwnGoal
        ? '⚠️ Gol Contra'
        : `⚽ ${ownGoalEv.scorerName}${ownGoalEv.assistName ? ` (${ownGoalEv.assistName})` : ''}`;
      assert.equal(formattedOwn, '⚠️ Gol Contra');
    });

    it('should recalculate 2x1 score from events when static score is stale at 2x0', () => {
      // Simula partida com placar estático 2x0, mas com gol do Time Azul (Paulinho) nos eventos
      const summaryWithStaleScore: MatchSummary = {
        matchId: 'm-200',
        sessionId: 's-1',
        sessionDate: '2026-09-03',
        homeTeamId: 't-vermelho',
        homeTeamName: 'Time Vermelho',
        homeTeamColor: '#ef4444',
        homeScore: 2,
        awayTeamId: 't-azul',
        awayTeamName: 'Time Azul',
        awayTeamColor: '#3b82f6',
        awayScore: 0, // Estático defasado!
        durationSeconds: 300,
        endReason: 'two_goals',
        status: 'finished',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        events: [
          {
            id: 'ev-1',
            matchId: 'm-200',
            teamId: 't-vermelho',
            scorerId: 'p-1',
            scorerName: 'Pedro',
            eventTimeSeconds: 60,
            isOwnGoal: false,
          },
          {
            id: 'ev-2',
            matchId: 'm-200',
            teamId: 't-azul',
            scorerId: 'p-2',
            scorerName: 'Paulinho',
            assistId: 'p-3',
            assistName: 'Gabs',
            eventTimeSeconds: 120,
            isOwnGoal: false,
          },
          {
            id: 'ev-3',
            matchId: 'm-200',
            teamId: 't-vermelho',
            scorerId: 'p-4',
            scorerName: 'Benzema',
            eventTimeSeconds: 180,
            isOwnGoal: false,
          },
        ],
      };

      const events = summaryWithStaleScore.events || [];
      const norm = (id?: string | null) => (id ? id.trim().toLowerCase() : '');
      const homeTeamId = norm(summaryWithStaleScore.homeTeamId);
      const awayTeamId = norm(summaryWithStaleScore.awayTeamId);

      // Fonte da verdade recalculada a partir dos eventos
      const calcHome = events.filter((e) => {
        const tId = norm(e.teamId);
        return (!e.isOwnGoal && tId === homeTeamId) || (e.isOwnGoal && tId === awayTeamId);
      }).length;

      const calcAway = events.filter((e) => {
        const tId = norm(e.teamId);
        return (!e.isOwnGoal && tId === awayTeamId) || (e.isOwnGoal && tId === homeTeamId);
      }).length;

      const finalHomeScore = events.length > 0 ? calcHome : (summaryWithStaleScore.homeScore ?? 0);
      const finalAwayScore = events.length > 0 ? calcAway : (summaryWithStaleScore.awayScore ?? 0);

      assert.equal(finalHomeScore, 2);
      assert.equal(finalAwayScore, 1);
      assert.equal(`${finalHomeScore} x ${finalAwayScore}`, '2 x 1');
    });

    it('should correctly register away team goal with UUID casing/whitespace differences', async () => {
      const matchRepo = new MockMatchRepository();
      const match = await matchRepo.create(
        new Match({
          id: 'm-uuid-test',
          sessionId: 's-1',
          homeTeamId: '8f0a2d48-8123-4bb1-b66a-49339e123456',
          awayTeamId: 'c4b9f32a-03bf-4b9b-ba23-952d7e0081d0',
        })
      );

      const useCase = new RegisterGoalUseCase(matchRepo);
      // Input com letras maiúsculas e espaços extras
      const result = await useCase.execute({
        matchId: 'm-uuid-test',
        teamId: '  C4B9F32A-03BF-4B9B-BA23-952D7E0081D0  ',
        scorerId: 'p-paulinho',
        assistId: 'p-gabs',
        eventTimeSeconds: 150,
      });

      assert.equal(result.match.homeScore, 0);
      assert.equal(result.match.awayScore, 1);
      assert.equal(result.match.status, 'ongoing');
    });

    it('should create session with teams named after their captains and preserve captainId', async () => {
      const sessionRepo = new MockSessionRepository();
      const useCase = new CreateSessionUseCase(sessionRepo);

      const result = await useCase.execute({
        sessionDate: '2026-09-03',
        matchDurationSeconds: 480,
        teams: [
          {
            name: 'Time Gabriel',
            colorHex: '#1f2937',
            captainId: 'p-gabriel',
            playerIds: ['p-gabriel', 'p-lucas', 'p-mateus'],
          },
          {
            name: 'Time Chitao',
            colorHex: '#e5e7eb',
            captainId: 'p-chitao',
            playerIds: ['p-chitao', 'p-pedro', 'p-gabs'],
          },
          {
            name: 'Time Paulinho',
            colorHex: '#3b82f6',
            captainId: 'p-paulinho',
            playerIds: ['p-paulinho', 'p-benzema', 'p-vini'],
          },
        ],
      });

      assert.equal(result.teams.length, 3);
      assert.equal(result.teams[0].name, 'Time Gabriel');
      assert.equal(result.teams[0].captainId, 'p-gabriel');
      assert.equal(result.teams[1].name, 'Time Chitao');
      assert.equal(result.teams[1].captainId, 'p-chitao');
      assert.equal(result.teams[2].name, 'Time Paulinho');
      assert.equal(result.teams[2].captainId, 'p-paulinho');

      // Verifica jogadores e capitão no repositório
      const savedSession = sessionRepo.sessions[0];
      assert.ok(savedSession);
      const team1 = savedSession.teams[0];
      const captainPlayer = team1.players.find((p) => p.playerId === 'p-gabriel');
      assert.ok(captainPlayer);
      assert.equal(captainPlayer.isCaptain, true);
    });

    it('should correctly structure match lineups, player badges, and individual goals/assists', () => {
      const matchDetails: MatchSummary = {
        matchId: 'm-300',
        sessionId: 's-1',
        sessionDate: '2026-09-03',
        homeTeamId: 't-preto',
        homeTeamName: 'Time Finazzi',
        homeTeamColor: '#10b981',
        homeScore: 2,
        awayTeamId: 't-branco',
        awayTeamName: 'Time Chitão',
        awayTeamColor: '#ef4444',
        awayScore: 1,
        durationSeconds: 29,
        endReason: 'two_goals',
        status: 'finished',
        startedAt: '2026-09-03T18:39:00.000Z',
        finishedAt: '2026-09-03T18:39:29.000Z',
        events: [
          {
            id: 'ev-1',
            matchId: 'm-300',
            teamId: 't-preto',
            scorerId: 'p-pedro',
            scorerName: 'Pedro',
            assistId: 'p-chico',
            assistName: 'Chico',
            eventTimeSeconds: 12,
            isOwnGoal: false,
          },
          {
            id: 'ev-2',
            matchId: 'm-300',
            teamId: 't-branco',
            scorerId: 'p-chitao',
            scorerName: 'Chitão',
            eventTimeSeconds: 18,
            isOwnGoal: false,
          },
          {
            id: 'ev-3',
            matchId: 'm-300',
            teamId: 't-preto',
            scorerId: 'p-pedro',
            scorerName: 'Pedro',
            assistId: 'p-finazzi',
            assistName: 'Finazzi',
            eventTimeSeconds: 29,
            isOwnGoal: false,
          },
        ],
        homePlayers: [
          {
            id: 'p-finazzi',
            name: 'Finazzi da Silva',
            nickname: 'Finazzi',
            isCaptain: true,
            isGoalkeeper: false,
            isLoaned: false,
            goals: 0,
            assists: 1,
          },
          {
            id: 'p-pedro',
            name: 'Pedro Henrique',
            nickname: 'Pedro',
            isCaptain: false,
            isGoalkeeper: false,
            isLoaned: false,
            goals: 2,
            assists: 0,
          },
          {
            id: 'p-chico',
            name: 'Francisco Costa',
            nickname: 'Chico',
            isCaptain: false,
            isGoalkeeper: false,
            isLoaned: true,
            goals: 0,
            assists: 1,
          },
          {
            id: 'p-goleiro-1',
            name: 'Diego Alves',
            nickname: 'Diego',
            isCaptain: false,
            isGoalkeeper: true,
            isLoaned: false,
            goals: 0,
            assists: 0,
          },
        ],
        awayPlayers: [
          {
            id: 'p-chitao',
            name: 'Chitãozinho Ferreira',
            nickname: 'Chitão',
            isCaptain: true,
            isGoalkeeper: false,
            isLoaned: false,
            goals: 1,
            assists: 0,
          },
          {
            id: 'p-goleiro-2',
            name: 'Weverton Santos',
            nickname: 'Weverton',
            isCaptain: false,
            isGoalkeeper: true,
            isLoaned: false,
            goals: 0,
            assists: 0,
          },
        ],
      };

      // 1. Valida escalações dos dois times
      assert.equal(matchDetails.homePlayers?.length, 4);
      assert.equal(matchDetails.awayPlayers?.length, 2);

      // 2. Valida capitão, goleiro e empréstimo
      const captain = matchDetails.homePlayers?.find((p) => p.isCaptain);
      assert.equal(captain?.nickname, 'Finazzi');
      assert.equal(captain?.assists, 1);

      const gk = matchDetails.homePlayers?.find((p) => p.isGoalkeeper);
      assert.equal(gk?.nickname, 'Diego');

      const loaned = matchDetails.homePlayers?.find((p) => p.isLoaned);
      assert.equal(loaned?.nickname, 'Chico');
      assert.equal(loaned?.isLoaned, true);

      // 3. Valida artilheiro da partida com 2 gols
      const scorer = matchDetails.homePlayers?.find((p) => p.goals === 2);
      assert.equal(scorer?.nickname, 'Pedro');

      // 4. Valida autor do gol adversário
      const awayCaptain = matchDetails.awayPlayers?.find((p) => p.isCaptain);
      assert.equal(awayCaptain?.nickname, 'Chitão');
      assert.equal(awayCaptain?.goals, 1);
    });
  });

  describe('UpdateSessionTeamsUseCase', () => {
    it('should update teams, change captain and transfer players between squads', async () => {
      const sessionRepo = new MockSessionRepository();
      const createUseCase = new CreateSessionUseCase(sessionRepo);

      const created = await createUseCase.execute({
        sessionDate: '2026-09-03',
        teams: [
          {
            name: 'Time Gabriel',
            colorHex: '#1f2937',
            captainId: 'p-gabriel',
            playerIds: ['p-gabriel', 'p-lucas'],
          },
          {
            name: 'Time Chitao',
            colorHex: '#e5e7eb',
            captainId: 'p-chitao',
            playerIds: ['p-chitao', 'p-pedro'],
          },
        ],
      });

      const team1Id = created.teams[0].id;
      const team2Id = created.teams[1].id;

      const updateUseCase = new UpdateSessionTeamsUseCase(sessionRepo);

      // Atualiza:
      // 1. Time 1 muda de capitão para p-lucas (e nome para Time Lucas)
      // 2. Transfere p-pedro do Time 2 para o Time 1 como Goleiro
      const updated = await updateUseCase.execute({
        sessionId: created.id,
        teams: [
          {
            id: team1Id,
            name: 'Time Lucas',
            captainId: 'p-lucas',
            players: [
              { playerId: 'p-gabriel', isGoalkeeper: false, isCaptain: false },
              { playerId: 'p-lucas', isGoalkeeper: false, isCaptain: true },
              { playerId: 'p-pedro', isGoalkeeper: true, isCaptain: false },
            ],
          },
          {
            id: team2Id,
            name: 'Time Chitao',
            captainId: 'p-chitao',
            players: [{ playerId: 'p-chitao', isGoalkeeper: false, isCaptain: true }],
          },
        ],
      });

      assert.equal(updated.teams.length, 2);
      const team1 = updated.teams.find((t) => t.id === team1Id);
      assert.ok(team1);
      assert.equal(team1.name, 'Time Lucas');
      assert.equal(team1.captainId, 'p-lucas');
      assert.equal(team1.players.length, 3);
      const pedro = team1.players.find((p) => p.id === 'p-pedro');
      assert.ok(pedro);
      assert.equal(pedro.isGoalkeeper, true);

      const team2 = updated.teams.find((t) => t.id === team2Id);
      assert.ok(team2);
      assert.equal(team2.players.length, 1);
    });

    it('should throw error when sessionId or teams are empty', async () => {
      const sessionRepo = new MockSessionRepository();
      const updateUseCase = new UpdateSessionTeamsUseCase(sessionRepo);

      await assert.rejects(
        () => updateUseCase.execute({ sessionId: '', teams: [] }),
        /ID da rodada é obrigatório/
      );

      await assert.rejects(
        () => updateUseCase.execute({ sessionId: 's-1', teams: [] }),
        /ao menos um time/
      );

      await assert.rejects(
        () =>
          updateUseCase.execute({
            sessionId: 's-1',
            teams: [{ id: 't-1', name: '  ', players: [] }],
          }),
        /Nome do time não pode ser vazio/
      );
    });
  });

  describe('GetLeaderboardUseCase (Matches Count & Goals Per Match)', () => {
    it('should accurately compute matchesPlayed and goalsPerMatch (e.g. Buzz with 2 goals in 4 matches = 0.50 G/J)', async () => {
      const matchRepo = new MockMatchRepository();
      matchRepo.customLeaderboard = [
        {
          playerId: 'p-buzz',
          name: 'Buzz Lightyear',
          nickname: 'Buzz',
          avatarUrl: null,
          totalGoals: 2,
          totalAssists: 1,
          totalContributions: 3,
          totalMatchesPlayed: 4, // 4 partidas disputadas (dois 0x0, um 2x1, um 1x1)
          totalSessionsPlayed: 1,
          goalsPerMatch: 0.5,
        },
        {
          playerId: 'p-woody',
          name: 'Woody',
          nickname: null,
          avatarUrl: null,
          totalGoals: 0,
          totalAssists: 0,
          totalContributions: 0,
          totalMatchesPlayed: 3,
          totalSessionsPlayed: 1,
          goalsPerMatch: 0.0,
        },
      ];

      const useCase = new GetLeaderboardUseCase(matchRepo);
      const result = await useCase.execute();

      assert.equal(result.length, 2);

      const buzz = result.find((p) => p.playerId === 'p-buzz');
      assert.ok(buzz);
      assert.equal(buzz.totalGoals, 2);
      assert.equal(buzz.totalMatchesPlayed, 4);
      assert.equal(buzz.goalsPerMatch, 0.5);

      const woody = result.find((p) => p.playerId === 'p-woody');
      assert.ok(woody);
      assert.equal(woody.totalGoals, 0);
      assert.equal(woody.totalMatchesPlayed, 3);
      assert.equal(woody.goalsPerMatch, 0);
    });
  });

  describe('UpdateMatchEventUseCase & DeleteMatchEventUseCase', () => {
    it('should successfully update goal scorer and assist and recalculate match score', async () => {
      const matchRepo = new MockMatchRepository();
      const match = await matchRepo.create(
        new Match({
          id: 'm-100',
          sessionId: 's-1',
          homeTeamId: 'team-a',
          awayTeamId: 'team-b',
        })
      );

      // Add a goal for team-a (scorer: p-1, assist: p-2)
      const event = await matchRepo.addEvent(
        new MatchEvent({
          id: 'ev-100',
          matchId: match.id!,
          teamId: 'team-a',
          scorerId: 'p-1',
          assistId: 'p-2',
          isOwnGoal: false,
          eventTimeSeconds: 45,
        })
      );
      await matchRepo.recalculateMatchScore(match.id!);

      assert.equal(match.homeScore, 1);
      assert.equal(match.awayScore, 0);

      // Update event: scorer becomes p-3, assist becomes p-1
      const updateUseCase = new UpdateMatchEventUseCase(matchRepo);
      const updateResult = await updateUseCase.execute({
        matchId: 'm-100',
        eventId: 'ev-100',
        teamId: 'team-a',
        scorerId: 'p-3',
        assistId: 'p-1',
        isOwnGoal: false,
      });

      assert.equal(updateResult.homeScore, 1);
      assert.equal(updateResult.awayScore, 0);

      const updatedEv = await matchRepo.findEventById('ev-100');
      assert.ok(updatedEv);
      assert.equal(updatedEv.scorerId, 'p-3');
      assert.equal(updatedEv.assistId, 'p-1');
    });

    it('should change normal goal to own goal, clearing assist and awarding goal to opposing team', async () => {
      const matchRepo = new MockMatchRepository();
      const match = await matchRepo.create(
        new Match({
          id: 'm-101',
          sessionId: 's-1',
          homeTeamId: 'team-a',
          awayTeamId: 'team-b',
        })
      );

      // Team A scored a normal goal -> homeScore: 1
      await matchRepo.addEvent(
        new MatchEvent({
          id: 'ev-101',
          matchId: 'm-101',
          teamId: 'team-a',
          scorerId: 'p-1',
          isOwnGoal: false,
        })
      );
      await matchRepo.recalculateMatchScore('m-101');
      assert.equal(match.homeScore, 1);
      assert.equal(match.awayScore, 0);

      // Change to own goal by team-a -> now awayScore gets +1 and homeScore gets 0!
      const updateUseCase = new UpdateMatchEventUseCase(matchRepo);
      const updateResult = await updateUseCase.execute({
        matchId: 'm-101',
        eventId: 'ev-101',
        teamId: 'team-a',
        isOwnGoal: true,
      });

      assert.equal(updateResult.homeScore, 0);
      assert.equal(updateResult.awayScore, 1);
      assert.equal(match.homeScore, 0);
      assert.equal(match.awayScore, 1);
    });

    it('should throw error when scorer and assist are identical on update', async () => {
      const matchRepo = new MockMatchRepository();
      await matchRepo.create(
        new Match({
          id: 'm-102',
          sessionId: 's-1',
          homeTeamId: 'team-a',
          awayTeamId: 'team-b',
        })
      );
      await matchRepo.addEvent(
        new MatchEvent({
          id: 'ev-102',
          matchId: 'm-102',
          teamId: 'team-a',
          scorerId: 'p-1',
        })
      );

      const updateUseCase = new UpdateMatchEventUseCase(matchRepo);
      await assert.rejects(async () => {
        await updateUseCase.execute({
          matchId: 'm-102',
          eventId: 'ev-102',
          teamId: 'team-a',
          scorerId: 'p-1',
          assistId: 'p-1',
        });
      }, /O autor do gol não pode ser o mesmo da assistência/);
    });

    it('should throw error when normal goal has no scorer on update', async () => {
      const matchRepo = new MockMatchRepository();
      await matchRepo.create(
        new Match({
          id: 'm-103',
          sessionId: 's-1',
          homeTeamId: 'team-a',
          awayTeamId: 'team-b',
        })
      );

      const updateUseCase = new UpdateMatchEventUseCase(matchRepo);
      await assert.rejects(async () => {
        await updateUseCase.execute({
          matchId: 'm-103',
          eventId: 'ev-103',
          teamId: 'team-a',
          isOwnGoal: false,
        });
      }, /Gol normal exige a identificação do autor do gol/);
    });

    it('should delete event and recalculate match score to 0', async () => {
      const matchRepo = new MockMatchRepository();
      const match = await matchRepo.create(
        new Match({
          id: 'm-104',
          sessionId: 's-1',
          homeTeamId: 'team-a',
          awayTeamId: 'team-b',
        })
      );

      await matchRepo.addEvent(
        new MatchEvent({
          id: 'ev-104',
          matchId: 'm-104',
          teamId: 'team-a',
          scorerId: 'p-1',
          isOwnGoal: false,
        })
      );
      await matchRepo.recalculateMatchScore('m-104');
      assert.equal(match.homeScore, 1);

      const deleteUseCase = new DeleteMatchEventUseCase(matchRepo);
      const deleteResult = await deleteUseCase.execute({
        matchId: 'm-104',
        eventId: 'ev-104',
      });

      assert.equal(deleteResult.homeScore, 0);
      assert.equal(deleteResult.awayScore, 0);
      assert.equal(match.homeScore, 0);

      const deletedEv = await matchRepo.findEventById('ev-104');
      assert.equal(deletedEv, null);
    });

    it('should throw error when deleting event of non-existent match', async () => {
      const matchRepo = new MockMatchRepository();
      const deleteUseCase = new DeleteMatchEventUseCase(matchRepo);

      await assert.rejects(async () => {
        await deleteUseCase.execute({
          matchId: 'm-non-existent',
          eventId: 'ev-999',
        });
      }, /Partida com ID 'm-non-existent' não foi encontrado/);
    });
  });

  describe('Post-Match Score Adjustments & Retroactive Goals', () => {
    it('should allow registering a retroactive goal on an already finished match via RegisterGoalUseCase', async () => {
      const matchRepo = new MockMatchRepository();
      const match = new Match({
        id: 'm-retro-1',
        sessionId: 's-1',
        homeTeamId: 't-preto',
        awayTeamId: 't-branco',
      });
      match.updateDuration(420);
      match.finish('manual');
      assert.equal(match.isFinished, true);
      await matchRepo.create(match);

      const registerGoalUseCase = new RegisterGoalUseCase(matchRepo);
      const result = await registerGoalUseCase.execute({
        matchId: 'm-retro-1',
        teamId: 't-preto',
        scorerId: 'p-scorer-1',
        eventTimeSeconds: 420,
        allowFinished: true,
      });

      assert.equal(result.match.homeScore, 1);
      assert.equal(result.match.awayScore, 0);
      assert.equal(result.match.isFinished, true);

      const updated = await matchRepo.findById('m-retro-1');
      assert.equal(updated?.homeScore, 1);
      assert.equal(updated?.awayScore, 0);
    });

    it('should update match scores directly using UpdateMatchScoreUseCase', async () => {
      const matchRepo = new MockMatchRepository();
      const match = new Match({
        id: 'm-score-adjust',
        sessionId: 's-1',
        homeTeamId: 't-preto',
        awayTeamId: 't-branco',
        homeScore: 1,
        awayScore: 0,
      });
      match.finish('time_limit');
      await matchRepo.create(match);

      const useCase = new UpdateMatchScoreUseCase(matchRepo);
      const output = await useCase.execute({
        matchId: 'm-score-adjust',
        homeScore: 2,
        awayScore: 2,
      });

      assert.equal(output.homeScore, 2);
      assert.equal(output.awayScore, 2);
      assert.equal(output.isFinished, true);

      const updated = await matchRepo.findById('m-score-adjust');
      assert.equal(updated?.homeScore, 2);
      assert.equal(updated?.awayScore, 2);
    });

    it('should throw error when updating scores of non-existent match', async () => {
      const matchRepo = new MockMatchRepository();
      const useCase = new UpdateMatchScoreUseCase(matchRepo);

      await assert.rejects(async () => {
        await useCase.execute({
          matchId: 'm-not-found',
          homeScore: 3,
          awayScore: 1,
        });
      }, /Partida com ID 'm-not-found' não foi encontrado/);
    });
  });
});

it('seleciona temporada pelo ano civil e mantém empates e todo o histórico', async () => {
  const repo: IMatchRepository = new MockMatchRepository();
  let range: (string | undefined)[] = [];
  repo.getLeaderboardByDateRange = async (start, end) => {
    range = [start, end];
    return ['Ana', 'Beto', 'Caio'].map((name, i) => ({
      playerId: name,
      name,
      nickname: null,
      avatarUrl: null,
      totalGoals: i < 2 ? 2 : 1,
      totalAssists: 0,
      totalContributions: i < 2 ? 2 : 1,
      totalMatchesPlayed: 3,
      totalSessionsPlayed: 1,
    }));
  };
  const useCase = new GetPeriodLeaderboardUseCase(repo);
  const annual = await useCase.execute({ type: 'year', year: '2026' });
  assert.deepEqual(range, ['2026-01-01', '2026-12-31']);
  assert.equal(annual.periodLabel, 'Temporada 2026');
  assert.deepEqual(
    annual.byGoals.map((p) => p.rank),
    [1, 1, 3]
  );
  assert.deepEqual(
    annual.byAssists.map((p) => p.rank),
    [1, 1, 1]
  );
  assert.equal((await useCase.execute({ type: 'all' })).periodLabel, 'Todo o histórico');
  assert.deepEqual(range, [undefined, undefined]);
  await assert.rejects(useCase.execute({ type: 'year', year: '2026-01' }), /Temporada inválida/);
});

it('casos de uso antigos delegam mutações ao comando atômico, sem gravar estado defasado', async () => {
  const repo: IMatchRepository = new MockMatchRepository();
  const actions: string[] = [];
  repo.findById = async () => {
    throw new Error('Não ler estado mutável antes da transação');
  };
  repo.executeCommand = async (command) => {
    actions.push(command.action);
    return {
      eventId: 'event',
      match: {
        matchId: 'match',
        sessionId: 'session',
        sessionDate: '2026-09-03',
        homeTeamId: 'home',
        awayTeamId: 'away',
        homeTeamName: 'A',
        awayTeamName: 'B',
        homeTeamColor: '#000',
        awayTeamColor: '#fff',
        homeScore: 1,
        awayScore: 0,
        durationSeconds: 430,
        status: 'finished',
        startedAt: '2026-09-03T20:00:00Z',
        finishedAt: '2026-09-03T20:07:10Z',
        endReason: 'manual',
        events: [
          {
            id: 'event',
            matchId: 'match',
            teamId: 'home',
            scorerId: 'player',
            assistId: null,
            eventTimeSeconds: 430,
            isOwnGoal: false,
          },
        ],
      },
    };
  };
  assert.equal(
    (
      await new RegisterGoalUseCase(repo).execute({
        matchId: 'match',
        teamId: 'home',
        scorerId: 'player',
      })
    ).isMatchFinished,
    true
  );
  assert.equal(
    (await new FinishMatchUseCase(repo).execute({ matchId: 'match', homeScore: 99, awayScore: 99 }))
      .homeScore,
    1
  );
  assert.equal(
    (await new UpdateMatchScoreUseCase(repo).execute({ matchId: 'match', homeScore: 1 })).homeScore,
    1
  );
  await new UpdateMatchEventUseCase(repo).execute({
    matchId: 'match',
    eventId: 'event',
    scorerId: 'player',
  });
  await new DeleteMatchEventUseCase(repo).execute({ matchId: 'match', eventId: 'event' });
  assert.deepEqual(actions, ['goal', 'finish', 'score', 'edit', 'delete']);
});
