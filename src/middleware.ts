import { defineMiddleware } from 'astro:middleware';
import { isAuthenticatedFromRequest } from './core/infrastructure/auth/pinAuth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  const method = context.request.method;

  // 1. Páginas Administrativas protegidas (SSR)
  const isProtectedPage =
    pathname.startsWith('/rodada/nova') ||
    pathname.startsWith('/rodada/mesario');

  if (isProtectedPage) {
    const isAuth = isAuthenticatedFromRequest(context.cookies, context.request);
    if (!isAuth) {
      const redirectTarget = encodeURIComponent(`${pathname}${search}`);
      return context.redirect(`/login?redirect=${redirectTarget}`);
    }
  }

  // 2. Endpoints de Escrita Protegidos (POST / PUT / DELETE / PATCH em /api/)
  const isApiRoute = pathname.startsWith('/api/');
  const isAuthApi = pathname.startsWith('/api/auth/');
  const isWriteMethod = !['GET', 'HEAD', 'OPTIONS'].includes(method);

  if (isApiRoute && !isAuthApi && isWriteMethod) {
    const isAuth = isAuthenticatedFromRequest(context.cookies, context.request);
    if (!isAuth) {
      return new Response(
        JSON.stringify({
          error: 'Acesso não autorizado. Forneça o PIN de administrador para gravar dados.',
          code: 'UNAUTHORIZED_ADMIN_PIN',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // Permite todas as rotas públicas (/, /historico, /login, GET /api/*, etc.)
  return next();
});
