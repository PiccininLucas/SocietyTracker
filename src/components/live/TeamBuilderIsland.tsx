import React, { useState, useMemo } from 'react';
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
  Clock,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
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

const ALL_AVAILABLE_TEAMS: { id: string; name: string; colorHex: string }[] = [
  { id: 'team-1', name: 'Time Preto', colorHex: '#1f2937' },
  { id: 'team-2', name: 'Time Branco', colorHex: '#e5e7eb' },
  { id: 'team-3', name: 'Time Azul', colorHex: '#3b82f6' },
  { id: 'team-4', name: 'Time Vermelho', colorHex: '#ef4444' },
];

export const TeamBuilderIsland: React.FC<TeamBuilderIslandProps> = ({ initialPlayers }) => {
  const [allPlayers, setAllPlayers] = useState<PlayerItem[]>(initialPlayers);
  const [sessionDate, setSessionDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Controle de Presença dos Atletas Cadastrados
  // Inicialmente todos os cadastrados iniciam marcados como presentes
  const [presentPlayerIds, setPresentPlayerIds] = useState<Set<string>>(
    () => new Set(initialPlayers.map((p) => p.id))
  );
  const [presenceSearch, setPresenceSearch] = useState('');
  const [isPresenceExpanded, setIsPresenceExpanded] = useState(true);

  // 2. Formato da Rodada: 3 ou 4 Times
  const [teamCount, setTeamCount] = useState<3 | 4>(() =>
    initialPlayers.length <= 19 ? 3 : 4
  );

  // 3. Duração da Partida em minutos (Sugerido: 8 min para 3 times, 7 min para 4 times)
  const [matchDurationMinutes, setMatchDurationMinutes] = useState<number>(() =>
    initialPlayers.length <= 19 ? 8 : 7
  );

  // Times da Noite (3 ou 4 times conforme seleção)
  const [teams, setTeams] = useState<TeamDraft[]>(() => {
    const initialCount = initialPlayers.length <= 19 ? 3 : 4;
    return ALL_AVAILABLE_TEAMS.slice(0, initialCount).map((t) => ({ ...t, players: [] }));
  });

  // Busca no banco de disponíveis
  const [poolSearchQuery, setPoolSearchQuery] = useState('');

  // Modais
  const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNickname, setNewPlayerNickname] = useState('');
  const [newPlayerIsGoalkeeper, setNewPlayerIsGoalkeeper] = useState(false);
  const [isCreatingPlayer, setIsCreatingPlayer] = useState(false);

  const [editingPlayer, setEditingPlayer] = useState<EditablePlayerData | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Jogadores presentes
  const presentPlayers = useMemo(
    () => allPlayers.filter((p) => presentPlayerIds.has(p.id)),
    [allPlayers, presentPlayerIds]
  );

  // Jogadores já escalados em algum time
  const assignedPlayerIds = useMemo(
    () => new Set(teams.flatMap((t) => t.players.map((p) => p.id))),
    [teams]
  );

  // Jogadores presentes que ainda estão livres (não escalados)
  const availablePresentPlayers = useMemo(
    () => presentPlayers.filter((p) => !assignedPlayerIds.has(p.id)),
    [presentPlayers, assignedPlayerIds]
  );

  // Filtro de busca para a lista de presença
  const filteredPresenceList = useMemo(() => {
    if (!presenceSearch.trim()) return allPlayers;
    const term = presenceSearch.toLowerCase();
    return allPlayers.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.nickname && p.nickname.toLowerCase().includes(term))
    );
  }, [allPlayers, presenceSearch]);

  // Filtro de busca para o banco de disponíveis
  const filteredAvailablePool = useMemo(() => {
    if (!poolSearchQuery.trim()) return availablePresentPlayers;
    const term = poolSearchQuery.toLowerCase();
    return availablePresentPlayers.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.nickname && p.nickname.toLowerCase().includes(term))
    );
  }, [availablePresentPlayers, poolSearchQuery]);

  const totalAssigned = assignedPlayerIds.size;
  const totalPresent = presentPlayerIds.size;

  // Alternar presença individual de um atleta
  const handleTogglePresence = (playerId: string) => {
    setPresentPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
        // Se foi desmarcado da presença, remove de qualquer time que estivesse escalado
        setTeams((currentTeams) =>
          currentTeams.map((t) => ({
            ...t,
            players: t.players.filter((p) => p.id !== playerId),
          }))
        );
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  // Marcar todos como presentes
  const handleSelectAllPresence = () => {
    setPresentPlayerIds(new Set(allPlayers.map((p) => p.id)));
  };

  // Desmarcar todos da presença
  const handleClearAllPresence = () => {
    setPresentPlayerIds(new Set());
    setTeams((prev) => prev.map((t) => ({ ...t, players: [] })));
  };

  // Alternar estrutura entre 3 ou 4 times
  const handleChangeTeamCount = (count: 3 | 4) => {
    if (count === teamCount) return;

    setTeamCount(count);

    // Ajusta o tempo sugerido
    if (count === 3 && matchDurationMinutes === 7) {
      setMatchDurationMinutes(8);
    } else if (count === 4 && matchDurationMinutes === 8) {
      setMatchDurationMinutes(7);
    }

    setTeams((prev) => {
      if (count === 3) {
        // Reduz para 3 times (Time 4 tem jogadores devolvidos ao pool disponível)
        return ALL_AVAILABLE_TEAMS.slice(0, 3).map((template, idx) => {
          const existing = prev[idx];
          return existing ? { ...template, players: existing.players } : { ...template, players: [] };
        });
      } else {
        // Expande para 4 times
        return ALL_AVAILABLE_TEAMS.map((template, idx) => {
          const existing = prev[idx];
          return existing ? { ...template, players: existing.players } : { ...template, players: [] };
        });
      }
    });
  };

  // Adicionar jogador ao time (SEM LIMITE RÍGIDO DE 6 JOGADORES)
  const handleAssignToTeam = (player: PlayerItem, teamId: string) => {
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === teamId) {
          if (t.players.some((p) => p.id === player.id)) return t;
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

  // Sorteio automático equilibrado entre os times escolhidos (3 ou 4) com os presentes
  const handleAutoDraw = () => {
    if (presentPlayers.length === 0) {
      alert('Selecione os atletas presentes antes de realizar o sorteio.');
      return;
    }

    // 1. Separa goleiros e atletas de linha presentes
    const goalkeepers = presentPlayers.filter((p) => p.isGoalkeeper);
    const outfielders = presentPlayers.filter((p) => !p.isGoalkeeper);

    // 2. Embaralha ambos os grupos (Fisher-Yates)
    const shuffledGKs = [...goalkeepers].sort(() => Math.random() - 0.5);
    const shuffledOutfielders = [...outfielders].sort(() => Math.random() - 0.5);

    // 3. Inicializa os 3 ou 4 times vazios
    const newTeams: TeamDraft[] = ALL_AVAILABLE_TEAMS.slice(0, teamCount).map((t) => ({
      ...t,
      players: [],
    }));

    // 4. Distribui os goleiros primeiro (1 por time, se possível)
    shuffledGKs.forEach((gk, index) => {
      const targetTeamIndex = index % newTeams.length;
      newTeams[targetTeamIndex].players.push({
        ...gk,
        isGoalkeeper: true,
      });
    });

    // 5. Distribui os jogadores de linha equitativamente
    shuffledOutfielders.forEach((player, index) => {
      // Prioriza times com menos jogadores para balancear
      const sortedTeamsByCount = [...newTeams].sort(
        (a, b) => a.players.length - b.players.length
      );
      const targetTeam = sortedTeamsByCount[0];
      targetTeam.players.push({
        ...player,
        isGoalkeeper: false,
      });
    });

    setTeams(newTeams);
  };

  // Limpar todos os times
  const handleClearTeams = () => {
    setTeams(
      ALL_AVAILABLE_TEAMS.slice(0, teamCount).map((t) => ({ ...t, players: [] }))
    );
  };

  // Abrir modal de edição de atleta
  const handleOpenEdit = (player: PlayerItem) => {
    setEditingPlayer(player);
    setIsEditModalOpen(true);
  };

  // Atualizar estado após edição com sucesso
  const handlePlayerUpdated = (updatedPlayer: EditablePlayerData) => {
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
      // Já inclui automaticamente na lista de presença
      setPresentPlayerIds((prev) => new Set([...prev, created.id]));
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
    if (totalAssigned < teamCount * 2) {
      setErrorMessage(
        `Distribua pelo menos ${teamCount * 2} jogadores nos times antes de iniciar.`
      );
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const matchDurationSeconds = Math.max(60, (matchDurationMinutes || 7) * 60);

      const payload = {
        sessionDate,
        notes: notes.trim() || null,
        matchDurationSeconds,
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
      {/* 1. Header com Formato, Presença e Ações Rápidas */}
      <div className="p-5 sm:p-6 rounded-3xl glass-card bg-surface-100/90 border border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-display font-black text-xl sm:text-2xl text-white flex items-center gap-2">
                <span>👥</span>
                <span>Montagem da Rodada</span>
              </h2>
              {/* Badge de Presença em Tempo Real */}
              <div className="px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-extrabold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{totalPresent} presentes</span>
              </div>
              <div className="px-2.5 py-1 rounded-xl bg-surface-50 border border-white/10 text-gray-400 font-bold text-xs">
                {totalAssigned} escalados ({availablePresentPlayers.length} livres)
              </div>
            </div>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Selecione os atletas presentes, escolha entre 3 ou 4 times e ajuste o tempo de partida.
            </p>
          </div>

          {/* Ações Rápidas */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAutoDraw}
              className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-black text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-amber-500/10 touch-press-scale"
            >
              <Dices className="w-4 h-4 text-amber-400" />
              <span>Sortear Equilibrado</span>
            </button>

            <button
              type="button"
              onClick={handleClearTeams}
              className="px-3 py-2.5 rounded-xl bg-surface-50 hover:bg-surface-200 border border-white/5 text-gray-400 hover:text-white font-bold text-xs transition-all touch-press-scale"
            >
              Limpar Times
            </button>

            <button
              type="button"
              onClick={() => setIsAddPlayerModalOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all active:scale-95 touch-press-scale"
            >
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <span>Novo Avulso</span>
            </button>
          </div>
        </div>

        {/* 2. Seletor de Estrutura e Duração da Partida */}
        <div className="pt-3 border-t border-white/5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Alternador Visual: 3 Times vs 4 Times */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Estrutura:
            </span>
            <div className="grid grid-cols-2 gap-1.5 bg-surface-50 p-1 rounded-2xl border border-white/10">
              <button
                type="button"
                onClick={() => handleChangeTeamCount(3)}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 justify-center touch-press-scale',
                  teamCount === 3
                    ? 'bg-emerald-500 text-gray-950 shadow-md font-extrabold'
                    : 'text-gray-400 hover:text-white hover:bg-surface-200/50'
                )}
              >
                <span>3 Times</span>
                <span className="text-[10px] opacity-80">(Sugestão: 8 min)</span>
              </button>

              <button
                type="button"
                onClick={() => handleChangeTeamCount(4)}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 justify-center touch-press-scale',
                  teamCount === 4
                    ? 'bg-emerald-500 text-gray-950 shadow-md font-extrabold'
                    : 'text-gray-400 hover:text-white hover:bg-surface-200/50'
                )}
              >
                <span>4 Times</span>
                <span className="text-[10px] opacity-80">(Sugestão: 7 min)</span>
              </button>
            </div>
          </div>

          {/* Seletor de Tempo de Partida */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tempo:</span>
            </span>

            {/* Chips rápidos de minutos */}
            <div className="flex items-center gap-1">
              {[6, 7, 8, 10].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setMatchDurationMinutes(mins)}
                  className={cn(
                    'px-2.5 py-1 rounded-xl text-xs font-bold border transition-all touch-press-scale',
                    matchDurationMinutes === mins
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-extrabold'
                      : 'bg-surface-50 text-gray-400 border-white/5 hover:text-white'
                  )}
                >
                  {mins} min
                </button>
              ))}
            </div>

            {/* Input manual de minutos */}
            <div className="flex items-center gap-1 bg-surface-50 px-2 py-1 rounded-xl border border-white/10">
              <input
                type="number"
                min={1}
                max={30}
                value={matchDurationMinutes}
                onChange={(e) => setMatchDurationMinutes(Number(e.target.value) || 7)}
                className="w-10 bg-transparent text-center font-bold text-xs text-white focus:outline-none"
              />
              <span className="text-[11px] text-gray-400 font-semibold">minutos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de Erro */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-fade-in">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 3. Seção do Contador de Presença (Checklist de Cadastrados) */}
      <div className="rounded-3xl glass-card bg-surface-100/90 border border-white/10 shadow-xl overflow-hidden">
        <div className="p-4 sm:p-5 flex items-center justify-between gap-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPresenceExpanded(!isPresenceExpanded)}
              className="flex items-center gap-2 text-left group"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display font-black text-sm sm:text-base text-white group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                  <span>Lista de Presença</span>
                  <span className="text-xs text-emerald-400 font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    {totalPresent}/{allPlayers.length}
                  </span>
                </h3>
                <p className="text-[11px] text-gray-400">
                  Marque quem veio para a pelada hoje
                </p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllPresence}
              className="px-2.5 py-1.5 rounded-xl bg-surface-50 hover:bg-surface-200 text-gray-300 hover:text-white font-bold text-[11px] border border-white/5 transition-all"
            >
              Todos
            </button>
            <button
              type="button"
              onClick={handleClearAllPresence}
              className="px-2.5 py-1.5 rounded-xl bg-surface-50 hover:bg-surface-200 text-gray-400 hover:text-white font-bold text-[11px] border border-white/5 transition-all"
            >
              Nenhum
            </button>
            <button
              type="button"
              onClick={() => setIsPresenceExpanded(!isPresenceExpanded)}
              className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-surface-50 transition-colors"
            >
              {isPresenceExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {isPresenceExpanded && (
          <div className="p-4 sm:p-5 space-y-3 bg-surface-50/40 animate-fade-in">
            {/* Campo de busca de presença */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar por nome/apelido..."
                value={presenceSearch}
                onChange={(e) => setPresenceSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-surface-100 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Grade de Checkbox de Presença */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-56 overflow-y-auto pr-1">
              {filteredPresenceList.map((player) => {
                const isPresent = presentPlayerIds.has(player.id);
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => handleTogglePresence(player.id)}
                    className={cn(
                      'p-2.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-1.5 touch-press-scale',
                      isPresent
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-sm'
                        : 'bg-surface-100/60 border-white/5 text-gray-400 hover:border-white/20'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs truncate flex items-center gap-1">
                        <span className="truncate">{player.nickname || player.name}</span>
                        {player.isGoalkeeper && (
                          <span className="text-[10px] shrink-0" title="Goleiro Padrão">
                            🧤
                          </span>
                        )}
                      </div>
                      {player.nickname && player.nickname !== player.name && (
                        <div className="text-[10px] opacity-70 truncate">{player.name}</div>
                      )}
                    </div>

                    <div className="shrink-0">
                      {isPresent ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-600" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. Grid Principal: Times Selecionados (3 ou 4) */}
      <div
        className={cn(
          'grid gap-4',
          teamCount === 3
            ? 'grid-cols-1 md:grid-cols-3'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
        )}
      >
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
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full border bg-surface-50 text-gray-300 border-white/10">
                  {team.players.length} {team.players.length === 1 ? 'jogador' : 'jogadores'}
                </span>
              </div>

              {/* Lista de Jogadores no Time */}
              <div className="space-y-1.5 min-h-[190px]">
                {team.players.length === 0 ? (
                  <div className="h-full min-h-[170px] border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-center p-3 text-gray-500 text-xs">
                    <span>Nenhum jogador escalado</span>
                    <span className="text-[10px] text-gray-600 mt-1">
                      Clique no botão <strong>+</strong> nos presentes abaixo
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

      {/* 5. Banco de Atletas Presentes Disponíveis (Livres para Escalar) */}
      <div className="p-5 rounded-3xl glass-card bg-surface-100/90 border border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-black text-base sm:text-lg text-white">
              Presentes Disponíveis ({availablePresentPlayers.length})
            </h3>
            <span className="text-xs text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              {totalAssigned} já escalados
            </span>
          </div>

          {/* Barra de Busca de Jogador Livre */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar atleta livre..."
              value={poolSearchQuery}
              onChange={(e) => setPoolSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-surface-50 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Chips de Jogadores Disponíveis com Seletor Rápido de Time */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-72 overflow-y-auto pr-1">
          {filteredAvailablePool.length === 0 ? (
            <div className="col-span-full py-8 text-center text-gray-500 text-xs">
              {totalPresent === 0
                ? 'Nenhum atleta marcado na lista de presença acima.'
                : poolSearchQuery
                ? 'Nenhum atleta livre encontrado com esse termo.'
                : 'Todos os atletas presentes já foram escalados nos times!'}
            </div>
          ) : (
            filteredAvailablePool.map((player) => (
              <div
                key={player.id}
                className="p-2.5 rounded-2xl bg-surface-200/80 border border-white/5 hover:border-emerald-500/40 transition-all flex flex-col justify-between gap-2 shadow-sm group"
              >
                <div className="flex items-start justify-between gap-1 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-white truncate flex items-center gap-1">
                      <span className="truncate">{player.nickname || player.name}</span>
                      {player.isGoalkeeper && (
                        <span className="text-[10px] shrink-0" title="Goleiro Padrão">
                          🧤
                        </span>
                      )}
                    </div>
                    {player.nickname && player.nickname !== player.name && (
                      <div className="text-[10px] text-gray-400 truncate">{player.name}</div>
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

                {/* Botões Rápidos para Escalar nos 3 ou 4 Times */}
                <div
                  className={cn(
                    'grid gap-1 pt-1 border-t border-white/5',
                    teamCount === 3 ? 'grid-cols-3' : 'grid-cols-4'
                  )}
                >
                  {teams.map((team) => (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => handleAssignToTeam(player, team.id)}
                      className="h-6 rounded-lg text-[10px] font-black flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm touch-press-scale"
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

      {/* 6. Configurações Finais da Sessão & Ação Salvar */}
      <div className="p-5 rounded-3xl glass-card bg-surface-100/90 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl">
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
              <span>Salvar e Iniciar Rodada ({matchDurationMinutes} min)</span>
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
