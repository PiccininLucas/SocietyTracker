export const DEFAULT_REDIRECT = '/rodada/mesario';

/**
 * Normaliza o `?redirect=` do login para um caminho interno.
 *
 * Sem isto, `/login?redirect=https://site-falso` levava o mesário — inclusive um já
 * autenticado, pelo `Astro.redirect` da página — para fora do domínio. É o vetor clássico
 * de phishing de credencial: a vítima chega pelo domínio real e é entregue ao falso.
 *
 * `//host` e `/\host` são recusados porque o navegador os trata como URL absoluta
 * protocol-relative, apesar de começarem com barra.
 */
export function safeRedirect(value: string | null | undefined): string {
  if (!value) return DEFAULT_REDIRECT;
  if (!value.startsWith('/')) return DEFAULT_REDIRECT;
  if (value.startsWith('//') || value.startsWith('/\\')) return DEFAULT_REDIRECT;
  return value;
}
