import type { PlayerItem, TeamDraft } from './TeamBuilderIsland';

/**
 * Rascunho do montador de times, salvo no aparelho a cada mudança. Um reload, um toque
 * na navegação ou um PIN expirado no "Salvar" perdiam a escalação inteira.
 */
export const DRAFT_KEY = 'society_team_builder_draft';
/** Mais velho que isso é de outra noite: a data e a presença já não valem. */
export const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface DraftState {
  sessionDate: string;
  notes: string;
  presentPlayerIds: string[];
  teamCount: 3 | 4;
  matchDurationMinutes: number;
  teams: TeamDraft[];
}

interface StoredDraft {
  version: 1;
  savedAt: number;
  sessionDate: string;
  notes: string;
  presentPlayerIds: string[];
  teamCount: 3 | 4;
  matchDurationMinutes: number;
  teams: {
    id: string;
    name: string;
    captainId: string | null;
    players: { id: string; isGoalkeeper: boolean }[];
  }[];
}

type TeamTemplate = Pick<TeamDraft, 'id' | 'name' | 'colorHex' | 'colorName'>;

/** Só ids e escolhas: nomes e fotos vêm sempre do cadastro atual. */
export function serializeDraft(state: DraftState): Omit<StoredDraft, 'version' | 'savedAt'> {
  return {
    sessionDate: state.sessionDate,
    notes: state.notes,
    presentPlayerIds: [...state.presentPlayerIds].sort(),
    teamCount: state.teamCount,
    matchDurationMinutes: state.matchDurationMinutes,
    teams: state.teams.map((t) => ({
      id: t.id,
      name: t.name,
      captainId: t.captainId ?? null,
      players: t.players.map((p) => ({ id: p.id, isGoalkeeper: !!p.isGoalkeeper })),
    })),
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/**
 * Valida um rascunho lido do aparelho contra o cadastro atual. Descarta o que não fecha
 * (versão, idade, formato) e remove jogadores que não existem mais; nunca inventa dados.
 */
export function sanitizeDraft(
  raw: unknown,
  players: PlayerItem[],
  templates: readonly TeamTemplate[],
  now: number
): (DraftState & { savedAt: number }) | null {
  if (!isRecord(raw) || raw.version !== 1 || typeof raw.savedAt !== 'number') return null;
  if (now - raw.savedAt > DRAFT_MAX_AGE_MS || raw.savedAt - now > 60_000) return null;
  const teamCount = raw.teamCount;
  if (teamCount !== 3 && teamCount !== 4) return null;
  if (typeof raw.sessionDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.sessionDate))
    return null;
  const minutes = Number(raw.matchDurationMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  if (!Array.isArray(raw.teams) || !Array.isArray(raw.presentPlayerIds)) return null;

  const byId = new Map(players.map((p) => [p.id, p]));
  const present = new Set(raw.presentPlayerIds.filter((id): id is string => byId.has(id as string)));
  const placed = new Set<string>();
  const teams: TeamDraft[] = [];
  for (const template of templates.slice(0, teamCount)) {
    const stored = raw.teams.find((t) => isRecord(t) && t.id === template.id);
    const storedPlayers = isRecord(stored) && Array.isArray(stored.players) ? stored.players : [];
    const teamPlayers: PlayerItem[] = [];
    for (const entry of storedPlayers) {
      const player = isRecord(entry) ? byId.get(entry.id as string) : undefined;
      if (!player || placed.has(player.id)) continue;
      placed.add(player.id);
      present.add(player.id);
      teamPlayers.push({ ...player, isGoalkeeper: isRecord(entry) && entry.isGoalkeeper === true });
    }
    const captainId =
      isRecord(stored) && teamPlayers.some((p) => p.id === stored.captainId)
        ? (stored.captainId as string)
        : null;
    teams.push({
      ...template,
      defaultName: template.name,
      name: captainId && isRecord(stored) && typeof stored.name === 'string' ? stored.name : template.name,
      captainId,
      players: teamPlayers,
    });
  }
  return {
    savedAt: raw.savedAt,
    sessionDate: raw.sessionDate,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    presentPlayerIds: [...present],
    teamCount,
    matchDurationMinutes: minutes,
    teams,
  };
}

export function loadDraft(
  players: PlayerItem[],
  templates: readonly TeamTemplate[],
  now = Date.now()
) {
  try {
    return sanitizeDraft(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null'), players, templates, now);
  } catch {
    return null;
  }
}

export function saveDraft(state: DraftState, now = Date.now()) {
  try {
    const stored: StoredDraft = { version: 1, savedAt: now, ...serializeDraft(state) };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(stored));
  } catch {
    // Sem espaço ou armazenamento bloqueado: o montador segue funcionando, só sem rascunho.
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Idem.
  }
}
