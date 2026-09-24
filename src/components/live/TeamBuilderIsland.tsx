import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Dices,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Search,
  UserPlus,
  X,
  Pencil,
  Clock,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Star,
} from 'lucide-react';
import { cn } from '../ui/utils';
import { localDateISO } from '../../core/domain/services/CompetitionService';
import { ROUND_RULES } from '../../core/domain/entities/Session';
import { EditPlayerModal, type EditablePlayerData } from '../ui/EditPlayerModal';
import { loadDraft, saveDraft, clearDraft, serializeDraft, type DraftState } from './teamDraft';

export interface PlayerItem {
  id: string;
  name: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  isGoalkeeper?: boolean;
}

export interface TeamDraft {
  id: string;
  defaultName: string;
  name: string;
  colorHex: string;
  colorName: string;
  captainId?: string | null;
  players: PlayerItem[];
}

interface TeamBuilderIslandProps {
  initialPlayers: PlayerItem[];
}

/** Fisher-Yates: cada permutação com a mesma probabilidade. */
function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const ALL_AVAILABLE_TEAMS: { id: string; name: string; colorHex: string; colorName: string }[] = [
  { id: 'team-1', name: 'Time Preto', colorHex: '#1f2937', colorName: 'Preto' },
  { id: 'team-2', name: 'Time Branco', colorHex: '#e5e7eb', colorName: 'Branco' },
  { id: 'team-3', name: 'Time Azul', colorHex: '#3b82f6', colorName: 'Azul' },
  { id: 'team-4', name: 'Time Vermelho', colorHex: '#ef4444', colorName: 'Vermelho' },
];

/** Montagem limpa: todos presentes, times vazios, formato e tempo sugeridos pelo total. */
function initialDraftState(players: PlayerItem[]): DraftState {
  const teamCount: 3 | 4 = players.length <= 19 ? 3 : 4;
  return {
    sessionDate: localDateISO(),
    notes: '',
    presentPlayerIds: players.map((p) => p.id),
    teamCount,
    // Sugerido: 8 min para 3 times, 7 min para 4 times
    matchDurationMinutes: teamCount === 3 ? 8 : 7,
    teams: ALL_AVAILABLE_TEAMS.slice(0, teamCount).map((t) => ({
      ...t,
      defaultName: t.name,
      captainId: null,
      players: [],
    })),
  };
}

