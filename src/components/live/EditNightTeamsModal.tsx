import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Star,
  Trash2,
  ArrowRightLeft,
  UserPlus,
  Search,
  Check,
  Save,
  AlertCircle,
  Loader2,
  Users,
} from 'lucide-react';
import type { LiveTeam, LivePlayer } from './types';
import { cn } from '../ui/utils';
import { hapticFeedback } from '../ui/vibration';
import { soundFx } from '../ui/audio';

interface EditNightTeamsModalProps {
  isOpen: boolean;
  sessionId: string;
  teams: LiveTeam[];
  allRegisteredPlayers?: LivePlayer[];
  onClose: () => void;
  onTeamsUpdated: (updatedTeams: LiveTeam[]) => void;
}

export const EditNightTeamsModal: React.FC<EditNightTeamsModalProps> = ({
  isOpen,
  sessionId,
  teams,
  allRegisteredPlayers = [],
  onClose,
  onTeamsUpdated,
}) => {
  const [editableTeams, setEditableTeams] = useState<LiveTeam[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Controle de adição de atleta a um time específico
  const [addingToTeamId, setAddingToTeamId] = useState<string | null>(null);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');

  // Sincroniza o estado local sempre que o modal abre ou as props mudam
  useEffect(() => {
    if (isOpen) {
      setEditableTeams(JSON.parse(JSON.stringify(teams)));
      setErrorMessage(null);
      setSuccessMessage(null);
      setAddingToTeamId(null);
      setPlayerSearchQuery('');
    }
  }, [isOpen, teams]);

  // Atletas já escalados em algum time
  const assignedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    editableTeams.forEach((t) => {
      t.players.forEach((p) => ids.add(p.id));
    });
    return ids;
  }, [editableTeams]);

  // Atletas disponíveis (cadastrados no sistema que não estão escalados em nenhum time)
  const unassignedPlayers = useMemo(() => {
    return allRegisteredPlayers.filter((p) => !assignedPlayerIds.has(p.id));
  }, [allRegisteredPlayers, assignedPlayerIds]);

  // Filtragem na busca de atletas
  const filteredUnassignedPlayers = useMemo(() => {
    if (!playerSearchQuery.trim()) return unassignedPlayers;
    const q = playerSearchQuery.toLowerCase().trim();
    return unassignedPlayers.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.nickname && p.nickname.toLowerCase().includes(q))
    );
  }, [unassignedPlayers, playerSearchQuery]);

  if (!isOpen) return null;

  // 1. Alternar Capitão
  const handleToggleCaptain = (teamId: string, playerId: string) => {
    hapticFeedback.click();
    soundFx.playClickBeep('normal');

    setEditableTeams((prev) =>
      prev.map((t) => {
        if (t.id !== teamId) return t;

        const isCurrentlyCaptain = t.captainId === playerId;
        if (isCurrentlyCaptain) {
          return {
            ...t,
            captainId: null,
            players: t.players.map((p) =>
              p.id === playerId ? { ...p, isCaptain: false } : p
            ),
          };
        }

        const captainPlayer = t.players.find((p) => p.id === playerId);
        const captainName = captainPlayer
          ? captainPlayer.nickname || captainPlayer.name
          : '';

        return {
          ...t,
          captainId: playerId,
          name: captainName ? `Time ${captainName}` : t.name,
          players: t.players.map((p) => ({
            ...p,
            isCaptain: p.id === playerId,
          })),
        };
      })
    );
  };

  // 2. Alternar Goleiro / Linha
  const handleToggleGoalkeeper = (teamId: string, playerId: string) => {
    hapticFeedback.click();
    setEditableTeams((prev) =>
      prev.map((t) => {
        if (t.id !== teamId) return t;
        return {
          ...t,
          players: t.players.map((p) =>
            p.id === playerId ? { ...p, isGoalkeeper: !p.isGoalkeeper } : p
          ),
        };
      })
    );
  };

  // 3. Mover Atleta para Outro Time
  const handleMovePlayer = (fromTeamId: string, toTeamId: string, playerId: string) => {
    hapticFeedback.click();
    soundFx.playClickBeep('normal');

    setEditableTeams((prev) => {
      const playerToMove = prev
        .find((t) => t.id === fromTeamId)
        ?.players.find((p) => p.id === playerId);

      if (!playerToMove) return prev;

      return prev.map((t) => {
        if (t.id === fromTeamId) {
          const isRemovingCaptain = t.captainId === playerId;
          return {
            ...t,
            captainId: isRemovingCaptain ? null : t.captainId,
            players: t.players.filter((p) => p.id !== playerId),
          };
        }
        if (t.id === toTeamId) {
          return {
            ...t,
            players: [
              ...t.players,
              {
                ...playerToMove,
                isCaptain: false,
              },
            ],
          };
        }
        return t;
      });
    });
  };

  // 4. Remover Atleta do Time (vai para o banco)
  const handleRemovePlayer = (teamId: string, playerId: string) => {
    hapticFeedback.click();
    setEditableTeams((prev) =>
      prev.map((t) => {
        if (t.id !== teamId) return t;
        const isRemovingCaptain = t.captainId === playerId;
        return {
          ...t,
          captainId: isRemovingCaptain ? null : t.captainId,
          players: t.players.filter((p) => p.id !== playerId),
        };
      })
    );
  };

  // 5. Adicionar Atleta do Banco a um Time
  const handleAddPlayerToTeam = (teamId: string, player: LivePlayer) => {
    hapticFeedback.click();
    soundFx.playClickBeep('high');

    setEditableTeams((prev) =>
      prev.map((t) => {
        if (t.id !== teamId) return t;
        // Evita duplicatas
        if (t.players.some((p) => p.id === player.id)) return t;

        return {
          ...t,
          players: [
            ...t.players,
            {
              ...player,
              isCaptain: false,
              isLoaned: false,
              isGoalkeeper: player.isGoalkeeper ?? false,
            },
          ],
        };
      })
    );

    setAddingToTeamId(null);
    setPlayerSearchQuery('');
  };

  // 6. Editar Nome do Time Manualmente
  const handleTeamNameChange = (teamId: string, newName: string) => {
    setEditableTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, name: newName } : t))
    );
  };

  // 7. Salvar Alterações na API
  const handleSave = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validação básica: cada time precisa de nome
    for (const team of editableTeams) {
      if (!team.name.trim()) {
        setErrorMessage('Todos os times devem ter um nome válido.');
        return;
      }
    }

    setIsSaving(true);
    hapticFeedback.victory();

    try {
      const payload = {
        teams: editableTeams.map((t) => ({
          id: t.id,
          name: t.name.trim(),
          captainId: t.captainId || null,
          colorHex: t.colorHex,
          players: t.players.map((p) => ({
            playerId: p.id,
            isGoalkeeper: !!p.isGoalkeeper,
            isLoaned: !!p.isLoaned,
            isCaptain: t.captainId === p.id || !!p.isCaptain,
          })),
        })),
      };

      const res = await fetch(`/api/sessions/${sessionId}/teams`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao salvar alterações dos times.');
      }

      const data = await res.json();
      setSuccessMessage('Times e elencos atualizados com sucesso!');
      soundFx.playWhistle();

      // Monta a nova lista de LiveTeam com base nos dados retornados
      const updatedLiveTeams: LiveTeam[] = (data.teams || []).map((t: any) => ({
        id: t.id,
        sessionId: t.sessionId,
        name: t.name,
        colorHex: t.colorHex,
        captainId: t.captainId || null,
        players: (t.players || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          nickname: p.nickname || null,
          avatarUrl: p.avatarUrl || null,
          isGoalkeeper: p.isGoalkeeper ?? false,
          isLoaned: p.isLoaned ?? false,
          isCaptain: p.isCaptain ?? (t.captainId ? t.captainId === p.id : false),
        })),
      }));

      onTeamsUpdated(updatedLiveTeams);

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (error: any) {
      setErrorMessage(error.message || 'Ocorreu um erro ao salvar os times.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl glass-card bg-surface-100/95 border border-white/10 shadow-2xl overflow-hidden animate-scale-up">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-surface-200/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-display font-black text-white flex items-center gap-2">
                <span>Editar Times da Noite</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Modo Edição
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Ajuste capitães, posições, transfira atletas ou adicione jogadores que chegaram
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
            title="Fechar sem salvar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notificações de Status */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Conteúdo com Grid dos Times */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          <div
            className={cn(
              'grid gap-4',
              editableTeams.length === 3
                ? 'grid-cols-1 md:grid-cols-3'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            )}
          >
            {editableTeams.map((team) => (
              <div
                key={team.id}
                className="rounded-2xl glass-card border border-white/10 bg-surface-200/50 p-4 flex flex-col justify-between shadow-lg relative overflow-hidden"
              >
                {/* Faixa Superior de Cor do Colete */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: team.colorHex }}
                />

                {/* Cabeçalho do Time (com campo para renomear) */}
                <div className="mt-1 mb-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: team.colorHex }}
                      />
                      <input
                        type="text"
                        value={team.name}
                        onChange={(e) => handleTeamNameChange(team.id, e.target.value)}
                        className="w-full bg-surface-100/80 border border-white/10 rounded-lg px-2 py-1 text-xs sm:text-sm font-display font-black text-white focus:outline-none focus:border-amber-400"
                        placeholder="Nome do Time"
                        title="Clique para editar o nome do time"
                      />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-surface-50 text-gray-300 border-white/10 shrink-0">
                      {team.players.length}
                    </span>
                  </div>
                </div>

                {/* Lista de Atletas */}
                <div className="space-y-1.5 min-h-[160px]">
                  {team.players.length === 0 ? (
                    <div className="h-full min-h-[140px] border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center p-3 text-center text-gray-500 text-xs">
                      <span>Sem jogadores</span>
                      <span className="text-[10px] text-gray-600 mt-1">
                        Adicione atletas abaixo
                      </span>
                    </div>
                  ) : (
                    team.players.map((player, idx) => {
                      const isCaptain = team.captainId === player.id || player.isCaptain;

                      return (
                        <div
                          key={player.id}
                          className={cn(
                            'p-2 rounded-xl border text-xs flex flex-col gap-1.5 transition-all',
                            isCaptain
                              ? 'bg-amber-500/10 border-amber-500/30'
                              : player.isGoalkeeper
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : 'bg-surface-100/60 border-white/5'
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
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

                            {/* Ações Rápidas: Remover */}
                            <button
                              type="button"
                              onClick={() => handleRemovePlayer(team.id, player.id)}
                              className="text-gray-500 hover:text-rose-400 p-1 rounded transition-colors"
                              title="Remover atleta do time"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Barra de Configurações do Atleta (Capitão, Goleiro, Mover) */}
                          <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/5 flex-wrap">
                            <div className="flex items-center gap-1">
                              {/* Botão de Capitão */}
                              <button
                                type="button"
                                onClick={() => handleToggleCaptain(team.id, player.id)}
                                className={cn(
                                  'px-1.5 py-0.5 rounded-md text-[10px] font-bold border transition-all flex items-center gap-1 active:scale-95',
                                  isCaptain
                                    ? 'bg-amber-500/25 text-amber-300 border-amber-500/40 shadow-sm'
                                    : 'bg-surface-50 text-gray-400 border-white/10 hover:text-amber-300'
                                )}
                                title={
                                  isCaptain
                                    ? 'Capitão da equipe (clique para desmarcar)'
                                    : 'Definir como Capitão e renomear equipe'
                                }
                              >
                                <Star
                                  className={cn(
                                    'w-2.5 h-2.5',
                                    isCaptain ? 'fill-current text-amber-300' : 'text-gray-400'
                                  )}
                                />
                                <span>Capitão</span>
                              </button>

                              {/* Toggle Goleiro / Linha */}
                              <button
                                type="button"
                                onClick={() => handleToggleGoalkeeper(team.id, player.id)}
                                className={cn(
                                  'px-1.5 py-0.5 rounded-md text-[10px] font-bold border transition-all flex items-center gap-1 active:scale-95',
                                  player.isGoalkeeper
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                                    : 'bg-surface-50 text-gray-400 border-white/10 hover:text-white'
                                )}
                                title={
                                  player.isGoalkeeper
                                    ? 'Goleiro (imune ao Bola Murcha)'
                                    : 'Jogador de Linha'
                                }
                              >
                                <span>{player.isGoalkeeper ? '🧤 GK' : '⚽ Linha'}</span>
                              </button>
                            </div>

                            {/* Seletor Rápido: Mover para outro time */}
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-500">Mover:</span>
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleMovePlayer(team.id, e.target.value, player.id);
                                  }
                                }}
                                className="bg-surface-50 text-[10px] text-gray-300 border border-white/10 rounded px-1 py-0.5 focus:outline-none focus:border-amber-400"
                              >
                                <option value="" disabled>
                                  Time...
                                </option>
                                {editableTeams
                                  .filter((other) => other.id !== team.id)
                                  .map((other) => (
                                    <option key={other.id} value={other.id}>
                                      {other.name}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Botão de Adicionar Jogador a este Time */}
                <div className="mt-3 pt-2 border-t border-white/10">
                  {addingToTeamId === team.id ? (
                    <div className="space-y-2 p-2 rounded-xl bg-surface-100/90 border border-amber-500/30">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-bold text-amber-300">
                          Adicionar Jogador
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setAddingToTeamId(null);
                            setPlayerSearchQuery('');
                          }}
                          className="text-gray-400 hover:text-white p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Buscar no banco..."
                          value={playerSearchQuery}
                          onChange={(e) => setPlayerSearchQuery(e.target.value)}
                          className="w-full pl-7 pr-2 py-1 text-xs rounded-lg bg-surface-200 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                          autoFocus
                        />
                      </div>

                      <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                        {filteredUnassignedPlayers.length === 0 ? (
                          <p className="text-[10px] text-gray-500 italic py-2 text-center">
                            Nenhum atleta disponível encontrado.
                          </p>
                        ) : (
                          filteredUnassignedPlayers.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleAddPlayerToTeam(team.id, p)}
                              className="w-full p-1.5 rounded-lg border border-white/5 bg-surface-200/70 hover:bg-emerald-500/20 hover:border-emerald-500/30 text-left text-xs text-white flex items-center justify-between transition-colors"
                            >
                              <span className="truncate">{p.nickname || p.name}</span>
                              <UserPlus className="w-3 h-3 text-emerald-400 shrink-0" />
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAddingToTeamId(team.id);
                        setPlayerSearchQuery('');
                      }}
                      className="w-full py-2 px-3 rounded-xl border border-dashed border-white/15 hover:border-amber-400/50 hover:bg-amber-500/10 text-gray-300 hover:text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Adicionar Atleta</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer com Ações */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-surface-200/70 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {unassignedPlayers.length} atletas disponíveis no banco para escalação
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl bg-surface-50 hover:bg-white/10 text-gray-300 font-bold text-xs border border-white/10 active:scale-95 transition-all"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 sm:flex-initial px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
