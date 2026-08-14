import type { APIRoute } from 'astro';
import { SupabaseSessionRepository } from '../../../core/infrastructure/repositories/SupabaseSessionRepository';
import { CreateSessionUseCase } from '../../../core/application/use-cases/CreateSessionUseCase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const sessionRepo = new SupabaseSessionRepository();
    const id = url.searchParams.get('id');
    const date = url.searchParams.get('date');

    let session = null;

    if (id) {
      session = await sessionRepo.findById(id);
    } else if (date) {
      session = await sessionRepo.findByDate(date);
    } else {
      session = await sessionRepo.findLatest();
    }

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma sessão encontrada.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const payload = {
      id: session.id,
      sessionDate: session.sessionDate,
      status: session.status,
      notes: session.notes,
      teams: session.teams.map((t) => ({
        id: t.id,
        sessionId: t.sessionId,
        name: t.name,
        colorHex: t.colorHex,
        players: t.players.map((tp) => ({
          id: tp.playerId,
          name: tp.player?.name || 'Jogador',
          nickname: tp.player?.nickname || null,
          avatarUrl: tp.player?.avatarUrl || null,
          isLoaned: tp.isLoaned,
        })),
      })),
      createdAt: session.state.createdAt,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao consultar sessão.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const sessionRepo = new SupabaseSessionRepository();
    const useCase = new CreateSessionUseCase(sessionRepo);

    const result = await useCase.execute({
      sessionDate: body.sessionDate,
      notes: body.notes,
      teams: body.teams,
    });

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao criar sessão.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
