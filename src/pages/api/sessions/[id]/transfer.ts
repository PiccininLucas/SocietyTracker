import { SupabaseSessionRepository } from '../../../../core/infrastructure/repositories/SupabaseSessionRepository';
import { TransferPlayerUseCase } from '../../../../core/application/use-cases/TransferPlayerUseCase';
import { endpoint, json, readJsonObject } from '../../../../core/infrastructure/http/api';
import { optionalBoolean, uuid } from '../../../../core/infrastructure/http/validate';

export const prerender = false;

export const POST = endpoint(async ({ request, params }) => {
  const body = await readJsonObject(request);
  const result = await new TransferPlayerUseCase(new SupabaseSessionRepository()).execute({
    sessionId: uuid(params.id, 'id da rodada'),
    fromTeamId: uuid(body.fromTeamId, 'fromTeamId'),
    toTeamId: uuid(body.toTeamId, 'toTeamId'),
    playerId: uuid(body.playerId, 'playerId'),
    isLoaned: optionalBoolean(body.isLoaned, 'isLoaned'),
    // Sem isto o goleiro chegava ao time de destino como jogador de linha, e o
    // match_participants da partida seguinte herdava a flag errada.
    isGoalkeeper: optionalBoolean(body.isGoalkeeper, 'isGoalkeeper'),
  });
  return json(result);
});