export const TeamBuilderIsland: React.FC<TeamBuilderIslandProps> = ({ initialPlayers }) => {
  const [initial] = useState(() => initialDraftState(initialPlayers));
  const [allPlayers, setAllPlayers] = useState<PlayerItem[]>(initialPlayers);
  const [sessionDate, setSessionDate] = useState(initial.sessionDate);
  const [notes, setNotes] = useState(initial.notes);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // PIN expirado no "Salvar": o rascunho fica no aparelho e o login volta para cá.
  const [needsLogin, setNeedsLogin] = useState(false);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);

  // 1. Controle de Presença dos Atletas Cadastrados
  // Inicialmente todos os cadastrados iniciam marcados como presentes
  const [presentPlayerIds, setPresentPlayerIds] = useState<Set<string>>(
    () => new Set(initial.presentPlayerIds)
  );
  const [presenceSearch, setPresenceSearch] = useState('');
  const [isPresenceExpanded, setIsPresenceExpanded] = useState(true);

  // 2. Formato da Rodada: 3 ou 4 Times
  const [teamCount, setTeamCount] = useState<3 | 4>(initial.teamCount);

  // 3. Duração da Partida em minutos (Sugerido: 8 min para 3 times, 7 min para 4 times)
  const [matchDurationMinutes, setMatchDurationMinutes] = useState<number>(
    initial.matchDurationMinutes
  );

  // Times da Noite (3 ou 4 times conforme seleção)
  const [teams, setTeams] = useState<TeamDraft[]>(initial.teams);

  const applyDraft = (draft: DraftState) => {
    setSessionDate(draft.sessionDate);
    setNotes(draft.notes);
    setPresentPlayerIds(new Set(draft.presentPlayerIds));
    setTeamCount(draft.teamCount);
    setMatchDurationMinutes(draft.matchDurationMinutes);
    setTeams(draft.teams);
  };

  // Restaura no mount, não no useState: a ilha é renderizada no servidor, que não tem o
  // rascunho, e ler o localStorage no primeiro render quebraria a hidratação.
  useEffect(() => {
    const draft = loadDraft(initialPlayers, ALL_AVAILABLE_TEAMS);
    if (!draft) return;
    applyDraft(draft);
    setRestoredAt(draft.savedAt);
  }, []);

  // Grava a cada mudança. A montagem limpa não vira rascunho (nem aviso de restauração).
  const pristine = useMemo(() => JSON.stringify(serializeDraft(initial)), [initial]);
  const hydrated = useRef(false);
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    const state: DraftState = {
      sessionDate,
      notes,
      presentPlayerIds: [...presentPlayerIds],
      teamCount,
      matchDurationMinutes,
      teams,
    };
    if (JSON.stringify(serializeDraft(state)) === pristine) clearDraft();
    else saveDraft(state);
  }, [sessionDate, notes, presentPlayerIds, teamCount, matchDurationMinutes, teams, pristine]);

  const handleDiscardDraft = () => {
    clearDraft();
    applyDraft(initial);
    setRestoredAt(null);
    setErrorMessage(null);
  };

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
          currentTeams.map((t) => {
            const isRemovingCaptain = t.captainId === playerId;
            return {
              ...t,
              captainId: isRemovingCaptain ? null : t.captainId,
              name: isRemovingCaptain ? t.defaultName : t.name,
              players: t.players.filter((p) => p.id !== playerId),
            };
          })
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
          return existing
            ? {
                ...template,
                defaultName: template.name,
                name: existing.name,
                captainId: existing.captainId,
                players: existing.players,
              }
            : {
                ...template,
                defaultName: template.name,
                captainId: null,
                players: [],
              };
        });
      } else {
        // Expande para 4 times
        return ALL_AVAILABLE_TEAMS.map((template, idx) => {
          const existing = prev[idx];
          return existing
            ? {
                ...template,
                defaultName: template.name,
                name: existing.name,
                captainId: existing.captainId,
                players: existing.players,
              }
            : {
                ...template,
                defaultName: template.name,
                captainId: null,
                players: [],
              };
        });
      }
    });
  };

  // Adicionar jogador ao time. Teto de 6 por time e 24 por rodada (ROUND_RULES).
  const handleAssignToTeam = (player: PlayerItem, teamId: string) => {
    const target = teams.find((t) => t.id === teamId);
    if (!target || target.players.some((p) => p.id === player.id)) return;

    if (target.players.length >= ROUND_RULES.MAX_PLAYERS_PER_TEAM) {
      setErrorMessage(
        `${target.name || target.defaultName} já está completo com ` +
          `${ROUND_RULES.MAX_PLAYERS_PER_TEAM} jogadores. Tire alguém antes de adicionar outro.`
      );
      return;
    }

    if (totalAssigned >= ROUND_RULES.MAX_PLAYERS_PER_ROUND) {
      setErrorMessage(
        `A rodada já tem os ${ROUND_RULES.MAX_PLAYERS_PER_ROUND} jogadores do limite.`
      );
      return;
    }

    setErrorMessage(null);
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? {
              ...t,
              players: [...t.players, { ...player, isGoalkeeper: player.isGoalkeeper ?? false }],
            }
          : t
      )
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

  // Definir ou alternar o Capitão do time
  const handleToggleCaptain = (teamId: string, playerId: string) => {
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === teamId) {
          const isAlreadyCaptain = t.captainId === playerId;
          if (isAlreadyCaptain) {
            // Se desmarcou o capitão atual, reseta para o nome padrão da cor
            return {
              ...t,
              captainId: null,
              name: t.defaultName,
            };
          }

          const captainPlayer = t.players.find((p) => p.id === playerId);
          const captainDisplayName = captainPlayer
            ? captainPlayer.nickname || captainPlayer.name
            : '';

          return {
            ...t,
            captainId: playerId,
            name: captainDisplayName ? `Time ${captainDisplayName}` : t.defaultName,
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
          const isRemovingCaptain = t.captainId === playerId;
          return {
            ...t,
            captainId: isRemovingCaptain ? null : t.captainId,
            name: isRemovingCaptain ? t.defaultName : t.name,
            players: t.players.filter((p) => p.id !== playerId),
          };
        }
        return t;
      })
    );
  };

  // Sorteio automático equilibrado entre os times escolhidos (3 ou 4) com os presentes
  const handleAutoDraw = () => {
    if (presentPlayers.length === 0) {
      setErrorMessage('Selecione os atletas presentes antes de realizar o sorteio.');
      return;
    }

    const MAX_PER_TEAM = ROUND_RULES.MAX_PLAYERS_PER_TEAM;

    // 1. Separa goleiros e atletas de linha presentes
    const goalkeepers = presentPlayers.filter((p) => p.isGoalkeeper);
    const outfielders = presentPlayers.filter((p) => !p.isGoalkeeper);

    // 2. Embaralha ambos os grupos (Fisher-Yates de verdade).
    //    O `sort(() => Math.random() - 0.5)` que estava aqui não produz permutação
    //    uniforme — o TimSort do V8 preserva parte da ordem original, e num sorteio
    //    semanal isso faz os mesmos jogadores caírem sistematicamente nos mesmos times.
    const shuffledGKs = shuffle(goalkeepers);
    const shuffledOutfielders = shuffle(outfielders);

    // 3. Inicializa os 3 ou 4 times vazios
    const newTeams: TeamDraft[] = ALL_AVAILABLE_TEAMS.slice(0, teamCount).map((t) => ({
      ...t,
      defaultName: t.name,
      captainId: null,
      players: [],
    }));

    const capacity = () => newTeams.filter((t) => t.players.length < MAX_PER_TEAM);
    const sobraram: string[] = [];

    // 4. Distribui os goleiros primeiro (1 por time, se possível)
    shuffledGKs.forEach((gk, index) => {
      const targetTeamIndex = index % newTeams.length;
      const target = newTeams[targetTeamIndex];
      if (target.players.length >= MAX_PER_TEAM) {
        sobraram.push(gk.nickname || gk.name);
        return;
      }
      target.players.push({
        ...gk,
        isGoalkeeper: true,
      });
    });

    // 5. Distribui os jogadores de linha equitativamente, respeitando o teto de 6
    shuffledOutfielders.forEach((player) => {
      // Prioriza times com menos jogadores para balancear
      const sortedTeamsByCount = capacity().sort(
        (a, b) => a.players.length - b.players.length
      );
      const targetTeam = sortedTeamsByCount[0];
      if (!targetTeam) {
        sobraram.push(player.nickname || player.name);
        return;
      }
      targetTeam.players.push({
        ...player,
        isGoalkeeper: false,
      });
    });

    setTeams(newTeams);
    setErrorMessage(
      sobraram.length
        ? `${teamCount} times × ${MAX_PER_TEAM} comportam ${teamCount * MAX_PER_TEAM} jogadores. ` +
            `Ficaram de fora: ${sobraram.join(', ')}. Ajuste a presença ou o número de times.`
        : null
    );
  };

  // Limpar todos os times
  const handleClearTeams = () => {
    setTeams(
      ALL_AVAILABLE_TEAMS.slice(0, teamCount).map((t) => ({
        ...t,
        defaultName: t.name,
        captainId: null,
        players: [],
      }))
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
      prev.map((t) => {
        const updatedPlayers = t.players.map((p) =>
          p.id === updatedPlayer.id
            ? {
                ...p,
                name: updatedPlayer.name,
                nickname: updatedPlayer.nickname || null,
                isGoalkeeper: updatedPlayer.isGoalkeeper ?? p.isGoalkeeper,
              }
            : p
        );

        let teamName = t.name;
        if (t.captainId === updatedPlayer.id) {
          const captainName = updatedPlayer.nickname || updatedPlayer.name;
          teamName = `Time ${captainName}`;
        }

        return {
          ...t,
          name: teamName,
          players: updatedPlayers,
        };
      })
    );
  };

  // Cadastrar jogador avulso na hora
  const handleCreatePlayer = async (e: React.SyntheticEvent) => {
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
    } catch (err) {
      alert((err instanceof Error && err.message) || 'Erro ao cadastrar jogador.');
    } finally {
      setIsCreatingPlayer(false);
    }
  };

  // Salvar a Sessão e ir para o Mesário
  const handleSaveSession = async () => {
    // Mesmas regras de ROUND_RULES que a API aplica — aqui só para avisar antes do envio.
    const vazios = teams.filter((t) => t.players.length === 0);
    if (vazios.length) {
      setErrorMessage(
        `Todo time precisa de pelo menos um jogador. Sem ninguém: ` +
          `${vazios.map((t) => t.name || t.defaultName).join(', ')}.`
      );
      return;
    }

    const cheios = teams.filter((t) => t.players.length > ROUND_RULES.MAX_PLAYERS_PER_TEAM);
    if (cheios.length) {
      setErrorMessage(
        `Cada time pode ter no máximo ${ROUND_RULES.MAX_PLAYERS_PER_TEAM} jogadores. ` +
          `Acima do limite: ${cheios
            .map((t) => `${t.name || t.defaultName} (${t.players.length})`)
            .join(', ')}.`
      );
      return;
    }

    if (totalAssigned > ROUND_RULES.MAX_PLAYERS_PER_ROUND) {
      setErrorMessage(
        `A rodada comporta no máximo ${ROUND_RULES.MAX_PLAYERS_PER_ROUND} jogadores ` +
          `(escalados: ${totalAssigned}).`
      );
      return;
    }

    // Validação de Capitães: Cada time deve ter exatamente 1 capitão selecionado
    const teamsWithoutCaptain = teams.filter(
      (t) => !t.captainId || !t.players.some((p) => p.id === t.captainId)
    );

    if (teamsWithoutCaptain.length > 0) {
      setErrorMessage(
        `Defina um capitão para cada equipe antes de iniciar (${teamsWithoutCaptain
          .map((t) => t.colorName || t.defaultName)
          .join(', ')} sem capitão selecionado).`
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
          captainId: t.captainId || null,
          playerIds: t.players.map((p) => p.id),
          players: t.players.map((p) => ({
            playerId: p.id,
            isGoalkeeper: !!p.isGoalkeeper,
            isCaptain: t.captainId === p.id,
          })),
        })),
      };

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        setNeedsLogin(true);
        throw new Error(
          'Sessão de mesário expirada. Entre com o PIN de novo; a montagem fica salva neste aparelho.'
        );
      }
      if (!res.ok) {
        // 502/504 do gateway vêm em HTML; sem o catch aparecia "Unexpected token '<'".
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || 'Erro ao salvar rodada.');
      }

      const created = await res.json();
      clearDraft();
      // Redireciona para o Mesário
      window.location.href = `/rodada/mesario?sessionId=${created.id}`;
    } catch (err) {
      setErrorMessage((err instanceof Error && err.message) || 'Erro ao conectar ao servidor.');
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

      {/* Rascunho restaurado */}
      {restoredAt !== null && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-sm flex flex-wrap items-center justify-between gap-3"
        >
          <span>
            Montagem restaurada deste aparelho (salva às{' '}
            {new Date(restoredAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            ).
          </span>
          <button
            type="button"
            onClick={handleDiscardDraft}
            className="min-h-[44px] px-4 rounded-xl bg-surface-50 border border-white/10 text-white font-bold text-sm touch-press-scale"
          >
            Descartar e começar do zero
          </button>
        </div>
      )}

      {/* Alerta de Erro */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex flex-wrap items-center gap-2 animate-fade-in">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          <span className="flex-1">{errorMessage}</span>
          {needsLogin && (
            <a
              href={'/login?redirect=' + encodeURIComponent('/rodada/nova')}
              className="min-h-[44px] inline-flex items-center px-4 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-100 font-bold text-sm"
            >
              Entrar com o PIN
            </a>
          )}
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
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                    style={{ backgroundColor: team.colorHex }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-display font-black text-base text-white truncate" title={team.name}>
                        {team.name}
                      </h3>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/15 text-gray-300"
                        style={{ backgroundColor: `${team.colorHex}33` }}
                      >
                        Colete {team.colorName}
                      </span>
                    </div>
                    {team.captainId ? (
                      <span className="text-[11px] text-amber-300 flex items-center gap-1 font-semibold mt-0.5">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        <span>Capitão definido</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400 italic mt-0.5 block">
                        Selecione o capitão abaixo ⭐
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full border bg-surface-50 text-gray-300 border-white/10 shrink-0">
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
                  team.players.map((p, idx) => {
                    const isCaptain = team.captainId === p.id;

                    return (
                      <div
                        key={p.id}
                        className={cn(
                          'flex items-center justify-between p-2 rounded-xl border text-xs group transition-all',
                          isCaptain
                            ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-400/30'
                            : p.isGoalkeeper
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : 'bg-surface-200/60 border-white/5 hover:border-white/20'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <span className="w-5 h-5 rounded-lg bg-surface-50 text-gray-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className={cn('font-semibold truncate', isCaptain ? 'text-amber-200' : 'text-white')}>
                            {p.nickname || p.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Botão de Capitão: [ ⭐ Capitão ] */}
                          <button
                            type="button"
                            onClick={() => handleToggleCaptain(team.id, p.id)}
                            className={cn(
                              'px-2 py-0.5 rounded-lg text-[10px] font-black border transition-all flex items-center gap-1 cursor-pointer select-none active:scale-95',
                              isCaptain
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm ring-1 ring-amber-400/40'
                                : 'bg-surface-50 text-gray-400 border-white/10 hover:text-amber-300 hover:border-amber-500/30'
                            )}
                            title={
                              isCaptain
                                ? 'Capitão da equipe (clique para desmarcar)'
                                : 'Definir como Capitão da equipe'
                            }
                          >
                            <Star className={cn('w-2.5 h-2.5', isCaptain ? 'fill-current text-amber-300' : 'text-gray-400')} />
                            <span>{isCaptain ? 'Capitão' : 'Capitão'}</span>
                          </button>

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
                    );
                  })
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
