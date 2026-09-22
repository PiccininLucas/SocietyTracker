/**
 * Erro vindo do Supabase/PostgreSQL com o SQLSTATE preservado.
 *
 * `new Error(error.message)` descartava o código, e a API passava a adivinhar o status
 * pelo texto. Com o código, a camada HTTP distingue regra de negócio (`P0001` dos
 * `RAISE EXCEPTION`), dado inválido (classes 22/23) e falha transitória (rede, timeout,
 * PostgREST), que o mesário precisa reenviar em vez de descartar.
 */
export class DatabaseError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string | null) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code || undefined;
  }
}
