import type { APIRoute } from 'astro';
import { matchCommand } from '../../../core/infrastructure/http/matchApi';
export const prerender = false;
export const POST: APIRoute = (c) => matchCommand(c, 'start');
