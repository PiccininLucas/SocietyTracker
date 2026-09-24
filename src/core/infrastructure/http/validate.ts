import { HttpError } from './api';

// Validação de entrada das rotas. Cada função devolve o valor já tipado ou lança 400 com
// `campo: motivo`. As `optional*` aceitam `undefined` (campo ausente) sem reclamar.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalid = (field: string, reason: string) => new HttpError(400, `${field}: ${reason}`);

export function uuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID.test(value))
    throw invalid(field, 'informe um UUID válido.');
  return value;
}

/** `undefined` e `null` passam: a regra de negócio decide se o campo é obrigatório. */
export function optionalUuid(value: unknown, field: string): string | null | undefined {
  return value === undefined || value === null ? value : uuid(value, field);
}

export function optionalUuidList(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw invalid(field, 'informe uma lista de UUIDs.');
  return value.map((item, i) => uuid(item, `${field}[${i}]`));
}

/** Data civil `AAAA-MM-DD` que existe no calendário (recusa 2026-02-30). */
export function isoDate(value: unknown, field: string): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value + 'T12:00:00Z');
    if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value) return value;
  }
  throw invalid(field, 'informe uma data no formato AAAA-MM-DD.');
}

export function yearMonth(value: unknown, field: string): string {
  if (typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  throw invalid(field, 'informe o mês no formato AAAA-MM.');
}

export function year(value: unknown, field: string): string {
  if (typeof value === 'string' && /^\d{4}$/.test(value)) return value;
  throw invalid(field, 'informe o ano com quatro dígitos.');
}

export function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw invalid(field, 'informe um texto.');
  return value;
}

export function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw invalid(field, 'informe um texto.');
  return value;
}

/** Para PATCH: ausente mantém, `null` limpa, texto troca. */
export function nullableString(value: unknown, field: string): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') throw invalid(field, 'informe um texto ou nulo.');
  return value;
}

export function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw invalid(field, 'informe verdadeiro ou falso.');
  return value;
}

export function optionalNonNegativeInt(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
    throw invalid(field, 'informe um inteiro não negativo.');
  return value;
}

export function optionalPositiveInt(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0)
    throw invalid(field, 'informe um inteiro positivo.');
  return value;
}

/** Lista de objetos; cada item passa por `item` com o prefixo `campo[i]`. */
export function objectList<T>(
  value: unknown,
  field: string,
  item: (entry: Record<string, unknown>, prefix: string) => T
): T[] {
  if (!Array.isArray(value)) throw invalid(field, 'informe uma lista.');
  return value.map((entry, i) => {
    const prefix = `${field}[${i}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      throw invalid(prefix, 'informe um objeto.');
    return item(entry as Record<string, unknown>, prefix);
  });
}
