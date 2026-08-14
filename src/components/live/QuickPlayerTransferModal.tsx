import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, X, UserCheck, Users, Check, AlertCircle } from 'lucide-react';
import { cn } from '../ui/utils';
import { soundFx } from '../ui/audio';
import { hapticFeedback } from '../ui/vibration';
import type { LivePlayer, LiveTeam } from './types';

export interface QuickPlayerTransferModalProps {
  isOpen: boolean;
  teams: LiveTeam[];
  currentHomeTeamId?: string;
  currentAwayTeamId?: string;
  onTransfer: (data: {
    fromTeamId: string;
    toTeamId: string;
    playerId: string;
    isLoaned: boolean;
  }) => void | Promise<void>;
  onClose: () => void;
}

export const QuickPlayerTransferModal: React.FC<QuickPlayerTransferModalProps> = ({
  isOpen,
  teams,
  currentHomeTeamId,
  currentAwayTeamId,
  onTransfer,
  onClose,
}) => {
  const [fromTeamId, setFromTeamId] = useState<string>('');
  const [toTeamId, setToTeamId] = useState<string>('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [isLoaned, setIsLoaned] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inicializa os times padrão quando o modal abre
  useEffect(() => {
    if (isOpen && teams.length >= 2) {
      const defaultFrom = teams[0].id;
      const defaultTo = teams.find((t) => t.id !== defaultFrom)?.id || teams[1].id;
      setFromTeamId(defaultFrom);
      setToTeamId(defaultTo);
      setSelectedPlayerId('');
      setIsLoaned(true);
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen, teams]);

  if (!isOpen) return null;

  const sourceTeam = teams.find((t) => t.id === fromTeamId);
  const destinationTeam = teams.find((t) => t.id === toTeamId);
  const availablePlayers = sourceTeam?.players || [];

  const handleConfirm = async () => {
    if (!fromTeamId || !toTeamId) {
      setErrorMsg('Selecione os times de origem e destino.');
      return;
    }
    if (fromTeamId === toTeamId) {
      setErrorMsg('Os times de origem e destino devem ser diferentes.');
      return;
    }
    if (!selectedPlayerId) {
      setErrorMsg('Selecione o jogador a ser transferido.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      hapticFeedback.click();
      soundFx.playClickBeep('high');

      await onTransfer({
        fromTeamId,
        toTeamId,
        playerId: selectedPlayerId,
        isLoaned,
      });

      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao transferir atleta.';
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-md rounded-3xl glass-card-glow bg-surface-100 border border-white/10 p-5 sm:p-6 shadow-2xl animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                Emprestar / Transferir Atleta
              </h3>
              <p className="text-xs text-gray-400">
                Ajuste rápido de escalação para o jogo
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagem de Erro se houver */}
        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Seleção de Times (Origem -> Destino) */}
        <div className="grid grid-cols-2 gap-3 my-4">
          {/* Time Origem */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
              Time de Origem
            </label>
            <select
              value={fromTeamId}
              onChange={(e) => {
                const newFrom = e.target.value;
                setFromTeamId(newFrom);
                setSelectedPlayerId('');
                if (newFrom === toTeamId) {
                  const alt = teams.find((t) => t.id !== newFrom)?.id || '';
                  setToTeamId(alt);
                }
              }}
              className="w-full min-h-[46px] px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white font-medium text-sm focus:outline-none focus:border-blue-500 transition-colors"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.players?.length || 0})
                </option>
              ))}
            </select>
          </div>

          {/* Time Destino */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
              Time de Destino
            </label>
            <select
              value={toTeamId}
              onChange={(e) => setToTeamId(e.target.value)}
              className="w-full min-h-[46px] px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white font-medium text-sm focus:outline-none focus:border-blue-500 transition-colors"
            >
              {teams
                .filter((t) => t.id !== fromTeamId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.players?.length || 0})
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Seleção de Atleta */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
            Selecione o Atleta ({sourceTeam?.name})
          </label>

          {availablePlayers.length === 0 ? (
            <div className="p-4 rounded-xl bg-gray-800/40 text-center text-xs text-gray-400 border border-dashed border-gray-700">
              Nenhum jogador disponível neste time.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
              {availablePlayers.map((player) => {
                const isSelected = selectedPlayerId === player.id;
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => {
                      hapticFeedback.click();
                      setSelectedPlayerId(player.id);
                    }}
                    className={cn(
                      'min-h-[46px] flex items-center justify-between px-3 py-2 rounded-xl text-left font-medium text-xs sm:text-sm transition-all touch-press-scale border',
                      isSelected
                        ? 'bg-blue-600/30 border-blue-500 text-white font-bold shadow-sm'
                        : 'bg-gray-800/80 border-gray-700/60 text-gray-300 hover:bg-gray-700/80'
                    )}
                  >
                    <span className="truncate">
                      {player.nickname || player.name}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Toggle de Empréstimo vs Transferência Definitiva */}
        <div
          onClick={() => setIsLoaned(!isLoaned)}
          className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-800/60 border border-gray-700/60 mb-5 cursor-pointer select-none hover:bg-gray-800/90 transition-colors"
        >
          <div className="pr-3">
            <span className="text-sm font-semibold text-white block">
              Empréstimo Temporário (Esta Partida)
            </span>
            <span className="text-xs text-gray-400 block mt-0.5">
              Gols contam para o ranking individual do atleta.
            </span>
          </div>

          <div
            className={cn(
              'w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 shrink-0',
              isLoaned ? 'bg-blue-600' : 'bg-gray-600'
            )}
          >
            <div
              className={cn(
                'w-5 h-5 rounded-full bg-white transition-transform shadow-md',
                isLoaned ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-sm transition-colors border border-gray-700"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={!selectedPlayerId || isSubmitting}
            onClick={handleConfirm}
            className="min-h-[48px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-sm shadow-lg shadow-blue-600/20 transition-all touch-press-scale"
          >
            <UserCheck className="w-4 h-4" />
            <span>{isSubmitting ? 'Transferindo...' : 'Confirmar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
