# 02 - Regras de Domínio e Mecânica de Jogo (Domain Rules)

## 1. Parâmetros da Rodada
* **Frequência:** Toda quinta-feira (1 `Session` por data).
* **Capacidade Máxima:** 24 jogadores por noite (6 vs 6 na quadra).
* **Times da Noite:** Exatamente 4 times por rodada (ex: Preto, Branco, Azul, Vermelho).
* **Times Dinâmicos:** Os elencos dos times são sorteados/montados a cada quinta-feira, mas o histórico e as estatísticas dos jogadores são cumulativos ao longo da temporada.

## 2. Regras da Partida (Mini-Jogos)
* **Duração Padrão:** Cronômetro regressivo de **7 minutos (420 segundos)**.
* **Condição de Vitória Imediata (Mercy Rule / Golden Goal):** O primeiro time a marcar **2 gols** vence a partida instantaneamente, mesmo que o tempo não tenha acabado.
* **Fim do Tempo:** Caso o cronômetro atinja `00:00` antes de um time atingir 2 gols, o placar no momento é considerado o resultado final (vitória do time com mais gols ou empate).

## 3. Empréstimo / Troca de Jogadores
* Caso um time tenha menos de 6 jogadores disponíveis em determinada partida, o mesário pode escalar temporariamente um jogador de outro time.
* O gol/assistência é creditado individualmente ao jogador no ranking geral, mas contabilizado no placar do time pelo qual ele estava jogando na partida.

## 4. Eventos e Estatísticas
* **Gol Normal:** Atribuído a um jogador (`scorer_id`), com opção de registrar uma assistência (`assist_id`).
* **Assistência:** Opcional (passe direto para o gol). Não pode ser o próprio autor do gol.
* **Gol Contra:** Atribuído ao time beneficiado; marcado como `is_own_goal = true` e sem assistência.
* **Rankings Globais Computados:**
  1. **Artilharia:** Total de gols marcados ($G$).
  2. **Líder de Assistências (Garçom):** Total de assistências ($A$).
  3. **Participação Direta em Gols:** $G + A$.
  4. **Média por Partida:** $G / Partidas$ e $(G+A) / Partidas$.
  5. **Aproveitamento / Vitórias:** Jogos disputados e taxa de vitórias individuais.
