import { SupabaseSessionRepository } from '../../../../core/infrastructure/repositories/SupabaseSessionRepository';
import { SetSessionStatusUseCase } from '../../../../core/application/use-cases/SetSessionStatusUseCase';
import {
  HttpError,
  endpoint,
  json,
  readJsonObject,
} from '../../../../core/infrastructure/http/api';
import { uuid } from '../../../../core/infrastructure/http/validate';

export const prerender = false;

// Encerrar ({ status: 'finished' }) ou reabrir ({ status: 'ongoing' }) a rodada. Repetir o
// pedido não muda nada, por isso não há Idempotency-Key. Partida em andamento -> 409.
export const PATCH = endpoint(async ({ request, params }) => {
  const sessionId = uuid(params.id, 'id da rodada');
  const { status } = await readJsonObject(request);
  if (status !== 'finished' && status !== 'ongoing')
    throw new HttpError(400, 'status: use finished (encerrar) ou ongoing (reabrir).');
  return json(
    await new SetSessionStatusUseCase(new SupabaseSessionRepository()).execute({
      sessionId,
      status,
    })
  );
});
