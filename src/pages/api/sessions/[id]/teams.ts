import { SupabaseSessionRepository } from '../../../../core/infrastructure/repositories/SupabaseSessionRepository';
import { UpdateSessionTeamsUseCase } from '../../../../core/application/use-cases/UpdateSessionTeamsUseCase';
import { endpoint, json, readJsonObject } from '../../../../core/infrastructure/http/api';
import {
  objectList,
  optionalBoolean,
  optionalString,
  optionalUuid,
  requiredString,
  uuid,
} from '../../../../core/infrastructure/http/validate';

export const prerender = false;

// Só PUT: a RPC apaga e regrava a escalação inteira, então não existe um POST aditivo.
export const PUT = endpoint(async ({ request, params }) => {
  const sessionId = uuid(params.id, 'id da rodada');
  const body = await readJsonObject(request);
  const teams = objectList(body.teams, 'teams', (t, p) => ({
    id: uuid(t.id, `${p}.id`),
    name: requiredString(t.name, `${p}.name`),
    captainId: optionalUuid(t.captainId, `${p}.captainId`),
    colorHex: optionalString(t.colorHex, `${p}.colorHex`),
    players: objectList(t.players ?? [], `${p}.players`, (pl, pp) => ({
      playerId: uuid(pl.playerId, `${pp}.playerId`),
      isGoalkeeper: optionalBoolean(pl.isGoalkeeper, `${pp}.isGoalkeeper`),
      isLoaned: optionalBoolean(pl.isLoaned, `${pp}.isLoaned`),
      isCaptain: optionalBoolean(pl.isCaptain, `${pp}.isCaptain`),
    })),
  }));

  return json(
    await new UpdateSessionTeamsUseCase(new SupabaseSessionRepository()).execute({
      sessionId,
      teams,
    })
  );
});
