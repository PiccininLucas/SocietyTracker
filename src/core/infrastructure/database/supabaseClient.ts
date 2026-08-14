import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Função para buscar variáveis de ambiente tanto no Node (process.env) quanto no Vite/Astro (import.meta.env)
function getEnv(key: string): string {
  const g = globalThis as any;
  return (
    (typeof process !== 'undefined' && process.env?.[key]) ||
    (import.meta.env as any)?.[key] ||
    (typeof g.process !== 'undefined' && g.process?.env?.[key]) ||
    ''
  ).trim();
}

const supabaseUrl =
  getEnv('PUBLIC_SUPABASE_URL') ||
  getEnv('SUPABASE_URL') ||
  'https://society-tracker-placeholder.supabase.co';

const supabaseAnonKey =
  getEnv('SUPABASE_SERVICE_ROLE_KEY') ||
  getEnv('PUBLIC_SUPABASE_ANON_KEY') ||
  getEnv('SUPABASE_ANON_KEY') ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export const isSupabaseConfigured =
  !supabaseUrl.includes('society-tracker-placeholder') &&
  !supabaseAnonKey.includes('placeholder');

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

