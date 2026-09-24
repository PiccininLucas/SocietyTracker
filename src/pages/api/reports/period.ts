import { SupabaseMatchRepository } from '../../../core/infrastructure/repositories/SupabaseMatchRepository';
import { GetPeriodLeaderboardUseCase } from '../../../core/application/use-cases/GetPeriodLeaderboardUseCase';
import {
  HttpError,
  PUBLIC_CACHE_CONTROL,
  endpoint,
  json,
} from '../../../core/infrastructure/http/api';
import { year, yearMonth } from '../../../core/infrastructure/http/validate';

export const prerender = false;

export const GET = endpoint(async ({ url }) => {
  const type = url.searchParams.get('type') ?? 'all';
  if (type !== 'month' && type !== 'year' && type !== 'all')
    throw new HttpError(400, 'type: use month, year ou all.');

  // Sem o mês (ou o ano), o recorte caía no histórico inteiro rotulado como mês.
  const result = await new GetPeriodLeaderboardUseCase(new SupabaseMatchRepository()).execute({
    type,
    yearMonth:
      type === 'month' ? yearMonth(url.searchParams.get('yearMonth'), 'yearMonth') : undefined,
    year: type === 'year' ? year(url.searchParams.get('year'), 'year') : undefined,
  });

  // Dados agregados e públicos, sem variação por autenticação — seguro no CDN. O
  // recorte 'all' deixa de varrer o histórico a cada abertura da tela de relatórios.
  return json(result, 200, { 'Cache-Control': PUBLIC_CACHE_CONTROL });
});
