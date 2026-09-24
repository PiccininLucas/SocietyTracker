import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LiveScoreboard } from './LiveScoreboard';
import { TeamRostersModal } from './TeamRostersModal';
import { EditNightTeamsModal } from './EditNightTeamsModal';
import { MatchEditor, actionClass, fieldClass } from './MatchEditor';
import { UndoToast } from './UndoToast';
import { useMatchSession } from './useMatchSession';
import { useTabLock } from './useTabLock';
import { useWakeLock } from './useWakeLock';
import {
  AuthRequiredError,
  describeNetworkError,
  projectPending,
  type PendingCommand,
  type TimerState,
} from './matchSync';
import { recentMatches, sequences } from '../../core/domain/services/CompetitionService';
import { TeamStandings } from '../stats/TeamStandings';
import { ModalPortal } from '../ui/ModalPortal';
import { DEFAULT_MATCH_DURATION_SECONDS, type LiveTeam, type LivePlayer } from './types';
import type { MatchSummary } from '../../core/domain/repositories/IMatchRepository';

/** Quanto tempo um gol fica no aparelho, podendo ser desfeito, antes de ir ao servidor. */
export const UNDO_WINDOW_MS = 5000;

interface LastGoal {
  operationId: string;
  matchId: string;
  label: string;
  sendAfter: number;
  /** Cronômetro antes do gol: o gol da vitória projetado para o relógio. */
  timer?: TimerState;
}

/**
 * Times em ordem de espera: quem jogou há mais tempo vem primeiro, e quem nunca jogou na
 * rodada vem antes de todos. O critério é o número da última partida disputada.
 */
