import { ROUND_RULES } from '../../core/domain/entities/Session';

/**
 * Regras dos times da rodada, usadas pelo montador (TeamBuilderIsland) e pelo editor de
 * times do mesário (EditNightTeamsModal). Antes cada um tinha a sua cópia, e elas
 * divergiam: o editor aceitava o 7º jogador e deixava o nome do ex-capitão no time.
 *
 * Tudo aqui é puro e trabalha com `captainId`, a única fonte de verdade sobre o capitão.
 */

export interface RulePlayer {
  id: string;
  name: string;
  nickname?: string | null;
  isGoalkeeper?: boolean;
}

export interface RuleTeam<P extends RulePlayer = RulePlayer> {
  id: string;
  name: string;
  colorHex: string;
  captainId?: string | null;
  players: P[];
}

export interface TeamTemplate {
  id: string;
  name: string;
  colorHex: string;
  colorName: string;
}

/** Os quatro coletes da pelada, na ordem em que os times são montados. */
export const TEAM_TEMPLATES: readonly TeamTemplate[] = [
  { id: 'team-1', name: 'Time Preto', colorHex: '#1f2937', colorName: 'Preto' },
  { id: 'team-2', name: 'Time Branco', colorHex: '#e5e7eb', colorName: 'Branco' },
  { id: 'team-3', name: 'Time Azul', colorHex: '#3b82f6', colorName: 'Azul' },
  { id: 'team-4', name: 'Time Vermelho', colorHex: '#ef4444', colorName: 'Vermelho' },
];

const displayName = (p: RulePlayer) => p.nickname || p.name;
const captainName = (p: RulePlayer) => `Time ${displayName(p)}`;

/** Nome do time pela cor do colete; `undefined` para uma cor que não é de colete. */
export function defaultTeamName(colorHex: string): string | undefined {
  const hex = colorHex.toLowerCase();
  return TEAM_TEMPLATES.find((t) => t.colorHex === hex)?.name;
}

/** Como o time aparece nas mensagens. */
function teamLabel(team: RuleTeam): string {
  return team.name.trim() || defaultTeamName(team.colorHex) || 'O time';
}

/**
 * O nome é o que o app daria sozinho: o da cor ou "Time <capitão>". Só um nome automático
 * muda quando o capitão muda; o digitado à mão no editor fica.
 */
export function isAutoName(team: RuleTeam): boolean {
  if (team.name === defaultTeamName(team.colorHex)) return true;
  const captain = team.players.find((p) => p.id === team.captainId);
  return !!captain && team.name === captainName(captain);
}

/** Tira o capitão, e o nome volta para o da cor se ainda era o automático. */
function withoutCaptain<T extends RuleTeam>(team: T): T {
  const fallback = isAutoName(team) ? defaultTeamName(team.colorHex) : undefined;
  return { ...team, captainId: null, name: fallback ?? team.name };
}

/**
 * Motivo para recusar o jogador no time, ou `null`. O teto por time vale sempre; o da
 * rodada só para quem ainda não está em time nenhum, porque mover não muda o total.
 */
export function canAddPlayer(teams: RuleTeam[], teamId: string, playerId: string): string | null {
  const target = teams.find((t) => t.id === teamId);
  if (!target || target.players.some((p) => p.id === playerId)) return null;
  if (target.players.length >= ROUND_RULES.MAX_PLAYERS_PER_TEAM) {
    return (
      `${teamLabel(target)} já está completo com ${ROUND_RULES.MAX_PLAYERS_PER_TEAM} ` +
      'jogadores. Tire alguém antes de adicionar outro.'
    );
  }
  const placed = teams.some((t) => t.players.some((p) => p.id === playerId));
  const total = teams.reduce((n, t) => n + t.players.length, 0);
  if (!placed && total >= ROUND_RULES.MAX_PLAYERS_PER_ROUND) {
    return `A rodada já tem os ${ROUND_RULES.MAX_PLAYERS_PER_ROUND} jogadores do limite.`;
  }
  return null;
}

/** Põe no time quem ainda não está em time nenhum. Os tetos são do `canAddPlayer`. */
export function addPlayer<T extends RuleTeam>(
  teams: T[],
  teamId: string,
  player: T['players'][number]
): T[] {
  if (teams.some((t) => t.players.some((p) => p.id === player.id))) return teams;
  return teams.map((t) =>
    t.id === teamId
      ? { ...t, players: [...t.players, { ...player, isGoalkeeper: !!player.isGoalkeeper }] }
      : t
  );
}

