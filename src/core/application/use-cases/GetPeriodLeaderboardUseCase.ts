import type { IMatchRepository, LeaderboardItem } from '../../domain/repositories/IMatchRepository';
import type {
  GetPeriodLeaderboardInputDTO,
  PeriodLeaderboardOutputDTO,
  LeaderboardRankedItemDTO,
} from '../dtos/PeriodLeaderboardDTO';

export class GetPeriodLeaderboardUseCase {
  constructor(private matchRepo: IMatchRepository) {}

  public async execute(input: GetPeriodLeaderboardInputDTO): Promise<PeriodLeaderboardOutputDTO> {
    let startDate: string | undefined = undefined;
    let endDate: string | undefined = undefined;
    let periodLabel = 'Todo o histórico';

    if (input.type === 'year') {
      if (!input.year || !/^\d{4}$/.test(input.year))
        throw new Error('Temporada inválida. Informe o ano.');
      startDate = input.year + '-01-01';
      endDate = input.year + '-12-31';
      periodLabel = 'Temporada ' + input.year;
    }

    if (input.type === 'month' && input.yearMonth) {
      const [yearStr, monthStr] = input.yearMonth.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      if (!isNaN(year) && !isNaN(month)) {
        const lastDay = new Date(year, month, 0).getDate();
        startDate = `${yearStr}-${monthStr.padStart(2, '0')}-01`;
        endDate = `${yearStr}-${monthStr.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const monthDate = new Date(year, month - 1, 1);
        const monthName = monthDate.toLocaleDateString('pt-BR', { month: 'long' });
        periodLabel = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${year}`;
      }
    }

    const items: LeaderboardItem[] = await this.matchRepo.getLeaderboardByDateRange(
      startDate,
      endDate
    );

    // 1. Tabela Craque do Futebol (G+A)
    const sortedByContributions = [...items]
      .sort((a, b) => {
        if (b.totalContributions !== a.totalContributions) {
          return b.totalContributions - a.totalContributions;
        }
        if (b.totalGoals !== a.totalGoals) {
          return b.totalGoals - a.totalGoals;
        }
        if (b.totalAssists !== a.totalAssists) {
          return b.totalAssists - a.totalAssists;
        }
        return a.name.localeCompare(b.name);
      })
      .map((item): LeaderboardRankedItemDTO => ({
        rank:
          1 + items.filter((other) => other.totalContributions > item.totalContributions).length,
        playerId: item.playerId,
        name: item.name,
        nickname: item.nickname,
        avatarUrl: item.avatarUrl,
        value: item.totalContributions,
        secondaryInfo: `${item.totalGoals}G • ${item.totalAssists}A`,
        totalGoals: item.totalGoals,
        totalAssists: item.totalAssists,
        totalContributions: item.totalContributions,
        totalMatchesPlayed: item.totalMatchesPlayed ?? item.totalSessionsPlayed,
        totalSessionsPlayed: item.totalSessionsPlayed,
        goalsPerMatch: item.goalsPerMatch,
      }));

    // 2. Tabela Artilheiro (Gols)
    const sortedByGoals = [...items]
      .sort((a, b) => {
        if (b.totalGoals !== a.totalGoals) {
          return b.totalGoals - a.totalGoals;
        }
        if (b.totalContributions !== a.totalContributions) {
          return b.totalContributions - a.totalContributions;
        }
        return a.name.localeCompare(b.name);
      })
      .map((item): LeaderboardRankedItemDTO => {
        const matchesCount = item.totalMatchesPlayed ?? item.totalSessionsPlayed;
        const avgGoals =
          item.goalsPerMatch !== undefined
            ? item.goalsPerMatch.toFixed(2)
            : matchesCount > 0
              ? (item.totalGoals / matchesCount).toFixed(2)
              : '0.00';

        return {
          rank: 1 + items.filter((other) => other.totalGoals > item.totalGoals).length,
          playerId: item.playerId,
          name: item.name,
          nickname: item.nickname,
          avatarUrl: item.avatarUrl,
          value: item.totalGoals,
          secondaryInfo: `${matchesCount} jogo${matchesCount !== 1 ? 's' : ''} • ${avgGoals} G/J`,
          totalGoals: item.totalGoals,
          totalAssists: item.totalAssists,
          totalContributions: item.totalContributions,
          totalMatchesPlayed: matchesCount,
          totalSessionsPlayed: item.totalSessionsPlayed,
          goalsPerMatch: Number(avgGoals),
        };
      });

    // 3. Tabela Garçom (Assistências)
    const sortedByAssists = [...items]
      .sort((a, b) => {
        if (b.totalAssists !== a.totalAssists) {
          return b.totalAssists - a.totalAssists;
        }
        if (b.totalContributions !== a.totalContributions) {
          return b.totalContributions - a.totalContributions;
        }
        return a.name.localeCompare(b.name);
      })
      .map((item): LeaderboardRankedItemDTO => {
        const matchesCount = item.totalMatchesPlayed ?? item.totalSessionsPlayed;
        return {
          rank: 1 + items.filter((other) => other.totalAssists > item.totalAssists).length,
          playerId: item.playerId,
          name: item.name,
          nickname: item.nickname,
          avatarUrl: item.avatarUrl,
          value: item.totalAssists,
          secondaryInfo: `${matchesCount} jogo${matchesCount !== 1 ? 's' : ''}`,
          totalGoals: item.totalGoals,
          totalAssists: item.totalAssists,
          totalContributions: item.totalContributions,
          totalMatchesPlayed: matchesCount,
          totalSessionsPlayed: item.totalSessionsPlayed,
          goalsPerMatch: item.goalsPerMatch,
        };
      });

    return {
      periodType: input.type,
      periodLabel,
      yearMonth: input.yearMonth,
      year: input.year,
      totalPlayers: items.length,
      byContributions: sortedByContributions,
      byGoals: sortedByGoals,
      byAssists: sortedByAssists,
    };
  }
}
