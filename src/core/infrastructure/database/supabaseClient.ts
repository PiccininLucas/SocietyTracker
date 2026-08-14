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

const supabaseUrl = sanitizeSupabaseUrl(rawUrl);

const supabaseAnonKey =
  getEnv('SUPABASE_SERVICE_ROLE_KEY') ||
  getEnv('PUBLIC_SUPABASE_ANON_KEY') ||
  getEnv('SUPABASE_ANON_KEY') ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export const isSupabaseConfigured =
  !supabaseUrl.includes('society-tracker-placeholder') &&
  !supabaseAnonKey.includes('placeholder');

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);