export function waitingOrder(teams: LiveTeam[], matches: MatchSummary[]): LiveTeam[] {
  const lastPlayed = new Map<string, number>();
  for (const m of matches) {
    if (m.status !== 'finished') continue;
    const seq = m.sequence ?? 0;
    for (const id of [m.homeTeamId, m.awayTeamId]) {
      if (id) lastPlayed.set(id, Math.max(lastPlayed.get(id) ?? -1, seq));
    }
  }
  return [...teams].sort((a, b) => (lastPlayed.get(a.id) ?? -1) - (lastPlayed.get(b.id) ?? -1));
}

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
  /** Janela do "Desfazer" gol; 0 envia na hora, sem opção de desfazer. */
  undoWindowMs?: number;
}
export function MesarioSessionWrapper({
  session,
  allRegisteredPlayers = [],
  undoWindowMs = UNDO_WINDOW_MS,
}: Props) {
  const [teams, setTeams] = useState(session.teams),
    [home, setHome] = useState(session.teams[0]?.id ?? ''),
    [away, setAway] = useState(session.teams[1]?.id ?? '');
  const [selected, setSelected] = useState<string | null>(null),
    [modal, setModal] = useState<'rosters' | 'edit' | null>(null),
    [lastGoal, setLastGoal] = useState<LastGoal | null>(null);
  const [roundStatus, setRoundStatus] = useState(session.status),
    [roundBusy, setRoundBusy] = useState(false),
    [roundError, setRoundError] = useState('');
  const closed = roundStatus === 'finished';
  const lock = useTabLock('society_mesario:' + session.id);
  const owner = lock.role === 'owner';
  const sync = useMatchSession(session.id, { active: owner });
  const pending = sync.cache.pending.length > 0;
  const duration = session.matchDurationSeconds ?? DEFAULT_MATCH_DURATION_SECONDS;
  // O placar re-renderiza a cada 250ms pelo cronômetro; sem memo esta projeção (e o
  // scoreFromEvents que ela roda por partida) seria recalculada em todo tique.
  const projected = useMemo(
    () =>
      projectPending(sync.cache.matches, sync.cache.pending, {
        sessionId: session.id,
        sessionDate: session.sessionDate,
        teams,
        durationSeconds: duration,
      }),
    [sync.cache.matches, sync.cache.pending, session.id, session.sessionDate, teams, duration]
  );
  const active = projected.find((m) => m.status === 'ongoing');
  // Sem partida em andamento, o último resultado continua na tela (com a sugestão de quem
  // entra) até o mesário tocar em "Próximo confronto" — inclusive depois de uma recarga.
  const [choosingNext, setChoosingNext] = useState(false);
  const latest = projected.reduce<MatchSummary | undefined>(
    (a, m) => (!a || (m.sequence ?? 0) > (a.sequence ?? 0) ? m : a),
    undefined
  );
  const current =
    projected.find((m) => m.matchId === selected) ?? active ?? (choosingNext ? undefined : latest);
  const finished = recentMatches(sync.cache.matches),
    streaks = sequences(sync.cache.matches);
  const actionRef = useRef(false);
  useWakeLock(owner && !!active);
  // Com lance no aparelho, sair do mesário deixa a fila parada até voltar: o navegador
  // pergunta antes. O Safari do iPhone não pergunta; para ele fica o aviso do Layout.
  // Entrar com o PIN é saída de propósito: o login volta para cá e a fila recomeça.
  const leavingOnPurpose = useRef(false);
  useEffect(() => {
    if (!owner || !pending) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (leavingOnPurpose.current) return;
      e.preventDefault();
      // Obsoleto, mas é o que navegadores mais antigos leem para mostrar o aviso.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [owner, pending]);
  // Partida em andamento: a navegação de baixo sai da tela (globals.css), para um toque
  // logo abaixo dos botões de gol não tirar o mesário da partida.
  const live = owner && !!active;
  useEffect(() => {
    if (!live) return;
    document.documentElement.dataset.liveMatch = '';
    return () => {
      delete document.documentElement.dataset.liveMatch;
    };
  }, [live]);
  useEffect(() => {
    if (active && !selected) {
      setSelected(active.matchId);
      setChoosingNext(false);
    }
  }, [active?.matchId, selected]);
  useEffect(() => {
    actionRef.current = false;
  }, [sync.cache.pending.length, current?.status]);
  const onCommand = (command: Omit<PendingCommand, 'operationId'>) => {
    // O servidor recusa um segundo início com partida em andamento; a projeção já mostra o
    // início pendente como partida em andamento, então basta olhar para ela.
    if (command.action === 'start' && (actionRef.current || active)) return;
    if (
      command.action === 'finish' &&
      (actionRef.current ||
        sync.cache.pending.some((p) => p.action === 'finish' && p.matchId === command.matchId))
    )
      return;
    if (command.action === 'start' || command.action === 'finish') actionRef.current = true;
    const hold = command.action === 'goal' && undoWindowMs > 0;
    const op = sync.enqueue(hold ? { ...command, sendAfter: Date.now() + undoWindowMs } : command);
    if (!op) {
      actionRef.current = false;
      return;
    }
    // Só o último lance da fila pode ser desfeito: qualquer comando novo encerra a janela.
    setLastGoal(
      hold && op.matchId
        ? {
            operationId: op.operationId,
            matchId: op.matchId,
            label: op.input.isOwnGoal
              ? 'Gol contra registrado'
              : 'Gol de ' + (op.input.scorerName || 'atleta') + ' registrado',
            sendAfter: op.sendAfter!,
            timer: sync.cache.timers[op.matchId],
          }
        : null
    );
  };
  const undo = () => {
    if (!lastGoal) return;
    const goal = lastGoal;
    setLastGoal(null);
    if (!sync.cancel(goal.operationId)) return;
    // Se era o gol da vitória, a projeção tinha encerrado a partida e parado o relógio.
    // O timer é ancorado no instante de início, então restaurar o estado anterior devolve
    // também os segundos que correram durante a janela.
    const now = sync.cache.timers[goal.matchId];
    if (goal.timer?.running && !now?.running) sync.setTimer(goal.matchId, goal.timer);
    setSelected(goal.matchId);
  };

  /**
   * Encerrar ou reabrir a rodada vai direto ao servidor, sem a fila do aparelho: não tem
   * pressa (é o fim da noite) e depende de o servidor saber que nenhuma partida está em
   * andamento. Sem sinal, o mesário tenta de novo depois.
   */
  const changeRoundStatus = async (status: 'finished' | 'ongoing') => {
    const date = session.sessionDate.split('-').reverse().join('/');
    const question =
      status === 'finished'
        ? `Encerrar a rodada de ${date}? Nenhuma partida nova poderá ser iniciada até reabrir. As três últimas continuam corrigíveis.`
        : `Reabrir a rodada de ${date} para iniciar novas partidas?`;
    if (roundBusy || !window.confirm(question)) return;
    setRoundBusy(true);
    setRoundError('');
    try {
      const res = await fetch('/api/sessions/' + session.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 401) throw new AuthRequiredError();
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Servidor indisponível no momento.');
      setRoundStatus(status);
      setChoosingNext(false);
    } catch (e) {
      setRoundError(
        e instanceof AuthRequiredError
          ? 'Sessão de mesário expirada. Entre com o PIN de novo.'
          : describeNetworkError(e) + ' Tente novamente.'
      );
    } finally {
      setRoundBusy(false);
    }
  };

  const next = () => {
    if (!current || current.status !== 'finished') return;
    const queue = waitingOrder(teams, projected);
    const winner =
      current.homeScore === current.awayScore
        ? null
        : current.homeScore > current.awayScore
          ? current.homeTeamId!
          : current.awayTeamId!;

    if (winner) {
      // Quem vence fica; entra quem está esperando há mais tempo. Antes entrava o
      // primeiro time da lista que não tivesse vencido — quase sempre quem acabou de
      // perder, furando a fila de quem estava de fora.
      setHome(winner);
      setAway(queue.find((t) => t.id !== winner)?.id ?? '');
    } else {
      // Empate: ninguém ficou por mérito, então entram os dois que esperam há mais tempo.
      // Os dois que acabaram de jogar ficam no fim da fila por construção.
      const [first, second] = queue;
      if (first) setHome(first.id);
      if (second) setAway(second.id);
    }
    setSelected(null);
    setChoosingNext(true);
  };

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-12">
      <header className="glass-card rounded-2xl p-4 space-y-3">
        <h1 className="font-display text-2xl font-black">Modo Mesário</h1>
        <p className="text-gray-300 text-sm">
          Rodada de {session.sessionDate.split('-').reverse().join('/')} ·{' '}
          {closed ? 'rodada encerrada' : 'times exclusivos desta rodada'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={actionClass} onClick={() => setModal('rosters')}>
            Ver times
          </button>
          <button
            className={actionClass}
            disabled={pending || !owner}
            onClick={() => setModal('edit')}
          >
            Editar times
          </button>
          {/* Só sem partida em andamento: o servidor recusa encerrar com jogo aberto. */}
          {owner && sync.ready && !closed && !active && (
            <button
              className={actionClass + ' border-rose-400/60 text-rose-200'}
              disabled={pending || roundBusy}
              onClick={() => void changeRoundStatus('finished')}
            >
              Encerrar rodada
            </button>
          )}
        </div>
        {roundError && (
          <p role="alert" className="text-sm text-rose-300">
            {roundError}
          </p>
        )}
      </header>
      {lock.role === 'follower' && (
        <div
          role="alert"
          className="rounded-xl p-3 bg-amber-950 border border-amber-400 text-amber-100 space-y-2"
        >
          <p>
            O mesário desta rodada está aberto em outra aba ou janela. Esta fica só para consulta,
            para os lances não se sobrescreverem.
          </p>
          <button className={actionClass} onClick={lock.takeOver}>
            Usar nesta aba
          </button>
        </div>
      )}
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
      {sync.error && (
        <div
          role="alert"
          className="rounded-xl p-3 bg-rose-950 border border-rose-400 text-rose-100 space-y-2"
        >
          <p>{sync.error}</p>
          {sync.needsLogin ? (
            // Os lances pendentes ficam no localStorage; ao voltar do login a página
            // recarrega e o envio da fila recomeça sozinho.
            <a
              className={actionClass + ' inline-flex items-center'}
              href={
                '/login?redirect=' +
                encodeURIComponent(window.location.pathname + window.location.search)
              }
              onClick={() => {
                leavingOnPurpose.current = true;
              }}
            >
              Entrar com o PIN
            </a>
          ) : (
            <button className={actionClass} onClick={() => void sync.retry()}>
              Tentar novamente
            </button>
          )}
          {pending && (
            <button className={actionClass + ' ml-2'} onClick={sync.discard}>
              Descartar operação pendente
            </button>
          )}
        </div>
      )}
      {!sync.ready || lock.role === 'checking' ? (
        <p role="status">Carregando partidas…</p>
      ) : !owner ? null : closed && !active ? (
        <section className="glass-card rounded-2xl p-4 space-y-3" aria-label="Rodada encerrada">
          <h2 className="text-xl font-bold">Rodada encerrada</h2>
          <p className="text-sm text-gray-300">
            {finished.length
              ? 'As três últimas partidas continuam corrigíveis logo abaixo.'
              : 'Nenhuma partida foi finalizada nesta rodada.'}{' '}
            Para iniciar outra partida, reabra a rodada.
          </p>
          <div className="flex flex-wrap gap-2">
            <a className={actionClass + ' inline-flex items-center'} href="/relatorios">
              Cards da rodada
            </a>
            <a className={actionClass + ' inline-flex items-center'} href="/rodada/nova">
              Montar próxima rodada
            </a>
            <button
              className={actionClass}
              disabled={roundBusy}
              onClick={() => void changeRoundStatus('ongoing')}
            >
              Reabrir rodada
            </button>
          </div>
        </section>
      ) : current ? (
        <>
          <LiveScoreboard
            key={current.matchId}
            match={current}
            teams={teams}
            duration={duration}
            timer={sync.cache.timers[current.matchId]}
            pending={pending}
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
                className={fieldClass + ' block w-full mt-1'}
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
                className={fieldClass + ' block w-full mt-1'}
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
            Quem vence fica, e entra quem está esperando há mais tempo. É só sugestão — o mesário
            pode trocar. Não há saída automática na terceira vitória.
          </p>
          <button
            className={actionClass + ' w-full bg-emerald-600'}
            disabled={!!active || home === away}
            onClick={() =>
              onCommand({
                action: 'start',
                input: { sessionId: session.id, homeTeamId: home, awayTeamId: away },
              })
            }
          >
            Iniciar partida
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
              {owner && (
                <div className="mt-3">
                  <MatchEditor match={display} busy={pending} onCommand={onCommand} />
                </div>
              )}
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
      {owner && lastGoal && (
        <UndoToast
          key={lastGoal.operationId}
          label={lastGoal.label}
          sendAfter={lastGoal.sendAfter}
          windowMs={undoWindowMs}
          onUndo={undo}
          onExpire={() => setLastGoal((g) => (g?.operationId === lastGoal.operationId ? null : g))}
        />
      )}
    </div>
  );
}
