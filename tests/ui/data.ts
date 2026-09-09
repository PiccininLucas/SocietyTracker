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
