import type { APIRoute } from 'astro';
import { SupabaseMatchRepository } from '../../../core/infrastructure/repositories/SupabaseMatchRepository';
import { GetPeriodLeaderboardUseCase } from '../../../core/application/use-cases/GetPeriodLeaderboardUseCase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const matchRepo = new SupabaseMatchRepository();
    const useCase = new GetPeriodLeaderboardUseCase(matchRepo);

    const typeParam = url.searchParams.get('type');
    const type = typeParam === 'month' ? 'month' : 'all';
    const yearMonth = url.searchParams.get('yearMonth') || undefined;

    const result = await useCase.execute({ type, yearMonth });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao processar ranking consolidado.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
