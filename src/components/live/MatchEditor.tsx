import React, { useState } from 'react';
import { Pencil, Trash2, LockKeyhole } from 'lucide-react';
import type {
  MatchSummary,
  MatchSummaryEvent,
} from '../../core/domain/repositories/IMatchRepository';
import type { PendingCommand } from './matchSync';
import { ModalPortal } from '../ui/ModalPortal';
export const actionClass =
  'min-h-[44px] px-3 py-2 rounded-xl border border-white/15 bg-surface-200 text-white font-semibold text-sm disabled:opacity-40';
export function MatchEditor({
  match,
  canEdit = true,
  busy = false,
  onCommand,
}: {
  match: MatchSummary;
  canEdit?: boolean;
  busy?: boolean;
  onCommand: (command: Omit<PendingCommand, 'operationId'>) => void;
}) {
  const [editing, setEditing] = useState<MatchSummaryEvent | null>(null);
  const [scorer, setScorer] = useState(''),
    [assist, setAssist] = useState(''),
    [team, setTeam] = useState(''),
    [own, setOwn] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false),
    [home, setHome] = useState(0),
    [away, setAway] = useState(0);
  const editable = canEdit && match.editable === true && !match.lockedAt && !busy;
  const players = team === match.homeTeamId ? (match.homePlayers ?? []) : (match.awayPlayers ?? []);
  const label = (p: { name: string; nickname: string | null }) => p.nickname || p.name;
  const begin = (event: MatchSummaryEvent) => {
    setEditing(event);
    setScorer(event.scorerId ?? '');
    setAssist(event.assistId ?? '');
    setTeam(event.teamId);
    setOwn(event.isOwnGoal);
  };
  const close = () => {
    setEditing(null);
    setScoreOpen(false);
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs text-gray-300">
          {match.lockedAt ? (
            <>
              <LockKeyhole className="inline w-4 h-4" /> Consolidada · somente leitura
            </>
          ) : match.status === 'finished' ? (
            'Correções disponíveis nas três últimas partidas'
          ) : (
            'Súmula da partida'
          )}
        </span>
        {editable && (
          <button
            className={actionClass}
            onClick={() => {
              setHome(match.homeScore);
              setAway(match.awayScore);
              setScoreOpen(true);
            }}
          >
            Corrigir placar
          </button>
        )}
      </div>
      {(match.events ?? []).length === 0 && (
        <p className="text-gray-400 text-sm">Nenhum gol registrado.</p>
      )}
      {(match.events ?? []).map((event) => (
        <div key={event.id} className="rounded-xl p-3 bg-surface-200/70 border border-white/10">
          <p className="text-white text-sm font-semibold">
            ⚽ {event.isOwnGoal ? 'Gol contra' : event.scorerName || 'Autoria não informada'}{' '}
            <span className="text-gray-400 text-xs">
              {Math.floor(event.eventTimeSeconds / 60)}:
              {String(event.eventTimeSeconds % 60).padStart(2, '0')}
            </span>
          </p>
          <p className="text-xs text-gray-300 mt-1">
            {event.teamId === match.homeTeamId ? match.homeTeamName : match.awayTeamName}
            {event.isOwnGoal ? ' · ponto para o adversário' : ''}
          </p>
          {!event.isOwnGoal && (
            <p className="text-xs text-cyan-300 mt-1">
              {event.assistId
                ? 'Assistência: ' + (event.assistName || 'Jogador')
                : 'Sem assistência'}
            </p>
          )}
          {editable && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                className={actionClass + ' flex items-center gap-2'}
                onClick={() => begin(event)}
                aria-label={'Editar gol de ' + (event.scorerName ?? 'autoria não informada')}
              >
                <Pencil className="w-4 h-4" />
                Editar gol
              </button>
              <button
                className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm flex gap-2 items-center"
                onClick={() => {
                  if (
                    window.confirm(
                      'Remover este gol de ' +
                        (event.scorerName ?? 'autoria não informada') +
                        '? O placar e as estatísticas serão atualizados.'
                    )
                  )
                    onCommand({
                      action: 'delete',
                      matchId: match.matchId,
                      input: { eventId: event.id },
                    });
                }}
              >
                <Trash2 className="w-4 h-4" />
                Remover gol
              </button>
            </div>
          )}
        </div>
      ))}
      {editable && (
        <div className="pt-3 border-t border-white/10">
          <button
            type="button"
            className="min-h-[44px] px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm flex gap-2 items-center"
            onClick={() => {
              if (window.confirm(
                'Apagar a partida #' + match.sequence + ': ' + match.homeTeamName + ' ' +
                match.homeScore + ' × ' + match.awayScore + ' ' + match.awayTeamName +
                '? Todos os gols, assistências e resultados desta partida deixarão de contar. Não é possível desfazer pelo aplicativo.'
              )) onCommand({ action: 'remove_match', matchId: match.matchId, input: {} });
            }}
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            Apagar partida
          </button>
        </div>
      )}
      {(editing || scoreOpen) && (
        <ModalPortal label={editing ? 'Editar gol' : 'Corrigir placar'} onClose={close}>
          <div className="fixed inset-0 z-[100] bg-black/80 flex items-end sm:items-center justify-center p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editable) return;
                if (editing)
                  onCommand({
                    action: 'edit',
                    matchId: match.matchId,
                    input: {
                      eventId: editing.id,
                      teamId: team,
                      scorerId: own ? null : scorer,
                      assistId: own ? null : assist || null,
                      isOwnGoal: own,
                    },
                  });
                else
                  onCommand({
                    action: 'score',
                    matchId: match.matchId,
                    input: { homeScore: home, awayScore: away },
                  });
                close();
              }}
              className="w-full max-w-md p-5 rounded-2xl bg-surface-100 border border-white/20 max-h-[85dvh] overflow-y-auto space-y-4 pb-safe"
            >
              <h3 className="text-xl font-bold">{editing ? 'Editar gol' : 'Corrigir placar'}</h3>
              {editing ? (
                <>
                  <label className="block text-sm">
                    Time
                    <select
                      aria-label="Time do gol"
                      className={actionClass + ' w-full mt-1'}
                      value={team}
                      onChange={(e) => {
                        setTeam(e.target.value);
                        setScorer('');
                        setAssist('');
                      }}
                    >
                      <option value={match.homeTeamId}>{match.homeTeamName}</option>
                      <option value={match.awayTeamId}>{match.awayTeamName}</option>
                    </select>
                  </label>
                  <label className="min-h-[44px] flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={own}
                      onChange={(e) => {
                        setOwn(e.target.checked);
                        setAssist('');
                      }}
                    />
                    Gol contra (ponto para o adversário)
                  </label>
                  {!own && (
                    <>
                      <label className="block text-sm">
                        Autor do gol
                        <select
                          aria-label="Autor do gol"
                          required
                          value={scorer}
                          className={actionClass + ' w-full mt-1'}
                          onChange={(e) => {
                            setScorer(e.target.value);
                            if (e.target.value === assist) setAssist('');
                          }}
                        >
                          <option value="">Selecione</option>
                          {players.map((p) => (
                            <option key={p.id} value={p.id}>
                              {label(p)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm">
                        Assistência
                        <select
                          aria-label="Assistência"
                          value={assist}
                          onChange={(e) => setAssist(e.target.value)}
                          className={actionClass + ' w-full mt-1'}
                        >
                          <option value="">Sem assistência</option>
                          {players
                            .filter((p) => p.id !== scorer)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {label(p)}
                              </option>
                            ))}
                        </select>
                      </label>
                    </>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-300">
                    Gols adicionais ficam como “Autoria não informada”. Para reduzir um placar com
                    autoria, remova o lance correspondente na súmula.
                  </p>
                  <label className="block">
                    {match.homeTeamName}
                    <input
                      aria-label="Gols mandante"
                      type="number"
                      min="0"
                      max="99"
                      required
                      className={actionClass + ' w-full'}
                      value={home}
                      onChange={(e) => setHome(Number(e.target.value))}
                    />
                  </label>
                  <label className="block">
                    {match.awayTeamName}
                    <input
                      aria-label="Gols visitante"
                      type="number"
                      min="0"
                      max="99"
                      required
                      className={actionClass + ' w-full'}
                      value={away}
                      onChange={(e) => setAway(Number(e.target.value))}
                    />
                  </label>
                </>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={close} className={actionClass}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!editable}
                  className={actionClass + ' bg-emerald-600'}
                >
                  Salvar correção
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
