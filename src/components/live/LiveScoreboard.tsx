import React, { useEffect, useState } from 'react';
import { GoalDrawer } from './GoalDrawer';
import { MatchTimer } from './MatchTimer';
import { MatchEditor, actionClass } from './MatchEditor';
import { timerNow, type TimerState, type PendingCommand } from './matchSync';
import type { MatchSummary } from '../../core/domain/repositories/IMatchRepository';
import type { LiveTeam } from './types';
export interface LiveScoreboardProps {
  match: MatchSummary;
  teams: LiveTeam[];
  duration: number;
  timer?: TimerState;
  pending: boolean;
  finishing: boolean;
  onTimer: (timer: TimerState) => void;
  onCommand: (command: Omit<PendingCommand, 'operationId'>) => void;
  onNext: () => void;
}
export function LiveScoreboard({
  match,
  teams,
  duration,
  timer,
  pending,
  finishing,
  onTimer,
  onCommand,
  onNext,
}: LiveScoreboardProps) {
  const initial: TimerState = {
    remaining: Math.max(0, duration - match.durationSeconds),
    elapsed: match.durationSeconds,
    running: false,
    anchor: Date.now(),
  };
  const clock = timer ?? initial;
  const [, tick] = useState(0),
    [goalTeam, setGoalTeam] = useState<LiveTeam | null>(null);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, []);
  const now = timerNow(clock);
  const ended = match.status === 'finished';
  useEffect(() => {
    if (ended && timer?.running)
      onTimer({ ...timer, ...timerNow(timer), running: false, anchor: Date.now() });
  }, [ended]);
  const changeTimer = (change: Partial<TimerState>) =>
    onTimer({ ...clock, ...now, ...change, anchor: Date.now() });
  const team = (home: boolean): LiveTeam => {
    const id = (home ? match.homeTeamId : match.awayTeamId)!;
    const current = teams.find((t) => t.id === id);
    return {
      id,
      name: home ? match.homeTeamName : match.awayTeamName,
      colorHex: home ? match.homeTeamColor : match.awayTeamColor,
      players: current?.players ?? (home ? match.homePlayers : match.awayPlayers) ?? [],
    };
  };
  return (
    <section className="space-y-4" aria-label="Partida atual">
      <h2 className="text-lg font-bold">Partida #{match.sequence ?? '—'}</h2>
      <MatchTimer
        secondsRemaining={now.remaining}
        totalDuration={duration}
        isRunning={clock.running && !ended}
        onToggleRunning={() => changeTimer({ running: !clock.running })}
        onAddMinute={() => changeTimer({ remaining: now.remaining + 60 })}
        onReset={() => {
          if (window.confirm('Reiniciar somente o cronômetro? Os gols serão preservados.'))
            changeTimer({ remaining: duration, elapsed: 0, running: false });
        }}
        disabled={ended || finishing}
      />
      {!ended && now.remaining === 0 && (
        <p
          role="status"
          className="rounded-xl bg-amber-500/15 border border-amber-400 p-3 text-amber-200 font-semibold"
        >
          Tempo regulamentar encerrado. Aguarde a bola sair e toque em “Finalizar partida”. Gols
          continuam liberados; dois gols encerram o jogo.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {[true, false].map((home) => (
          <div
            key={String(home)}
            className="glass-card rounded-2xl p-4 text-center border border-white/10"
          >
            <h3 className="font-bold text-base break-words">{team(home).name}</h3>
            <p
              className="font-display text-6xl font-black my-3"
              data-testid={home ? 'home-score' : 'away-score'}
            >
              {home ? match.homeScore : match.awayScore}
            </p>
            {!ended && !finishing && (
              <button
                className="w-full min-h-[52px] rounded-xl bg-emerald-500 text-gray-950 font-black"
                onClick={() => setGoalTeam(team(home))}
              >
                + Gol {team(home).name}
              </button>
            )}
          </div>
        ))}
      </div>
      {pending && (
        <p role="status" className="text-amber-200 text-sm">
          Alterações pendentes de sincronização. O próximo jogo aguarda a confirmação do servidor.
        </p>
      )}
      {ended ? (
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <p className="font-bold text-emerald-300">
            {match.homeScore === match.awayScore
              ? 'Empate'
              : (match.homeScore > match.awayScore ? match.homeTeamName : match.awayTeamName) +
                ' venceu'}{' '}
            · {match.endReason === 'two_goals' ? 'Regra dos dois gols' : 'Finalização manual'}
          </p>
          <button
            className={actionClass + ' w-full bg-emerald-600'}
            onClick={onNext}
            disabled={pending}
          >
            Próximo confronto
          </button>
        </div>
      ) : (
        <button
          disabled={finishing}
          className={actionClass + ' w-full bg-rose-700'}
          onClick={() => {
            if (
              window.confirm(
                'Finalizar esta partida com o placar ' +
                  match.homeScore +
                  ' × ' +
                  match.awayScore +
                  '?'
              )
            )
              onCommand({
                action: 'finish',
                matchId: match.matchId,
                input: { durationSeconds: now.elapsed },
              });
          }}
        >
          {finishing ? 'Finalizando…' : 'Finalizar partida'}
        </button>
      )}
      <MatchEditor match={match} busy={pending} onCommand={onCommand} />
      <GoalDrawer
        isOpen={!!goalTeam}
        team={goalTeam}
        onClose={() => setGoalTeam(null)}
        onConfirmGoal={(data) =>
          onCommand({
            action: 'goal',
            matchId: match.matchId,
            input: { ...data, eventTimeSeconds: now.elapsed },
          })
        }
      />
    </section>
  );
}
export default LiveScoreboard;
