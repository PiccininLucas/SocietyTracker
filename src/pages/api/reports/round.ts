import { SupabaseSessionRepository } from '../../../core/infrastructure/repositories/SupabaseSessionRepository';
import { SupabaseMatchRepository } from '../../../core/infrastructure/repositories/SupabaseMatchRepository';
import { GetRoundHighlightsUseCase } from '../../../core/application/use-cases/GetRoundHighlightsUseCase';
import { endpoint, json } from '../../../core/infrastructure/http/api';
import { isoDate, uuid } from '../../../core/infrastructure/http/validate';

export const prerender = false;

export const GET = endpoint(async ({ url }) => {
  const sessionIdParam = url.searchParams.get('sessionId');
  const dateParam = url.searchParams.get('date');
  const useCase = new GetRoundHighlightsUseCase(
    new SupabaseSessionRepository(),
    new SupabaseMatchRepository()
  );

  const result = await useCase.execute({
    sessionId: sessionIdParam ? uuid(sessionIdParam, 'sessionId') : undefined,
    date: dateParam ? isoDate(dateParam, 'date') : undefined,
  });

  if (!result)
    return json({ error: 'Nenhuma rodada encontrada para os parâmetros informados.' }, 404);
  return json(result);
});
