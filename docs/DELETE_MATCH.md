# Exclusão de partidas no aplicativo

Implementação integrada ao comando transacional existente (Astro API → caso de uso → repositório Supabase → função PostgreSQL) e ao editor compartilhado entre histórico e mesário. O middleware existente exige PIN de administrador nas requisições de escrita.

## Comportamento

- “Apagar partida” aparece na súmula da partida atual e nas recentes ainda editáveis.
- A confirmação identifica número, times e placar e explica a retirada de todos os resultados dos cálculos.
- Partidas consolidadas continuam bloqueadas, mesmo se a exclusão reduzir o histórico recente. O servidor verifica o bloqueio.
- A exclusão é lógica, preservando eventos, participantes e comprovantes das operações para auditoria. Não existe restauração pela interface.
- A numeração não é reutilizada; times e jogadores da rodada permanecem intactos.
- Leituras oficiais e a view de ranking excluem os registros apagados. Classificação, aproveitamento, gols, assistências, retrospecto e sequências derivam dessas leituras.
- Exclusões repetidas retornam a mesma confirmação. Um pedido antigo de edição não reativa a partida.
- O cliente persiste o pedido antes do envio e só remove a partida e seu cronômetro após a confirmação. Falhas podem ser repetidas após recarregar. Outras telas abertas no mesário se atualizam na consulta periódica existente.
- O histórico recarrega os totais renderizados no servidor depois da exclusão e apresenta confirmação.

## Referências e decisões

Foram consideradas as referências já analisadas de `society-tracker-specs`, em especial `02_DOMAIN_AND_RULES.md`, `04_DATABASE_SCHEMA.sql` e `05_UI_UX_MESARIO_FLOW.md`: identidade dos times por rodada, cálculos por partida e persistência das operações. Nenhum arquivo das specs foi alterado.

As referências não detalham exclusão de partidas. A nova ação segue a janela de edição determinada pelo pedido anterior, preservando o bloqueio das consolidadas. Mantém-se a arquitetura e os componentes existentes.

## Banco e entrega

Aplicar `supabase/migrations/202609090002_delete_match.sql` depois da migração inicial já confirmada pelo responsável e **antes do deploy**. O arquivo inicial não foi alterado. A nova migração adiciona `deleted_at` e `deleted_snapshot`, atualiza comandos, leituras, proteção de eventos e índice de partida ativa, sem apagar registros.

Consultas SQL externas ao app devem usar `deleted_at IS NULL`. A exclusão não foi executada em dados reais durante o desenvolvimento.

## Validação

Testes de PostgreSQL isolado cobrem exclusão com gol e assistência, estatísticas zeradas, auditoria preservada, repetição de pedidos, bloqueio de edição posterior, nova partida após apagar a atual, numeração crescente e reaplicação da migração. A classificação, o retrospecto e as sequências são verificados após a retirada de um resultado.

O teste de navegador usa os componentes reais, a camada HTTP e PostgreSQL isolado, em tela de 360 × 640: cancelar e confirmar, bloqueio pelo endpoint, atualização do aproveitamento, recarga e resposta perdida após a exclusão com repetição do pedido. A revisão visual confirmou botão legível e área de toque confortável. Há também regressão do cache e cronômetro.

Validação no Supabase e deploy de produção permanecem para a aplicação da migração pelo responsável. Como melhoria futura fora deste escopo, pode-se oferecer uma área administrativa para consulta de auditoria e restauração controlada.

Resultados: 76 testes unitários/transacionais aprovados; os 8 cenários de navegador passaram (o fluxo completo foi repetido após corrigir o nome de um botão no teste); TypeScript e build aprovados; Astro Check sem erros e com 24 sugestões preexistentes. Não existe script de lint dedicado no projeto. A telemetria do Astro foi desativada durante as verificações; os testes Node e Edge precisaram rodar fora do sandbox por uma restrição do Windows.
