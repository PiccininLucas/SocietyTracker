import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../database/supabaseClient';
import { Match, type MatchEndReason } from '../../domain/entities/Match';
import { MatchEvent, type MatchEventProps } from '../../domain/entities/MatchEvent';
import type {
  IMatchRepository,
  MatchSummary,
  LeaderboardItem,
} from '../../domain/repositories/IMatchRepository';
import type {
  IMatchCommands,
  MatchCommand,
  MatchCommandResult,
} from '../../domain/repositories/IMatchCommands';
import { playerPerformance } from '../../domain/services/CompetitionService';
import { SupabasePlayerRepository } from './SupabasePlayerRepository';
import { SupabaseHistoricalRepository } from './SupabaseHistoricalRepository';
import { historicalTotalsForPeriod } from '../../domain/entities/HistoricalPlayerTotal';
import { performanceLeaderboard } from '../../application/dtos/performanceLeaderboard';

export class SupabaseMatchRepository implements IMatchRepository, IMatchCommands {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}
  private domain(m: MatchSummary): Match {
    return new Match({
      id: m.matchId,
      sessionId: m.sessionId,
      homeTeamId: m.homeTeamId!,
      awayTeamId: m.awayTeamId!,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      durationSeconds: m.durationSeconds,
      status: m.status,
      endReason: m.endReason as MatchEndReason | null,
      startedAt: new Date(m.startedAt),
      finishedAt: m.finishedAt ? new Date(m.finishedAt) : null,
    });
  }
  async getMatchesSummary(sessionId?: string): Promise<MatchSummary[]> {
    const { data, error } = await this.client.rpc('society_matches_snapshot', {
      p_session_id: sessionId ?? null,
    });
    if (error)
      throw new Error('Falha ao ler partidas. Verifique a migração 202609090001: ' + error.message);
    return data as MatchSummary[];
  }
  async getMatchById(id: string): Promise<MatchSummary | null> {
    const { data, error } = await this.client
      .from('matches')
      .select('session_id')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return (await this.getMatchesSummary(data.session_id)).find((m) => m.matchId === id) ?? null;
  }
  async findById(id: string) {
    const m = await this.getMatchById(id);
    return m ? this.domain(m) : null;
  }
  async findBySessionId(id: string) {
    return (await this.getMatchesSummary(id)).map((m) => this.domain(m));
  }
  async findActiveMatch(id: string) {
    const m = (await this.getMatchesSummary(id)).find((m) => m.status === 'ongoing');
    return m ? this.domain(m) : null;
  }
  async executeCommand(command: MatchCommand): Promise<MatchCommandResult> {
    const { data, error } = await this.client.rpc('society_match_command', {
      p_action: command.action,
      p_match_id: command.matchId ?? null,
      p_input: command.input,
      p_operation_id: command.operationId,
    });
    if (error) throw new Error(error.message);
    const result = data as { match_id: string; event_id?: string; deleted_match?: MatchSummary };
    const match = result.deleted_match ?? await this.getMatchById(result.match_id);
    if (!match)
      throw new Error(
        'Partida salva, mas não foi possível carregar a confirmação. Tente novamente.'
      );
    return { match, eventId: result.event_id };
  }
  async create(match: Match) {
    return this.domain(
      (
        await this.executeCommand({
          action: 'start',
          operationId: crypto.randomUUID(),
          input: {
            sessionId: match.sessionId,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
          },
        })
      ).match
    );
  }
  async update(match: Match) {
    const result = await this.executeCommand({
      action: 'score',
      matchId: match.id,
      operationId: crypto.randomUUID(),
      input: { homeScore: match.homeScore, awayScore: match.awayScore },
    });
    return this.domain(result.match);
  }
  async addEvent(event: MatchEvent) {
    const result = await this.executeCommand({
      action: 'goal',
      matchId: event.matchId,
      operationId: crypto.randomUUID(),
      input: {
        teamId: event.teamId,
        scorerId: event.scorerId,
        assistId: event.assistId,
        isOwnGoal: event.isOwnGoal,
        eventTimeSeconds: event.eventTimeSeconds,
      },
    });
    return new MatchEvent({ ...event.state, id: result.eventId });
  }
  async findEventById(id: string): Promise<MatchEvent | null> {
    const { data, error } = await this.client
      .from('match_events')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data
      ? new MatchEvent({
          id: data.id,
          matchId: data.match_id,
          teamId: data.team_id,
          scorerId: data.scorer_id,
          assistId: data.assist_id,
          isOwnGoal: data.is_own_goal,
          isUnattributed: data.is_unattributed,
          eventTimeSeconds: data.event_time_seconds,
        })
      : null;
  }
  async updateEvent(id: string, data: Partial<MatchEventProps>) {
    const event = await this.findEventById(id);
    if (!event) throw new Error('Evento não encontrado.');
    await this.executeCommand({
      action: 'edit',
      matchId: event.matchId,
      operationId: crypto.randomUUID(),
      input: { eventId: id, ...data },
    });
  }
  async deleteEvent(id: string) {
    const event = await this.findEventById(id);
    if (!event) throw new Error('Evento não encontrado.');
    await this.executeCommand({
      action: 'delete',
      matchId: event.matchId,
      operationId: crypto.randomUUID(),
      input: { eventId: id },
    });
  }
  async recalculateMatchScore(id: string) {
    const m = await this.getMatchById(id);
    if (!m) throw new Error('Partida não encontrada.');
    return { homeScore: m.homeScore, awayScore: m.awayScore };
  }
  async getEventsByMatchId(id: string) {
    return ((await this.getMatchById(id))?.events ?? []).map((e) => new MatchEvent(e));
  }
  async getLeaderboard() {
    return this.getLeaderboardByDateRange();
  }
  async getLeaderboardByDateRange(start?: string, end?: string): Promise<LeaderboardItem[]> {
    const [all, players, historical] = await Promise.all([
      this.getMatchesSummary(),
      new SupabasePlayerRepository(this.client).findAll(),
      new SupabaseHistoricalRepository(this.client).findAll(),
    ]);
    return playerPerformance(
      all.filter((m) => (!start || m.sessionDate >= start) && (!end || m.sessionDate <= end)),
      players.map((p) => ({
        id: p.id!,
        name: p.name,
        nickname: p.nickname,
        avatarUrl: p.avatarUrl,
        isActive: p.isActive,
      })),
      historicalTotalsForPeriod(historical, start, end)
    ).map(performanceLeaderboard);
  }
}
