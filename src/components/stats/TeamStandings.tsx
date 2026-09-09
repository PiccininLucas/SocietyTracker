import React from 'react';
import type { MatchSummary } from '../../core/domain/repositories/IMatchRepository';
import { standings, headToHead } from '../../core/domain/services/CompetitionService';
export function TeamStandings({
  matches,
  teams,
  scope,
}: {
  matches: MatchSummary[];
  teams: { id: string; name: string; colorHex: string }[];
  scope: string;
}) {
  const rows = standings(matches, teams);
  return (
    <section className="glass-card rounded-2xl p-4 space-y-3">
      <h2 className="font-display font-bold text-xl">Classificação semanal dos times</h2>
      <p className="text-xs text-gray-300">{scope}</p>
      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Tabela de classificação semanal"
      >
        <table className="w-full text-sm whitespace-nowrap">
          <caption className="sr-only">Pontuação: vitória 3, empate 1, derrota 0</caption>
          <thead>
            <tr>
              {['Pos', 'Time', 'P', 'J', 'V', 'E', 'D', 'GP', 'GC', 'SG', '%'].map((h) => (
                <th key={h} className="p-2 text-left text-gray-400" scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teamId} className="border-t border-white/10">
                <td className="p-2">{r.position}</td>
                <th scope="row" className="p-2 text-left font-semibold">
                  {r.name}
                </th>
                {[
                  r.points,
                  r.played,
                  r.wins,
                  r.draws,
                  r.losses,
                  r.goalsFor,
                  r.goalsAgainst,
                  r.goalDifference,
                  r.efficiency.toFixed(1) + '%',
                ].map((v, i) => (
                  <td className="p-2" key={i}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="text-gray-400 text-sm">Sem times nesta semana.</p>}
      <p className="text-xs text-gray-400">
        Deslize para ver todas as colunas. P: pontos · J: jogos · V/E/D: vitórias/empates/derrotas ·
        GP/GC: gols pró/contra · SG: saldo · %: aproveitamento. Desempate: pontos, vitórias, saldo,
        gols pró, confronto direto, nome.
      </p>
      <details>
        <summary className="min-h-[44px] cursor-pointer text-emerald-300 font-semibold">
          Retrospecto dos confrontos · mesma semana
        </summary>
        <div className="grid gap-2">
          {teams.flatMap((a, i) =>
            teams.slice(i + 1).map((b) => {
              const h = headToHead(matches, a.id, b.id);
              return (
                <p key={a.id + b.id} className="text-sm rounded-xl bg-surface-200 p-3">
                  {a.name} × {b.name}: {h.firstWins} × {h.secondWins} vitórias, {h.draws} empate(s),{' '}
                  {h.played} jogo(s), {h.firstGoals} × {h.secondGoals} gols.
                </p>
              );
            })
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Times são formados novamente a cada rodada. Nomes ou cores iguais em outras semanas não
          representam o mesmo time.
        </p>
      </details>
    </section>
  );
}
