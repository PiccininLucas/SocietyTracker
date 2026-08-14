import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trophy,
  ArrowRightLeft,
  Square,
  RotateCcw,
  Undo2,
  CheckCircle2,
  Sparkles,
  Clock,
  ChevronRight,
  Flame,
  ShieldAlert,
  Save,
  Check,
} from 'lucide-react';
import { cn } from '../ui/utils';
import { soundFx } from '../ui/audio';
import { hapticFeedback } from '../ui/vibration';
import { MatchTimer } from './MatchTimer';
import { GoalDrawer } from './GoalDrawer';
import { QuickPlayerTransferModal } from './QuickPlayerTransferModal';
import {
  type LiveMatchState,
  type LiveTeam,
  type LivePlayer,
  type LiveMatchEvent,
  type ActiveMatchStorageSchema,
  ACTIVE_MATCH_STORAGE_KEY,
  DEFAULT_MATCH_DURATION_SECONDS,
  MAX_GOALS_FOR_VICTORY,
} from './types';

export interface LiveScoreboardProps {
  initialMatchId?: string;
  sessionId?: string;
  sessionTitle?: string;
  homeTeam?: LiveTeam;
  awayTeam?: LiveTeam;
  allSessionTeams?: LiveTeam[];
  onGoalRegistered?: (event: LiveMatchEvent) => Promise<void> | void;
  onFinishMatch?: (match: LiveMatchState) => Promise<void> | void;
  onNextMatch?: () => void;
  onTransferPlayer?: (data: {
    fromTeamId: string;
    toTeamId: string;
    playerId: string;
    isLoaned: boolean;
  }) => Promise<void> | void;
}

// Fallback padrão caso nenhum time seja passado via SSR
const DEFAULT_HOME_TEAM: LiveTeam = {
  id: 'team-preto',
  name: 'Time Preto',
  colorHex: '#1f2937',
  players: [
    { id: 'p1', name: 'Lucas Piccinin', nickname: 'Lucas' },
    { id: 'p2', name: 'Gabriel Silva', nickname: 'Gabriel' },
    { id: 'p3', name: 'Igor Rocha', nickname: 'Igor' },
    { id: 'p4', name: 'Mateus Lima', nickname: 'Mateus' },
    { id: 'p5', name: 'Bruno Dias', nickname: 'Bruno' },
    { id: 'p6', name: 'Rodrigo Alves', nickname: 'Rodrigo' },
  ],
};

const DEFAULT_AWAY_TEAM: LiveTeam = {
  id: 'team-branco',
  name: 'Time Branco',
  colorHex: '#e5e7eb',
  players: [
    { id: 'p7', name: 'Felipe Santos', nickname: 'Felipe' },
    { id: 'p8', name: 'Thiago Martins', nickname: 'Thiago' },
    { id: 'p9', name: 'Rafael Costa', nickname: 'Rafael' },
    { id: 'p10', name: 'Danilo Souza', nickname: 'Danilo' },
    { id: 'p11', name: 'Leonardo Moura', nickname: 'Léo' },
    { id: 'p12', name: 'Gustavo Nunes', nickname: 'Gustavo' },
  ],
};

