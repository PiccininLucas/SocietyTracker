import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TransferPlayerUseCase } from '../src/core/application/use-cases/TransferPlayerUseCase.ts';
import { GetRoundHighlightsUseCase } from '../src/core/application/use-cases/GetRoundHighlightsUseCase.ts';
import { GetPeriodLeaderboardUseCase } from '../src/core/application/use-cases/GetPeriodLeaderboardUseCase.ts';
import { GetLeaderboardUseCase } from '../src/core/application/use-cases/GetLeaderboardUseCase.ts';
import { UpdatePlayerUseCase } from '../src/core/application/use-cases/UpdatePlayerUseCase.ts';
import { CreateSessionUseCase } from '../src/core/application/use-cases/CreateSessionUseCase.ts';
import { UpdateSessionTeamsUseCase } from '../src/core/application/use-cases/UpdateSessionTeamsUseCase.ts';

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
import { Session, type SessionStatus } from '../src/core/domain/entities/Session.ts';
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
  public transferred: {
    fromTeamId: string;
    toTeamId: string;
    playerId: string;
    isLoaned?: boolean;
  }[] = [];

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
  async updateStatus(_id: string, _status: SessionStatus): Promise<void> {}
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
        const props = (existingTeam as unknown as { props: Record<string, unknown> }).props;
        if (update.name) props.name = update.name;
        if (update.captainId !== undefined) props.captainId = update.captainId || null;
        if (update.colorHex) props.colorHex = update.colorHex;

        if (update.players) {
          props.players = update.players.map((p) => ({
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

      const events = [
        {
          id: 'event-0',
          matchId: 'm-1',
          teamId: 't-preto',
          scorerId: 'p-1',
          assistId: 'p-2',
          eventTimeSeconds: 60,
          isOwnGoal: false,
        },
        {
          id: 'event-1',
          matchId: 'm-1',
          teamId: 't-preto',
          scorerId: 'p-1',
          assistId: null,
          eventTimeSeconds: 120,
          isOwnGoal: false,
        },
        {
          id: 'event-2',
          matchId: 'm-1',
          teamId: 't-branco',
          scorerId: 'p-3',
          assistId: null,
          eventTimeSeconds: 180,
          isOwnGoal: false,
        },
      ];
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
          events,
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

    it('should compute period leaderboard using preloadedData without querying match repository', async () => {
      let repoCalled = false;
      const throwingMatchRepo = {
        getLeaderboardByDateRange: async () => {
          repoCalled = true;
          throw new Error('Repository should not have been called when preloadedData is provided');
        },
      } as unknown as IMatchRepository;

      const useCase = new GetPeriodLeaderboardUseCase(throwingMatchRepo);

      const result = await useCase.execute({
        type: 'month',
        yearMonth: '2026-08',
        preloadedData: {
          matches: [
            {
              matchId: 'm-1',
              sessionId: 's-1',
              sessionDate: '2026-08-15',
              homeTeamName: 'Time A',
              homeTeamColor: '#ffffff',
              awayTeamName: 'Time B',
              awayTeamColor: '#000000',
              homeScore: 1,
              awayScore: 0,
              durationSeconds: 420,
              status: 'finished',
              endReason: 'two_goals',
              startedAt: '2026-08-15T20:00:00Z',
              finishedAt: '2026-08-15T20:07:00Z',
              events: [
                {
                  id: 'e-1',
                  matchId: 'm-1',
                  teamId: 't-1',
                  scorerId: 'p-1',
                  assistId: 'p-2',
                  isOwnGoal: false,
                  eventTimeSeconds: 120,
                },
              ],
            },
          ],
          players: [
            { id: 'p-1', name: 'Neymar Jr', nickname: 'Ney', isActive: true },
            { id: 'p-2', name: 'Lionel Messi', nickname: 'Leo', isActive: true },
          ],
          historical: [],
        },
      });

      assert.equal(repoCalled, false);
      assert.equal(result.periodType, 'month');
      assert.equal(result.totalPlayers, 2);
      assert.equal(result.byGoals[0].playerId, 'p-1');
      assert.equal(result.byGoals[0].totalGoals, 1);
      assert.equal(result.byAssists[0].playerId, 'p-2');
      assert.equal(result.byAssists[0].totalAssists, 1);
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
        /Jogador com ID 'non-existent-id' não foi encontrado/
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
            playerIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'],
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
      assert.equal(result.teams[0].playersCount, 6);
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

  describe('CreateSessionUseCase (capitães)', () => {
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
          // A rodada exige no mínimo 3 times; este não participa da troca sob teste.
          {
            name: 'Time Ana',
            colorHex: '#3b82f6',
            captainId: 'p-ana',
            playerIds: ['p-ana'],
          },
        ],
      });

      const team1Id = created.teams[0].id;
      const team2Id = created.teams[1].id;
      const team3Id = created.teams[2].id;

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
          {
            id: team3Id,
            name: 'Time Ana',
            captainId: 'p-ana',
            players: [{ playerId: 'p-ana', isGoalkeeper: false, isCaptain: true }],
          },
        ],
      });

      assert.equal(updated.teams.length, 3);
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
