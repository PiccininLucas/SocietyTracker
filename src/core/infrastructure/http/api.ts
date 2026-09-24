import type { APIContext, APIRoute } from 'astro';
import { DomainError } from '../../domain/errors/DomainError';
import { EntityNotFoundError } from '../../domain/errors/EntityNotFoundError';

/**
 * Resposta JSON da API. `no-store` por padrão: uma rota que pode ir para a CDN (como
 * reports/period) declara o próprio `Cache-Control`.
 */
export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });

/** Recusa decidida pela própria rota (entrada inválida), com status e texto finais. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const TRANSIENT_MESSAGE = 'Serviço indisponível no momento. Tente novamente.';

function sqlState(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code ? code : undefined;
}

/**
 * Os `RAISE EXCEPTION` do SQL marcam o tipo da recusa com um prefixo na mensagem. O
 * prefixo decide o status e sai do texto mostrado ao usuário.
 */
function businessRefusal(message: string) {
  const status =
    message.includes('MATCH_LOCKED') || message.includes('CONFLICT')
      ? 409
      : message.includes('NOT_FOUND')
        ? 404
        : 400;
  return { status, message: message.replace(/^(MATCH_LOCKED|CONFLICT|NOT_FOUND):\s*/, '') };
}

/**
 * 4xx só para recusas que não mudam com o tempo: o mesário descarta esses comandos da
 * fila. Qualquer outra falha (rede, timeout, PostgREST, leitura após o commit, erro
 * desconhecido) vira 503 para o cliente reenviar com a mesma `Idempotency-Key`. O texto
 * do Postgres nunca sai no corpo: fica no log do servidor.
 */
export function classifyError(
  error: unknown,
  transientMessage = TRANSIENT_MESSAGE
): { status: number; message: string } {
  const message = error instanceof Error ? error.message : '';
  if (error instanceof HttpError) return { status: error.status, message };
  if (error instanceof EntityNotFoundError) return { status: 404, message };
  if (error instanceof DomainError) return businessRefusal(message);
  if (error instanceof SyntaxError)
    return { status: 400, message: 'Corpo da requisição inválido.' };
  const code = sqlState(error);
  if (code === 'P0001') return businessRefusal(message);
  if (code === '23505') return { status: 409, message: 'Já existe um registro com esses dados.' };
  if (code?.startsWith('22') || code?.startsWith('23'))
    return { status: 400, message: 'Dados inválidos para esta operação.' };
  return { status: 503, message: transientMessage };
}

/** `transientMessage` troca o texto do 503, por exemplo no mesário, que reenvia sozinho. */
export function apiError(error: unknown, transientMessage?: string) {
  const { status, message } = classifyError(error, transientMessage);
  if (status >= 500) console.error('[api] Falha transitória ou inesperada:', error);
  return json({ error: message, code: status === 409 ? 'MATCH_CONFLICT' : undefined }, status);
}

/**
 * Handler comum das rotas: um único ponto converte exceção em resposta, com o mesmo
 * formato `{ error, code? }` e os mesmos status em toda a API.
 */
export function endpoint(
  handler: (context: APIContext) => Promise<Response>,
  options: { transientMessage?: string } = {}
): APIRoute {
  return async (context) => {
    try {
      return await handler(context);
    } catch (error) {
      return apiError(error, options.transientMessage);
    }
  };
}

/** Corpo JSON que precisa ser um objeto. `null`, lista ou JSON inválido viram 400. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, 'Corpo da requisição inválido.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new HttpError(400, 'Corpo da requisição inválido.');
  return body as Record<string, unknown>;
}
