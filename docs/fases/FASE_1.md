# Fase 1 — Risco imediato: gols perdidos e segurança (22/09/2026)

**Commit:** `c686a09` (22/09, 16:06) · **Plano original:**
[planos/2026-09-22-pontos-de-melhora-e-fase-1.md](planos/2026-09-22-pontos-de-melhora-e-fase-1.md)
(seção "Execução recomendada — Fase 1")

## Contexto

O levantamento de pontos de melhora de 22/09 revisou o repositório em três frentes:
backend e segurança, frontend e UX, e arquitetura, testes e ferramentas. Nessa data,
`npm test` passava 134/134. A Fase 1 pegou os seis itens de risco imediato (1.1 a 1.6):
dava para perder gols na quadra, e havia uma brecha no limite de tentativas do PIN.

## O que foi feito

1. **Autenticação só por cookie**
   ([pinAuth.ts](../../src/core/infrastructure/auth/pinAuth.ts))
   - O PIN deixou de ser aceito nos headers `x-admin-pin` e `Authorization: Bearer`. Esse
     caminho não passava pelo limite de tentativas: com o `GET /api/auth/status` dava para
     testar os 10 mil PINs.
   - A comparação do PIN passou a ser em tempo constante (`timingSafeEqual` sobre os
     digests).
   - Em produção, sem `SESSION_SECRET`, a sessão não é mais emitida nem aceita. Antes o
     app assinava com o valor que está no repositório.
2. **Status HTTP corretos para os comandos do mesário**
   - `DatabaseError` preserva o SQLSTATE.
   - `P0001` com prefixo (`MATCH_LOCKED`, `CONFLICT`, `NOT_FOUND`) vira 409/404; o resto
     do `P0001` vira 400.
   - Rede, PostgREST e erro desconhecido viram **503**, e o celular reenvia com a mesma
     `Idempotency-Key`. Antes qualquer falha era 400 e o gol era descartado da fila.
3. **Mesário mantém a fila no 401:** a sessão expirada deixa os lances pendentes e mostra
   "Entrar com o PIN". Ao voltar do login, a fila é reenviada. Os erros de rede passaram a
   aparecer em português.
4. **Criação da rodada atômica:** `society_create_session` (migration `202609220001`) grava
   sessão, times e escalações numa transação. Antes eram 9 inserts, e uma falha no meio
   deixava uma rodada órfã que bloqueava a mesma data. Data repetida responde 409.
5. **Permissões das RPCs de escrita:** a migration `202609220002` revoga o `EXECUTE` de
   `anon` e `authenticated`. Os default privileges do Supabase concediam esse acesso
   apesar do `REVOKE … FROM PUBLIC`: com a URL e a chave publicável dava para gravar gols
   sem PIN.
6. **Fuso horário:** a data de hoje, o ano padrão e o horário das partidas passaram a usar
   `America/Sao_Paulo` (`APP_TIME_ZONE`) em vez do UTC do servidor.

## Migrations

`202609220001_create_session_rpc` e `202609220002_revoke_public_rpc_execute`, aplicadas em
produção em 22/09, antes do deploy. O usuário confirmou que o `SESSION_SECRET` está
definido na Vercel.

## Decisões

- O `ADMIN_PIN` continua 1234 (risco aceito em 21/09).
- Toda migration com função nova passa a terminar com
  `REVOKE ALL … FROM PUBLIC, anon, authenticated` e `GRANT EXECUTE … TO service_role`.

## Testes

- **`api-errors.test.ts`:** a classificação por SQLSTATE.
- **`auth.test.ts`:** os headers passam a dar falso, e produção sem secret lança erro.
- **`transactions.test.ts`:** `society_create_session` com sucesso, rollback no meio e data
  repetida (CONFLICT), e as RPCs de escrita executáveis só pela `service_role`.
- **`match-sync.test.ts`:** 401 vira "entre de novo" e nunca descarta o gol; falha de rede
  aparece em português e continua reenviável.
- **`competition.test.ts`:** a data de hoje em Brasília com o servidor em UTC.

## Próximas fases previstas no plano

Fase 2 (quadra), Fase 3 (base) e Fase 4 (UX e desempenho). Ver o [README](README.md).
