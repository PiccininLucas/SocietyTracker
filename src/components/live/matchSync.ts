import { scoreFromEvents } from '../../core/domain/services/CompetitionService';
import type { MatchSummary } from '../../core/domain/repositories/IMatchRepository';
import type { MatchAction } from '../../core/domain/repositories/IMatchCommands';
import {
  MAX_GOALS_FOR_VICTORY,
  DEFAULT_MATCH_DURATION_SECONDS,
  type LiveTeam,
  type LivePlayer,
} from './types';
export interface PendingCommand {
  operationId: string;
  action: MatchAction;
  matchId?: string;
  input: Record<string, unknown>;
  /**
   * Só do aparelho, nunca vai ao servidor: antes deste instante (epoch ms) a operação fica
   * retida na fila. É a janela do "Desfazer" gol — tirar da fila um lance que o servidor
   * ainda não viu desfaz tudo, inclusive o encerramento pela regra dos dois gols.
   */
  sendAfter?: number;
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
/**
 * O servidor recusou a operação por um motivo que não muda com o tempo (400/404/409...).
 * Reenviá-la só bloquearia tudo o que vier depois na fila.
 */
export class CommandRejectedError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'CommandRejectedError';
  }
}

/**
 * A sessão do mesário expirou (cookie de 24h) ou foi invalidada. Não é uma recusa do
 * lance: a operação fica na fila e é reenviada depois de um novo login.
 */
export class AuthRequiredError extends Error {
  constructor() {
    super('Sessão de mesário expirada. Entre com o PIN de novo para enviar os lances.');
    this.name = 'AuthRequiredError';
  }
}

/**
 * Espera até a próxima tentativa automática depois de uma falha transitória: 2s, 4s, 8s…
 * até 30s, com ±20% de variação para vários aparelhos não baterem juntos no servidor.
 */
export function retryDelay(attempt: number, random = Math.random): number {
  const base = 2000 * 2 ** Math.min(Math.max(0, attempt), 10);
  return Math.min(30000, Math.round(base * (0.8 + 0.4 * random())));
}

/** 4xx é definitivo, exceto os que pedem explicitamente para tentar de novo. */
function isRetryable(status: number) {
  return status >= 500 || status === 408 || status === 429;
}

/** Troca "Failed to fetch" / "signal timed out" do navegador por uma mensagem em português. */
export function describeNetworkError(error: unknown): string {
  const name = (error as { name?: unknown } | null)?.name;
  if (name === 'TimeoutError' || name === 'AbortError') return 'O servidor demorou para responder.';
  if (error instanceof TypeError) return 'Sem conexão com o servidor.';
  return error instanceof Error && error.message ? error.message : 'Falha de rede.';
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
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': command.operationId },
      ...(method === 'DELETE' ? {} : { body: JSON.stringify(command.input) }),
    });
  } catch (error) {
    throw new Error(describeNetworkError(error), { cause: error });
  }

  // Um 502/504 do gateway responde HTML: `res.json()` lançaria SyntaxError antes de
  // chegarmos ao tratamento de status, e o mesário veria "Unexpected token '<'".
  const body = await res.json().catch(() => null);

  if (res.status === 401) throw new AuthRequiredError();
  if (!res.ok) {
    const message =
      body?.error ??
      (isRetryable(res.status)
        ? 'Servidor indisponível no momento.'
        : 'Não foi possível salvar. Tente novamente.');
    if (!isRetryable(res.status)) throw new CommandRejectedError(message, res.status);
    throw new Error(message);
  }
  if (!body?.match) throw new Error('Resposta do servidor incompleta. Tente novamente.');
  return body.match as MatchSummary;
}
/** O que a projeção precisa saber da rodada para montar uma partida que o servidor ainda não viu. */
export interface ProjectionContext {
  sessionId: string;
  sessionDate: string;
  teams: LiveTeam[];
  durationSeconds: number;
  now?: number;
}

function participant(p: LivePlayer, captainId?: string | null) {
  return {
    id: p.id,
    name: p.name,
    nickname: p.nickname ?? null,
    avatarUrl: p.avatarUrl,
    isCaptain: p.id === captainId || !!p.isCaptain,
    isGoalkeeper: !!p.isGoalkeeper,
    isLoaned: !!p.isLoaned,
    goals: 0,
    assists: 0,
  };
}

/** Espelha o encerramento de `society_match_command`: mesmo motivo, mesma duração. */
function closeMatch(m: MatchSummary, input: Record<string, unknown>, ctx?: ProjectionContext) {
  const duration = Math.max(
    m.durationSeconds ?? 0,
    Number(input.durationSeconds ?? input.eventTimeSeconds ?? 0) || 0
  );
  m.status = 'finished';
  m.durationSeconds = duration;
  m.finishedAt = new Date(ctx?.now ?? Date.now()).toISOString();
  m.endReason =
    m.homeScore >= MAX_GOALS_FOR_VICTORY || m.awayScore >= MAX_GOALS_FOR_VICTORY
      ? 'two_goals'
      : duration >= (ctx?.durationSeconds ?? DEFAULT_MATCH_DURATION_SECONDS)
        ? 'time_limit'
        : 'manual';
}

