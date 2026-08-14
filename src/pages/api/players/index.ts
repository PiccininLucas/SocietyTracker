import type { APIRoute } from 'astro';
import { SupabasePlayerRepository } from '../../../core/infrastructure/repositories/SupabasePlayerRepository';
import { CreatePlayerUseCase } from '../../../core/application/use-cases/CreatePlayerUseCase';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const playerRepo = new SupabasePlayerRepository();
    const players = await playerRepo.findAll(true);

    const payload = players.map((p) => ({
      id: p.id,
      name: p.name,
      nickname: p.nickname,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      isActive: p.isActive,
    }));

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao listar jogadores.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const playerRepo = new SupabasePlayerRepository();
    const useCase = new CreatePlayerUseCase(playerRepo);

    const result = await useCase.execute({
      name: body.name,
      nickname: body.nickname,
      avatarUrl: body.avatarUrl,
      isActive: body.isActive ?? true,
    });

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao cadastrar jogador.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
