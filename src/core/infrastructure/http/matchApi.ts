import type { APIContext } from 'astro';
import type { IMatchCommands, MatchAction } from '../../domain/repositories/IMatchCommands';
import { MatchCommandUseCase } from '../../application/use-cases/MatchCommandUseCase';
import { SupabaseMatchRepository } from '../repositories/SupabaseMatchRepository';
import { apiError, json, readJsonObject } from './api';
import {
  optionalBoolean,
  optionalNonNegativeInt,
  optionalUuid,
  optionalUuidList,
  uuid,
} from './validate';

const PENDING_MESSAGE =
  'Servidor indisponível no momento. A operação continua pendente e será reenviada.';

/**
 * Confere os tipos do que cada comando lê. O objeto não é alterado: o replay compara
 * `op.input <> p_input` no banco, e tirar ou normalizar chaves (ex. `scorerName`, que o
 * cliente manda e o SQL ignora) faria um gol reenviado depois do deploy dar CONFLICT.
 */
function checkInput(input: Record<string, unknown>) {
  for (const key of ['homeScore', 'awayScore', 'durationSeconds', 'eventTimeSeconds'])
    optionalNonNegativeInt(input[key], key);
  for (const key of ['sessionId', 'homeTeamId', 'awayTeamId', 'teamId', 'scorerId', 'assistId'])
    optionalUuid(input[key], key);
  optionalBoolean(input.isOwnGoal, 'isOwnGoal');
  optionalUuidList(input.loanPlayerIds, 'loanPlayerIds');
}

export async function matchCommand(
  context: APIContext,
  action: MatchAction,
  repository: IMatchCommands = new SupabaseMatchRepository()
) {
  try {
    const { request, params } = context;
    const matchId = action === 'start' ? undefined : uuid(params.id, 'id da partida');
    const body = request.method === 'DELETE' ? {} : await readJsonObject(request);
    // Sem chave não há idempotência: sortear uma aqui faria um reenvio de proxy ou do
    // navegador gravar o mesmo gol duas vezes.
    const operationId = uuid(
      request.headers.get('Idempotency-Key') ?? body.operationId,
      'Idempotency-Key'
    );
    const { operationId: _operationId, ...input } = body;
    if (params.eventId) input.eventId = uuid(params.eventId, 'id do lance');
    checkInput(input);

    const result = await new MatchCommandUseCase(repository).execute({
      action,
      operationId,
      matchId,
      input,
    });
    // O cliente lê só `match`; o espalhamento antigo duplicava a súmula inteira na resposta.
    return json({ match: result.match, eventId: result.eventId }, action === 'start' ? 201 : 200);
  } catch (error) {
    return apiError(error, PENDING_MESSAGE);
  }
}
