import React, { useState, useEffect, useRef } from 'react';
import { ModalPortal } from '../ui/ModalPortal';
import { X, ArrowLeft, User, Sparkles, ShieldAlert, ArrowRightLeft, Search } from 'lucide-react';
import { soundFx } from '../ui/audio';
import { hapticFeedback } from '../ui/vibration';
import type { LivePlayer, LiveTeam } from './types';
import { matchesPlayerSearch } from '../../lib/search';

export interface GoalDrawerProps {
  isOpen: boolean;
  team: LiveTeam | null;
  opponentTeam?: LiveTeam | null;
  availableLoanPlayers?: LivePlayer[];
  onConfirmGoal: (data: {
    teamId: string;
    scorerId?: string | null;
    assistId?: string | null;
    isOwnGoal: boolean;
    scorerName?: string;
    assistName?: string;
    loanPlayerIds?: string[];
  }) => void;
  onClose: () => void;
}

type Step = 'select_scorer' | 'select_assist' | 'select_loan_scorer' | 'select_loan_assist';

export const GoalDrawer: React.FC<GoalDrawerProps> = ({
  isOpen,
  team,
  opponentTeam,
  availableLoanPlayers = [],
  onConfirmGoal,
  onClose,
}) => {
  const confirming = useRef(false);
  const [step, setStep] = useState<Step>('select_scorer');
  const [selectedScorer, setSelectedScorer] = useState<LivePlayer | null>(null);
  const [isScorerLoaned, setIsScorerLoaned] = useState<boolean>(false);
  const [filterQuery, setFilterQuery] = useState<string>('');

  // Reseta o estado interno sempre que o drawer é aberto
  useEffect(() => {
    if (isOpen) {
      confirming.current = false;
      setStep('select_scorer');
      setSelectedScorer(null);
      setIsScorerLoaned(false);
      setFilterQuery('');
    }
  }, [isOpen, team?.id]);

  if (!isOpen || !team) return null;

  // Jogadores disponíveis para autor do gol (do time em campo)
  const teamPlayers = team.players || [];

  // Jogadores elegíveis para assistência (exclui o próprio autor do gol)
  const assistCandidates = teamPlayers.filter((p) => !selectedScorer || p.id !== selectedScorer.id);

  // Lista de jogadores emprestados disponíveis dos outros times (ordem alfabética)
  const filteredLoanPlayers = availableLoanPlayers
    .filter((p) =>
      step === 'select_loan_scorer' ? true : !selectedScorer || p.id !== selectedScorer.id
    )
    .filter((p) => matchesPlayerSearch(p, filterQuery))
    .sort((a, b) =>
      (a.nickname || a.name).localeCompare(b.nickname || b.name, 'pt-BR', { sensitivity: 'base' })
    );

  // Selecionar o autor do gol (seja do time ou emprestado)
  const handleSelectScorer = (player: LivePlayer, isLoan = false) => {
    hapticFeedback.click();
    soundFx.playClickBeep('high');
    setSelectedScorer(player);
    setIsScorerLoaned(isLoan);
    setFilterQuery('');
    setStep('select_assist');
  };

  // Gol Contra
  //
  // A gaveta é aberta pelo time que MARCOU — é nele que o mesário toca. Um gol contra é,
  // então, um jogador do ADVERSÁRIO que mandou na própria meta.
  //
  // O contrato de dados é o inverso disso, de propósito: `teamId` é o time que COMETEU o
  // gol contra, e o ponto vai para o outro (a regra vive em `scoreFromEvents` e no
  // trigger `society_event_score`). Por isso enviamos aqui o id do adversário. Antes
  // enviávamos `team.id`, e o ponto acabava indo para o time errado.
  const handleSelectOwnGoal = () => {
    if (confirming.current || !opponentTeam) return;
    confirming.current = true;
    hapticFeedback.goal();
    soundFx.playGoalSound();
    onConfirmGoal({
      teamId: opponentTeam.id,
      scorerId: null,
      assistId: null,
      isOwnGoal: true,
      scorerName: 'Gol Contra',
      assistName: undefined,
    });
    onClose();
  };

  // Confirmar assistência ou Jogada Individual
  const handleSelectAssist = (assistPlayer: LivePlayer | null, isAssistLoan = false) => {
    if (!selectedScorer || confirming.current) return;
    confirming.current = true;

    hapticFeedback.goal();
    soundFx.playGoalSound();

    const loanPlayerIds: string[] = [];
    if (isScorerLoaned && selectedScorer) loanPlayerIds.push(selectedScorer.id);
    if (isAssistLoan && assistPlayer) loanPlayerIds.push(assistPlayer.id);

    onConfirmGoal({
      teamId: team.id,
      scorerId: selectedScorer.id,
      assistId: assistPlayer ? assistPlayer.id : null,
      isOwnGoal: false,
      scorerName: selectedScorer.nickname || selectedScorer.name,
      assistName: assistPlayer ? assistPlayer.nickname || assistPlayer.name : undefined,
      loanPlayerIds: loanPlayerIds.length > 0 ? loanPlayerIds : undefined,
    });

    onClose();
  };

  return (
    <ModalPortal onClose={onClose} label="Registrar gol">
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm transition-opacity animate-fade-in">
        {/* Backdrop Click para fechar */}
        <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

        {/* Painel Inferior (Bottom Sheet) */}
        <div
          className="relative z-10 w-full max-w-lg rounded-t-3xl bg-surface-100 border-t border-white/10 p-5 shadow-2xl animate-slide-up max-h-[85dvh] pb-safe flex flex-col"
          style={{
            boxShadow: `0 -10px 40px -10px ${team.colorHex}33`,
          }}
        >
          {/* Barra de arraste (Drag handle visual) */}
          <div className="w-12 h-1.5 bg-gray-600 rounded-full mx-auto mb-4" />

          {/* Header do Drawer */}
          <div className="shrink-0 flex items-center justify-between pb-3 border-b border-gray-800">
            <div className="flex items-center gap-3">
              {step !== 'select_scorer' && (
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.click();
                    setFilterQuery('');
                    if (step === 'select_loan_scorer') setStep('select_scorer');
                    else if (step === 'select_loan_assist') setStep('select_assist');
                    else setStep('select_scorer');
                  }}
                  className="min-h-[44px] min-w-[44px] p-1.5 rounded-lg bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                  aria-label="Voltar"
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
                    {step === 'select_scorer' && '⚽ Quem marcou o gol?'}
                    {step === 'select_assist' && '👟 Quem deu a assistência?'}
                    {step === 'select_loan_scorer' && '🔄 Quem marcou? (Emprestado)'}
                    {step === 'select_loan_assist' && '🔄 Quem assistiu? (Emprestado)'}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {team.name} • {step === 'select_scorer' && 'Passo 1 de 2'}
                    {step === 'select_assist' && 'Passo 2 de 2'}
                    {step === 'select_loan_scorer' && 'Passo 1 de 2 · Outros times'}
                    {step === 'select_loan_assist' && 'Passo 2 de 2 · Outros times'}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Conteúdo Dinâmico do Fluxo */}
          <div className="min-h-0 overscroll-contain overflow-y-auto py-3 space-y-2.5 flex-1 pr-1">
            {/* PASSO 1: SELEÇÃO DO AUTOR DO GOL (TIME) */}
            {step === 'select_scorer' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {teamPlayers.length === 0 && (
                    <p className="text-gray-300">Nenhum jogador escalado neste time.</p>
                  )}
                  {teamPlayers.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => handleSelectScorer(player, false)}
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

                {/* Opções especiais: Empréstimo e Gol Contra */}
                <div className="pt-2 space-y-2">
                  {availableLoanPlayers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        hapticFeedback.click();
                        soundFx.playClickBeep('normal');
                        setFilterQuery('');
                        setStep('select_loan_scorer');
                      }}
                      className="min-h-[48px] w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-blue-950/40 hover:bg-blue-900/50 active:scale-[0.98] border border-blue-700/40 text-blue-300 font-bold text-sm transition-all touch-press-scale"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>Jogador Emprestado (Outros Times)</span>
                    </button>
                  )}

                  {opponentTeam && (
                    <button
                      type="button"
                      onClick={handleSelectOwnGoal}
                      className="min-h-[48px] w-full flex flex-col items-center justify-center gap-0.5 px-4 py-3 rounded-2xl bg-rose-950/40 hover:bg-rose-900/50 active:scale-[0.98] border border-rose-800/40 text-rose-300 font-bold text-sm transition-all touch-press-scale"
                    >
                      <span className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" />
                        <span>Gol Contra</span>
                      </span>
                      <span className="text-[11px] font-medium text-rose-400/80 normal-case">
                        Marcado por jogador do {opponentTeam.name} · ponto para {team.name}
                      </span>
                    </button>
                  )}
                </div>
              </>
            )}

            {/* PASSO 1 SUBVISÃO: SELEÇÃO DE JOGADOR EMPRESTADO (AUTOR DO GOL) */}
            {step === 'select_loan_scorer' && (
              <div className="space-y-3">
                {availableLoanPlayers.length > 4 && (
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      placeholder="Buscar jogador emprestado..."
                      className="w-full min-h-[44px] pl-9 pr-3 py-2.5 rounded-xl bg-gray-800/90 border border-gray-700 text-base text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredLoanPlayers.length === 0 ? (
                    <p className="text-gray-400 text-sm p-3 text-center col-span-full">
                      Nenhum atleta disponível para empréstimo.
                    </p>
                  ) : (
                    filteredLoanPlayers.map((player) => (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => handleSelectScorer(player, true)}
                        className="min-h-[52px] w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-gray-800/80 hover:bg-blue-900/40 active:scale-[0.98] border border-gray-700/60 hover:border-blue-500/50 text-left transition-all touch-press-scale group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-950 border border-blue-600/30 flex items-center justify-center text-blue-300 font-bold text-xs group-hover:bg-blue-600 group-hover:text-white transition-colors">
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
                        <span className="text-xs font-bold px-2 py-1 rounded bg-blue-900/40 text-blue-300 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          GOL ⚽
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* PASSO 2: SELEÇÃO DA ASSISTÊNCIA */}
            {step === 'select_assist' && (
              <>
                {/* Botão Principal: Sem Assistência (Jogada Individual) */}
                <button
                  type="button"
                  onClick={() => handleSelectAssist(null, false)}
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
                      onClick={() => handleSelectAssist(player, false)}
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

                {availableLoanPlayers.length > 0 && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        hapticFeedback.click();
                        soundFx.playClickBeep('normal');
                        setFilterQuery('');
                        setStep('select_loan_assist');
                      }}
                      className="min-h-[48px] w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-blue-950/40 hover:bg-blue-900/50 active:scale-[0.98] border border-blue-700/40 text-blue-300 font-bold text-sm transition-all touch-press-scale"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>Jogador Emprestado (Assistência)</span>
                    </button>
                  </div>
                )}
              </>
            )}

            {/* PASSO 2 SUBVISÃO: SELEÇÃO DE JOGADOR EMPRESTADO (ASSISTÊNCIA) */}
            {step === 'select_loan_assist' && (
              <div className="space-y-3">
                {availableLoanPlayers.length > 4 && (
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      placeholder="Buscar jogador emprestado..."
                      className="w-full min-h-[44px] pl-9 pr-3 py-2.5 rounded-xl bg-gray-800/90 border border-gray-700 text-base text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredLoanPlayers.length === 0 ? (
                    <p className="text-gray-400 text-sm p-3 text-center col-span-full">
                      Nenhum outro atleta disponível para empréstimo.
                    </p>
                  ) : (
                    filteredLoanPlayers.map((player) => (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => handleSelectAssist(player, true)}
                        className="min-h-[50px] w-full flex items-center justify-between px-4 py-2.5 rounded-2xl bg-gray-800/80 hover:bg-blue-900/40 active:scale-[0.98] border border-gray-700/60 hover:border-blue-500/50 text-left transition-all touch-press-scale group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-950 border border-blue-600/30 flex items-center justify-center text-blue-300 font-bold text-xs group-hover:bg-cyan-400 group-hover:text-gray-950 transition-colors">
                            <User className="w-4 h-4" />
                          </div>
                          <span className="font-semibold text-white text-sm">
                            {player.nickname || player.name}
                          </span>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 group-hover:bg-cyan-400 group-hover:text-gray-950 transition-colors">
                          Passe 👟
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
