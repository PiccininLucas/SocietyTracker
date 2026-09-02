import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Função para buscar e limpar variáveis de ambiente
function getEnv(key: string): string {
  const g = globalThis as any;
  let val = (
    (typeof process !== 'undefined' && process.env?.[key]) ||
    (import.meta.env as any)?.[key] ||
    (typeof g.process !== 'undefined' && g.process?.env?.[key]) ||
    ''
  ).trim();

  // Remove aspas acidentais adicionadas no .env ou Vercel
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1).trim();
  }

  return val;
}

function sanitizeSupabaseUrl(rawUrl: string): string {
  let url = rawUrl.trim();
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
    url = url.slice(1, -1).trim();
  }
  // Remove caminhos adicionais como /rest/v1 ou barras no final
  url = url.replace(/\/rest\/v1\/?$/, '');
  url = url.replace(/\/+$/, '');
  return url;
}

const rawUrl =
  getEnv('PUBLIC_SUPABASE_URL') ||
  getEnv('SUPABASE_URL') ||
  'https://society-tracker-placeholder.supabase.co';

export const supabaseUrl = sanitizeSupabaseUrl(rawUrl);

/**
 * 1. Chave Anônima Pública (PUBLIC_SUPABASE_ANON_KEY)
 * SEGURA PARA O CLIENTE / NAVEGADOR.
 * NUNCA utiliza ou faz fallback para a SERVICE_ROLE_KEY.
 */
export const supabaseAnonKey =
  getEnv('PUBLIC_SUPABASE_ANON_KEY') ||
  getEnv('SUPABASE_ANON_KEY') ||
  'supabase-placeholder-key';

export const isSupabaseConfigured =
  !supabaseUrl.includes('society-tracker-placeholder') &&
  !supabaseAnonKey.includes('placeholder');

/**
 * Cliente Supabase Público (Usa exclusivamente a Chave Anônima)
 * Seguro para ser utilizado no cliente navegador e leituras públicas.
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 2. Chave de Serviço / Service Role (SUPABASE_SERVICE_ROLE_KEY)
 * USO EXCLUSIVO NO SERVIDOR (API Astro, SSR, Scripts Node/tsx).
 * PROIBIDO NO NAVEGADOR / CLIENTE.
 */
function getServerServiceRoleKey(): string {
  // Proibido no cliente: bloqueia imediatamente em tempo de execução
  if (typeof window !== 'undefined') {
    throw new Error(
      'Security Exception: SUPABASE_SERVICE_ROLE_KEY is strictly forbidden in browser/client environments.'
    );
  }

  const g = globalThis as any;
  const key = (
    (typeof process !== 'undefined' && process.env?.SUPABASE_SERVICE_ROLE_KEY) ||
    (import.meta.env as any)?.SUPABASE_SERVICE_ROLE_KEY ||
    (typeof g.process !== 'undefined' && g.process?.env?.SUPABASE_SERVICE_ROLE_KEY) ||
    ''
  ).trim();

  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    return key.slice(1, -1).trim();
  }

  return key;
}

/**
 * Retorna um cliente Supabase com permissões de administrador (Service Role).
 * Uso exclusivo em contexto de Servidor (Endpoints de API em src/pages/api e scripts Node).
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error(
      'Security Exception: getSupabaseAdminClient cannot be invoked in browser/client environments.'
    );
  }

  const serviceRoleKey = getServerServiceRoleKey();
  const activeKey = serviceRoleKey || supabaseAnonKey;

  return createClient(supabaseUrl, activeKey);
}

/**
 * Cliente Supabase Admin para uso no servidor (SSR / API / Repositórios do servidor).
 * No navegador, este objeto é nulo/fallback para o cliente anônimo para evitar vazamentos.
 */
export const supabaseAdmin: SupabaseClient =
  typeof window === 'undefined' ? getSupabaseAdminClient() : supabase;
