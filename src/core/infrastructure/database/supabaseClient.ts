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
 * 1. Chave Pública / Publicável (PUBLIC_SUPABASE_PUBLISHABLE_KEY)
 * SEGURA PARA O CLIENTE / NAVEGADOR.
 * Inclui retrocompatibilidade com PUBLIC_SUPABASE_ANON_KEY e SUPABASE_ANON_KEY.
 * NUNCA utiliza ou faz fallback para SUPABASE_SECRET_KEY / SERVICE_ROLE_KEY.
 */
export const supabasePublishableKey =
  getEnv('PUBLIC_SUPABASE_PUBLISHABLE_KEY') ||
  getEnv('PUBLIC_SUPABASE_ANON_KEY') ||
  getEnv('SUPABASE_ANON_KEY') ||
  'supabase-placeholder-key';

// Alias para retrocompatibilidade
export const supabaseAnonKey = supabasePublishableKey;

export const isSupabaseConfigured =
  !supabaseUrl.includes('society-tracker-placeholder') &&
  !supabasePublishableKey.includes('placeholder');

/**
 * Cliente Supabase Público (Frontend / Islands / Leituras Públicas)
 * Instanciado utilizando exclusivamente PUBLIC_SUPABASE_URL e PUBLIC_SUPABASE_PUBLISHABLE_KEY.
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabasePublishableKey);

/**
 * 2. Chave Secreta / Secret Key (SUPABASE_SECRET_KEY)
 * USO EXCLUSIVO NO SERVIDOR (API Astro, SSR, Scripts Node/tsx).
 * PROIBIDO NO NAVEGADOR / CLIENTE.
 * Inclui retrocompatibilidade com SUPABASE_SERVICE_ROLE_KEY.
 */
function getServerSecretKey(): string {
  // Proibido no cliente: bloqueia imediatamente em tempo de execução
  if (typeof window !== 'undefined') {
    throw new Error(
      'Security Exception: SUPABASE_SECRET_KEY is strictly forbidden in browser/client environments.'
    );
  }

  const g = globalThis as any;
  const key = (
    (typeof process !== 'undefined' && (process.env?.SUPABASE_SECRET_KEY || process.env?.SUPABASE_SERVICE_ROLE_KEY)) ||
    (import.meta.env as any)?.SUPABASE_SECRET_KEY ||
    (import.meta.env as any)?.SUPABASE_SERVICE_ROLE_KEY ||
    (typeof g.process !== 'undefined' && (g.process?.env?.SUPABASE_SECRET_KEY || g.process?.env?.SUPABASE_SERVICE_ROLE_KEY)) ||
    ''
  ).trim();

  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    return key.slice(1, -1).trim();
  }

  return key;
}

/**
 * Retorna um cliente Supabase com permissões de administrador (Secret Key).
 * Uso exclusivo em contexto de Servidor (Endpoints de API em src/pages/api e scripts Node).
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error(
      'Security Exception: getSupabaseAdminClient cannot be invoked in browser/client environments.'
    );
  }

  const secretKey = getServerSecretKey();
  const activeKey = secretKey || supabasePublishableKey;

  return createClient(supabaseUrl, activeKey);
}

/**
 * Cliente Supabase Admin para uso no servidor (SSR / API / Repositórios do servidor).
 * No navegador, este objeto é nulo/fallback para o cliente público para evitar vazamentos.
 */
export const supabaseAdmin: SupabaseClient =
  typeof window === 'undefined' ? getSupabaseAdminClient() : supabase;
