import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** `process` visto por `globalThis`, para runtimes em que o identificador global não existe. */
type GlobalWithProcess = { process?: { env?: Record<string, string | undefined> } };

// Função para buscar e limpar variáveis de ambiente
function getEnv(key: string): string {
  const g = globalThis as GlobalWithProcess;
  // Só `process.env`. Um acesso por índice dinâmico em `import.meta.env` não é
  // substituído estaticamente pelo Vite: em vez disso ele embute o objeto de ambiente
  // INTEIRO no artefato de servidor — inclusive ADMIN_PIN e as chaves do Supabase.
  let val = (
    (typeof process !== 'undefined' && process.env?.[key]) ||
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

  // Nunca `import.meta.env` aqui: é acesso estático, então o Vite grava a chave secreta
  // em texto claro dentro do bundle de servidor em tempo de build. A chave é lida do
  // ambiente em tempo de execução.
  const g = globalThis as GlobalWithProcess;
  const key = (
    (typeof process !== 'undefined' &&
      (process.env?.SUPABASE_SECRET_KEY || process.env?.SUPABASE_SERVICE_ROLE_KEY)) ||
    (typeof g.process !== 'undefined' &&
      (g.process?.env?.SUPABASE_SECRET_KEY || g.process?.env?.SUPABASE_SERVICE_ROLE_KEY)) ||
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

  // Sem degradação silenciosa: todas as RPCs têm GRANT EXECUTE apenas para service_role,
  // inclusive as de leitura. Caindo para a chave publicável, cada requisição falhava com
  // "permission denied for function ..." mapeado para 400 — apontando para a causa
  // errada e tornando o diagnóstico demorado justamente durante o jogo.
  if (!secretKey) {
    throw new Error(
      'Configuração ausente: defina SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) ' +
        'no ambiente do servidor. A chave publicável não tem permissão para as operações ' +
        'de partida.'
    );
  }

  return createClient(supabaseUrl, secretKey);
}

/**
 * Cliente Supabase Admin para uso no servidor (SSR / API / Repositórios do servidor).
 *
 * Criado sob demanda, na primeira utilização. Antes era instanciado no load do módulo —
 * que é importado transitivamente por quase toda página — então um erro de configuração
 * derrubaria o site inteiro no import, em vez de falhar na operação que precisa da chave.
 *
 * No navegador o acesso lança: nenhuma ilha deve importar um repositório, e degradar em
 * silêncio para o cliente público apenas esconderia esse engano até virar erro de
 * permissão confuso.
 */
let adminClient: SupabaseClient | null = null;

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (typeof window !== 'undefined') {
      throw new Error(
        'Security Exception: supabaseAdmin não pode ser usado no navegador. ' +
          'Use uma rota de API em src/pages/api em vez de importar o repositório na ilha.'
      );
    }
    if (!adminClient) adminClient = getSupabaseAdminClient();
    const value = Reflect.get(adminClient, prop);
    return typeof value === 'function' ? value.bind(adminClient) : value;
  },
});
