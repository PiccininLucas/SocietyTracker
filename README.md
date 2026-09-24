# SocietyTracker

Placar, artilharia e estatísticas da pelada society de quinta-feira. O mesário registra as
partidas da beira da quadra, pelo celular, e o resto do grupo acompanha a classificação,
o histórico e os cards da rodada para o WhatsApp.

| Página | Para quê | Acesso |
|---|---|---|
| `/` | Classificação: gols, assistências, participações e times | Público |
| `/historico` | Partidas com súmula e filtros | Público |
| `/relatorios` | Cards PNG da rodada, do mês e da temporada | Público |
| `/rodada/nova` | Montagem da rodada: presença, sorteio, capitães e duração | PIN |
| `/rodada/mesario` | Placar ao vivo, cronômetro, gols e correções; funciona sem sinal | PIN |
| `/login` | Teclado do PIN do mesário | — |
| `/offline` | Página servida pelo service worker quando não há cópia guardada | — |

## Stack

- **Astro 7** com SSR na Vercel (`@astrojs/vercel`). As telas interativas são ilhas
  **React 19**. O estilo é **Tailwind CSS v4**, e o TypeScript é estrito.
- **Supabase (PostgreSQL)**, acessado só pelo servidor com a chave secreta
  (`@supabase/supabase-js`). As regras de escrita da partida (gol, fim aos 2 gols, limite
  de tempo, consolidação) vivem na transação SQL `society_match_command`. Ver o
  [ADR 0001](docs/adr/0001-transacao-sql-e-a-autoridade-das-partidas.md).
- **Clean Architecture** em `src/core/`, com `domain`, `application` e `infrastructure`.
  As regras de dependência estão no [AGENT.md](AGENT.md).
- **Testes:** `node:test` via `tsx`, com PGlite para rodar as migrations e o SQL em
  memória, e Playwright para o e2e.
- **Node 24**, fixado no [.nvmrc](.nvmrc).

## Como rodar

```sh
npm ci
cp .env.example .env   # e preencha
npm run dev            # http://localhost:4321
```

| Variável | Onde | Para quê |
|---|---|---|
| `PUBLIC_SUPABASE_URL` | Vercel e `.env` | URL do projeto Supabase. |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel e `.env` | Chave pública do Supabase. Aceita o nome antigo `PUBLIC_SUPABASE_ANON_KEY`. |
| `SUPABASE_SECRET_KEY` | Vercel e `.env` | Chave secreta, só no servidor: todas as consultas passam por ela. Aceita o nome antigo `SUPABASE_SERVICE_ROLE_KEY`. Nunca vai para o navegador. |
| `ADMIN_PIN` | Vercel e `.env` | PIN do mesário. Sem ela vale o PIN padrão do código, que é público, e o servidor registra um erro. |
| `SESSION_SECRET` | Vercel e `.env` | Assina o cookie de sessão do mesário (HMAC-SHA256). Em produção é obrigatória: sem ela o login recusa tudo. Gere com `openssl rand -base64 48`. |
| `SUPABASE_DB_URL` | Só `.env` | Conexão direta ao PostgreSQL, usada só pelos scripts `npm run db:*`. Nunca vai para a Vercel. |

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento. Não registra o service worker. |
| `npm run build` | Build de produção (`dist/` e `.vercel/output/`). |
| `npm run check` | `astro sync` e `tsc --noEmit`. |
| `npm run check:astro` | `astro check`, que confere também os arquivos `.astro`. |
| `npm run lint` | ESLint. |
| `npm run format` / `format:check` | Prettier nos `.ts`, `.tsx` e `.mjs`. |
| `npm test` | Testes de unidade e de SQL (`tests/*.test.ts`). |
| `npm run test:e2e` | Playwright no harness de `tests/ui/`. |
| `npm run db:status` / `db:diff` / `db:grants` | Estado do banco real contra as migrations (só leitura). |
| `npm run db:migrate -- --yes` | Aplica as migrations pendentes, em ordem. |
| `npm run db:mark-applied -- <versão> --yes` | Registra uma migration sem executá-la (usado só na baseline). |

### Testes

- **Unidade e SQL:** os testes de banco montam um PostgreSQL em memória (PGlite) com os
  papéis e os privilégios padrão do Supabase e aplicam todas as migrations, a partir da
  baseline `202608140000`.
- **E2E:** `tests/ui/` é um SPA do Vite com as ilhas React e uma API mínima sobre o PGlite
  ([tests/ui/server.ts](tests/ui/server.ts)). O viewport é de 360 × 640. No Windows o
  Playwright usa o Edge instalado; `PLAYWRIGHT_CHANNEL` troca o navegador, e em outros
  sistemas é preciso rodar `npx playwright install chromium`. O harness não carrega o
  `Layout` nem as páginas `.astro`.
- A `touch.spec` confere que todo alvo de toque tem pelo menos 44 × 44 e todo campo tem
  fonte de pelo menos 16 px (abaixo disso o iPhone dá zoom ao focar).

## Deploy

1. **Migration primeiro.** Se o código depende de uma migration nova, aplique-a antes do
   push: `npm run db:status` e depois `npm run db:migrate -- --yes`. As migrations só são
   aplicadas por esses scripts, nunca pelo SQL Editor nem pelo CLI do Supabase. O motivo e
   as regras de uma migration nova estão no [supabase/README.md](supabase/README.md).
2. **Push na `main`.** A Vercel publica a `main` sozinha. O `vercel-build` roda `check` e
   `npm test` antes do build, então um erro de tipo ou um teste quebrado barra a
   publicação.
3. O **CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) roda a cada push e PR:
   lint, formato, tipos, `astro check`, testes, build e e2e.

## PWA e cache

- O **service worker** ([public/sw.js](public/sw.js)) é registrado pelo `Layout` só no
  build de produção. No `astro dev` ele guardaria os módulos do Vite e serviria código
  velho. Ele deixa o app abrir sem sinal: as páginas vêm da rede primeiro e, sem rede, da
  cópia guardada. O `/api/*` passa direto.
- Ao mudar a estratégia do SW, troque a **`VERSION`** no topo do `sw.js`: o `activate`
  apaga os caches das versões antigas.
- Os **ícones** saem de `node scripts/icons.mjs`, a partir do SVG desenhado no próprio
  script. Rode de novo depois de mudar o desenho.
- **`PUBLIC_CACHE_CONTROL`** ([src/core/infrastructure/http/api.ts](src/core/infrastructure/http/api.ts))
  vale para `/`, `/historico`, `/relatorios` e `/api/reports/period`: 60 s de frescor na
  CDN da Vercel e até 5 min servindo a versão anterior enquanto atualiza. Uma página que
  falhou responde `no-store`. Como a CDN não separa o cache por cookie, o `Layout` não lê
  cookie nenhum: o que depende do login, como o botão "Sair", é resolvido no navegador.
- **Fila do mesário:** os lances ficam no `localStorage`, em
  `society_active_match_state:<sessionId>`, e só são enviados com o mesário aberto. As
  outras páginas mostram um aviso quando há lances parados no aparelho.

## Documentação

- [AGENT.md](AGENT.md): regras de arquitetura, código e fluxo de trabalho no repositório.
- [docs/adr/](docs/adr/): decisões de arquitetura.
- [supabase/README.md](supabase/README.md): migrations, baseline e importações.
- [docs/fases/](docs/fases/README.md): o registro das fases de melhoria, com o que cada uma
  resolveu e o que está pendente.
- [society-tracker-specs/](society-tracker-specs/): a especificação original do projeto,
  mantida como estava. Onde ela diverge do código, vale o código e as migrations.