export const LiveScoreboard: React.FC<LiveScoreboardProps> = ({
  initialMatchId = 'match-live-01',
  sessionId = 'session-current',
  sessionTitle = 'Pelada das Quintas',
  homeTeam = DEFAULT_HOME_TEAM,
  awayTeam = DEFAULT_AWAY_TEAM,
  allSessionTeams = [DEFAULT_HOME_TEAM, DEFAULT_AWAY_TEAM],
  onGoalRegistered,
  onFinishMatch,
  onNextMatch,
  onTransferPlayer,
}) => {
  // Estado principal da partida
  const [matchState, setMatchState] = useState<LiveMatchState>(() => {
    return {
      id: initialMatchId,
      sessionId,
      homeTeam,
      awayTeam,
      allSessionTeams,
      homeScore: 0,
      awayScore: 0,
      secondsRemaining: DEFAULT_MATCH_DURATION_SECONDS,
      durationSeconds: 0,
      status: 'ongoing',
      endReason: null,
      events: [],
      isTimerRunning: false,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };
  });

  // Modais e gavetas
  const [isGoalDrawerOpen, setIsGoalDrawerOpen] = useState(false);
  const [selectedScoringTeam, setSelectedScoringTeam] = useState<LiveTeam | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isVictoryModalOpen, setIsVictoryModalOpen] = useState(false);
  const [isRestoreBannerVisible, setIsRestoreBannerVisible] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Intervalo do Cronômetro
  const timerIntervalRef = useRef<number | null>(null);

  // ============================================================================
  // PERSISTÊNCIA OFFLINE-FIRST (localStorage: society_active_match_state)
  // ============================================================================

  // Salva no localStorage sempre que o estado muda
  const persistState = useCallback((state: LiveMatchState) => {
    if (typeof window === 'undefined') return;
    try {
      const payload: ActiveMatchStorageSchema = {
        version: 1,
        match: state,
        pendingSyncEvents: state.events,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(ACTIVE_MATCH_STORAGE_KEY, JSON.stringify(payload));
      setLastSavedTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch {
      // Falha silenciosa de quota/storage
    }
  }, []);

  // Recupera estado do localStorage ao montar
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(ACTIVE_MATCH_STORAGE_KEY);
      if (raw) {
        const parsed: ActiveMatchStorageSchema = JSON.parse(raw);
        if (parsed?.match && parsed.match.status === 'ongoing') {
          setMatchState(parsed.match);
          setIsRestoreBannerVisible(true);
          setLastSavedTime(new Date(parsed.savedAt).toLocaleTimeString('pt-BR'));
        }
      }
    } catch {
      // Ignora erro de parse
    }
  }, []);

  // ============================================================================
  // CONTROLE DO CRONÔMETRO
  // ============================================================================

  useEffect(() => {
    if (matchState.isTimerRunning && matchState.status === 'ongoing') {
      timerIntervalRef.current = window.setInterval(() => {
        setMatchState((prev) => {
          if (prev.secondsRemaining <= 1) {
            // Tempo esgotado!
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            const finishedState: LiveMatchState = {
              ...prev,
              secondsRemaining: 0,
              durationSeconds: DEFAULT_MATCH_DURATION_SECONDS,
              isTimerRunning: false,
              status: 'finished',
              endReason: 'time_limit',
              finishedAt: new Date().toISOString(),
            };
            persistState(finishedState);
            setIsVictoryModalOpen(true);
            return finishedState;
          }

          const nextRemaining = prev.secondsRemaining - 1;
          const nextDuration = prev.durationSeconds + 1;
          const nextState: LiveMatchState = {
            ...prev,
            secondsRemaining: nextRemaining,
            durationSeconds: nextDuration,
          };
          // Persiste a cada 5 segundos ou no final
          if (nextRemaining % 5 === 0) {
            persistState(nextState);
          }
          return nextState;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [matchState.isTimerRunning, matchState.status, persistState]);

  const handleToggleTimer = () => {
    setMatchState((prev) => {
      const next = { ...prev, isTimerRunning: !prev.isTimerRunning };
      persistState(next);
      return next;
    });
  };

  const handleAddMinute = () => {
    setMatchState((prev) => {
      const nextRemaining = Math.min(DEFAULT_MATCH_DURATION_SECONDS, prev.secondsRemaining + 60);
      const next = { ...prev, secondsRemaining: nextRemaining };
      persistState(next);
      return next;
    });
  };

  const handleResetTimer = () => {
    setMatchState((prev) => {
      const next = {
        ...prev,
        secondsRemaining: DEFAULT_MATCH_DURATION_SECONDS,
        durationSeconds: 0,
        isTimerRunning: false,
      };
      persistState(next);
      return next;
    });
  };

  const handleTimeExpired = () => {
    setMatchState((prev) => {
      const finished: LiveMatchState = {
        ...prev,
        secondsRemaining: 0,
        status: 'finished',
        endReason: 'time_limit',
        isTimerRunning: false,
        finishedAt: new Date().toISOString(),
      };
      persistState(finished);
      setIsVictoryModalOpen(true);
      return finished;
    });
  };

  // ============================================================================
  // REGISTRO DE GOLS E REGRA DOS 2 GOLS
  // ============================================================================

  const handleOpenGoalDrawer = (team: LiveTeam) => {
    if (matchState.status === 'finished') return;
    hapticFeedback.click();
    soundFx.playClickBeep('normal');
    setSelectedScoringTeam(team);
    setIsGoalDrawerOpen(true);
  };

  const handleConfirmGoal = async (data: {
    teamId: string;
    scorerId?: string | null;
    assistId?: string | null;
    isOwnGoal: boolean;
    scorerName?: string;
    assistName?: string;
  }) => {
    const isHome = data.teamId === matchState.homeTeam.id;
    const nextHomeScore = isHome ? matchState.homeScore + 1 : matchState.homeScore;
    const nextAwayScore = !isHome ? matchState.awayScore + 1 : matchState.awayScore;

    const scoringTeam = isHome ? matchState.homeTeam : matchState.awayTeam;

    const newEvent: LiveMatchEvent = {
      clientEventId: `event-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      matchId: matchState.id,
      teamId: data.teamId,
      scorerId: data.scorerId ?? null,
      assistId: data.assistId ?? null,
      eventTimeSeconds: matchState.durationSeconds,
      isOwnGoal: data.isOwnGoal,
      scorerName: data.scorerName,
      assistName: data.assistName,
      teamName: scoringTeam.name,
      createdAt: new Date().toISOString(),
    };

    // Verifica a Regra dos 2 Gols (Vitória Imediata)
    const isTwoGoalsReached =
      nextHomeScore >= MAX_GOALS_FOR_VICTORY || nextAwayScore >= MAX_GOALS_FOR_VICTORY;

    const nextStatus = isTwoGoalsReached ? 'finished' : matchState.status;
    const nextEndReason = isTwoGoalsReached ? 'two_goals' : matchState.endReason;

    const updatedState: LiveMatchState = {
      ...matchState,
      homeScore: nextHomeScore,
      awayScore: nextAwayScore,
      status: nextStatus,
      endReason: nextEndReason,
      isTimerRunning: isTwoGoalsReached ? false : matchState.isTimerRunning,
      finishedAt: isTwoGoalsReached ? new Date().toISOString() : matchState.finishedAt,
      events: [newEvent, ...matchState.events],
    };

    setMatchState(updatedState);
    persistState(updatedState);

    // Dispara callback de API assíncrono se fornecido
    if (onGoalRegistered) {
      try {
        await onGoalRegistered(newEvent);
      } catch {
        // Evento já está em cache no localStorage
      }
    }

    // Se atingiu 2 gols, toca fanfarra e abre o modal de vitória
    if (isTwoGoalsReached) {
      soundFx.playVictoryFanfare();
      hapticFeedback.victory();
      setIsVictoryModalOpen(true);
      if (onFinishMatch) {
        onFinishMatch(updatedState);
      }
    }
  };

  // Desfazer o último lance em caso de erro do mesário
  const handleUndoLastGoal = () => {
    if (matchState.events.length === 0) return;

    hapticFeedback.cancel();
    soundFx.playClickBeep('low');

    const lastEvent = matchState.events[0];
    const isHome = lastEvent.teamId === matchState.homeTeam.id;

    const nextHomeScore = isHome ? Math.max(0, matchState.homeScore - 1) : matchState.homeScore;
    const nextAwayScore = !isHome ? Math.max(0, matchState.awayScore - 1) : matchState.awayScore;

    const updatedEvents = matchState.events.slice(1);

    const updatedState: LiveMatchState = {
      ...matchState,
      homeScore: nextHomeScore,
      awayScore: nextAwayScore,
      events: updatedEvents,
      status: 'ongoing',
      endReason: null,
      finishedAt: null,
    };

    setMatchState(updatedState);
    persistState(updatedState);
    setIsVictoryModalOpen(false);
  };

  // Encerrar Partida Manualmente
  const handleManualFinish = () => {
    hapticFeedback.timeExpired();
    soundFx.playWhistle();

    const finishedState: LiveMatchState = {
      ...matchState,
      status: 'finished',
      endReason: 'manual',
      isTimerRunning: false,
      finishedAt: new Date().toISOString(),
    };

    setMatchState(finishedState);
    persistState(finishedState);
    setIsVictoryModalOpen(true);

    if (onFinishMatch) {
      onFinishMatch(finishedState);
    }
  };

  // Reiniciar a Partida Atual do Zero
  const handleResetMatch = () => {
    if (typeof window !== 'undefined') {
      const confirmReset = window.confirm('Deseja zerar o placar e reiniciar esta partida?');
      if (!confirmReset) return;
    }

    hapticFeedback.click();
    soundFx.playClickBeep('low');

    const resetState: LiveMatchState = {
      ...matchState,
      homeScore: 0,
      awayScore: 0,
      secondsRemaining: DEFAULT_MATCH_DURATION_SECONDS,
      durationSeconds: 0,
      status: 'ongoing',
      endReason: null,
      events: [],
      isTimerRunning: false,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };

    setMatchState(resetState);
    persistState(resetState);
    setIsVictoryModalOpen(false);
  };

  // Transferência / Empréstimo de Jogador
  const handleTransferPlayer = async (data: {
    fromTeamId: string;
    toTeamId: string;
    playerId: string;
    isLoaned: boolean;
  }) => {
    // Local update of teams
    let transferredPlayer: LivePlayer | undefined;

    const updatedTeams = (matchState.allSessionTeams || [matchState.homeTeam, matchState.awayTeam]).map(
      (team) => {
        if (team.id === data.fromTeamId) {
          transferredPlayer = team.players.find((p) => p.id === data.playerId);
          return {
            ...team,
            players: team.players.filter((p) => p.id !== data.playerId),
          };
        }
        return team;
      }
    );

    if (!transferredPlayer) return;

    const modifiedPlayer: LivePlayer = {
      ...transferredPlayer,
      isLoaned: data.isLoaned,
      originalTeamId: data.fromTeamId,
    };

    const finalTeams = updatedTeams.map((team) => {
      if (team.id === data.toTeamId) {
        return {
          ...team,
          players: [...team.players, modifiedPlayer],
        };
      }
      return team;
    });

    const newHomeTeam =
      finalTeams.find((t) => t.id === matchState.homeTeam.id) || matchState.homeTeam;
    const newAwayTeam =
      finalTeams.find((t) => t.id === matchState.awayTeam.id) || matchState.awayTeam;

    const updatedState: LiveMatchState = {
      ...matchState,
      homeTeam: newHomeTeam,
      awayTeam: newAwayTeam,
      allSessionTeams: finalTeams,
    };

    setMatchState(updatedState);
    persistState(updatedState);

    if (onTransferPlayer) {
      await onTransferPlayer(data);
    }
  };

  // Determina o time vencedor para exibição do modal
  const winningTeam =
    matchState.homeScore > matchState.awayScore
      ? matchState.homeTeam
      : matchState.awayScore > matchState.homeScore
      ? matchState.awayTeam
      : null;

  return (
    <div className="w-full max-w-xl mx-auto px-3.5 sm:px-4 py-4 space-y-4 pb-20 select-none">
      {/* Banner de Recuperação do Cache Offline */}
      {isRestoreBannerVisible && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-blue-300 text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <Save className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              Partida restaurada do cache offline {lastSavedTime && `(salva às ${lastSavedTime})`}.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsRestoreBannerVisible(false)}
            className="text-blue-400 hover:text-white text-xs font-bold px-2 py-1"
          >
            OK
          </button>
        </div>
      )}

      {/* Header Superior da Rodada */}
      <header className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-sm">
            ⚽
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>{sessionTitle}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </h1>
            <p className="text-xs text-gray-400 font-medium">Modo Mesário • Mini-jogo de 7 min</p>
          </div>
        </div>

        {/* Badge Offline-First */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-800/80 border border-gray-700 text-xs font-semibold text-emerald-400"
          title="Dados salvos automaticamente em cache offline"
        >
          <Check className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Offline-First</span>
          <span className="sm:hidden">Auto</span>
        </div>
      </header>

      {/* Componente 3.1: Cronômetro da Partida */}
      <MatchTimer
        secondsRemaining={matchState.secondsRemaining}
        isRunning={matchState.isTimerRunning}
        onToggleRunning={handleToggleTimer}
        onAddMinute={handleAddMinute}
        onReset={handleResetTimer}
        onTimeExpired={handleTimeExpired}
        disabled={matchState.status === 'finished'}
      />

      {/* Placar Principal e Botões de Ação Imediata (+ GOL) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Card Time Mandante (Home) */}
        <div
          className="rounded-3xl glass-card p-4 sm:p-5 flex flex-col items-center justify-between border-t-4 transition-all duration-200"
          style={{ borderTopColor: matchState.homeTeam.colorHex }}
        >
          {/* Header do Time */}
          <div className="flex flex-col items-center text-center w-full">
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/20 mb-1"
              style={{ backgroundColor: matchState.homeTeam.colorHex }}
            />
            <h2 className="font-extrabold text-white text-sm sm:text-base truncate w-full">
              {matchState.homeTeam.name}
            </h2>
            <span className="text-[11px] text-gray-400 font-medium">
              {matchState.homeTeam.players.length} atletas
            </span>
          </div>

          {/* Número Gigante do Placar */}
          <div className="my-3 font-display text-6xl sm:text-7xl font-black text-white tracking-tight drop-shadow-md">
            {matchState.homeScore}
          </div>

          {/* Botão de Toque Amplo: + GOL MANDANTE (>= 56px) */}
          <button
            type="button"
            disabled={matchState.status === 'finished'}
            onClick={() => handleOpenGoalDrawer(matchState.homeTeam)}
            className="w-full min-h-[54px] sm:min-h-[58px] flex items-center justify-center gap-1.5 px-3 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-gray-950 font-black text-sm sm:text-base shadow-lg shadow-emerald-500/25 transition-all touch-press-scale"
            aria-label={`Adicionar gol para ${matchState.homeTeam.name}`}
          >
            <span className="text-lg">⚽</span>
            <span>+ GOL</span>
          </button>
        </div>

        {/* Card Time Visitante (Away) */}
        <div
          className="rounded-3xl glass-card p-4 sm:p-5 flex flex-col items-center justify-between border-t-4 transition-all duration-200"
          style={{ borderTopColor: matchState.awayTeam.colorHex }}
        >
          {/* Header do Time */}
          <div className="flex flex-col items-center text-center w-full">
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/20 mb-1"
              style={{ backgroundColor: matchState.awayTeam.colorHex }}
            />
            <h2 className="font-extrabold text-white text-sm sm:text-base truncate w-full">
              {matchState.awayTeam.name}
            </h2>
            <span className="text-[11px] text-gray-400 font-medium">
              {matchState.awayTeam.players.length} atletas
            </span>
          </div>

          {/* Número Gigante do Placar */}
          <div className="my-3 font-display text-6xl sm:text-7xl font-black text-white tracking-tight drop-shadow-md">
            {matchState.awayScore}
          </div>

          {/* Botão de Toque Amplo: + GOL VISITANTE (>= 56px) */}
          <button
            type="button"
            disabled={matchState.status === 'finished'}
            onClick={() => handleOpenGoalDrawer(matchState.awayTeam)}
            className="w-full min-h-[54px] sm:min-h-[58px] flex items-center justify-center gap-1.5 px-3 py-3.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-gray-950 font-black text-sm sm:text-base shadow-lg shadow-cyan-400/25 transition-all touch-press-scale"
            aria-label={`Adicionar gol para ${matchState.awayTeam.name}`}
          >
            <span className="text-lg">⚽</span>
            <span>+ GOL</span>
          </button>
        </div>
      </div>

      {/* Timeline dos Lances da Partida */}
      <div className="rounded-2xl glass-card p-4">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs sm:text-sm font-bold text-gray-200 uppercase tracking-wider">
              Lances da Partida ({matchState.events.length})
            </h3>
          </div>

          {/* Botão Desfazer Último Gol */}
          {matchState.events.length > 0 && (
            <button
              type="button"
              onClick={handleUndoLastGoal}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 active:scale-95 text-rose-400 hover:text-rose-300 font-semibold text-xs transition-all border border-gray-700"
              title="Anular o último gol registrado"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Desfazer Gol</span>
            </button>
          )}
        </div>

        {matchState.events.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-4 font-medium italic">
            Nenhum gol registrado até o momento. A partida está 0 x 0.
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {matchState.events.map((ev, index) => {
              const mins = Math.floor(ev.eventTimeSeconds / 60);
              const secs = ev.eventTimeSeconds % 60;
              const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
              const isFirst = index === 0;

              return (
                <div
                  key={ev.clientEventId || index}
                  className={cn(
                    'flex items-center justify-between p-2.5 rounded-xl border text-xs sm:text-sm transition-all',
                    isFirst
                      ? 'bg-gray-800/90 border-emerald-500/40 text-white shadow-sm'
                      : 'bg-gray-800/40 border-gray-800 text-gray-300'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-gray-900 text-gray-400 border border-gray-700">
                      {formattedTime}
                    </span>
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <span>{ev.isOwnGoal ? '🛡️' : '⚽'}</span>
                        <span className={ev.isOwnGoal ? 'text-rose-400' : 'text-emerald-400'}>
                          {ev.scorerName || 'Gol'}
                        </span>
                        <span className="text-gray-400 font-normal text-xs">
                          ({ev.teamName})
                        </span>
                      </div>
                      {ev.assistName && (
                        <div className="text-[11px] text-cyan-300 font-medium">
                          Assistência: {ev.assistName}
                        </div>
                      )}
                    </div>
                  </div>

                  {isFirst && (
                    <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      Último
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Barra de Ações Rápidas do Mesário */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        {/* Botão de Transferência / Empréstimo */}
        <button
          type="button"
          onClick={() => {
            hapticFeedback.click();
            setIsTransferModalOpen(true);
          }}
          className="min-h-[48px] flex items-center justify-center gap-2 px-3 py-3 rounded-2xl bg-gray-800/80 hover:bg-gray-700 active:scale-95 text-blue-400 font-bold text-xs sm:text-sm border border-gray-700 transition-all touch-press-scale"
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Emprestar Jogador</span>
        </button>

        {/* Botão de Encerrar Partida Manual */}
        <button
          type="button"
          disabled={matchState.status === 'finished'}
          onClick={handleManualFinish}
          className="min-h-[48px] flex items-center justify-center gap-2 px-3 py-3 rounded-2xl bg-gray-800/80 hover:bg-gray-700 active:scale-95 disabled:opacity-40 text-rose-400 font-bold text-xs sm:text-sm border border-gray-700 transition-all touch-press-scale"
        >
          <Square className="w-4 h-4 fill-current" />
          <span>Encerrar Partida</span>
        </button>
      </div>

      {/* Componente 3.2: Drawer de Lançamento de Gol (2 Toques) */}
      <GoalDrawer
        isOpen={isGoalDrawerOpen}
        team={selectedScoringTeam}
        opponentTeam={
          selectedScoringTeam?.id === matchState.homeTeam.id
            ? matchState.awayTeam
            : matchState.homeTeam
        }
        onConfirmGoal={handleConfirmGoal}
        onClose={() => setIsGoalDrawerOpen(false)}
      />

      {/* Componente 3.3: Modal de Transferência / Empréstimo */}
      <QuickPlayerTransferModal
        isOpen={isTransferModalOpen}
        teams={matchState.allSessionTeams || [matchState.homeTeam, matchState.awayTeam]}
        currentHomeTeamId={matchState.homeTeam.id}
        currentAwayTeamId={matchState.awayTeam.id}
        onTransfer={handleTransferPlayer}
        onClose={() => setIsTransferModalOpen(false)}
      />

      {/* Modal de Vitória Imediata (Regra dos 2 Gols / Fim do Tempo) */}
      {isVictoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl glass-card-glow bg-surface-100 border border-emerald-500/40 p-6 text-center shadow-2xl animate-scale-up">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
              <Trophy className="w-8 h-8" />
            </div>

            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 text-xs font-bold uppercase tracking-wider border border-emerald-500/20 inline-block mb-2">
              {matchState.endReason === 'two_goals'
                ? '⚡ Regra dos 2 Gols'
                : matchState.endReason === 'time_limit'
                ? '⏱ Fim do Tempo Oficial'
                : '⏹ Partida Encerrada'}
            </span>

            <h2 className="text-xl sm:text-2xl font-black text-white mt-1 mb-1">
              {winningTeam ? `${winningTeam.name} Venceu!` : 'Empate na Partida!'}
            </h2>

            <div className="my-4 p-4 rounded-2xl bg-gray-900/80 border border-gray-800">
              <div className="text-xs text-gray-400 mb-1 font-semibold uppercase">
                Placar Final
              </div>
              <div className="font-display text-4xl font-black text-white">
                {matchState.homeTeam.name} {matchState.homeScore} x {matchState.awayScore}{' '}
                {matchState.awayTeam.name}
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Duração total: {Math.floor(matchState.durationSeconds / 60)}m{' '}
                {matchState.durationSeconds % 60}s
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {onNextMatch ? (
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.click();
                    setIsVictoryModalOpen(false);
                    onNextMatch();
                  }}
                  className="w-full min-h-[50px] flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-gray-950 font-black text-base shadow-lg shadow-emerald-500/25 transition-all touch-press-scale"
                >
                  <span>Avançar para Próximo Jogo</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.click();
                    setIsVictoryModalOpen(false);
                  }}
                  className="w-full min-h-[50px] flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-gray-950 font-black text-base shadow-lg shadow-emerald-500/25 transition-all touch-press-scale"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Concluir Partida</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleResetMatch}
                className="w-full min-h-[44px] flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 font-semibold text-xs transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reiniciar este mesmo jogo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default LiveScoreboard;
