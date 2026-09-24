export const sid = '00000000-0000-4000-8000-000000000001';
const id = (n: number) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
export const teams = Array.from({ length: 4 }, (_, t) => ({
  id: id(100 + t),
  name: 'Time ' + t,
  colorHex: ['#10b981', '#3b82f6', '#eab308', '#ef4444'][t],
  players: Array.from({ length: 6 }, (_, i) => ({
    id: id(1000 + t * 6 + i),
    name: 'Jogador ' + (t * 6 + i),
    nickname: null,
    isGoalkeeper: i === 5,
  })),
}));

/**
 * Rodadas extras, uma por spec que grava partidas: o banco do harness é um só e o
 * live.spec depende de começar da "Partida #1". Os jogadores são os mesmos; os times
 * (session_teams) são próprios de cada rodada.
 */
function round(n: number, sessionDate: string) {
  return {
    id: id(n),
    sessionDate,
    teams: teams.map((t, i) => ({ ...t, id: id(200 + n * 10 + i) })),
  };
}
export const rounds = {
  offline: round(2, '2026-09-10'),
  retry: round(3, '2026-09-17'),
  undo: round(4, '2026-09-24'),
  tabs: round(5, '2026-10-01'),
  touch: round(6, '2026-10-08'),
  touchTeams: round(7, '2026-10-15'),
  close: round(8, '2026-10-22'),
  leave: round(9, '2026-10-29'),
};
export type RoundName = keyof typeof rounds;
