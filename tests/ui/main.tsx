import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GoalDrawer } from '../../src/components/live/GoalDrawer';
import { MesarioSessionWrapper } from '../../src/components/live/MesarioSessionWrapper';
import { TeamBuilderIsland } from '../../src/components/live/TeamBuilderIsland';
import { TeamStandings } from '../../src/components/stats/TeamStandings';
import { PlayerPerformanceTable } from '../../src/components/stats/PlayerPerformanceTable';
import { MatchDetailsModal } from '../../src/components/ui/MatchDetailsModal';
import { playerPerformance } from '../../src/core/domain/services/CompetitionService';
import type { MatchSummary } from '../../src/core/domain/repositories/IMatchRepository';
import { sid, teams, rounds, type RoundName } from './data';
import '../../src/styles/globals.css';
import { ReportsIsland } from '../../src/components/export/ReportsIsland';
import { RoundSummaryCard } from '../../src/components/export/RoundSummaryCard';
import { PinLoginPad } from '../../src/components/live/PinLoginPad';
import type { PeriodLeaderboardOutputDTO } from '../../src/core/application/dtos/PeriodLeaderboardDTO';
function Fixture() {
  const [open, setOpen] = useState(true),
    [result, setResult] = useState(''),
    [matches, setMatches] = useState<MatchSummary[]>([]);
  const query = new URLSearchParams(location.search);
  const [report, setReport] = useState<PeriodLeaderboardOutputDTO | null>(null);
  useEffect(() => {
    const refreshMatches = () =>
      void fetch('/api/sessions/' + sid + '/matches')
        .then((r) => r.json())
        .then(setMatches);
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
  if (query.has('historical'))
    return (
      <div className="p-3">
        <PlayerPerformanceTable
          season="2026"
          players={playerPerformance(
            [],
            [
              { id: 'old', name: 'Barbaroto', isActive: true },
              { id: 'zero', name: 'Caio', isActive: true },
            ],
            [
              {
                playerId: 'old',
                sourceName: 'Barbaroto',
                season: 2026,
                throughDate: '2026-09-03',
                goals: 41,
                assists: 23,
                bottomCount: 0,
              },
              {
                playerId: 'zero',
                sourceName: 'Caio',
                season: 2026,
                throughDate: '2026-09-03',
                goals: 0,
                assists: 0,
                bottomCount: 1,
              },
            ]
          )}
        />
      </div>
    );
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
  if (query.has('roundCard'))
    return (
      <div className="p-3">
        <RoundSummaryCard
          data={{
            sessionId: sid,
            sessionDate: '2026-09-03',
            status: 'finished',
            // Rodada de 3 times: 8 minutos, e não os 7 do padrão.
            matchDurationSeconds: 480,
            totalMatches: 1,
            totalGoals: 2,
            highlights: {
              topScorers: ['Jogador 0'],
              topAssisters: [],
              mvps: ['Jogador 0'],
              bottomPlayers: ['Jogador 1'],
            },
            players: [
              {
                playerId: teams[0].players[0].id,
                name: 'Jogador 0',
                isGoalkeeper: false,
                goals: 2,
                assists: 0,
                contributions: 2,
                rank: 1,
              },
              {
                playerId: teams[0].players[1].id,
                name: 'Jogador 1',
                isGoalkeeper: false,
                goals: 0,
                assists: 0,
                contributions: 0,
                rank: 2,
              },
            ],
          }}
        />
      </div>
    );
  if (query.has('pin'))
    return (
      <div className="p-3">
        <PinLoginPad />
      </div>
    );
  if (query.has('builder'))
    return (
      <div className="p-3">
        <TeamBuilderIsland initialPlayers={teams.flatMap((t) => t.players)} />
      </div>
    );
  if (query.has('live')) {
    // ?session=<nome> usa uma rodada própria (data.ts), para a spec não depender do estado
    // que as outras deixam no banco compartilhado.
    const round = rounds[query.get('session') as RoundName] ?? {
      id: sid,
      sessionDate: '2026-09-03',
      teams,
    };
    return (
      <MesarioSessionWrapper
        session={{
          id: round.id,
          sessionDate: round.sessionDate,
          status: 'ongoing',
          teams: round.teams,
          matchDurationSeconds: 2,
        }}
        // Um atleta fora dos times, para o "Adicionar Atleta" do editor ter o que listar.
        allRegisteredPlayers={[
          ...round.teams.flatMap((t) => t.players),
          { id: '00000000-0000-4000-8000-000000009999', name: 'Avulso Único', nickname: null },
        ]}
        // Curto por padrão para os fluxos longos passarem pela retenção sem ficarem lentos;
        // undo.spec usa uma janela maior para ter tempo de tocar em "Desfazer".
        undoWindowMs={Number(query.get('undo') ?? 300)}
      />
    );
  }
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
            data-audit-skip
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
      <button data-audit-skip onClick={() => setOpen(true)}>
        Abrir gaveta
      </button>
      <output>{result}</output>
      <GoalDrawer
        isOpen={open}
        team={team}
        // Como o LiveScoreboard: a gaveta sempre sabe quem é o adversário da partida.
        opponentTeam={teams[1]}
        onClose={() => setOpen(false)}
        onConfirmGoal={(data) => setResult(JSON.stringify(data))}
      />
    </>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
