import type { APIRoute } from 'astro';
import { SupabaseSessionRepository } from '../../../core/infrastructure/repositories/SupabaseSessionRepository';
import { SupabaseMatchRepository } from '../../../core/infrastructure/repositories/SupabaseMatchRepository';
import { GetRoundHighlightsUseCase } from '../../../core/application/use-cases/GetRoundHighlightsUseCase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const sessionRepo = new SupabaseSessionRepository();
    const matchRepo = new SupabaseMatchRepository();
    const useCase = new GetRoundHighlightsUseCase(sessionRepo, matchRepo);

    const sessionId = url.searchParams.get('sessionId') || undefined;
    const date = url.searchParams.get('date') || undefined;

    const result = await useCase.execute({ sessionId, date });

    if (!result) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma rodada encontrada para os parâmetros informados.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao processar destaques da rodada.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
