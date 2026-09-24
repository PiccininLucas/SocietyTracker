import { SupabasePlayerRepository } from '../../../core/infrastructure/repositories/SupabasePlayerRepository';
import { UpdatePlayerUseCase } from '../../../core/application/use-cases/UpdatePlayerUseCase';
import type { UpdatePlayerInputDTO } from '../../../core/application/dtos/UpdatePlayerDTO';
import { endpoint, json, readJsonObject } from '../../../core/infrastructure/http/api';
import {
  nullableString,
  optionalBoolean,
  optionalString,
  uuid,
} from '../../../core/infrastructure/http/validate';

export const prerender = false;

export const PATCH = endpoint(async ({ request, params }) => {
  const id = uuid(params.id, 'id do jogador');
  const body = await readJsonObject(request);

  // PATCH parcial: só repassamos o que veio no corpo, para que ausente continue
  // significando "não alterar" em vez de "limpar".
  const update: UpdatePlayerInputDTO = { id };
  const name = optionalString(body.name, 'name');
  const nickname = nullableString(body.nickname, 'nickname');
  const isGoalkeeper = optionalBoolean(body.isGoalkeeper, 'isGoalkeeper');
  if (name !== undefined) update.name = name;
  if (nickname !== undefined) update.nickname = nickname;
  if (isGoalkeeper !== undefined) update.isGoalkeeper = isGoalkeeper;

  return json(await new UpdatePlayerUseCase(new SupabasePlayerRepository()).execute(update));
});