/** Tira o jogador do time em que estiver. */
export function removePlayer<T extends RuleTeam>(teams: T[], playerId: string): T[] {
  return teams.map((t) => {
    if (!t.players.some((p) => p.id === playerId)) return t;
    const team = t.captainId === playerId ? withoutCaptain(t) : t;
    return { ...team, players: t.players.filter((p) => p.id !== playerId) };
  });
}

/** Leva o jogador para outro time. Ele chega sem a braçadeira de capitão. */
export function movePlayer<T extends RuleTeam>(
  teams: T[],
  playerId: string,
  toTeamId: string
): T[] {
  const from = teams.find((t) => t.players.some((p) => p.id === playerId));
  const player = from?.players.find((p) => p.id === playerId);
  if (!from || !player || from.id === toTeamId || !teams.some((t) => t.id === toTeamId))
    return teams;
  return addPlayer(removePlayer(teams, playerId), toTeamId, player);
}

/** Marca ou desmarca o capitão. Marcar renomeia para "Time <capitão>" se o nome era automático. */
export function toggleCaptain<T extends RuleTeam>(
  teams: T[],
  teamId: string,
  playerId: string
): T[] {
  return teams.map((t) => {
    if (t.id !== teamId) return t;
    if (t.captainId === playerId) return withoutCaptain(t);
    const captain = t.players.find((p) => p.id === playerId);
    if (!captain) return t;
    return { ...t, captainId: playerId, name: isAutoName(t) ? captainName(captain) : t.name };
  });
}

export function toggleGoalkeeper<T extends RuleTeam>(
  teams: T[],
  teamId: string,
  playerId: string
): T[] {
  return teams.map((t) =>
    t.id === teamId
      ? {
          ...t,
          players: t.players.map((p) =>
            p.id === playerId ? { ...p, isGoalkeeper: !p.isGoalkeeper } : p
          ),
        }
      : t
  );
}

/**
 * Leva ao time o cadastro editado do jogador. Se ele é o capitão e o nome era "Time
 * <nome antigo>", o time passa a se chamar pelo nome novo.
 */
export function updatePlayer<T extends RuleTeam>(teams: T[], updated: RulePlayer): T[] {
  return teams.map((t) => {
    const old = t.players.find((p) => p.id === updated.id);
    if (!old) return t;
    const rename = t.captainId === updated.id && t.name === captainName(old);
    return {
      ...t,
      name: rename ? captainName(updated) : t.name,
      players: t.players.map((p) =>
        p.id === updated.id
          ? {
              ...p,
              name: updated.name,
              nickname: updated.nickname || null,
              isGoalkeeper: updated.isGoalkeeper ?? p.isGoalkeeper,
            }
          : p
      ),
    };
  });
}

/**
 * O que impede salvar, na ordem em que o mesário deve resolver. As regras de formato são
 * as de `assertValidRoundFormat`, que a API aplica de novo; o capitão só a UI exige.
 */
export function saveProblems(teams: RuleTeam[]): string[] {
  const problems: string[] = [];
  const names = (list: RuleTeam[]) => list.map(teamLabel).join(', ');

  if (teams.some((t) => !t.name.trim())) problems.push('Todos os times devem ter um nome válido.');

  const empty = teams.filter((t) => t.players.length < ROUND_RULES.MIN_PLAYERS_PER_TEAM);
  if (empty.length)
    problems.push(`Todo time precisa de pelo menos um jogador. Sem ninguém: ${names(empty)}.`);

  const full = teams.filter((t) => t.players.length > ROUND_RULES.MAX_PLAYERS_PER_TEAM);
  if (full.length)
    problems.push(
      `Cada time pode ter no máximo ${ROUND_RULES.MAX_PLAYERS_PER_TEAM} jogadores. ` +
        `Acima do limite: ${full.map((t) => `${teamLabel(t)} (${t.players.length})`).join(', ')}.`
    );

  const total = new Set(teams.flatMap((t) => t.players.map((p) => p.id))).size;
  if (total > ROUND_RULES.MAX_PLAYERS_PER_ROUND)
    problems.push(
      `A rodada comporta no máximo ${ROUND_RULES.MAX_PLAYERS_PER_ROUND} jogadores ` +
        `(escalados: ${total}).`
    );

  const noCaptain = teams.filter(
    (t) => !t.captainId || !t.players.some((p) => p.id === t.captainId)
  );
  if (noCaptain.length)
    problems.push(
      `Defina um capitão para cada time antes de salvar. Sem capitão: ${names(noCaptain)}.`
    );

  return problems;
}
