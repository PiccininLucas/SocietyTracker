import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, User, Sparkles, ShieldAlert, Check } from 'lucide-react';
import { cn } from '../ui/utils';
import { soundFx } from '../ui/audio';
import { hapticFeedback } from '../ui/vibration';
import type { LivePlayer, LiveTeam } from './types';

export interface GoalDrawerProps {
  isOpen: boolean;
  team: LiveTeam | null;
  opponentTeam?: LiveTeam | null;
  onConfirmGoal: (data: {
    teamId: string;
    scorerId?: string | null;
    assistId?: string | null;
    isOwnGoal: boolean;
    scorerName?: string;
    assistName?: string;
  }) => void;
  onClose: () => void;
}

type Step = 'select_scorer' | 'select_assist';

export const GoalDrawer: React.FC<GoalDrawerProps> = ({
  isOpen,
  team,
  opponentTeam,
  onConfirmGoal,
  onClose,
}) => {
  const [step, setStep] = useState<Step>('select_scorer');
  const [selectedScorer, setSelectedScorer] = useState<LivePlayer | null>(null);
  const [isOwnGoal, setIsOwnGoal] = useState<boolean>(false);

  // Reseta o estado interno sempre que o drawer é aberto
  useEffect(() => {
    if (isOpen) {
      setStep('select_scorer');
      setSelectedScorer(null);
      setIsOwnGoal(false);
    }
  }, [isOpen, team?.id]);

  if (!isOpen || !team) return null;

  // Jogadores disponíveis para autor do gol
  const teamPlayers = team.players || [];

  // Jogadores elegíveis para assistência (exclui o próprio autor do gol)
  const assistCandidates = teamPlayers.filter(
    (p) => !selectedScorer || p.id !== selectedScorer.id
  );

  // Toque 1: Selecionar o autor do gol
  const handleSelectScorer = (player: LivePlayer) => {
    hapticFeedback.click();
    soundFx.playClickBeep('high');
    setSelectedScorer(player);
    setIsOwnGoal(false);
    setStep('select_assist');
  };

  // Toque 1 Alternativo: Gol Contra
  const handleSelectOwnGoal = () => {
    hapticFeedback.goal();
    soundFx.playGoalSound();
    onConfirmGoal({
      teamId: team.id,
      scorerId: null,
      assistId: null,
      isOwnGoal: true,
      scorerName: 'Gol Contra',
      assistName: undefined,
    });
    onClose();
  };

  // Toque 2: Confirmar assistência ou Jogada Individual
  const handleSelectAssist = (assistPlayer: LivePlayer | null) => {
    if (!selectedScorer) return;

    hapticFeedback.goal();
    soundFx.playGoalSound();

    onConfirmGoal({
      teamId: team.id,
      scorerId: selectedScorer.id,
      assistId: assistPlayer ? assistPlayer.id : null,
      isOwnGoal: false,
      scorerName: selectedScorer.nickname || selectedScorer.name,
      assistName: assistPlayer ? (assistPlayer.nickname || assistPlayer.name) : undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm transition-opacity animate-fade-in">
      {/* Backdrop Click para fechar */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Painel Inferior (Bottom Sheet) */}
      <div
        className="relative z-10 w-full max-w-lg rounded-t-3xl bg-surface-100 border-t border-white/10 p-5 shadow-2xl animate-slide-up max-h-[85vh] flex flex-col"
        style={{
          boxShadow: `0 -10px 40px -10px ${team.colorHex}33`,
        }}
      >
        {/* Barra de arraste (Drag handle visual) */}
        <div className="w-12 h-1.5 bg-gray-600 rounded-full mx-auto mb-4" />

        {/* Header do Drawer */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            {step === 'select_assist' && (
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.click();
                  setStep('select_scorer');
                }}
                className="p-1.5 rounded-lg bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                aria-label="Voltar para seleção de autor"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            <div className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded-full border border-white/30"
                style={{ backgroundColor: team.colorHex }}
              />
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                  {step === 'select_scorer' ? '⚽ Quem marcou o gol?' : '👟 Quem deu a assistência?'}
                </h3>
                <p className="text-xs text-gray-400">
                  {team.name} • {step === 'select_scorer' ? 'Passo 1 de 2' : 'Passo 2 de 2'}
                </p>
              </div>
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

        {/* Conteúdo Dinâmico do Fluxo */}
        <div className="overflow-y-auto py-3 space-y-2.5 flex-1 pr-1">
          {/* PASSO 1: SELEÇÃO DO AUTOR DO GOL */}
          {step === 'select_scorer' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {teamPlayers.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => handleSelectScorer(player)}
                    className="min-h-[52px] w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-gray-800/80 hover:bg-gray-700 active:scale-[0.98] border border-gray-700/60 hover:border-emerald-500/50 text-left transition-all touch-press-scale group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-bold text-xs group-hover:bg-emerald-500 group-hover:text-gray-950 transition-colors">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-white text-sm sm:text-base block">
                          {player.nickname || player.name}
                        </span>
                        {player.nickname && player.name && (
                          <span className="text-xs text-gray-400 block -mt-0.5">
                            {player.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 rounded bg-gray-700/50 text-emerald-400 opacity-80 group-hover:opacity-100">
                      GOL ⚽
                    </span>
                  </button>
                ))}
              </div>

              {/* Botão de Gol Contra em destaque */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSelectOwnGoal}
                  className="min-h-[48px] w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-rose-950/40 hover:bg-rose-900/50 active:scale-[0.98] border border-rose-800/40 text-rose-300 font-bold text-sm transition-all touch-press-scale"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Registrar Gol Contra (Adversário)</span>
                </button>
              </div>
            </>
          )}

          {/* PASSO 2: SELEÇÃO DA ASSISTÊNCIA */}
          {step === 'select_assist' && (
            <>
              {/* Botão Principal: Sem Assistência (Jogada Individual) */}
              <button
                type="button"
                onClick={() => handleSelectAssist(null)}
                className="min-h-[54px] w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-gray-950 font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-500/20 transition-all touch-press-scale mb-3"
              >
                <Sparkles className="w-5 h-5 fill-current" />
                <span>Sem Assistência (Jogada Individual)</span>
              </button>

              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 pt-1 pb-1">
                Ou selecione o garçom:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {assistCandidates.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => handleSelectAssist(player)}
                    className="min-h-[50px] w-full flex items-center justify-between px-4 py-2.5 rounded-2xl bg-gray-800/80 hover:bg-gray-700 active:scale-[0.98] border border-gray-700/60 hover:border-cyan-500/50 text-left transition-all touch-press-scale group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-bold text-xs group-hover:bg-cyan-400 group-hover:text-gray-950 transition-colors">
                        <User className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-white text-sm">
                        {player.nickname || player.name}
                      </span>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-700/50 text-cyan-400">
                      Passe 👟
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
