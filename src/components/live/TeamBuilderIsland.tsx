import React, { useState } from 'react';
import {
  Users,
  Dices,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Search,
  UserPlus,
  X,
  Pencil,
} from 'lucide-react';
import { cn } from '../ui/utils';
import { EditPlayerModal, type EditablePlayerData } from '../ui/EditPlayerModal';

export interface PlayerItem {
  id: string;
  name: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  isGoalkeeper?: boolean;
}

export interface TeamDraft {
  id: string;
  name: string;
  colorHex: string;
  players: PlayerItem[];
}

interface TeamBuilderIslandProps {
  initialPlayers: PlayerItem[];
}

const DEFAULT_TEAMS_CONFIG = [
  { id: 'team-1', name: 'Time Preto', colorHex: '#1f2937' },
  { id: 'team-2', name: 'Time Branco', colorHex: '#e5e7eb' },
  { id: 'team-3', name: 'Time Azul', colorHex: '#3b82f6' },
  { id: 'team-4', name: 'Time Vermelho', colorHex: '#ef4444' },
];

export const TeamBuilderIsland: React.FC<TeamBuilderIslandProps> = ({ initialPlayers }) => {
  const [allPlayers, setAllPlayers] = useState<PlayerItem[]>(initialPlayers);
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionDate, setSessionDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal para adicionar jogador avulso
  const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNickname, setNewPlayerNickname] = useState('');
  const [newPlayerIsGoalkeeper, setNewPlayerIsGoalkeeper] = useState(false);
  const [isCreatingPlayer, setIsCreatingPlayer] = useState(false);

  // Modal para editar atleta cadastrado
  const [editingPlayer, setEditingPlayer] = useState<EditablePlayerData | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // 4 Times com suas listas de jogadores
  const [teams, setTeams] = useState<TeamDraft[]>(() =>
    DEFAULT_TEAMS_CONFIG.map((t) => ({ ...t, players: [] }))
  );

  // Jogadores já escalados em algum time
  const assignedPlayerIds = new Set(
    teams.flatMap((t) => t.players.map((p) => p.id))
  );

  // Jogadores disponíveis (não escalados)
  const availablePlayers = allPlayers.filter((p) => !assignedPlayerIds.has(p.id));

  const filteredAvailable = availablePlayers.filter((p) => {
    const term = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.nickname && p.nickname.toLowerCase().includes(term))
    );
  });

  const totalAssigned = assignedPlayerIds.size;

  // Adicionar jogador ao time com vaga
  const handleAssignToTeam = (player: PlayerItem, teamId: string) => {
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === teamId) {
          if (t.players.length >= 6) {
            alert(`O ${t.name} já atingiu o limite de 6 jogadores.`);
            return t;
          }
          return {
            ...t,
            players: [
              ...t.players,
              { ...player, isGoalkeeper: player.isGoalkeeper ?? false },
            ],
          };
        }
        return t;
      })
    );
  };

  // Alternar posição entre Goleiro e Linha
  const handleToggleGoalkeeper = (teamId: string, playerId: string) => {
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === teamId) {
          return {
            ...t,
            players: t.players.map((p) =>
              p.id === playerId ? { ...p, isGoalkeeper: !p.isGoalkeeper } : p
            ),
          };
        }
        return t;
      })
    );
  };

  // Remover jogador do time
  const handleRemoveFromTeam = (teamId: string, playerId: string) => {
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === teamId) {
          return { ...t, players: t.players.filter((p) => p.id !== playerId) };
        }
        return t;
      })
    );
  };

  // Sorteio automático equilibrado entre os 4 times
  const handleAutoDraw = () => {
    // Pega todos os jogadores escalados + disponíveis até completar 24 (ou quantos tiver)
    const pool = [...allPlayers];
    // Embaralha aleatoriamente (Fisher-Yates)
    const shuffled = [...pool].sort(() => Math.random() - 0.5);

    const maxPlayersPerTeam = 6;
    const newTeams: TeamDraft[] = DEFAULT_TEAMS_CONFIG.map((t) => ({ ...t, players: [] }));

    let playerIndex = 0;
    for (let round = 0; round < maxPlayersPerTeam; round++) {
      for (let t = 0; t < newTeams.length; t++) {
        if (playerIndex < shuffled.length) {
          newTeams[t].players.push({
            ...shuffled[playerIndex],
            isGoalkeeper: shuffled[playerIndex].isGoalkeeper ?? false,
          });
          playerIndex++;
        }
      }
    }

    setTeams(newTeams);
  };

  // Limpar todos os times
  const handleClearTeams = () => {
    setTeams(DEFAULT_TEAMS_CONFIG.map((t) => ({ ...t, players: [] })));
  };

  // Abrir modal de edição de atleta
  const handleOpenEdit = (player: PlayerItem) => {
    setEditingPlayer(player);
    setIsEditModalOpen(true);
  };

  // Atualizar estado após edição com sucesso
  const handlePlayerUpdated = (updatedPlayer: EditablePlayerData) => {
    // 1. Atualiza na lista geral de jogadores disponíveis / cadastrados
    setAllPlayers((prev) =>
      prev.map((p) =>
        p.id === updatedPlayer.id
          ? {
              ...p,
              name: updatedPlayer.name,
              nickname: updatedPlayer.nickname || null,
              isGoalkeeper: updatedPlayer.isGoalkeeper ?? p.isGoalkeeper,
            }
          : p
      )
    );

    // 2. Atualiza nos times já escalados
    setTeams((prev) =>
      prev.map((t) => ({
        ...t,
        players: t.players.map((p) =>
          p.id === updatedPlayer.id
            ? {
                ...p,
                name: updatedPlayer.name,
                nickname: updatedPlayer.nickname || null,
                isGoalkeeper: updatedPlayer.isGoalkeeper ?? p.isGoalkeeper,
              }
            : p
        ),
      }))
    );
  };

  // Cadastrar jogador avulso na hora
  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    setIsCreatingPlayer(true);
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPlayerName.trim(),
          nickname: newPlayerNickname.trim() || null,
          isGoalkeeper: newPlayerIsGoalkeeper,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao cadastrar jogador.');
      }

      const created: PlayerItem = await res.json();
      setAllPlayers((prev) => [created, ...prev]);
      setNewPlayerName('');
      setNewPlayerNickname('');
      setNewPlayerIsGoalkeeper(false);
      setIsAddPlayerModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao cadastrar jogador.');
    } finally {
      setIsCreatingPlayer(false);
    }
  };

  // Salvar a Sessão e ir para o Mesário
  const handleSaveSession = async () => {
    if (totalAssigned < 4) {
      setErrorMessage('Distribua pelo menos alguns jogadores nos times antes de iniciar.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const payload = {
        sessionDate,
        notes: notes.trim() || null,
        teams: teams.map((t) => ({
          name: t.name,
          colorHex: t.colorHex,
          playerIds: t.players.map((p) => p.id),
          players: t.players.map((p) => ({
            playerId: p.id,
            isGoalkeeper: !!p.isGoalkeeper,
          })),
        })),
      };

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao salvar rodada.');
      }

      const created = await res.json();
      // Redireciona para o Mesário
      window.location.href = `/rodada/mesario?sessionId=${created.id}`;
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao conectar ao servidor.');
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com Ações Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl glass-card bg-surface-100/90 border border-white/10">
        <div>
          <h2 className="font-display font-black text-xl sm:text-2xl text-white flex items-center gap-2">
            <span>👥</span>
            <span>Montagem dos 4 Times</span>
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
            Distribua até 24 jogadores entre Preto, Branco, Azul e Vermelho (6 por time).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAutoDraw}
            className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95"
          >
            <Dices className="w-4 h-4 text-amber-400" />
            <span>Sortear Equilibrado</span>
          </button>

          <button
            type="button"
            onClick={handleClearTeams}
            className="px-3 py-2 rounded-xl bg-surface-50 hover:bg-surface-200 border border-white/5 text-gray-400 hover:text-white font-semibold text-xs transition-all"
          >
            Limpar
          </button>

          <button
            type="button"
            onClick={() => setIsAddPlayerModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all active:scale-95"
          >
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>Novo Avulso</span>
          </button>
        </div>
      </div>

      {/* Alerta de Erro */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-fade-in">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Grid Principal: 4 Times da Noite */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {teams.map((team) => (
          <div
            key={team.id}
            className="rounded-3xl glass-card border border-white/10 bg-surface-100/90 p-4 flex flex-col justify-between shadow-lg relative overflow-hidden"
          >
            {/* Faixa Superior de Cor do Time */}
            <div
              className="absolute top-0 left-0 right-0 h-2"
              style={{ backgroundColor: team.colorHex }}
            />

            <div>
              <div className="flex items-center justify-between gap-2 mt-1 mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white/20"
                    style={{ backgroundColor: team.colorHex }}
                  />
                  <h3 className="font-display font-black text-base text-white">
                    {team.name}
                  </h3>
                </div>
                <span
                  className={cn(
                    'text-xs font-black px-2 py-0.5 rounded-full border',
                    team.players.length === 6
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-surface-50 text-gray-400 border-white/5'
                  )}
                >
                  {team.players.length}/6
                </span>
              </div>

              {/* Lista de Jogadores no Time */}
              <div className="space-y-1.5 min-h-[180px]">
                {team.players.length === 0 ? (
                  <div className="h-full min-h-[160px] border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-center p-3 text-gray-500 text-xs">
                    <span>Nenhum jogador escalado</span>
                    <span className="text-[10px] text-gray-600 mt-1">
                      Clique em um jogador abaixo para escalar
                    </span>
                  </div>
                ) : (
                  team.players.map((p, idx) => (
                    <div
                      key={p.id}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-xl border text-xs group transition-all',
                        p.isGoalkeeper
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : 'bg-surface-200/60 border-white/5 hover:border-white/20'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-1">
                        <span className="w-5 h-5 rounded-lg bg-surface-50 text-gray-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-white truncate">
                          {p.nickname || p.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Toggle Rápido: Linha / Goleiro */}
                        <button
                          type="button"
                          onClick={() => handleToggleGoalkeeper(team.id, p.id)}
                          className={cn(
                            'px-2 py-0.5 rounded-lg text-[10px] font-black border transition-all flex items-center gap-1 cursor-pointer select-none active:scale-95',
                            p.isGoalkeeper
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 shadow-sm'
                              : 'bg-surface-50 text-gray-400 border-white/10 hover:text-white hover:border-white/20'
                          )}
                          title={
                            p.isGoalkeeper
                              ? 'Goleiro da equipe (Imune ao Bola Murcha)'
                              : 'Jogador de Linha'
                          }
                        >
                          <span>{p.isGoalkeeper ? '🧤 Goleiro' : '⚽ Linha'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEdit(p)}
                          className="text-gray-500 hover:text-emerald-400 p-1 transition-colors"
                          title="Editar atleta"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveFromTeam(team.id, p.id)}
                          className="text-gray-500 hover:text-rose-400 p-1 transition-colors"
                          title="Remover do time"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Banco de Jogadores Disponíveis */}
      <div className="p-5 rounded-3xl glass-card bg-surface-100/90 border border-white/10 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-black text-base sm:text-lg text-white">
              Jogadores Disponíveis ({availablePlayers.length})
            </h3>
            <span className="text-xs text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              {totalAssigned} escalados
            </span>
          </div>

          {/* Barra de Busca de Jogador */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar atleta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-surface-50 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Chips de Jogadores Disponíveis com Seletor Rápido de Time */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-72 overflow-y-auto pr-1">
          {filteredAvailable.length === 0 ? (
            <div className="col-span-full py-8 text-center text-gray-500 text-xs">
              {searchQuery ? 'Nenhum jogador encontrado com esse nome.' : 'Todos os jogadores já foram escalados nos times!'}
            </div>
          ) : (
            filteredAvailable.map((player) => (
              <div
                key={player.id}
                className="p-2.5 rounded-2xl bg-surface-200/80 border border-white/5 hover:border-emerald-500/40 transition-all flex flex-col justify-between gap-2 shadow-sm group"
              >
                <div className="flex items-start justify-between gap-1 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-white truncate flex items-center gap-1">
                      <span className="truncate">{player.nickname || player.name}</span>
                      {player.isGoalkeeper && (
                        <span className="text-[10px] shrink-0" title="Goleiro Padrão">🧤</span>
                      )}
                    </div>
                    {player.nickname && player.nickname !== player.name && (
                      <div className="text-[10px] text-gray-400 truncate">
                        {player.name}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(player)}
                    className="p-1 rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-white/5 transition-colors shrink-0"
                    title="Editar dados do atleta"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Botões Rápidos para Escalar nos 4 Times */}
                <div className="grid grid-cols-4 gap-1 pt-1 border-t border-white/5">
                  {teams.map((team) => (
                    <button
                      key={team.id}
                      type="button"
                      disabled={team.players.length >= 6}
                      onClick={() => handleAssignToTeam(player, team.id)}
                      className="h-6 rounded-lg text-[10px] font-black flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
                      style={{
                        backgroundColor: team.colorHex,
                        color: team.id === 'team-2' ? '#111827' : '#ffffff',
                      }}
                      title={`Escalar no ${team.name}`}
                    >
                      +
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Configurações Finais da Sessão & Ação Salvar */}
      <div className="p-5 rounded-3xl glass-card bg-surface-100/90 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
          <div>
            <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">
              Data da Pelada
            </label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="px-3 py-2 rounded-xl bg-surface-50 border border-white/10 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="w-full sm:w-64">
            <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">
              Observações (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Rodada especial de fim de mês"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface-50 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={isSaving}
          onClick={handleSaveSession}
          className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-50 text-gray-950 font-black text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 shrink-0 touch-press-scale"
        >
          {isSaving ? (
            <span>Salvando Sessão...</span>
          ) : (
            <>
              <span>Salvar e Iniciar Rodada</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Modal Rápido: Cadastrar Jogador Avulso */}
      {isAddPlayerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl glass-card-glow bg-surface-100 border border-emerald-500/30 p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setIsAddPlayerModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-xl text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-black text-lg text-white">
                  Novo Jogador
                </h3>
                <p className="text-xs text-gray-400">Cadastre um atleta avulso na hora</p>
              </div>
            </div>

            <form onSubmit={handleCreatePlayer} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Matheus Silva"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-50 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Apelido (Como é chamado)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Theus"
                  value={newPlayerNickname}
                  onChange={(e) => setNewPlayerNickname(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-50 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Posição Inicial
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewPlayerIsGoalkeeper(false)}
                    className={cn(
                      'py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5',
                      !newPlayerIsGoalkeeper
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-surface-50 text-gray-400 border-white/5 hover:text-white'
                    )}
                  >
                    <span>⚽</span>
                    <span>Linha</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPlayerIsGoalkeeper(true)}
                    className={cn(
                      'py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5',
                      newPlayerIsGoalkeeper
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-surface-50 text-gray-400 border-white/5 hover:text-white'
                    )}
                  >
                    <span>🧤</span>
                    <span>Goleiro</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddPlayerModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-surface-50 hover:bg-surface-200 text-xs font-bold text-gray-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingPlayer}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-black text-gray-950 disabled:opacity-50"
                >
                  {isCreatingPlayer ? 'Salvando...' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição de Atleta */}
      <EditPlayerModal
        isOpen={isEditModalOpen}
        player={editingPlayer}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingPlayer(null);
        }}
        onSaved={handlePlayerUpdated}
      />
    </div>
  );
};
