import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Trophy,
  Clock,
  Zap,
  Star,
  ArrowRightLeft,
  Shield,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Check,
} from 'lucide-react';
import type { MatchSummary, MatchPlayerSummary, MatchSummaryEvent } from '../../core/domain/repositories/IMatchRepository';

interface MatchDetailsModalProps {
  matches?: MatchSummary[];
  initialMatchId?: string | null;
}

export const MatchDetailsModal: React.FC<MatchDetailsModalProps> = ({
  matches = [],
  initialMatchId = null,
}) => {
  const [selectedMatch, setSelectedMatch] = useState<MatchSummary | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Estados para edição e exclusão de eventos (súmula)
  const [editingEvent, setEditingEvent] = useState<MatchSummaryEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<MatchSummaryEvent | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Campos do formulário de edição
  const [editTeamId, setEditTeamId] = useState<string>('');
  const [editIsOwnGoal, setEditIsOwnGoal] = useState<boolean>(false);
  const [editScorerId, setEditScorerId] = useState<string>('');
  const [editAssistId, setEditAssistId] = useState<string>('');

  // Auto-dismiss da mensagem de toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Formatação de minutos e segundos (ex: 1m 23s ou 01:23)
  const formatSeconds = (seconds?: number) => {
    const s = Math.max(0, Math.floor(seconds ?? 0));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const formatTimelineTime = (seconds?: number) => {
    const s = Math.max(0, Math.floor(seconds ?? 0));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatStartTime = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatSessionDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        return date.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Carregar dados completos da partida
  const openWithMatchId = useCallback(
    async (matchId: string, preloadedMatch?: MatchSummary) => {
      // 1. Tentar encontrar nos matches já carregados
      const existing =
        preloadedMatch || matches.find((m) => m.matchId.toLowerCase() === matchId.toLowerCase());

      const hasCompleteLineups =
        existing &&
        Array.isArray(existing.homePlayers) &&
        existing.homePlayers.length > 0 &&
        Array.isArray(existing.awayPlayers) &&
        existing.awayPlayers.length > 0;

      if (hasCompleteLineups) {
        setSelectedMatch(existing);
        setIsOpen(true);
        return;
      }

      if (existing) {
        setSelectedMatch(existing);
        setIsOpen(true);
      }

      // 2. Se não tiver escalações completas ou não foi encontrado em memória, buscar via API
      try {
        setIsLoading(!hasCompleteLineups);
        if (!existing) setIsOpen(true);

        const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}`);
        if (res.ok) {
          const detailed: MatchSummary = await res.json();
          setSelectedMatch(detailed);
        }
      } catch (err) {
        console.error('Erro ao buscar detalhes da partida:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [matches]
  );

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setSelectedMatch(null);
    // Limpar query param da URL caso exista
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('match')) {
        url.searchParams.delete('match');
        window.history.replaceState({}, '', url.toString());
      }
    } catch {
      // Ignora erro de manipulação de URL
    }
  }, []);

  // Fechar no teclado (ESC) e travar scroll do body
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeModal();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeModal]);

  // Listener para eventos customizados 'open-match-details'
  useEffect(() => {
    const handleCustomEvent = (e: Event) => {
      const customEv = e as CustomEvent<{ matchId?: string; match?: MatchSummary }>;
      if (customEv.detail?.matchId) {
        openWithMatchId(customEv.detail.matchId, customEv.detail.match);
      }
    };

    window.addEventListener('open-match-details', handleCustomEvent);

    // Expor função no escopo global do window para facilitar invocações
    (window as any).openMatchDetails = (matchId: string, match?: MatchSummary) => {
      openWithMatchId(matchId, match);
    };

    // Verificar se a URL possui query param ?match=
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlMatchId = urlParams.get('match') || initialMatchId;
      if (urlMatchId) {
        openWithMatchId(urlMatchId);
      }
    } catch {
      // Ignora erro de query param
    }

    return () => {
      window.removeEventListener('open-match-details', handleCustomEvent);
      delete (window as any).openMatchDetails;
    };
  }, [openWithMatchId, initialMatchId]);

  // Recalcular estatísticas de gols e assistências dos jogadores a partir da lista de eventos
  const recalculatePlayerStats = (
    players: MatchPlayerSummary[] = [],
    eventsList: MatchSummaryEvent[]
  ): MatchPlayerSummary[] => {
    const norm = (id?: string | null) => (id ? id.trim().toLowerCase() : '');
    return players.map((p) => {
      const pId = norm(p.id);
      const goals = eventsList.filter((e) => norm(e.scorerId) === pId && !e.isOwnGoal).length;
      const assists = eventsList.filter((e) => norm(e.assistId) === pId && !e.isOwnGoal).length;
      return { ...p, goals, assists };
    });
  };

  const calculateMatchScores = (
    eventsList: MatchSummaryEvent[],
    hTeamId?: string | null,
    aTeamId?: string | null
  ) => {
    const norm = (id?: string | null) => (id ? id.trim().toLowerCase() : '');
    const hId = norm(hTeamId);
    const aId = norm(aTeamId);

    const hScore = eventsList.filter((e) => {
      const tId = norm(e.teamId);
      return (!e.isOwnGoal && tId === hId) || (e.isOwnGoal && tId === aId);
    }).length;

    const aScore = eventsList.filter((e) => {
      const tId = norm(e.teamId);
      return (!e.isOwnGoal && tId === aId) || (e.isOwnGoal && tId === hId);
    }).length;

    return { homeScore: hScore, awayScore: aScore };
  };

  const notifyMatchUpdated = (matchId: string, hScore: number, aScore: number) => {
    try {
      window.dispatchEvent(
        new CustomEvent('match-updated', {
          detail: { matchId, homeScore: hScore, awayScore: aScore },
        })
      );
      // Sincroniza visualmente o card correspondente no DOM caso a página esteja montada
      const card = document.querySelector(`[data-match-card][data-match-id="${matchId}"]`);
      if (card) {
        const scoreSpans = card.querySelectorAll('.font-display span');
        if (scoreSpans.length >= 3) {
          scoreSpans[0].textContent = String(hScore);
          scoreSpans[2].textContent = String(aScore);
        }
      }
    } catch {
      // Ignora erro
    }
  };

  const handleOpenEditModal = (ev: MatchSummaryEvent) => {
    setActionError(null);
    setEditingEvent(ev);
    setEditTeamId(ev.teamId);
    setEditIsOwnGoal(ev.isOwnGoal);
    setEditScorerId(ev.scorerId || '');
    setEditAssistId(ev.assistId || '');
  };

  const handleOpenDeleteModal = (ev: MatchSummaryEvent) => {
    setActionError(null);
    setDeletingEvent(ev);
  };

  const handleConfirmDelete = async () => {
    if (!deletingEvent || !selectedMatch) return;

    try {
      setIsSubmittingAction(true);
      setActionError(null);

      const res = await fetch(
        `/api/matches/${encodeURIComponent(selectedMatch.matchId)}/events/${encodeURIComponent(deletingEvent.id)}`,
        {
          method: 'DELETE',
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao excluir o evento.');
      }

      // Sucesso: atualizar estado local da partida
      const newEvents = (selectedMatch.events || []).filter((e) => e.id !== deletingEvent.id);
      const { homeScore: nextH, awayScore: nextA } = calculateMatchScores(
        newEvents,
        selectedMatch.homeTeamId,
        selectedMatch.awayTeamId
      );

      const nextHomePlayers = recalculatePlayerStats(selectedMatch.homePlayers || [], newEvents);
      const nextAwayPlayers = recalculatePlayerStats(selectedMatch.awayPlayers || [], newEvents);

      setSelectedMatch({
        ...selectedMatch,
        events: newEvents,
        homeScore: nextH,
        awayScore: nextA,
        homePlayers: nextHomePlayers,
        awayPlayers: nextAwayPlayers,
      });

      notifyMatchUpdated(selectedMatch.matchId, nextH, nextA);
      setToastMessage('Gol excluído com sucesso! Placar recalculado.');
      setDeletingEvent(null);
    } catch (err: any) {
      setActionError(err.message || 'Erro inesperado ao excluir o evento.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleConfirmEdit = async () => {
    if (!editingEvent || !selectedMatch) return;

    if (!editIsOwnGoal && !editScorerId) {
      setActionError('Selecione o autor do gol.');
      return;
    }

    if (!editIsOwnGoal && editScorerId && editAssistId && editScorerId === editAssistId) {
      setActionError('O autor do gol não pode ser o mesmo da assistência.');
      return;
    }

    try {
      setIsSubmittingAction(true);
      setActionError(null);

      const payload = {
        teamId: editTeamId || editingEvent.teamId,
        scorerId: editIsOwnGoal ? null : (editScorerId || null),
        assistId: editIsOwnGoal ? null : (editAssistId || null),
        isOwnGoal: editIsOwnGoal,
      };

      const res = await fetch(
        `/api/matches/${encodeURIComponent(selectedMatch.matchId)}/events/${encodeURIComponent(editingEvent.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao salvar as alterações do lance.');
      }

      // Determinar os nomes do autor e assistência para atualizar a visualização
      const allPlayers = [
        ...(selectedMatch.homePlayers || []),
        ...(selectedMatch.awayPlayers || []),
      ];
      const scorerObj = allPlayers.find((p) => p.id === editScorerId);
      const assistObj = allPlayers.find((p) => p.id === editAssistId);

      const scorerName = editIsOwnGoal
        ? 'Gol Contra'
        : (scorerObj?.nickname || scorerObj?.name || 'Jogador');
      const assistName = editIsOwnGoal
        ? undefined
        : (assistObj ? (assistObj.nickname || assistObj.name) : undefined);

      const newEvents = (selectedMatch.events || []).map((e) => {
        if (e.id === editingEvent.id) {
          return {
            ...e,
            teamId: payload.teamId,
            scorerId: payload.scorerId,
            scorerName,
            assistId: payload.assistId,
            assistName,
            isOwnGoal: payload.isOwnGoal,
          };
        }
        return e;
      });

      const { homeScore: nextH, awayScore: nextA } = calculateMatchScores(
        newEvents,
        selectedMatch.homeTeamId,
        selectedMatch.awayTeamId
      );

      const nextHomePlayers = recalculatePlayerStats(selectedMatch.homePlayers || [], newEvents);
      const nextAwayPlayers = recalculatePlayerStats(selectedMatch.awayPlayers || [], newEvents);

      setSelectedMatch({
        ...selectedMatch,
        events: newEvents,
        homeScore: nextH,
        awayScore: nextA,
        homePlayers: nextHomePlayers,
        awayPlayers: nextAwayPlayers,
      });

      notifyMatchUpdated(selectedMatch.matchId, nextH, nextA);
      setToastMessage('Anotação de gol atualizada com sucesso!');
      setEditingEvent(null);
    } catch (err: any) {
      setActionError(err.message || 'Erro inesperado ao salvar alterações.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  if (!isOpen) return null;

  const match = selectedMatch;

  const normalizeId = (id?: string | null) => (id ? id.trim().toLowerCase() : '');
  const homeTeamId = normalizeId(match?.homeTeamId);
  const awayTeamId = normalizeId(match?.awayTeamId);

  // Placar calculado com base nos eventos
  const events = match?.events || [];
  const calculatedHomeScore = events.filter((e) => {
    const tId = normalizeId(e.teamId);
    return (!e.isOwnGoal && tId === homeTeamId) || (e.isOwnGoal && tId === awayTeamId);
  }).length;

  const calculatedAwayScore = events.filter((e) => {
    const tId = normalizeId(e.teamId);
    return (!e.isOwnGoal && tId === awayTeamId) || (e.isOwnGoal && tId === homeTeamId);
  }).length;

  const homeScore = events.length > 0 ? calculatedHomeScore : (match?.homeScore ?? 0);
  const awayScore = events.length > 0 ? calculatedAwayScore : (match?.awayScore ?? 0);

  const isHomeWinner = homeScore > awayScore;
  const isAwayWinner = awayScore > homeScore;
  const isDraw = homeScore === awayScore;

  const sortedEvents = [...events].sort((a, b) => a.eventTimeSeconds - b.eventTimeSeconds);

  // Renderizar estatísticas do atleta na partida
  const renderPlayerMatchStats = (player: MatchPlayerSummary) => {
    if (player.goals === 0 && player.assists === 0) return null;

    return (
      <div className="flex items-center gap-1.5 shrink-0 ml-1">
        {player.goals > 0 && (
          <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
            title={`${player.goals} gol${player.goals > 1 ? 's' : ''} nesta partida`}
          >
            <span>⚽</span>
            {player.goals > 1 ? (
              <span>x{player.goals}</span>
            ) : null}
          </span>
        )}
        {player.assists > 0 && (
          <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
            title={`${player.assists} assistência${player.assists > 1 ? 's' : ''} nesta partida`}
          >
            <span>👟</span>
            {player.assists > 1 ? (
              <span>x{player.assists}</span>
            ) : null}
          </span>
        )}
      </div>
    );
  };

  // Renderizar cartão de um jogador na lista do time
  const renderPlayerCard = (player: MatchPlayerSummary, idx: number) => {
    return (
      <div
        key={player.id}
        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
          player.isCaptain
            ? 'bg-amber-500/10 border-amber-500/30 shadow-sm shadow-amber-500/5'
            : player.isGoalkeeper
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : player.isLoaned
            ? 'bg-cyan-500/10 border-cyan-500/30'
            : 'bg-surface-200/50 border-white/5 hover:border-white/10'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 pr-1">
          <span className="w-4 h-4 rounded text-gray-500 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
            {idx + 1}
          </span>
          <div className="min-w-0">
            <span
              className={`font-semibold truncate block ${
                player.isCaptain ? 'text-amber-200' : 'text-white'
              }`}
            >
              {player.nickname || player.name}
            </span>
            {player.nickname && player.name && (
              <span className="text-[10px] text-gray-400 truncate block">
                {player.name}
              </span>
            )}
          </div>
        </div>

        {/* Badges de Função e Estatísticas da Partida */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Badges de papel */}
          {player.isCaptain && (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
              <Star className="w-2.5 h-2.5 fill-current" />
              <span>Capitão</span>
            </span>
          )}

          {player.isGoalkeeper && (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <span>🧤</span>
              <span>Goleiro</span>
            </span>
          )}

          {player.isLoaned && (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
              <ArrowRightLeft className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">Emprestado</span>
            </span>
          )}

          {/* Gols e Assistências nesta partida */}
          {renderPlayerMatchStats(player)}
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-modal-title"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl glass-card bg-surface-100/95 border border-white/10 shadow-2xl overflow-hidden animate-scale-up">
        {/* ============================================================ */}
        {/* TOP BAR / CABEÇALHO DO MODAL */}
        {/* ============================================================ */}
        <div className="px-5 sm:px-6 py-4 border-b border-white/10 bg-surface-200/60 shrink-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            {/* Tag de Regra e Horário */}
            <div className="flex items-center flex-wrap gap-2">
              {match?.endReason === 'two_goals' ? (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm shadow-emerald-500/10">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Regra dos 2 Gols</span>
                </span>
              ) : match?.endReason === 'time_limit' ? (
                <span className="px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm shadow-blue-500/10">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Fim do Tempo Oficial</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-gray-500/15 border border-gray-500/30 text-gray-400 text-xs font-black uppercase tracking-wider">
                  Partida Concluída
                </span>
              )}

              {match?.sessionDate && (
                <span className="text-xs text-gray-400 capitalize hidden sm:inline">
                  • {formatSessionDate(match.sessionDate)}
                </span>
              )}
            </div>

            {/* Duração & Botão Fechar */}
            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-400 font-semibold flex items-center gap-1.5 bg-surface-50 px-3 py-1 rounded-full border border-white/5">
                <span>⏱ {formatSeconds(match?.durationSeconds)}</span>
                {match?.startedAt && (
                  <span>• {formatStartTime(match.startedAt)}</span>
                )}
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 active:scale-95 transition-all"
                title="Fechar detalhes da partida (Esc)"
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Placar Central com Destaque para o Vencedor */}
          <div className="py-3 px-4 rounded-2xl bg-surface-100/90 border border-white/5 flex items-center justify-between gap-3 shadow-inner">
            {/* Time Mandante */}
            <div className="flex-1 min-w-0 flex items-center gap-3 justify-start">
              <div
                className="w-4 h-10 rounded-md shadow shrink-0"
                style={{
                  backgroundColor: match?.homeTeamColor || '#10b981',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3
                    id="match-modal-title"
                    className={`font-display font-black text-sm sm:text-lg truncate ${
                      isHomeWinner ? 'text-emerald-400 font-extrabold' : 'text-white'
                    }`}
                  >
                    {match?.homeTeamName || 'Mandante'}
                  </h3>
                </div>
                {isHomeWinner ? (
                  <span className="text-[10px] sm:text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <Trophy className="w-3 h-3" />
                    <span>Vencedor</span>
                  </span>
                ) : isDraw ? (
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                    Empate
                  </span>
                ) : null}
              </div>
            </div>

            {/* Placar */}
            <div className="shrink-0 px-3 sm:px-6 py-1 rounded-xl bg-surface-200/80 border border-white/10 shadow-md">
              <div className="font-display font-black text-2xl sm:text-4xl text-white tracking-tight flex items-center gap-2">
                <span className={isHomeWinner ? 'text-emerald-400' : 'text-white'}>
                  {homeScore}
                </span>
                <span className="text-sm sm:text-base text-gray-500 font-normal">x</span>
                <span className={isAwayWinner ? 'text-emerald-400' : 'text-white'}>
                  {awayScore}
                </span>
              </div>
            </div>

            {/* Time Visitante */}
            <div className="flex-1 min-w-0 flex items-center gap-3 justify-end text-right">
              <div className="min-w-0">
                <div className="flex items-center justify-end gap-1.5">
                  <h3
                    className={`font-display font-black text-sm sm:text-lg truncate ${
                      isAwayWinner ? 'text-emerald-400 font-extrabold' : 'text-white'
                    }`}
                  >
                    {match?.awayTeamName || 'Visitante'}
                  </h3>
                </div>
                {isAwayWinner ? (
                  <span className="text-[10px] sm:text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center justify-end gap-1">
                    <Trophy className="w-3 h-3" />
                    <span>Vencedor</span>
                  </span>
                ) : isDraw ? (
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                    Empate
                  </span>
                ) : null}
              </div>
              <div
                className="w-4 h-10 rounded-md shadow shrink-0"
                style={{
                  backgroundColor: match?.awayTeamColor || '#ef4444',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              />
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* CORPO DO MODAL (ESCALAÇÕES DOS 2 TIMES + LINHA DO TEMPO) */}
        {/* ============================================================ */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-400">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
              <p className="text-xs font-medium">Carregando detalhes da partida...</p>
            </div>
          ) : (
            <>
              {/* ESCALAÇÕES LADO A LADO */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h4 className="text-xs sm:text-sm font-display font-black text-gray-300 uppercase tracking-wider flex items-center gap-2">
                    <span>👥</span>
                    <span>Escalações das Equipes</span>
                  </h4>
                  <span className="text-[11px] text-gray-500">
                    Jogadores que atuaram por cada time
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* COLUNA 1: TIME MANDANTE */}
                  <div className="rounded-2xl glass-card border border-white/10 bg-surface-200/50 p-4 relative overflow-hidden flex flex-col justify-between shadow-lg">
                    {/* Linha de cor do colete */}
                    <div
                      className="absolute top-0 left-0 right-0 h-1.5"
                      style={{ backgroundColor: match?.homeTeamColor || '#10b981' }}
                    />

                    <div>
                      {/* Topo da Coluna do Mandante */}
                      <div className="flex items-center justify-between gap-2 mt-1 mb-3 pb-2 border-b border-white/5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                            style={{ backgroundColor: match?.homeTeamColor || '#10b981' }}
                          />
                          <span className="font-display font-bold text-sm text-white truncate">
                            {match?.homeTeamName}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-50 text-gray-400 border border-white/5 shrink-0">
                          {match?.homePlayers?.length || 0} atletas
                        </span>
                      </div>

                      {/* Lista de Atletas do Mandante */}
                      <div className="space-y-1.5">
                        {!match?.homePlayers || match.homePlayers.length === 0 ? (
                          <p className="text-xs text-gray-500 italic text-center py-6">
                            Nenhum jogador listado para este time.
                          </p>
                        ) : (
                          match.homePlayers.map((player, idx) => renderPlayerCard(player, idx))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* COLUNA 2: TIME VISITANTE */}
                  <div className="rounded-2xl glass-card border border-white/10 bg-surface-200/50 p-4 relative overflow-hidden flex flex-col justify-between shadow-lg">
                    {/* Linha de cor do colete */}
                    <div
                      className="absolute top-0 left-0 right-0 h-1.5"
                      style={{ backgroundColor: match?.awayTeamColor || '#ef4444' }}
                    />

                    <div>
                      {/* Topo da Coluna do Visitante */}
                      <div className="flex items-center justify-between gap-2 mt-1 mb-3 pb-2 border-b border-white/5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                            style={{ backgroundColor: match?.awayTeamColor || '#ef4444' }}
                          />
                          <span className="font-display font-bold text-sm text-white truncate">
                            {match?.awayTeamName}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-50 text-gray-400 border border-white/5 shrink-0">
                          {match?.awayPlayers?.length || 0} atletas
                        </span>
                      </div>

                      {/* Lista de Atletas do Visitante */}
                      <div className="space-y-1.5">
                        {!match?.awayPlayers || match.awayPlayers.length === 0 ? (
                          <p className="text-xs text-gray-500 italic text-center py-6">
                            Nenhum jogador listado para este time.
                          </p>
                        ) : (
                          match.awayPlayers.map((player, idx) => renderPlayerCard(player, idx))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ============================================================ */}
              {/* LINHA DO TEMPO DOS GOLS */}
              {/* ============================================================ */}
              <div className="rounded-2xl glass-card border border-white/10 bg-surface-200/40 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-white/5">
                  <h4 className="text-xs sm:text-sm font-display font-black text-gray-300 uppercase tracking-wider flex items-center gap-2">
                    <span>⚽</span>
                    <span>Linha do Tempo dos Gols</span>
                  </h4>
                  <span className="text-[11px] text-gray-400 font-semibold">
                    {sortedEvents.length} {sortedEvents.length === 1 ? 'gol marcado' : 'gols marcados'}
                  </span>
                </div>

                {sortedEvents.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-500 italic">
                    0 x 0 • Nenhum gol registrado nesta partida.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sortedEvents.map((ev, index) => {
                      const isHomeGoal =
                        (!ev.isOwnGoal && normalizeId(ev.teamId) === homeTeamId) ||
                        (ev.isOwnGoal && normalizeId(ev.teamId) === awayTeamId);

                      const scoringTeamName = isHomeGoal ? match?.homeTeamName : match?.awayTeamName;
                      const scoringTeamColor = isHomeGoal ? match?.homeTeamColor : match?.awayTeamColor;

                      return (
                        <div
                          key={ev.id || `${ev.eventTimeSeconds}-${index}`}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-surface-100/70 border border-white/5 hover:border-white/10 text-xs transition-all group/item"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Minuto:Segundo */}
                            <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-surface-50 text-gray-300 border border-white/10 shrink-0">
                              ⏱ {formatTimelineTime(ev.eventTimeSeconds)}
                            </span>

                            {/* Ícone de Gol ou Gol Contra */}
                            <span className="text-sm shrink-0">
                              {ev.isOwnGoal ? '⚠️' : '⚽'}
                            </span>

                            {/* Detalhe do autor e assistência */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`font-bold truncate ${
                                    ev.isOwnGoal ? 'text-rose-400' : 'text-white'
                                  }`}
                                >
                                  {ev.scorerName || (ev.isOwnGoal ? 'Gol Contra' : 'Gol')}
                                </span>

                                {!ev.isOwnGoal && ev.assistName && (
                                  <span className="text-cyan-300 text-[11px] font-medium truncate">
                                    (Assistência: {ev.assistName})
                                  </span>
                                )}

                                {ev.isOwnGoal && (
                                  <span className="text-rose-400 text-[10px] uppercase font-bold tracking-wider">
                                    (Gol Contra)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Time Beneficiado e Ações de Edição/Exclusão */}
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-gray-300 hidden sm:inline truncate max-w-[120px]">
                                {scoringTeamName}
                              </span>
                              <div
                                className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                                style={{ backgroundColor: scoringTeamColor || '#10b981' }}
                                title={`Gol pontuado para ${scoringTeamName}`}
                              />
                            </div>

                            {/* Botões de Ação Rápida */}
                            <div className="flex items-center gap-1 pl-2 border-l border-white/10">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditModal(ev);
                                }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-300 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/30 active:scale-95 transition-all"
                                title="Editar este lance (autor, assistência ou gol contra)"
                                aria-label="Editar lance"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDeleteModal(ev);
                                }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 active:scale-95 transition-all"
                                title="Excluir este gol"
                                aria-label="Excluir lance"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ============================================================ */}
        {/* TOAST DE FEEDBACK DE AÇÃO */}
        {/* ============================================================ */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-emerald-500/90 text-white text-xs font-bold shadow-xl flex items-center gap-2 animate-fade-in backdrop-blur-md border border-emerald-400/30">
            <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE LANCE */}
        {/* ============================================================ */}
        {deletingEvent && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isSubmittingAction) setDeletingEvent(null);
            }}
          >
            <div className="w-full max-w-md rounded-3xl glass-card bg-surface-100 border border-rose-500/30 p-6 shadow-2xl space-y-4 animate-scale-up">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display font-black text-lg text-white">
                    Excluir Anotação de Gol?
                  </h3>
                  <p className="text-xs text-gray-400">
                    Aos ⏱ {formatTimelineTime(deletingEvent.eventTimeSeconds)} de partida
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-200/60 border border-white/5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-gray-300">
                  <span className="text-gray-400">Lance:</span>
                  <span className="font-bold text-white">
                    {deletingEvent.isOwnGoal ? '⚠️ Gol Contra' : `⚽ Gol de ${deletingEvent.scorerName || 'Jogador'}`}
                  </span>
                </div>
                {!deletingEvent.isOwnGoal && deletingEvent.assistName && (
                  <div className="flex items-center justify-between text-gray-300">
                    <span className="text-gray-400">Assistência:</span>
                    <span className="text-cyan-300 font-semibold">{deletingEvent.assistName}</span>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 text-[11px] text-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  O placar oficial da partida será recalculado automaticamente e os dados de artilharia serão sincronizados.
                </span>
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                  {actionError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingEvent(null)}
                  disabled={isSubmittingAction}
                  className="px-4 py-2 rounded-xl bg-surface-50 hover:bg-white/10 text-gray-300 font-bold text-xs border border-white/10 transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isSubmittingAction}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingAction ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Excluindo...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirmar Exclusão</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL DE EDIÇÃO DE LANCE (SÚMULA) */}
        {/* ============================================================ */}
        {editingEvent && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isSubmittingAction) setEditingEvent(null);
            }}
          >
            <div className="w-full max-w-lg rounded-3xl glass-card bg-surface-100 border border-amber-500/30 p-6 shadow-2xl space-y-4 animate-scale-up">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300">
                    <Pencil className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-black text-base sm:text-lg text-white">
                      Editar Anotação do Lance
                    </h3>
                    <p className="text-xs text-gray-400">
                      ⏱ Minuto: {formatTimelineTime(editingEvent.eventTimeSeconds)} de jogo
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  disabled={isSubmittingAction}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Seleção do Time Atribuído */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 block">
                  Time que Marcou o Gol:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditTeamId(selectedMatch?.homeTeamId || '');
                      if (!editIsOwnGoal) {
                        setEditScorerId('');
                        setEditAssistId('');
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      normalizeId(editTeamId) === homeTeamId
                        ? 'bg-surface-50 border-emerald-500/50 text-white shadow-sm ring-1 ring-emerald-500/50'
                        : 'bg-surface-200/40 border-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: selectedMatch?.homeTeamColor || '#10b981' }}
                    />
                    <span className="truncate">{selectedMatch?.homeTeamName || 'Mandante'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditTeamId(selectedMatch?.awayTeamId || '');
                      if (!editIsOwnGoal) {
                        setEditScorerId('');
                        setEditAssistId('');
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      normalizeId(editTeamId) === awayTeamId
                        ? 'bg-surface-50 border-emerald-500/50 text-white shadow-sm ring-1 ring-emerald-500/50'
                        : 'bg-surface-200/40 border-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: selectedMatch?.awayTeamColor || '#ef4444' }}
                    />
                    <span className="truncate">{selectedMatch?.awayTeamName || 'Visitante'}</span>
                  </button>
                </div>
              </div>

              {/* Checkbox / Toggle Gol Contra */}
              <div className="p-3 rounded-2xl bg-surface-200/50 border border-white/5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">⚠️</span>
                  <div>
                    <span className="text-xs font-bold text-white block">Gol Contra</span>
                    <span className="text-[11px] text-gray-400 block">
                      O ponto é creditado à equipe adversária. Sem assistência.
                    </span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsOwnGoal}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setEditIsOwnGoal(val);
                      if (val) {
                        setEditAssistId('');
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                </label>
              </div>

              {/* Autor do Gol e Assistência com Seleção Resiliente de Atletas */}
              {(() => {
                const isHome = normalizeId(editTeamId) === homeTeamId;
                const teamList = isHome ? selectedMatch?.homePlayers || [] : selectedMatch?.awayPlayers || [];
                const candidatePlayers = teamList.length > 0 ? teamList : [
                  ...(selectedMatch?.homePlayers || []),
                  ...(selectedMatch?.awayPlayers || []),
                ];

                return (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-300 block">
                        {editIsOwnGoal ? 'Jogador que marcou contra (opcional):' : '⚽ Autor do Gol:'}
                      </label>
                      <select
                        value={editScorerId}
                        onChange={(e) => {
                          const newScorerId = e.target.value;
                          setEditScorerId(newScorerId);
                          if (editAssistId === newScorerId) {
                            setEditAssistId('');
                          }
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-surface-200/80 border border-white/10 text-white text-xs font-medium focus:border-amber-400 focus:outline-none"
                      >
                        <option value="">{editIsOwnGoal ? 'Não identificado' : 'Selecione o autor do gol...'}</option>
                        {candidatePlayers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nickname || p.name} {p.nickname && p.name ? `(${p.name})` : ''} {p.isGoalkeeper ? '🧤' : ''} {p.isCaptain ? '⭐' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {!editIsOwnGoal && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-300 block">
                          👟 Assistência (passe para o gol):
                        </label>
                        <select
                          value={editAssistId}
                          onChange={(e) => setEditAssistId(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-surface-200/80 border border-white/10 text-white text-xs font-medium focus:border-cyan-400 focus:outline-none"
                        >
                          <option value="">Sem assistência (jogada individual)</option>
                          {candidatePlayers
                            .filter((p) => p.id !== editScorerId)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nickname || p.name} {p.nickname && p.name ? `(${p.name})` : ''} {p.isGoalkeeper ? '🧤' : ''} {p.isCaptain ? '⭐' : ''}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </>
                );
              })()}

              {actionError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                  {actionError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  disabled={isSubmittingAction}
                  className="px-4 py-2 rounded-xl bg-surface-50 hover:bg-white/10 text-gray-300 font-bold text-xs border border-white/10 transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEdit}
                  disabled={isSubmittingAction}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingAction ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Salvar Alterações</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* FOOTER DO MODAL */}
        {/* ============================================================ */}
        <div className="p-4 border-t border-white/10 bg-surface-200/60 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-gray-500 hidden sm:block">
            Pressione <kbd className="px-1.5 py-0.5 rounded bg-surface-50 border border-white/10 text-gray-300 font-mono text-[10px]">ESC</kbd> para fechar a qualquer momento
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="w-full sm:w-auto px-6 py-2 rounded-xl bg-surface-50 hover:bg-white/10 text-white font-bold text-xs sm:text-sm border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            <span>Fechar Detalhes</span>
          </button>
        </div>
      </div>
    </div>
  );
};


