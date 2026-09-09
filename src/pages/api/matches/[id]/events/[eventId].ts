import type { APIRoute } from 'astro';
import { matchCommand } from '../../../../../core/infrastructure/http/matchApi';
export const prerender = false;
export const PATCH: APIRoute = (c) => matchCommand(c, 'edit');
export const DELETE: APIRoute = (c) => matchCommand(c, 'delete');
