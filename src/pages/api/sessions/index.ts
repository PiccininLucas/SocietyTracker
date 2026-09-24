import { SupabaseSessionRepository } from '../../../core/infrastructure/repositories/SupabaseSessionRepository';
import { CreateSessionUseCase } from '../../../core/application/use-cases/CreateSessionUseCase';
import type {
  CreateSessionTeamInputDTO,
  CreateSessionTeamPlayerInputDTO,
} from '../../../core/application/dtos/CreateSessionDTO';
import { HttpError, endpoint, json, readJsonObject } from '../../../core/infrastructure/http/api';
import {
  isoDate,
  nullableString,
  objectList,
  optionalBoolean,
  optionalPositiveInt,
  optionalString,
  optionalUuid,
  optionalUuidList,
  requiredString,
  uuid,
} from '../../../core/infrastructure/http/validate';

export const prerender = false;

export const GET = endpoint(async ({ url }) => {
  const sessionRepo = new SupabaseSessionRepository();
  const id = url.searchParams.get('id');
  const date = url.searchParams.get('date');

  const session = id
    ? await sessionRepo.findById(uuid(id, 'id'))
    : date
      ? await sessionRepo.findByDate(isoDate(date, 'date'))
      : await sessionRepo.findLatest();

  if (!session) return json({ error: 'Nenhuma sessão encontrada.' }, 404);

  return json({
    id: session.id,
    sessionDate: session.sessionDate,
    status: session.status,
    notes: session.notes,
    matchDurationSeconds: session.matchDurationSeconds,
    teams: session.teams.map((t) => ({
      id: t.id,
      sessionId: t.sessionId,
      name: t.name,
      colorHex: t.colorHex,
      captainId: t.captainId || null,
      players: t.players.map((tp) => ({
        id: tp.playerId,
        name: tp.player?.name || 'Jogador',
        nickname: tp.player?.nickname || null,
        avatarUrl: tp.player?.avatarUrl || null,
        isLoaned: tp.isLoaned,
        isGoalkeeper: tp.isGoalkeeper ?? false,
        isCaptain: tp.isCaptain ?? (t.captainId ? t.captainId === tp.playerId : false),
      })),
    })),
    createdAt: session.state.createdAt,
  });
});

/** Elenco do montador: o id do jogador, ou o objeto com as marcas de goleiro e capitão. */
function rosterEntry(value: unknown, field: string): string | CreateSessionTeamPlayerInputDTO {
  if (typeof value === 'string') return uuid(value, field);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, `${field}: informe o id do jogador ou um objeto.`);
  const entry = value as Record<string, unknown>;
  return {
    playerId: uuid(entry.playerId, `${field}.playerId`),
    isGoalkeeper: optionalBoolean(entry.isGoalkeeper, `${field}.isGoalkeeper`),
    isCaptain: optionalBoolean(entry.isCaptain, `${field}.isCaptain`),
  };
}

function teamsInput(value: unknown): CreateSessionTeamInputDTO[] | undefined {
  if (value === undefined) return undefined;
  return objectList(value, 'teams', (t, p) => {
    if (t.players !== undefined && !Array.isArray(t.players))
      throw new HttpError(400, `${p}.players: informe uma lista.`);
    return {
      name: requiredString(t.name, `${p}.name`),
      colorHex: optionalString(t.colorHex, `${p}.colorHex`),
      captainId: optionalUuid(t.captainId, `${p}.captainId`),
      playerIds: optionalUuidList(t.playerIds, `${p}.playerIds`),
      players: (t.players as unknown[] | undefined)?.map((entry, i) =>
        rosterEntry(entry, `${p}.players[${i}]`)
      ),
    };
  });
}

// Data repetida -> 409; validação -> 400; banco fora do ar -> 503. Antes tudo saía
// como 400 com a mensagem crua do Postgres.
export const POST = endpoint(
  async ({ request }) => {
    const body = await readJsonObject(request);
    const result = await new CreateSessionUseCase(new SupabaseSessionRepository()).execute({
      sessionDate: isoDate(body.sessionDate, 'sessionDate'),
      notes: nullableString(body.notes, 'notes'),
      matchDurationSeconds: optionalPositiveInt(body.matchDurationSeconds, 'matchDurationSeconds'),
      teams: teamsInput(body.teams),
    });
    return json(result, 201);
  },
  {
    transientMessage: 'Servidor indisponível no momento. Os times não foram salvos; tente de novo.',
  }
);
