import type { APIContext } from 'astro';
import type { IMatchCommands, MatchAction } from '../../domain/repositories/IMatchCommands';
import { MatchCommandUseCase } from '../../application/use-cases/MatchCommandUseCase';
import { SupabaseMatchRepository } from '../repositories/SupabaseMatchRepository';
export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Erro inesperado.';
  const status =
    message.includes('MATCH_LOCKED') || message.includes('CONFLICT')
      ? 409
      : message.includes('NOT_FOUND')
        ? 404
        : message.includes('migração')
          ? 503
          : 400;
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
