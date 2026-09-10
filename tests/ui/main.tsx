import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GoalDrawer } from '../../src/components/live/GoalDrawer';
import { MesarioSessionWrapper } from '../../src/components/live/MesarioSessionWrapper';
import { TeamStandings } from '../../src/components/stats/TeamStandings';
import { PlayerPerformanceTable } from '../../src/components/stats/PlayerPerformanceTable';
import { MatchDetailsModal } from '../../src/components/ui/MatchDetailsModal';
import { playerPerformance } from '../../src/core/domain/services/CompetitionService';
import type { MatchSummary } from '../../src/core/domain/repositories/IMatchRepository';
import { sid, teams } from './data';
import '../../src/styles/globals.css';
import { ReportsIsland } from '../../src/components/export/ReportsIsland';
import type { PeriodLeaderboardOutputDTO } from '../../src/core/application/dtos/PeriodLeaderboardDTO';
function Fixture() {
  const [open, setOpen] = useState(true),
    [result, setResult] = useState(''),
    [matches, setMatches] = useState<MatchSummary[]>([]);
  const query = new URLSearchParams(location.search);
  const [report, setReport] = useState<PeriodLeaderboardOutputDTO | null>(null);
  useEffect(() => {
    const refreshMatches = () => void fetch('/api/sessions/' + sid + '/matches').then((r) => r.json()).then(setMatches);
    window.addEventListener('match-deleted', refreshMatches);
    if (query.has('reports'))
      void fetch('/api/reports/period?type=year&year=2026')
        .then((r) => r.json())
        .then(setReport);
    if (query.has('stats'))
      void fetch('/api/sessions/' + sid + '/matches')
        .then((r) => r.json())
        .then(setMatches);
    return () => window.removeEventListener('match-deleted', refreshMatches);
  }, []);
  if (query.has('historical')) return <div className="p-3">
    <PlayerPerformanceTable season="2026" players={playerPerformance([], [
      { id: 'old', name: 'Barbaroto', isActive: true },
      { id: 'zero', name: 'Caio', isActive: true },
    ], [
      { playerId: 'old', sourceName: 'Barbaroto', season: 2026, throughDate: '2026-09-03', goals: 41, assists: 23, bottomCount: 0 },
      { playerId: 'zero', sourceName: 'Caio', season: 2026, throughDate: '2026-09-03', goals: 0, assists: 0, bottomCount: 1 },
    ])} />
  </div>;
  if (query.has('reports'))
    return report ? (
      <div className="p-3">
        <ReportsIsland
          sessions={[{ id: sid, sessionDate: '2026-09-03', status: 'ongoing' }]}
          months={[]}
          initialRoundData={null}
          initialMonthData={null}
          initialYearData={report}
          initialAllTimeData={{
            ...report,
            periodType: 'all',
            year: undefined,
            periodLabel: 'Todo o histórico',
          }}
        />
      </div>
    ) : (
      <p>Carregando relatórios…</p>
    );
  if (query.has('live'))
    return (
      <MesarioSessionWrapper
        session={{
          id: sid,
          sessionDate: '2026-09-03',
          status: 'ongoing',
          teams,
          matchDurationSeconds: 2,
        }}
      />
    );
  if (query.has('stats'))
    return (
      <div className="p-3 space-y-4">
        <TeamStandings teams={teams} matches={matches} scope="Semana selecionada: 31/08 a 06/09" />
        <PlayerPerformanceTable
          players={playerPerformance(
            matches,
            teams.flatMap((t) => t.players.map((p) => ({ ...p, isActive: true })))
          )}
          season="2026"
        />
        {matches.map((m) => (
          <button
            key={m.matchId}
            className="min-h-[44px] p-3"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('open-match-details', { detail: { matchId: m.matchId } })
              )
            }
          >
            Súmula #{m.sequence}
          </button>
        ))}
        <MatchDetailsModal />
      </div>
    );
  const count = Number(query.get('players') ?? 6);
  const team = { ...teams[0], players: teams[0].players.slice(0, count) };
  return (
    <>
      <button onClick={() => setOpen(true)}>Abrir gaveta</button>
      <output>{result}</output>
      <GoalDrawer
        isOpen={open}
        team={team}
        onClose={() => setOpen(false)}
        onConfirmGoal={(data) => setResult(JSON.stringify(data))}
      />
    </>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
