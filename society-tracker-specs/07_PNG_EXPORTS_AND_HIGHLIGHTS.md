# 07 - Exportação de Imagens PNG e Destaques da Rodada (WhatsApp Cards)

## 1. Visão Geral da Funcionalidade
Substituir o envio manual de prints de planilhas no WhatsApp por um gerador automático de **Cards Visuais em PNG** de alta resolução, gerados 100% no cliente (navegador) via biblioteca `html-to-image`.

**Premissas:**
- **Zero PDF e Zero Excel:** Foco exclusivo em imagem PNG (que abre direto no chat do WhatsApp sem necessidade de download de arquivos externos).
- **Client-Side Rendering:** Sem consumo de memória do servidor ou limites de timeout na Vercel.
- **Suporte a Copiar para Área de Transferência:** Permitir tanto o download do arquivo `.png` quanto o botão "Copiar Imagem" para colar direto no WhatsApp Web.

---

## 2. Tipos de Cards PNG a Gerar

### Card 1: Resumo da Rodada (O "Post da Quinta")
Reproduz a síntese do dia e os destaques:
1. **Cabeçalho:** Nome da pelada e data formatada (ex: `PELADA DAS QUINTAS • 13/AGO`).
2. **Quadro de Destaques (Banner / Pódio):**
   * 👑 **Craque da rodada (G+A):** Maior soma de gols e assistências.
   * ⚽ **Artilheiro da rodada:** Maior marcador de gols no dia.
   * 👟 **Garçom da rodada:** Maior assistente no dia.
   * 🩴 **Bola murcha da rodada:** Jogadores que atuaram no dia, mas terminaram com **0 gols e 0 assistências**.
3. **Tabela de Desempenho do Dia:**
   * Colunas: `Jogador | Gols | Assistências`
   * Ordenada por $G+A$ desc, depois Gols desc.

### Card 2: Ranking Consolidado (Mensal ou Temporada)
Reproduz a visualização das 3 tabelas lado a lado:
1. **Tabela 1 - Craque do Futebol:** `Pos | Jogador | G+A` (Top 1 destacado com cor dourada).
2. **Tabela 2 - Artilheiro:** `Pos | Jogador | Gols`.
3. **Tabela 3 - Garçom:** `Pos | Jogador | Assistências`.

---

## 3. Regras de Domínio (`RoundHighlightsService.ts`)

Criar o serviço de domínio puro em `src/core/domain/services/RoundHighlightsService.ts`:

```typescript
export interface PlayerRoundStats {
  playerId: string;
  name: string;
  goals: number;
  assists: number;
  contributions: number; // goals + assists
}

export interface RoundHighlights {
  topScorers: string[];     // Nomes com empate permitido
  topAssisters: string[];   // Nomes com empate permitido
  mvps: string[];           // Nomes com maior G+A
  bottomPlayers: string[];  // Jogadores presentes com 0 G e 0 A ("Bola Murcha")
}

export class RoundHighlightsService {
  public static calculate(stats: PlayerRoundStats[]): RoundHighlights {
    if (!stats || stats.length === 0) {
      return { topScorers: [], topAssisters: [], mvps: [], bottomPlayers: [] };
    }

    const maxGoals = Math.max(...stats.map(s => s.goals));
    const maxAssists = Math.max(...stats.map(s => s.assists));
    const maxContributions = Math.max(...stats.map(s => s.contributions));

    return {
      topScorers: maxGoals > 0 ? stats.filter(s => s.goals === maxGoals).map(s => s.name) : [],
      topAssisters: maxAssists > 0 ? stats.filter(s => s.assists === maxAssists).map(s => s.name) : [],
      mvps: maxContributions > 0 ? stats.filter(s => s.contributions === maxContributions).map(s => s.name) : [],
      bottomPlayers: stats.filter(s => s.goals === 0 && s.assists === 0).map(s => s.name)
    };
  }
}
```

---

## 4. Implementação do Exportador PNG no Frontend

Instalação:
```bash
npm install html-to-image
```

### Utilitário de Captura (`src/lib/exportPng.ts`)
```typescript
import { toPng, toBlob } from 'html-to-image';

export async function downloadElementAsPng(elementId: string, filename: string): Promise<void> {
  const node = document.getElementById(elementId);
  if (!node) return;

  const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = dataUrl;
  link.click();
}

export async function copyElementToClipboard(elementId: string): Promise<boolean> {
  const node = document.getElementById(elementId);
  if (!node) return false;

  try {
    const blob = await toBlob(node, { pixelRatio: 2, cacheBust: true });
    if (!blob) return false;
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    return true;
  } catch (err) {
    console.error('Erro ao copiar imagem:', err);
    return false;
  }
}
```

---

## 5. Estrutura de Componentes da V2

```text
src/
├── core/
│   ├── domain/
│   │   └── services/
│   │       └── RoundHighlightsService.ts
│   └── application/
│       └── use-cases/
│           ├── GetRoundHighlightsUseCase.ts
│           └── GetPeriodLeaderboardUseCase.ts
│
├── components/
│   └── export/
│       ├── RoundSummaryCard.tsx      # Card do Dia com Destaques + Bola Murcha + Botões PNG
│       └── PeriodLeaderboardCard.tsx # Card de 3 colunas (G+A, Gols, Assist) + Botões PNG
│
└── pages/
    └── relatorios.astro              # Interface com abas (Por Rodada, Por Mês, Geral)
```
