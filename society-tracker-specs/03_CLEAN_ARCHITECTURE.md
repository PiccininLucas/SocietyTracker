# 03 - Arquitetura de Software (Clean Architecture)

A aplicação segue a separação estrita em 4 camadas independentes, garantindo que as regras de negócio permaneçam puras e desacopladas de frameworks e bibliotecas externas.

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation Layer (Astro Pages, SSR API Routes, Islands) │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure Layer (Supabase Repositories, LocalStorage) │
├─────────────────────────────────────────────────────────────┤
│  Application Layer (Use Cases: RegisterGoal, StartMatch)   │
├─────────────────────────────────────────────────────────────┤
│  Domain Layer (Entities, Value Objects, Domain Rules)       │
└─────────────────────────────────────────────────────────────┘
```

## 1. Estrutura de Diretórios

```text
src/
├── core/
│   ├── domain/                  # Camada 1: Domínio Puro
│   │   ├── entities/
│   │   │   ├── Player.ts
│   │   │   ├── Session.ts
│   │   │   ├── Team.ts
│   │   │   ├── Match.ts
│   │   │   └── MatchEvent.ts
│   │   ├── repositories/        # Ports (Interfaces)
│   │   │   ├── IPlayerRepository.ts
│   │   │   ├── ISessionRepository.ts
│   │   │   └── IMatchRepository.ts
│   │   └── errors/
│   │       ├── MatchAlreadyFinishedError.ts
│   │       └── InvalidGoalEventError.ts
│   │
│   ├── application/             # Camada 2: Casos de Uso
│   │   ├── dtos/
│   │   │   ├── RegisterGoalDTO.ts
│   │   │   ├── CreateSessionDTO.ts
│   │   │   └── LeaderboardDTO.ts
│   │   └── use-cases/
│   │       ├── CreateSessionUseCase.ts
│   │       ├── StartMatchUseCase.ts
│   │       ├── RegisterGoalUseCase.ts
│   │       ├── FinishMatchUseCase.ts
│   │       ├── TransferPlayerUseCase.ts
│   │       └── GetLeaderboardUseCase.ts
│   │
│   └── infrastructure/          # Camada 3: Adaptadores e Banco
│       ├── database/
│       │   └── supabaseClient.ts
│       └── repositories/
│           ├── SupabasePlayerRepository.ts
│           ├── SupabaseSessionRepository.ts
│           └── SupabaseMatchRepository.ts
│
├── components/                  # Camada 4: Apresentação (UI)
│   ├── live/                    # Ilhas React (client:load)
│   │   ├── LiveScoreboard.tsx
│   │   ├── MatchTimer.tsx
│   │   ├── GoalDrawer.tsx
│   │   └── QuickPlayerTransferModal.tsx
│   └── ui/                      # Componentes Astro puros
│       ├── LeaderboardTable.astro
│       ├── PodiumCard.astro
│       └── MatchHistoryCard.astro
│
├── layouts/
│   └── Layout.astro
│
└── pages/                       # Rotas Astro & Endpoints SSR
    ├── index.astro              # Tabela de Classificação e Artilharia (SSR)
    ├── historico.astro          # Resultados dos jogos anteriores (SSR)
    ├── rodada/
    │   ├── nova.astro           # Montagem dos 4 times da noite
    │   └── mesario.astro        # Modo Mesário ao Vivo (Isla React)
    └── api/                     # REST Endpoints
        ├── sessions/index.ts
        ├── matches/
        │   ├── start.ts
        │   └── [id]/goals.ts
        └── leaderboard/index.ts
```

## 2. Implementação das Entidades de Domínio

### `Match.ts`
```typescript
export interface MatchProps {
  id: string;
  sessionId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  durationSeconds: number;
  endReason?: 'two_goals' | 'time_limit' | 'manual';
  status: 'ongoing' | 'finished';
  startedAt: Date;
  finishedAt?: Date;
}

export class Match {
  private props: MatchProps;

  constructor(props: MatchProps) {
    this.props = props;
  }

  public registerGoal(teamId: string): void {
    if (this.props.status === 'finished') {
      throw new Error('Partida já encerrada.');
    }

    if (teamId === this.props.homeTeamId) {
      this.props.homeScore += 1;
    } else if (teamId === this.props.awayTeamId) {
      this.props.awayScore += 1;
    } else {
      throw new Error('Time informado não pertence a esta partida.');
    }

    // Regra de Vitória: 2 gols
    if (this.props.homeScore >= 2 || this.props.awayScore >= 2) {
      this.finish('two_goals');
    }
  }

  public handleTimeExpired(): void {
    if (this.props.status === 'ongoing') {
      this.finish('time_limit');
    }
  }

  public finish(reason: 'two_goals' | 'time_limit' | 'manual' = 'manual'): void {
    this.props.status = 'finished';
    this.props.endReason = reason;
    this.props.finishedAt = new Date();
  }

  get isFinished(): boolean {
    return this.props.status === 'finished';
  }

  get state(): Readonly<MatchProps> {
    return this.props;
  }
}
```
