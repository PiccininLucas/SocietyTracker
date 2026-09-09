import { scoreFromEvents } from '../../core/domain/services/CompetitionService';
import type { MatchSummary } from '../../core/domain/repositories/IMatchRepository';
import type { MatchAction } from '../../core/domain/repositories/IMatchCommands';
export interface PendingCommand {
  operationId: string;
  action: MatchAction;
  matchId?: string;
  input: Record<string, unknown>;
}
export interface TimerState {
  remaining: number;
  elapsed: number;
  running: boolean;
  anchor: number;
}
export interface SessionCache {
  version: 2;
  sessionId: string;
  pending: PendingCommand[];
  timers: Record<string, TimerState>;
  matches: MatchSummary[];
}
export const cacheKey = (id: string) => 'society_active_match_state:' + id;
export function readCache(sessionId: string): SessionCache {
  const empty: SessionCache = { version: 2, sessionId, pending: [], timers: {}, matches: [] };
  try {
    const value = JSON.parse(localStorage.getItem(cacheKey(sessionId)) ?? 'null');
    return value?.version === 2 && value.sessionId === sessionId ? value : empty;
  } catch {
    return empty;
  }
}
export function saveCache(cache: SessionCache) {
  localStorage.setItem(cacheKey(cache.sessionId), JSON.stringify(cache));
}
export function timerNow(timer: TimerState, now = Date.now()) {
  const delta = timer.running ? Math.max(0, Math.floor((now - timer.anchor) / 1000)) : 0;
  return { remaining: Math.max(0, timer.remaining - delta), elapsed: timer.elapsed + delta };
}
export async function sendCommand(command: PendingCommand): Promise<MatchSummary> {
  let path = command.action === 'start' ? '/api/matches/start' : '/api/matches/' + command.matchId;
  let method = 'POST';
  if (command.action === 'goal') path += '/goals';
  if (command.action === 'finish') path += '/finish';
  if (command.action === 'score') method = 'PATCH';
  if (command.action === 'remove_match') method = 'DELETE';
  if (command.action === 'edit' || command.action === 'delete') {
    path += '/events/' + command.input.eventId;
    method = command.action === 'edit' ? 'PATCH' : 'DELETE';
  }
  const res = await fetch(path, {
    method,
    signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': command.operationId },
    ...(method === 'DELETE' ? {} : { body: JSON.stringify(command.input) }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível salvar. Tente novamente.');
  return body.match as MatchSummary;
}
export function projectPending(matches: MatchSummary[], pending: PendingCommand[]): MatchSummary[] {
  const byId = new Map(matches.map((m) => [m.matchId, { ...m, events: [...(m.events ?? [])] }]));
  for (const op of pending) {
    const m = byId.get(op.matchId ?? '');
    if (!m) continue;
    if (op.action === 'goal') {
      // A refresh may observe a committed goal before its lost acknowledgement is retried.
      if (m.events.some((event) => event.id === op.operationId)) continue;
      const d = op.input;
      const players = [...(m.homePlayers ?? []), ...(m.awayPlayers ?? [])];
      const scorer = players.find((p) => p.id === d.scorerId),
        assist = players.find((p) => p.id === d.assistId);
      m.events.push({
        id: op.operationId,
        matchId: m.matchId,
        teamId: String(d.teamId),
        scorerId: d.scorerId as string | null,
        assistId: d.assistId as string | null,
        eventTimeSeconds: Number(d.eventTimeSeconds ?? 0),
        isOwnGoal: !!d.isOwnGoal,
        scorerName: scorer?.nickname ?? scorer?.name,
        assistName: assist?.nickname ?? assist?.name,
      });
    }
    if (op.action === 'delete') m.events = m.events.filter((e) => e.id !== op.input.eventId);
    if (op.action === 'edit')
      m.events = m.events.map((e) => {
        if (e.id !== op.input.eventId) return e;
        const players = [...(m.homePlayers ?? []), ...(m.awayPlayers ?? [])];
        const scorer = players.find((p) => p.id === op.input.scorerId),
          assist = players.find((p) => p.id === op.input.assistId);
        return {
          ...e,
          ...op.input,
          scorerName: op.input.isOwnGoal ? 'Gol contra' : scorer?.nickname || scorer?.name,
          assistName: assist?.nickname || assist?.name,
        };
      });
    // Other screens use only acknowledged results. This projection is explicitly pending.
    const scores = scoreFromEvents(m.homeTeamId!, m.awayTeamId!, m.events);
    m.homeScore = scores.homeScore;
    m.awayScore = scores.awayScore;
  }
  return [...byId.values()];
}

// Apply the server acknowledgement before removing the durable pending command.
export function applyMatchResult(cache: SessionCache, match: MatchSummary): SessionCache {
  const matches = cache.matches.filter((m) => m.matchId !== match.matchId);
  const timers = { ...cache.timers };
  if (match.deletedAt) delete timers[match.matchId];
  else matches.push(match);
  return { ...cache, matches, timers };
}
