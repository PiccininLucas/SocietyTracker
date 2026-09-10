import type {
  MatchSummary,
  MatchSummaryEvent,
  MatchPlayerSummary,
} from '../repositories/IMatchRepository';
import { isCoveredByHistoricalTotal, type HistoricalPlayerTotal } from '../entities/HistoricalPlayerTotal';

export const normalizeId = (id?: string | null): string => (id ?? '').trim().toLowerCase();
export function scoreFromEvents(home: string, away: string, events: readonly MatchSummaryEvent[]) {
  let homeScore = 0,
    awayScore = 0;
  for (const event of events) {
    const id = normalizeId(event.teamId);
    if (
      (!event.isOwnGoal && id === normalizeId(home)) ||
      (event.isOwnGoal && id === normalizeId(away))
    )
      homeScore++;
    if (
      (!event.isOwnGoal && id === normalizeId(away)) ||
      (event.isOwnGoal && id === normalizeId(home))
    )
      awayScore++;
  }
  return { homeScore, awayScore };
}
export function orderedMatches(matches: readonly MatchSummary[]) {
  return [...matches].sort(
    (a, b) =>
      (a.sequence ?? 0) - (b.sequence ?? 0) ||
      a.startedAt.localeCompare(b.startedAt) ||
      a.matchId.localeCompare(b.matchId)
  );
}
export function recentMatches(matches: readonly MatchSummary[]) {
  return orderedMatches(matches.filter((m) => m.status === 'finished'))
    .slice(-3)
    .reverse();
}
export interface TeamStanding {
  teamId: string;
  name: string;
  color: string;
  position: number;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  efficiency: number;
}
export function headToHead(matches: readonly MatchSummary[], first: string, second: string) {
  const relevant = matches.filter(
    (m) =>
      m.status === 'finished' &&
      ((m.homeTeamId === first && m.awayTeamId === second) ||
        (m.homeTeamId === second && m.awayTeamId === first))
  );
  let firstWins = 0,
    secondWins = 0,
    draws = 0,
    firstGoals = 0,
    secondGoals = 0;
  for (const m of relevant) {
    const a = m.homeTeamId === first ? m.homeScore : m.awayScore,
      b = m.homeTeamId === first ? m.awayScore : m.homeScore;
    firstGoals += a;
    secondGoals += b;
    if (a > b) firstWins++;
    else if (b > a) secondWins++;
    else draws++;
  }
  return { firstWins, secondWins, draws, played: relevant.length, firstGoals, secondGoals };
}
export function standings(
  matches: readonly MatchSummary[],
  teams: { id: string; name: string; colorHex: string }[]
): TeamStanding[] {
  const rows = teams.map((t) => ({
    teamId: t.id,
    name: t.name,
    color: t.colorHex,
    position: 0,
    points: 0,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    efficiency: 0,
  }));
  for (const m of matches.filter((m) => m.status === 'finished')) {
    for (const r of rows) {
      if (r.teamId !== m.homeTeamId && r.teamId !== m.awayTeamId) continue;
      const gf = r.teamId === m.homeTeamId ? m.homeScore : m.awayScore,
        ga = r.teamId === m.homeTeamId ? m.awayScore : m.homeScore;
      r.played++;
      r.goalsFor += gf;
      r.goalsAgainst += ga;
      if (gf > ga) {
        r.wins++;
        r.points += 3;
      } else if (gf === ga) {
        r.draws++;
        r.points++;
      } else r.losses++;
    }
  }
  for (const r of rows) {
    r.goalDifference = r.goalsFor - r.goalsAgainst;
    r.efficiency = r.played ? (r.points / (r.played * 3)) * 100 : 0;
  }
  const primary = (a: TeamStanding, b: TeamStanding) =>
    b.points - a.points ||
    b.wins - a.wins ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor;
  rows.sort(primary);
  // A mini-table for the tied group avoids non-transitive pairwise comparisons.
  for (let i = 0; i < rows.length;) {
    let end = i + 1;
    while (end < rows.length && primary(rows[i], rows[end]) === 0) end++;
    const ids = new Set(rows.slice(i, end).map((r) => r.teamId));
    const direct = new Map([...ids].map((id) => [id, 0]));
    for (const m of matches.filter(
      (m) => m.status === 'finished' && ids.has(m.homeTeamId!) && ids.has(m.awayTeamId!)
    )) {
      direct.set(
        m.homeTeamId!,
        direct.get(m.homeTeamId!)! +
          (m.homeScore > m.awayScore ? 3 : m.homeScore === m.awayScore ? 1 : 0)
      );
      direct.set(
        m.awayTeamId!,
        direct.get(m.awayTeamId!)! +
          (m.awayScore > m.homeScore ? 3 : m.homeScore === m.awayScore ? 1 : 0)
      );
    }
    rows.splice(
      i,
      end - i,
      ...rows
        .slice(i, end)
        .sort(
          (a, b) =>
            direct.get(b.teamId)! - direct.get(a.teamId)! ||
            a.name.localeCompare(b.name, 'pt-BR') ||
            a.teamId.localeCompare(b.teamId)
        )
    );
    i = end;
  }
  return rows.map((r, i) => ({ ...r, position: i + 1 }));
}
export function sequences(matches: readonly MatchSummary[]) {
  const counts = new Map<string, number>();
  return orderedMatches(matches.filter((m) => m.status === 'finished')).map((m) => {
    const h = m.homeTeamId!,
      a = m.awayTeamId!;
    const winner = m.homeScore > m.awayScore ? h : m.awayScore > m.homeScore ? a : null;
    const interrupted = [h, a].filter((id) => (counts.get(id) ?? 0) > 0 && id !== winner);
    if (winner) {
      counts.set(winner, (counts.get(winner) ?? 0) + 1);
      counts.set(winner === h ? a : h, 0);
    } else {
      counts.set(h, 0);
      counts.set(a, 0);
    }
    return {
      matchId: m.matchId,
      winnerTeamId: winner,
      winStreak: winner ? counts.get(winner)! : 0,
      interrupted,
      reason: winner ? 'derrota' : 'empate',
    };
  });
}
export interface PlayerPerformance {
  hasHistoricalTotals?: boolean;
  recordedGoals?: number;
  playerId: string;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  efficiency: number;
  goals: number;
  assists: number;
  contributions: number;
  contributionRank: number;
  goalRank: number;
  assistRank: number;
  bottomCount: number;
  sessions: number;
  inferred: boolean;
}
export function playerPerformance(
  matches: readonly MatchSummary[],
  registered: {
    id: string;
    name: string;
    nickname?: string | null;
    avatarUrl?: string | null;
    isActive?: boolean;
  }[] = [],
  historical: readonly HistoricalPlayerTotal[] = []
): PlayerPerformance[] {
  const rows = new Map<string, PlayerPerformance>();
  const ensure = (p: {
    id: string;
    name: string;
    nickname?: string | null;
    avatarUrl?: string | null;
    isActive?: boolean;
  }) => {
    if (!rows.has(p.id))
      rows.set(p.id, {
        playerId: p.id,
        name: p.name,
        nickname: p.nickname ?? null,
        avatarUrl: p.avatarUrl ?? null,
        isActive: p.isActive ?? false,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        efficiency: 0,
        goals: 0,
        assists: 0,
        contributions: 0,
        contributionRank: 0,
        goalRank: 0,
        assistRank: 0,
        bottomCount: 0,
        sessions: 0,
        inferred: false,
        recordedGoals: 0,
      });
    return rows.get(p.id)!;
  };
  registered.filter((p) => p.isActive !== false).forEach(ensure);
  for (const t of historical) {
    const r = ensure(registered.find((p) => p.id === t.playerId)
      ?? { id: t.playerId, name: t.sourceName, isActive: false });
    r.hasHistoricalTotals = true;
    r.goals += t.goals;
    r.assists += t.assists;
    r.bottomCount += t.bottomCount;
  }
  const round = new Map<
    string,
    { playerId: string; date: string; g: number; a: number; gk: boolean; matches: Set<string> }
  >();
  for (const m of matches.filter((m) => m.status === 'finished')) {
    const seen = new Set<string>();
    for (const [players, home] of [
      [m.homePlayers ?? [], true],
      [m.awayPlayers ?? [], false],
    ] as [MatchPlayerSummary[], boolean][]) {
      for (const p of players) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        const registeredPlayer = registered.find((r) => r.id === p.id);
        const r = ensure(registeredPlayer ?? p);
        r.played++;
        r.inferred ||= p.inferred ?? false;
        const gf = home ? m.homeScore : m.awayScore,
          ga = home ? m.awayScore : m.homeScore;
        if (gf > ga) r.wins++;
        else if (gf === ga) r.draws++;
        else r.losses++;
        const key = m.sessionId + ':' + p.id;
        if (!round.has(key))
          round.set(key, { playerId: p.id, date: m.sessionDate, g: 0, a: 0, gk: false, matches: new Set() });
        const rr = round.get(key)!;
        rr.gk ||= p.isGoalkeeper;
        rr.matches.add(m.matchId);
      }
    }
    for (const e of m.events ?? []) {
      if (e.isOwnGoal) continue;
      for (const [id, kind] of [
        [e.scorerId, 'g'],
        [e.assistId, 'a'],
      ] as [string | null | undefined, 'g' | 'a'][]) {
        if (!id) continue;
        const r = rows.get(id);
        if (r) {
          if (kind === 'g') r.recordedGoals = (r.recordedGoals ?? 0) + 1;
          if (!isCoveredByHistoricalTotal(historical, id, m.sessionDate)) {
            if (kind === 'g') r.goals++;
            else r.assists++;
          }
        }
        const rr = round.get(m.sessionId + ':' + id);
        if (rr) rr[kind]++;
      }
    }
  }
  for (const rr of round.values()) {
    const r = rows.get(rr.playerId)!;
    r.sessions++;
    if (rr.matches.size && !rr.gk && !rr.g && !rr.a
      && !isCoveredByHistoricalTotal(historical, rr.playerId, rr.date)) r.bottomCount++;
  }
  const list = [...rows.values()];
  for (const r of list) {
    r.contributions = r.goals + r.assists;
    r.efficiency = r.played ? ((r.wins * 3 + r.draws) / (r.played * 3)) * 100 : 0;
  }
  for (const [metric, rank] of [
    ['contributions', 'contributionRank'],
    ['goals', 'goalRank'],
    ['assists', 'assistRank'],
  ] as const) {
    for (const r of list) r[rank] = 1 + list.filter((other) => other[metric] > r[metric]).length;
  }
  return list.sort(
    (a, b) =>
      b.contributions - a.contributions ||
      b.goals - a.goals ||
      a.name.localeCompare(b.name, 'pt-BR')
  );
}
export function weekRange(date: string) {
  const d = new Date(date + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) throw new Error('Semana inválida.');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const start = d.toISOString().slice(0, 10);
  d.setUTCDate(d.getUTCDate() + 6);
  return { start, end: d.toISOString().slice(0, 10) };
}
