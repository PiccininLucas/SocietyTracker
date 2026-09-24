import { SupabasePlayerRepository } from '../../../core/infrastructure/repositories/SupabasePlayerRepository';
import { CreatePlayerUseCase } from '../../../core/application/use-cases/CreatePlayerUseCase';
import { endpoint, json, readJsonObject } from '../../../core/infrastructure/http/api';
import {
  nullableString,
  optionalBoolean,
  requiredString,
} from '../../../core/infrastructure/http/validate';

export const prerender = false;

export const GET = endpoint(async () => {
  const players = await new SupabasePlayerRepository().findAll(true);
  return json(
    players.map((p) => ({
      id: p.id,
      name: p.name,
      nickname: p.nickname,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      isGoalkeeper: p.isGoalkeeper,
      isActive: p.isActive,
    }))
  );
});

export const POST = endpoint(async ({ request }) => {
  const body = await readJsonObject(request);
  const result = await new CreatePlayerUseCase(new SupabasePlayerRepository()).execute({
    name: requiredString(body.name, 'name'),
    nickname: nullableString(body.nickname, 'nickname'),
    avatarUrl: nullableString(body.avatarUrl, 'avatarUrl'),
    isGoalkeeper: optionalBoolean(body.isGoalkeeper, 'isGoalkeeper') ?? false,
    isActive: optionalBoolean(body.isActive, 'isActive') ?? true,
  });
  return json(result, 201);
});
