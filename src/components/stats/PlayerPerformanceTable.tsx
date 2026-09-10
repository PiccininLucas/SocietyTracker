import React from 'react';
import type { PlayerPerformance } from '../../core/domain/services/CompetitionService';
type SortKey =
  'contributions' | 'goals' | 'assists' | 'played' | 'wins' | 'efficiency' | 'bottomCount' | 'name';
export function PlayerPerformanceTable({
  players,
  season,
  sort = 'contributions',
  direction = 'desc',
  week,
}: {
  players: PlayerPerformance[];
  season: string;
  sort?: string;
  direction?: string;
  week?: string;
}) {
  const keys: SortKey[] = [
    'contributions',
    'goals',
    'assists',
    'played',
    'wins',
    'efficiency',
    'bottomCount',
    'name',
  ];
  const key = keys.includes(sort as SortKey) ? (sort as SortKey) : 'contributions',
    sign = direction === 'asc' ? 1 : -1;
  const sorted = [...players].sort(
    (a, b) =>
      (typeof a[key] === 'number'
        ? (Number(a[key]) - Number(b[key])) * sign
        : String(a[key]).localeCompare(String(b[key]), 'pt-BR') * sign) ||
      a.name.localeCompare(b.name, 'pt-BR')
  );
  const columns: [string, keyof PlayerPerformance, SortKey?][] = [
    ['Jogador', 'name', 'name'],
    ['J', 'played', 'played'],
    ['V', 'wins', 'wins'],
    ['E', 'draws'],
    ['D', 'losses'],
    ['%', 'efficiency', 'efficiency'],
    ['G+A', 'contributions', 'contributions'],
    ['Gols', 'goals', 'goals'],
    ['Assist.', 'assists', 'assists'],
    ['Rank G+A', 'contributionRank'],
    ['Rank G', 'goalRank'],
    ['Rank A', 'assistRank'],
    ['Bola Murcha', 'bottomCount', 'bottomCount'],
  ];
  const href = (k: SortKey) =>
    '?' +
    new URLSearchParams({
      season,
      sort: k,
      direction: key === k && direction === 'desc' ? 'asc' : 'desc',
      ...(week ? { week } : {}),
    }).toString();
  return (
    <section className="glass-card rounded-2xl p-4 space-y-3">
      <h2 className="font-display text-xl font-bold">
        Desempenho individual · {season === 'all' ? 'Todo o histórico' : season}
      </h2>
      <p className="text-xs text-gray-400">
        Deslize a tabela e toque nos títulos para ordenar. Empates compartilham posição (1, 1, 3).
        Aproveitamento: (3 × vitórias + empates) ÷ (3 × jogos).
      </p>
      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Desempenho individual da temporada"
      >
        <table className="w-full whitespace-nowrap text-sm">
          <thead>
            <tr>
              {columns.map(([title, field, sortable], i) => (
                <th
                  scope="col"
                  key={field}
                  className={
                    'p-2 text-left text-gray-400 ' +
                    (i === 0 ? 'sticky left-0 bg-surface-100 z-10' : '')
                  }
                  aria-sort={
                    sortable === key
                      ? direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  {sortable ? (
                    <a
                      className="inline-flex items-center min-h-[44px] text-emerald-300"
                      href={href(sortable)}
                    >
                      {title}
                      {sortable === key ? (direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </a>
                  ) : (
                    title
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.playerId} className="border-t border-white/10">
                {columns.map(([, field], i) =>
                  i === 0 ? (
                    <th
                      scope="row"
                      key={field}
                      className="sticky left-0 bg-surface-100 text-left p-2 font-semibold min-w-[120px] max-w-[160px] whitespace-normal"
                    >
                      {p.nickname || p.name}
                      {!p.isActive && <small className="block text-gray-400">Inativo</small>}
                      {p.inferred && (
                        <small className="block text-amber-300">Histórico inferido</small>
                      )}
                    </th>
                  ) : (
                    <td key={field} className="p-2">
                      {p.hasHistoricalTotals && !p.played && ['played', 'wins', 'draws', 'losses', 'efficiency'].includes(field)
                        ? '—' : field === 'efficiency' ? p.efficiency.toFixed(1) + '%' : String(p[field])}
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!players.length && <p className="text-gray-400">Nenhum jogador neste período.</p>}
      <p className="text-xs text-gray-400">
        Bola Murcha: uma ocorrência por rodada disputada sem gols ou assistências; goleiros são
        imunes. Rodadas ainda em andamento têm valores provisórios.
      </p>
    </section>
  );
}
