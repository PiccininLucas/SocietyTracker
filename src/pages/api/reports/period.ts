import type { APIRoute } from 'astro';
import { SupabaseMatchRepository } from '../../../core/infrastructure/repositories/SupabaseMatchRepository';
import { GetPeriodLeaderboardUseCase } from '../../../core/application/use-cases/GetPeriodLeaderboardUseCase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const matchRepo = new SupabaseMatchRepository();
    const useCase = new GetPeriodLeaderboardUseCase(matchRepo);

    const typeParam = url.searchParams.get('type');
    const type = typeParam === 'month' ? 'month' : typeParam === 'year' ? 'year' : 'all';
    const yearMonth = url.searchParams.get('yearMonth') || undefined;

    const result = await useCase.execute({
      type,
      yearMonth,
      year: url.searchParams.get('year') || undefined,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro ao processar ranking consolidado.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
