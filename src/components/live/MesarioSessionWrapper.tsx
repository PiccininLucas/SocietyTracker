import React, { useState, useEffect } from 'react';
import {
  Swords,
  Play,
  CheckCircle2,
  Users,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { LiveScoreboard } from './LiveScoreboard';
import type {
  LiveTeam,
  LiveMatchEvent,
  LiveMatchState,
} from './types';
import { cn } from '../ui/utils';

export interface SessionData {
  id: string;
  sessionDate: string;
  status: 'ongoing' | 'finished';
  notes?: string | null;
  teams: LiveTeam[];
}

interface MesarioSessionWrapperProps {
  session: SessionData;
}

export const MesarioSessionWrapper: React.FC<MesarioSessionWrapperProps> = ({ session }) => {
  const [activeSession, setActiveSession] = useState<SessionData>(session);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [selectedHomeTeamId, setSelectedHomeTeamId] = useState<string>(
    session.teams[0]?.id || 'team-1'
  );
  const [selectedAwayTeamId, setSelectedAwayTeamId] = useState<string>(
    session.teams[1]?.id || 'team-2'
  );
  const [isStartingMatch, setIsStartingMatch] = useState(false);
  const [lastFinishedMatch, setLastFinishedMatch] = useState<LiveMatchState | null>(null);

  // Times selecionados atualmente para o confronto
  const homeTeam =
    activeSession.teams.find((t) => t.id === selectedHomeTeamId) || activeSession.teams[0];
  const awayTeam =
    activeSession.teams.find((t) => t.id === selectedAwayTeamId) || activeSession.teams[1];

  // Iniciar nova partida no banco
  const handleStartNewMatch = async () => {
    if (selectedHomeTeamId === selectedAwayTeamId) {
      alert('Selecione dois times diferentes para o confronto.');
      return;
    }

    setIsStartingMatch(true);
    try {
      const res = await fetch('/api/matches/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.id,
          homeTeamId: selectedHomeTeamId,
          awayTeamId: selectedAwayTeamId,
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao iniciar partida na API.');
      }

      const data = await res.json();
      setActiveMatchId(data.id || `match-${Date.now()}`);
    } catch {
      // Fallback offline caso API falhe
      setActiveMatchId(`match-${Date.now()}`);
    } finally {
      setIsStartingMatch(false);
    }
  };

  // Callback de registro de gol sincronizado com a API
  const handleGoalRegistered = async (event: LiveMatchEvent) => {
    if (!activeMatchId) return;

    try {
      await fetch(`/api/matches/${activeMatchId}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: event.teamId,
          scorerId: event.scorerId,
          assistId: event.assistId,
          eventTimeSeconds: event.eventTimeSeconds,
          isOwnGoal: event.isOwnGoal,
        }),
      });
    } catch {
      // Evento persistido localmente pelo LiveScoreboard
    }
  };

  // Callback de término de partida sincronizado com a API
  const handleFinishMatch = async (finishedMatch: LiveMatchState) => {
    setLastFinishedMatch(finishedMatch);
    if (!activeMatchId) return;

    try {
      await fetch(`/api/matches/${activeMatchId}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationSeconds: finishedMatch.durationSeconds,
          reason: finishedMatch.endReason || 'manual',
        }),
      });
    } catch {
      // Ignora erro de rede
    }
  };

  // Callback de transferência de jogador
  const handleTransferPlayer = async (data: {
    fromTeamId: string;
    toTeamId: string;
    playerId: string;
    isLoaned: boolean;
  }) => {
    try {
      await fetch(`/api/sessions/${activeSession.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch {
      // Ignora erro
    }
  };

  // Avançar para a próxima partida
  const handleNextMatch = () => {
    setActiveMatchId(null);
    // Se houve vencedor, mantém o vencedor como mandante por padrão (regra quem ganha fica)
    if (lastFinishedMatch) {
      if (lastFinishedMatch.homeScore > lastFinishedMatch.awayScore) {
        setSelectedHomeTeamId(lastFinishedMatch.homeTeam.id);
      } else if (lastFinishedMatch.awayScore > lastFinishedMatch.homeScore) {
        setSelectedHomeTeamId(lastFinishedMatch.awayTeam.id);
      }
    }
  };

  // Se já houver uma partida em andamento, exibe o LiveScoreboard
  if (activeMatchId && homeTeam && awayTeam) {
    return (
      <LiveScoreboard
        initialMatchId={activeMatchId}
        sessionId={activeSession.id}
        sessionTitle={`Pelada • ${activeSession.sessionDate}`}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        allSessionTeams={activeSession.teams}
        onGoalRegistered={handleGoalRegistered}
        onFinishMatch={handleFinishMatch}
        onNextMatch={handleNextMatch}
        onTransferPlayer={handleTransferPlayer}
      />
    );
  }

  // Caso contrário, exibe o Seletor de Confronto da Rodada
  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      {/* Header da Rodada Ativa */}
      <div className="p-5 sm:p-6 rounded-3xl glass-card bg-surface-100/90 border border-white/10 shadow-xl text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wider mb-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Sessão em Andamento</span>
        </div>

        <h2 className="font-display font-black text-2xl sm:text-3xl text-white">
          Próximo Confronto
        </h2>
        <p className="text-xs sm:text-sm text-gray-400 mt-1 flex items-center justify-center gap-1.5">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <span>Data da rodada: {activeSession.sessionDate}</span>
        </p>
      </div>

      {/* Seleção dos 2 Times que vão jogar agora */}
      <div className="p-5 sm:p-6 rounded-3xl glass-card bg-surface-100/90 border border-white/10 shadow-2xl space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          {/* Time Mandante */}
          <div className="space-y-2">
            <label className="block text-xs font-black uppercase tracking-wider text-gray-300">
              Time 1 (Mandante)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {activeSession.teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedHomeTeamId(t.id)}
                  className={cn(
                    'p-3 rounded-2xl border text-left transition-all flex flex-col justify-between min-h-[70px]',
                    selectedHomeTeamId === t.id
                      ? 'border-emerald-400 bg-emerald-500/10 ring-2 ring-emerald-400/40 shadow-lg'
                      : 'border-white/5 bg-surface-200/60 hover:border-white/20'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full border border-white/20"
                      style={{ backgroundColor: t.colorHex }}
                    />
                    <span className="font-bold text-xs text-white truncate">
                      {t.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400">
                    {t.players.length} jogadores
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Time Visitante */}
          <div className="space-y-2">
            <label className="block text-xs font-black uppercase tracking-wider text-gray-300">
              Time 2 (Visitante)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {activeSession.teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedAwayTeamId(t.id)}
                  className={cn(
                    'p-3 rounded-2xl border text-left transition-all flex flex-col justify-between min-h-[70px]',
                    selectedAwayTeamId === t.id
                      ? 'border-emerald-400 bg-emerald-500/10 ring-2 ring-emerald-400/40 shadow-lg'
                      : 'border-white/5 bg-surface-200/60 hover:border-white/20'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full border border-white/20"
                      style={{ backgroundColor: t.colorHex }}
                    />
                    <span className="font-bold text-xs text-white truncate">
                      {t.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400">
                    {t.players.length} jogadores
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Card do Duelo Escolhido */}
        {homeTeam && awayTeam && (
          <div className="p-4 rounded-2xl bg-surface-200/80 border border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-3.5 h-6 rounded shadow shrink-0"
                style={{ backgroundColor: homeTeam.colorHex }}
              />
              <span className="font-display font-black text-sm text-white truncate">
                {homeTeam.name}
              </span>
            </div>

            <span className="text-xs font-black text-emerald-400 uppercase tracking-widest px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
              VS
            </span>

            <div className="flex items-center gap-2.5 min-w-0 justify-end text-right">
              <span className="font-display font-black text-sm text-white truncate">
                {awayTeam.name}
              </span>
              <div
                className="w-3.5 h-6 rounded shadow shrink-0"
                style={{ backgroundColor: awayTeam.colorHex }}
              />
            </div>
          </div>
        )}

        {/* Botão de Iniciar Partida */}
        <button
          type="button"
          disabled={isStartingMatch || selectedHomeTeamId === selectedAwayTeamId}
          onClick={handleStartNewMatch}
          className="w-full min-h-[52px] px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-50 text-gray-950 font-black text-base shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 touch-press-scale"
        >
          {isStartingMatch ? (
            <span>Iniciando Cronômetro...</span>
          ) : (
            <>
              <Play className="w-5 h-5 fill-current" />
              <span>Apitar Início da Partida (7 min)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
