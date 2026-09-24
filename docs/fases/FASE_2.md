# Fase 2 — Modo mesário na quadra (22/09/2026)

**Commit:** `e166717` (22/09, 17:01) · **Plano original:**
[planos/2026-09-22-fase-2.md](planos/2026-09-22-fase-2.md)

## Contexto

A Fase 1 resolveu a perda de gols por erro transitório e por sessão expirada. A Fase 2 é a
lista "quadra": o mesário usa o celular na beira do campo, muitas vezes sem sinal. Até
então:

- a tela apagava com o cronômetro rodando, e não havia aviso de 1 minuto;
- a fila só era reenviada no evento `online` ou num toque;
- offline não dava para começar outra partida, porque o id vinha do servidor;
- duas abas sobrescreviam a fila uma da outra;
- não havia "Desfazer" gol;
- o montador perdia a escalação num reload.

## O que foi feito

1. **Partida iniciada offline:** a migration `202609220003` faz o `start` gravar
   `matches.id = operation id`, o mesmo padrão do gol (`event id = operation id`).
   - O cliente projeta o `start`, o `finish` e o encerramento automático pelos 2 gols. Com
     isso dá para encadear várias partidas sem sinal.
   - `remapMatchId` protege a fila se o servidor devolver outro id, por exemplo sem a
     migration aplicada.
2. **Reenvio automático:** backoff de 2s a 30s com ±20% de jitter. A fila também é enviada
   quando a aba volta a ficar visível, e um pedido de envio feito durante outro envio não
   se perde mais.
3. **"Desfazer" gol:** cada gol fica 5s no aparelho antes de ir ao servidor.
   - Desfazer só tira o gol da fila.
   - No gol da vitória, a partida reabre e o cronômetro volta ao estado de antes.
   - Vale também para o gol contra, que entra com um toque só.
4. **Uma aba por rodada** (Web Locks, `useTabLock`): só a aba dona grava a fila. As outras
   ficam em modo consulta e assumem quando pedido ou quando a dona fecha.
5. **Tela e alertas:**
   - Wake Lock durante a partida;
   - bipe e vibração em 1:00;
   - alerta de tela cheia "TEMPO ESGOTADO", que é o que funciona no iPhone, onde não há
     vibração.
   - Os alertas disparam só no cruzamento, não num reload.
6. **Rascunho do montador** (`teamDraft.ts`): a escalação fica salva no aparelho por 12h,
   com a opção "Descartar". Se o PIN expira ao salvar, o link de login preserva o
   rascunho.
7. O último resultado fica na tela até "Próximo confronto", inclusive depois de um reload,
   e a sugestão de quem entra não se perde.

## Migration

`202609220003_client_match_id`: cópia integral do `society_match_command` da `202609210005`,
só com a coluna `id` no `INSERT`. Está aplicada em produção.

## Decisões

- **"Desfazer"** (decisão do usuário): o gol fica **retido 5s** no aparelho, e desfazer só
  o tira da fila. Vale também para o gol da vitória, porque a partida reabre.
- **Editar ou remover gols com pendências na fila:** continua bloqueado.

## Testes

- **`match-sync.test.ts`:**
  - projeção de `start` com o id da operação;
  - fim pelos 2 gols, e reabertura quando o gol é desfeito;
  - `finish` rotulado como `time_limit` ou `manual`;
  - `remapMatchId`;
  - limites do `retryDelay`;
  - nenhuma mutação do cache.
- **`team-draft.test.ts`:** `sanitizeDraft` descarta versão, idade e forma inválidas,
  jogadores removidos e duplicados.
- **E2E, em rodadas próprias no harness:**
  - `offline.spec`: sem sinal, dois gols encerram, a próxima partida encadeia e tudo
    sincroniza ao voltar; e um 503 reenviado sozinho;
  - `undo.spec`: gol comum, gol da vitória e gol contra;
  - `tabs.spec`;
  - `builder.spec`.
- **`live.spec`:** atualizado para a regra de rodízio da Fase 1. Já falhava antes desta
  fase.

## O que ficou de fora

Previsto para depois:

- PWA e service worker (feito na Fase 4);
- esconder a navegação de baixo durante a partida, e o aviso `beforeunload` (Fase 5);
- botão de som;
- sincronizar entre dois aparelhos.