/**
 * Estado que o mesário vê: o confirmado pelo servidor mais a fila ainda não enviada.
 *
 * Com `ctx`, um `start` pendente vira uma partida com `matchId = operationId` — o mesmo id
 * que o servidor grava (202609220003) —, então gols e finalização podem ser enfileirados
 * para ela offline. O encerramento pelos dois gols e pela finalização também é projetado,
 * para o mesário seguir para o próximo confronto sem esperar a rede.
 */
export function projectPending(
  matches: MatchSummary[],
  pending: PendingCommand[],
  ctx?: ProjectionContext
): MatchSummary[] {
  // A cópia precisa incluir homePlayers/awayPlayers: a projeção empurra o jogador
  // emprestado nesses arrays e, com cópia rasa, isso mutava o cache original — que é
  // gravado no localStorage e alimenta ranking e classificação.
  const byId = new Map(
    matches.map((m) => [
      m.matchId,
      {
        ...m,
        events: [...(m.events ?? [])],
        homePlayers: m.homePlayers ? [...m.homePlayers] : m.homePlayers,
        awayPlayers: m.awayPlayers ? [...m.awayPlayers] : m.awayPlayers,
      },
    ])
  );
  for (const op of pending) {
    if (op.action === 'start') {
      // Uma recarga pode trazer a partida confirmada antes do ack perdido ser reenviado.
      if (!ctx || byId.has(op.operationId)) continue;
      const home = ctx.teams.find((t) => t.id === op.input.homeTeamId);
      const away = ctx.teams.find((t) => t.id === op.input.awayTeamId);
      if (!home || !away) continue;
      const sequence = Math.max(0, ...[...byId.values()].map((x) => x.sequence ?? 0)) + 1;
      byId.set(op.operationId, {
        matchId: op.operationId,
        sessionId: ctx.sessionId,
        sessionDate: ctx.sessionDate,
        sequence,
        lockedAt: null,
        editable: true,
        homeTeamId: home.id,
        homeTeamName: home.name,
        homeTeamColor: home.colorHex,
        homeScore: 0,
        awayTeamId: away.id,
        awayTeamName: away.name,
        awayTeamColor: away.colorHex,
        awayScore: 0,
        durationSeconds: 0,
        endReason: null,
        status: 'ongoing',
        startedAt: new Date(ctx.now ?? Date.now()).toISOString(),
        finishedAt: null,
        events: [],
        homePlayers: home.players.map((p) => participant(p, home.captainId)),
        awayPlayers: away.players.map((p) => participant(p, away.captainId)),
      });
      continue;
    }
    const m = byId.get(op.matchId ?? '');
    if (!m) continue;
    if (op.action === 'goal') {
      // A refresh may observe a committed goal before its lost acknowledgement is retried.
      if (m.events.some((event) => event.id === op.operationId)) continue;
      const d = op.input;
      const isHome = d.teamId === m.homeTeamId;
      const teamPlayerList = isHome ? (m.homePlayers ??= []) : (m.awayPlayers ??= []);

      if (d.scorerId && !teamPlayerList.some((p) => p.id === d.scorerId)) {
        teamPlayerList.push({
          id: String(d.scorerId),
          name: (d.scorerName as string) || 'Atleta',
          nickname: (d.scorerName as string) || null,
          isLoaned: true,
          isGoalkeeper: false,
          isCaptain: false,
          goals: 0,
          assists: 0,
        });
      }
      if (d.assistId && !teamPlayerList.some((p) => p.id === d.assistId)) {
        teamPlayerList.push({
          id: String(d.assistId),
          name: (d.assistName as string) || 'Atleta',
          nickname: (d.assistName as string) || null,
          isLoaned: true,
          isGoalkeeper: false,
          isCaptain: false,
          goals: 0,
          assists: 0,
        });
      }

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
        scorerName: scorer?.nickname ?? scorer?.name ?? (d.scorerName as string | undefined),
        assistName: assist?.nickname ?? assist?.name ?? (d.assistName as string | undefined),
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
    if (m.status !== 'ongoing') continue;
    if (op.action === 'goal' && op.input.eventTimeSeconds !== undefined)
      m.durationSeconds = Math.max(m.durationSeconds ?? 0, Number(op.input.eventTimeSeconds) || 0);
    if (
      op.action === 'finish' ||
      m.homeScore >= MAX_GOALS_FOR_VICTORY ||
      m.awayScore >= MAX_GOALS_FOR_VICTORY
    )
      closeMatch(m, op.input, ctx);
  }
  return [...byId.values()];
}

/**
 * O servidor devolveu o `start` com outro id (ainda sem a 202609220003, ou partida
 * iniciada antes dela): aponta para o id real os lances que foram enfileirados para o
 * id provisório, em vez de deixá-los morrer num 404.
 */
export function remapMatchId(cache: SessionCache, from: string, to: string): SessionCache {
  if (from === to) return cache;
  const timers = { ...cache.timers };
  if (timers[from]) {
    timers[to] ??= timers[from];
    delete timers[from];
  }
  return {
    ...cache,
    timers,
    pending: cache.pending.map((p) => (p.matchId === from ? { ...p, matchId: to } : p)),
  };
}

// Apply the server acknowledgement before removing the durable pending command.
export function applyMatchResult(cache: SessionCache, match: MatchSummary): SessionCache {
  const matches = cache.matches.filter((m) => m.matchId !== match.matchId);
  const timers = { ...cache.timers };
  if (match.deletedAt) delete timers[match.matchId];
  else matches.push(match);
  return { ...cache, matches, timers };
}
