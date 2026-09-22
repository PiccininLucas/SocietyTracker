import type { APIContext } from 'astro';
import type { IMatchCommands, MatchAction } from '../../domain/repositories/IMatchCommands';
import { MatchCommandUseCase } from '../../application/use-cases/MatchCommandUseCase';
import { SupabaseMatchRepository } from '../repositories/SupabaseMatchRepository';
import { DomainError } from '../../domain/errors/DomainError';
export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const TRANSIENT_MESSAGE =
  'Servidor indisponível no momento. A operação continua pendente e será reenviada.';

function sqlState(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code ? code : undefined;
}

/**
 * Os `RAISE EXCEPTION` do SQL marcam o tipo da recusa com um prefixo na mensagem. O
 * prefixo decide o status e sai do texto mostrado ao usuário.
 */
function businessRefusal(message: string) {
  const status =
    message.includes('MATCH_LOCKED') || message.includes('CONFLICT')
      ? 409
      : message.includes('NOT_FOUND')
        ? 404
        : 400;
  return { status, message: message.replace(/^(MATCH_LOCKED|CONFLICT|NOT_FOUND):\s*/, '') };
}

/**
 * 4xx só para recusas que não mudam com o tempo: o mesário descarta esses comandos da
 * fila. Qualquer outra falha (rede, timeout, PostgREST, leitura após o commit, erro
 * desconhecido) vira 503 para o cliente reenviar com a mesma `Idempotency-Key`.
 */
export function classifyError(
  error: unknown,
  transientMessage = TRANSIENT_MESSAGE
): { status: number; message: string } {
  const message = error instanceof Error ? error.message : '';
  if (error instanceof DomainError) return businessRefusal(message);
  if (error instanceof SyntaxError) return { status: 400, message: 'Corpo da requisição inválido.' };
  const code = sqlState(error);
  if (code === 'P0001') return businessRefusal(message);
  if (code === '23505') return { status: 409, message: 'Já existe um registro com esses dados.' };
  if (code?.startsWith('22') || code?.startsWith('23'))
    return { status: 400, message: 'Dados inválidos para esta operação.' };
  return { status: 503, message: transientMessage };
}

/** `transientMessage` troca o texto do 503 fora do mesário, onde nada é reenviado sozinho. */
export function apiError(error: unknown, transientMessage?: string) {
  const { status, message } = classifyError(error, transientMessage);
  if (status >= 500) console.error('[api] Falha transitória ou inesperada:', error);
  return json({ error: message, code: status === 409 ? 'MATCH_CONFLICT' : undefined }, status);
}
export async function matchCommand(
  context: APIContext,
  action: MatchAction,
  repository: IMatchCommands = new SupabaseMatchRepository()
) {
  try {
    const body =
      context.request.method === 'DELETE'
        ? {}
        : ((await context.request.json()) as Record<string, unknown>);
    const operationId =
      context.request.headers.get('Idempotency-Key') ??
      (typeof body.operationId === 'string' ? body.operationId : crypto.randomUUID());
    const { operationId: ignored, ...input } = body;
    if (context.params.eventId) input.eventId = context.params.eventId;
    for (const key of ['homeScore', 'awayScore', 'durationSeconds', 'eventTimeSeconds']) {
      if (
        input[key] !== undefined &&
        (typeof input[key] !== 'number' || !Number.isInteger(input[key]) || Number(input[key]) < 0)
      )
        return json({ error: key + ': informe um inteiro não negativo.' }, 400);
    }
    const result = await new MatchCommandUseCase(repository).execute({
      action,
      operationId,
      matchId: action === 'start' ? undefined : context.params.id,
      input,
    });
    const m = result.match;
    // Retain legacy fields while returning the authoritative snapshot.
    return json(
      {
        ...m,
        id: m.matchId,
        match: m,
        event: m.events?.find((e) => e.id === result.eventId),
        eventId: result.eventId,
        isMatchFinished: m.status === 'finished',
        matchEndReason: m.endReason,
      },
      action === 'start' ? 201 : 200
    );
  } catch (error) {
    return apiError(error);
  }
}
