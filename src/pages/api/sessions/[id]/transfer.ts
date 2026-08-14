import type { APIRoute } from 'astro';
import { SupabaseSessionRepository } from '../../../../core/infrastructure/repositories/SupabaseSessionRepository';
import { TransferPlayerUseCase } from '../../../../core/application/use-cases/TransferPlayerUseCase';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  try {
    const sessionId = params.id;
    const body = await request.json();

    const sessionRepo = new SupabaseSessionRepository();
    const useCase = new TransferPlayerUseCase(sessionRepo);

    const result = await useCase.execute({
      sessionId,
      fromTeamId: body.fromTeamId,
      toTeamId: body.toTeamId,
      playerId: body.playerId,
      isLoaned: body.isLoaned,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao transferir jogador.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
