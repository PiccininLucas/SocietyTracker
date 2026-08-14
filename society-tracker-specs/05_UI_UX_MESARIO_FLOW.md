# 05 - Especificação de UI/UX e Fluxo do Mesário

## 1. Filosofia de Interface
* **Design Mobile-First:** Otimizado para telas de smartphone (360px a 430px de largura).
* **Ergonomia com Uma Só Mão:** Botões de ação rápida posicionados na metade inferior da tela para facilitar o manuseio na beira do campo.
* **Feedback Tátil e Visual:** Animações sutis e vibração (`navigator.vibrate(50)`) ao registrar gols ou encerrar o tempo.

---

## 2. Layout da Tela "Modo Mesário" (`/rodada/mesario`)

```
┌──────────────────────────────────────────────────┐
│  ⚽ PELADA DAS QUINTAS            [⚙ Config]    │
├──────────────────────────────────────────────────┤
│                                                  │
│               ⏱ 05:42                           │
│       [ ⏸ Pausar ]    [ 🔄 +1 min ]              │
│  ████████████████████░░░░░░ (Barra de Progresso) │
│                                                  │
├──────────────────────────────────────────────────┤
│    TIME PRETO               TIME BRANCO          │
│       [ 1 ]                    [ 0 ]             │
│                                                  │
│  ┌──────────────┐        ┌──────────────┐        │
│  │ + GOL PRETO  │        │ + GOL BRANCO │        │
│  └──────────────┘        └──────────────┘        │
├──────────────────────────────────────────────────┤
│  Lances da Partida:                              │
│  • 02:15 - ⚽ Lucas (Assist: Gabriel) [x]         │
├──────────────────────────────────────────────────┤
│  [ ⇄ Emprestar Jogador ]    [ ⏹ Encerrar Partida ]│
└──────────────────────────────────────────────────┘
```

---

## 3. Fluxo de Lançamento de Gol (2 Toques)

1. O mesário clica em **`+ GOL PRETO`**.
2. **Bottom Sheet (Gaveta Inferior)** desliza para cima com a lista dos 6 jogadores do Time Preto:
   * Botão 1: `Lucas`
   * Botão 2: `Gabriel`
   * Botão 3: `Igor`
   * Botão 4: `Mateus`
   * Botão 5: `Bruno`
   * Botão 6: `Rodrigo`
   * Botão Extra: `[ Gol Contra ]`
3. Ao tocar no autor do gol (ex: `Lucas`), a gaveta atualiza instantaneamente para a pergunta:
   * **"Quem deu a assistência?"**
   * Exibe os outros 5 jogadores + Botão destacado: **`[ Sem Assistência (Jogada Individual) ]`**.
4. Ao tocar na assistência, a gaveta fecha:
   * Placar atualiza de `0` para `1`.
   * O lance aparece na lista cronológica da partida.
   * Se o placar atingir **2 gols**, um modal de vitória é disparado automaticamente: *"Time Preto venceu por 2 a 0!"* com botão *"Avançar para Próximo Jogo"*.

---

## 4. Estratégia de Cache e Persistência Offline
O componente React sincroniza o estado a cada segundo com o `localStorage`:
* Chave: `society_active_match_state`
* Conteúdo: Placar atual, timestamp de início, segundos restantes e lista de eventos não sincronizados.
* Caso a conexão caia, os dados são enfileirados e sincronizados com a API assim que o 4G restabelecer.
