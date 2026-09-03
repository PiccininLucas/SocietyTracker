import React from 'react';
import { X, Users, Star, ArrowRightLeft, Shield, Pencil } from 'lucide-react';
import type { LiveTeam } from './types';
import { cn } from '../ui/utils';

interface TeamRostersModalProps {
  isOpen: boolean;
  teams: LiveTeam[];
  onClose: () => void;
  onEdit?: () => void;
}

export const TeamRostersModal: React.FC<TeamRostersModalProps> = ({
  isOpen,
  teams,
  onClose,
  onEdit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl glass-card bg-surface-100/95 border border-white/10 shadow-2xl overflow-hidden animate-scale-up">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-surface-200/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-lg shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-display font-black text-white flex items-center gap-2">
                <span>Times da Noite</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                  {teams.length} equipes
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Composição completa dos elencos da rodada
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold active:scale-95 transition-all"
                title="Editar composição dos times e capitães"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Editar Times</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 active:scale-95 transition-all"
              title="Fechar elenco"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Grid de Times com Scroll */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          <div
            className={cn(
              'grid gap-4',
              teams.length === 3
                ? 'grid-cols-1 md:grid-cols-3'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            )}
          >
            {teams.map((team) => (
              <div
                key={team.id}
                className="rounded-2xl glass-card border border-white/10 bg-surface-200/50 p-4 flex flex-col justify-between shadow-lg relative overflow-hidden"
              >
                {/* Linha de Cor do Colete no Topo */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: team.colorHex }}
                />

                {/* Cabeçalho do Time */}
                <div className="mt-1 mb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: team.colorHex }}
                      />
                      <h3
                        className="font-display font-black text-sm sm:text-base text-white truncate"
                        title={team.name}
                      >
                        {team.name}
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-surface-50 text-gray-300 border-white/10 shrink-0">
                      {team.players.length} {team.players.length === 1 ? 'atleta' : 'atletas'}
                    </span>
                  </div>
                </div>

                {/* Lista de Atletas */}
                <div className="space-y-1.5">
                  {team.players.length === 0 ? (
                    <p className="text-xs text-gray-500 italic text-center py-4">
                      Nenhum jogador escalado.
                    </p>
                  ) : (
                    team.players.map((player, idx) => {
                      const isCaptain = player.isCaptain || player.id === team.captainId;

                      return (
                        <div
                          key={player.id}
                          className={cn(
                            'flex items-center justify-between p-2 rounded-xl border text-xs transition-all',
                            isCaptain
                              ? 'bg-amber-500/10 border-amber-500/30'
                              : player.isGoalkeeper
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : player.isLoaned
                              ? 'bg-cyan-500/10 border-cyan-500/30'
                              : 'bg-surface-100/60 border-white/5'
                          )}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 pr-1">
                            <span className="w-4 h-4 rounded text-gray-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span
                              className={cn(
                                'font-semibold truncate',
                                isCaptain ? 'text-amber-200' : 'text-white'
                              )}
                            >
                              {player.nickname || player.name}
                            </span>
                          </div>

                          {/* Badges de Função */}
                          <div className="flex items-center gap-1 shrink-0">
                            {isCaptain && (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
                                <Star className="w-2.5 h-2.5 fill-current" />
                                <span>Capitão</span>
                              </span>
                            )}

                            {player.isGoalkeeper && (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                <span>🧤</span>
                                <span className="hidden sm:inline">Goleiro</span>
                                <span className="sm:hidden">GK</span>
                              </span>
                            )}

                            {player.isLoaned && (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                                <ArrowRightLeft className="w-2.5 h-2.5" />
                                <span>Emprestado</span>
                              </span>
                            )}

                            {!isCaptain && !player.isGoalkeeper && !player.isLoaned && (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-surface-50 text-gray-400 border border-white/10">
                                Linha
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer com Botão de Fechar Rápido */}
        <div className="p-4 border-t border-white/10 bg-surface-200/50 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-surface-50 hover:bg-white/10 text-white font-bold text-xs sm:text-sm border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            <span>Fechar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
