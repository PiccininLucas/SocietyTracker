import React, { useEffect, useRef, useState } from 'react';
import { LiveScoreboard } from './LiveScoreboard';
import { TeamRostersModal } from './TeamRostersModal';
import { EditNightTeamsModal } from './EditNightTeamsModal';
import { QuickPlayerTransferModal } from './QuickPlayerTransferModal';
import { MatchEditor, actionClass } from './MatchEditor';
import { useMatchSession } from './useMatchSession';
import { projectPending, type PendingCommand } from './matchSync';
import { recentMatches, sequences } from '../../core/domain/services/CompetitionService';
import { TeamStandings } from '../stats/TeamStandings';
import { ModalPortal } from '../ui/ModalPortal';
import type { LiveTeam, LivePlayer } from './types';
export interface SessionData {
  id: string;
  sessionDate: string;
  status: 'ongoing' | 'finished';
  notes?: string | null;
  matchDurationSeconds?: number;
  teams: LiveTeam[];
}
interface Props {
  session: SessionData;
  allRegisteredPlayers?: LivePlayer[];
}
export function MesarioSessionWrapper({ session, allRegisteredPlayers = [] }: Props) {
  const [teams, setTeams] = useState(session.teams),
    [home, setHome] = useState(session.teams[0]?.id ?? ''),
    [away, setAway] = useState(session.teams[1]?.id ?? '');
  const [selected, setSelected] = useState<string | null>(null),
    [modal, setModal] = useState<'rosters' | 'edit' | 'transfer' | null>(null);
  const [teamError, setTeamError] = useState('');
  const sync = useMatchSession(session.id);
  const pending = sync.cache.pending.length > 0;
  const projected = projectPending(sync.cache.matches, sync.cache.pending);
  const active = projected.find((m) => m.status === 'ongoing');
  const current = projected.find((m) => m.matchId === selected) ?? active;
  const finished = recentMatches(sync.cache.matches),
    streaks = sequences(sync.cache.matches);
  const actionRef = useRef(false);
  useEffect(() => {
    if (active && !selected) setSelected(active.matchId);
  }, [active?.matchId, selected]);
  useEffect(() => {
    actionRef.current = false;
  }, [sync.cache.pending.length, current?.status]);
  const onCommand = (command: Omit<PendingCommand, 'operationId'>) => {
    if (
      (command.action === 'start' || command.action === 'finish') &&
      (actionRef.current || sync.cache.pending.some((p) => p.action === command.action))
    )
      return;
    if (command.action === 'start' || command.action === 'finish') actionRef.current = true;
    if (!sync.enqueue(command)) actionRef.current = false;
  };
  const reloadTeams = async () => {
    const res = await fetch('/api/sessions?id=' + session.id);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setTeams(data.teams);
  };
  const transfer = async (data: {
    fromTeamId: string;
    toTeamId: string;
    playerId: string;
    isLoaned: boolean;
  }) => {
    try {
      const res = await fetch('/api/sessions/' + session.id + '/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      await reloadTeams();
      await sync.refresh();
      setModal(null);
      setTeamError('');
    } catch (e) {
      setTeamError(e instanceof Error ? e.message : 'Falha ao transferir jogador.');
      throw e;
    }
  };
  const next = () => {
    if (pending || !current || current.status !== 'finished') return;
    if (current.homeScore !== current.awayScore) {
      const winner =
        current.homeScore > current.awayScore ? current.homeTeamId! : current.awayTeamId!;
      setHome(winner);
      setAway(teams.find((t) => t.id !== winner)?.id ?? '');
    }
    setSelected(null);
  };

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-12">
      <header className="glass-card rounded-2xl p-4 space-y-3">
        <h1 className="font-display text-2xl font-black">Modo Mesário</h1>
        <p className="text-gray-300 text-sm">
          Rodada de {session.sessionDate.split('-').reverse().join('/')} · times exclusivos desta
          rodada
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={actionClass} onClick={() => setModal('rosters')}>
            Ver times
          </button>
          <button className={actionClass} disabled={pending} onClick={() => setModal('edit')}>
            Editar times
          </button>
          <button className={actionClass} disabled={pending} onClick={() => setModal('transfer')}>
            Emprestar jogador
          </button>
        </div>
      </header>
      {sync.notice && (
        <p role="status" className="text-emerald-300 text-sm">
          {sync.notice}
        </p>
      )}
      {sync.legacyCache && (
        <button
          className={actionClass}
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([sync.legacyCache!], { type: 'application/json' })
            );
            const link = document.createElement('a');
            link.href = url;
            link.download = 'registros-anteriores-' + session.id + '.json';
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Baixar cópia dos registros anteriores
        </button>
      )}
      {(sync.error || teamError) && (
        <div
          role="alert"
          className="rounded-xl p-3 bg-rose-950 border border-rose-400 text-rose-100 space-y-2"
        >
          <p>{teamError || sync.error}</p>
          <button className={actionClass} onClick={() => void sync.retry()}>
            Tentar novamente
          </button>
          {pending && (
            <button className={actionClass + ' ml-2'} onClick={sync.discard}>
              Descartar operação pendente
            </button>
          )}
        </div>
      )}
      {!sync.ready ? (
        <p role="status">Carregando partidas…</p>
      ) : current ? (
        <>
          <LiveScoreboard
            key={current.matchId}
            match={current}
            teams={teams}
            duration={session.matchDurationSeconds ?? 420}
            timer={sync.cache.timers[current.matchId]}
            pending={pending}
            finishing={
              sync.cache.pending.some(
                (p) => p.matchId === current.matchId && p.action === 'finish'
              ) ||
              (current.status === 'ongoing' && (current.homeScore >= 2 || current.awayScore >= 2))
            }
            onTimer={(t) => sync.setTimer(current.matchId, t)}
            onCommand={onCommand}
            onNext={next}
          />
          {[current.homeTeamId, current.awayTeamId].map((id) => {
            const latest = streaks
              .filter((s) => {
                const m = sync.cache.matches.find((m) => m.matchId === s.matchId);
                return m?.homeTeamId === id || m?.awayTeamId === id;
              })
              .at(-1);
            const count = latest && latest.winnerTeamId === id ? latest.winStreak : 0;
            return (
              <p key={id} className="text-amber-300 text-sm">
                {teams.find((t) => t.id === id)?.name}:{' '}
                {count ? count + ' vitória(s) consecutiva(s)' : 'sem sequência de vitórias'}.
              </p>
            );
          })}
        </>
      ) : (
        <section className="glass-card rounded-2xl p-4 space-y-4">
          <h2 className="text-xl font-bold">Próximo confronto</h2>
          <div className="grid grid-cols-2 gap-3">
            <label>
              Time 1
              <select
                aria-label="Time 1"
                value={home}
                onChange={(e) => setHome(e.target.value)}
                className={actionClass + ' block w-full mt-1'}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Time 2
              <select
                aria-label="Time 2"
                value={away}
                onChange={(e) => setAway(e.target.value)}
                className={actionClass + ' block w-full mt-1'}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-gray-400">
            Quem vence fica como sugestão. O mesário define o próximo adversário; não há saída
            automática na terceira vitória.
          </p>
          <button
            className={actionClass + ' w-full bg-emerald-600'}
            disabled={pending || home === away}
            onClick={() =>
              onCommand({
                action: 'start',
                input: { sessionId: session.id, homeTeamId: home, awayTeamId: away },
              })
            }
          >
            {pending ? 'Iniciando…' : 'Iniciar partida'}
          </button>
        </section>
      )}
      <section className="space-y-3" aria-label="Últimas três partidas">
        <h2 className="font-bold text-xl">Últimas três partidas</h2>
        <p className="text-gray-400 text-sm">
          Ao finalizar a quarta, a mais antiga fica consolidada. Todos os resultados continuam no
          histórico.
        </p>
        {!finished.length && (
          <p className="text-sm text-gray-400">Nenhuma partida finalizada nesta rodada.</p>
        )}
        {finished.map((m) => {
          const st = streaks.find((s) => s.matchId === m.matchId);
          const display = projected.find((p) => p.matchId === m.matchId) ?? m;
          return (
            <details key={m.matchId} className="glass-card p-4 rounded-2xl">
              <summary className="min-h-[44px] cursor-pointer space-y-1">
                <span className="block font-bold">
                  #{m.sequence} · {m.homeTeamName} {display.homeScore} × {display.awayScore}{' '}
                  {m.awayTeamName}
                </span>
                <span className="block text-xs text-amber-300">
                  {st?.winnerTeamId
                    ? teams.find((t) => t.id === st.winnerTeamId)?.name +
                      ' · ' +
                      st.winStreak +
                      'ª vitória consecutiva'
                    : 'Empate · sequências interrompidas'}
                  {st?.interrupted.length
                    ? ' · Interrompida por ' +
                      st.reason +
                      ': ' +
                      st.interrupted.map((id) => teams.find((t) => t.id === id)?.name).join(', ')
                    : ''}
                </span>
                <span className="block text-xs text-gray-300">
                  {(display.events ?? [])
                    .map(
                      (e) =>
                        (e.scorerName || 'Gol contra') +
                        (e.assistId ? ' (assist. ' + e.assistName + ')' : ' (sem assistência)')
                    )
                    .join(' · ') || 'Sem gols'}
                </span>
              </summary>
              <div className="mt-3">
                <MatchEditor match={display} busy={pending} onCommand={onCommand} />
              </div>
            </details>
          );
        })}
        <a href="/historico" className="inline-block text-emerald-300 py-3">
          Ver histórico completo →
        </a>
      </section>
      <TeamStandings
        matches={sync.cache.matches}
        teams={teams}
        scope="Rodada atual · times desta semana"
      />
      {modal === 'rosters' && (
        <ModalPortal label="Times da rodada" onClose={() => setModal(null)}>
          <TeamRostersModal
            isOpen
            teams={teams}
            onClose={() => setModal(null)}
            onEdit={() => setModal('edit')}
          />
        </ModalPortal>
      )}
      {modal === 'edit' && (
        <ModalPortal label="Editar times da rodada" onClose={() => setModal(null)}>
          <EditNightTeamsModal
            isOpen
            sessionId={session.id}
            teams={teams}
            allRegisteredPlayers={allRegisteredPlayers}
            onClose={() => setModal(null)}
            onTeamsUpdated={(t) => {
              setTeams(t);
              void sync.refresh();
            }}
          />
        </ModalPortal>
      )}
      {modal === 'transfer' && (
        <ModalPortal label="Emprestar jogador" onClose={() => setModal(null)}>
          <QuickPlayerTransferModal
            isOpen
            teams={teams}
            currentHomeTeamId={current?.homeTeamId ?? home}
            currentAwayTeamId={current?.awayTeamId ?? away}
            onTransfer={transfer}
            onClose={() => setModal(null)}
          />
        </ModalPortal>
      )}
    </div>
  );
}
