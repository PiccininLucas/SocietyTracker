import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchSummary } from '../../core/domain/repositories/IMatchRepository';
import { MatchEditor, actionClass } from '../live/MatchEditor';
import { sendCommand, type PendingCommand } from '../live/matchSync';
import { ModalPortal } from './ModalPortal';
interface Props {
  matches?: MatchSummary[];
  initialMatchId?: string | null;
}
export function MatchDetailsModal({ initialMatchId = null }: Props) {
  const [match, setMatch] = useState<MatchSummary | null>(null),
    [open, setOpen] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [auth, setAuth] = useState(false),
    [busy, setBusy] = useState(false);
  const inflight = useRef(false),
    pending = useRef<PendingCommand | null>(null);
  const requestedMatchId = useRef('');
  const loadVersion = useRef(0);
  const load = useCallback(async (id: string) => {
    requestedMatchId.current = id;
    const version = ++loadVersion.current;
    setOpen(true);
    setLoading(true);
    setMatch(null);
    setNotice('');
    setError(pending.current ? 'Existe uma correção pendente. Tente salvar novamente.' : '');
    try {
      const res = await fetch('/api/matches/' + encodeURIComponent(id), {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (version === loadVersion.current) setMatch(data);
    } catch (e) {
      if (version === loadVersion.current)
        setError(e instanceof Error ? e.message : 'Falha ao carregar partida.');
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void fetch('/api/auth/status')
      .then((r) => r.json())
      .then((d) => setAuth(d.isAuthenticated))
      .catch(() => setAuth(false));
    const listener = (e: Event) => {
      const d = (e as CustomEvent<{ matchId: string }>).detail;
      if (d?.matchId) void load(d.matchId);
    };
    window.addEventListener('open-match-details', listener);
    const id = new URLSearchParams(location.search).get('match') ?? initialMatchId;
    if (id) void load(id);
    return () => window.removeEventListener('open-match-details', listener);
  }, [load, initialMatchId]);
  const submit = async (command?: Omit<PendingCommand, 'operationId'>) => {
    if (inflight.current) return;
    if (command) pending.current = { ...command, operationId: crypto.randomUUID() };
    if (!pending.current) return;
    inflight.current = true;
    setBusy(true);
    setError('');
    // Also survives closing the tab between commit and response.
    const storageKey = 'society_history_pending';
    try {
      localStorage.setItem(storageKey, JSON.stringify(pending.current));
      const updated = await sendCommand(pending.current);
      setMatch(updated);
      pending.current = null;
      localStorage.removeItem(storageKey);
      window.dispatchEvent(new CustomEvent('match-updated', { detail: updated }));
      setNotice('Correção salva. Placar e estatísticas atualizados.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    try {
      const saved = localStorage.getItem('society_history_pending');
      if (saved) {
        pending.current = JSON.parse(saved);
        if (pending.current?.matchId)
          void load(pending.current.matchId).then(() =>
            setError('Há uma correção pendente da última visita. Tente salvar novamente.')
          );
      }
    } catch {
      /* Retain original storage for manual recovery. */
    }
  }, [load]);
  if (!open) return null;
  return (
    <ModalPortal
      label="Detalhes da partida"
      onClose={() => {
        if (!busy) setOpen(false);
      }}
    >
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3">
        <section className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto bg-surface-100 rounded-3xl border border-white/20 p-4 sm:p-6 space-y-4 pb-safe">
          <div className="flex justify-between gap-3 items-center">
            <h2 className="font-display text-xl font-bold">
              Súmula · partida #{match?.sequence ?? '—'}
            </h2>
            <button className={actionClass} disabled={busy} onClick={() => setOpen(false)}>
              Fechar
            </button>
          </div>
          {loading && <p role="status">Carregando súmula…</p>}
          {error && (
            <div role="alert" className="text-rose-300">
              <p>{error}</p>
              {pending.current ? (
                <>
                  <button className={actionClass} disabled={busy} onClick={() => void submit()}>
                    Tentar salvar novamente
                  </button>
                  <button
                    className={actionClass + ' mt-2'}
                    disabled={busy}
                    onClick={() => {
                      if (
                        !window.confirm(
                          'Descartar esta correção pendente e recarregar os dados salvos no servidor?'
                        )
                      )
                        return;
                      try {
                        localStorage.removeItem('society_history_pending');
                        pending.current = null;
                        void load(requestedMatchId.current);
                      } catch {
                        setError('Não foi possível atualizar o armazenamento do dispositivo.');
                      }
                    }}
                  >
                    Descartar correção pendente
                  </button>
                </>
              ) : (
                requestedMatchId.current && (
                  <button
                    className={actionClass}
                    onClick={() => void load(requestedMatchId.current)}
                  >
                    Tentar carregar novamente
                  </button>
                )
              )}
            </div>
          )}
          {notice && (
            <p role="status" className="text-emerald-300">
              {notice}
            </p>
          )}
          {match && !loading && (
            <>
              <p className="text-xs text-gray-400">
                Rodada de {match.sessionDate.split('-').reverse().join('/')}
              </p>
              <p className="font-display text-2xl font-black">
                {match.homeTeamName} {match.homeScore} × {match.awayScore} {match.awayTeamName}
              </p>
              <MatchEditor
                match={match}
                canEdit={auth}
                busy={busy || !!pending.current}
                onCommand={(c) => void submit(c)}
              />
              {[true, false].map((home) => (
                <details key={String(home)} open>
                  <summary className="min-h-[44px] font-bold cursor-pointer">
                    {home ? match.homeTeamName : match.awayTeamName} · participantes
                  </summary>
                  <ul className="text-sm space-y-2">
                    {(home ? match.homePlayers : match.awayPlayers)?.map((p) => (
                      <li key={p.id} className="flex flex-wrap gap-2 p-2 bg-surface-200 rounded-lg">
                        <span>
                          {p.nickname || p.name}
                          {p.isCaptain ? ' · capitão' : ''}
                          {p.isGoalkeeper ? ' · goleiro' : ''}
                          {p.isLoaned ? ' · emprestado' : ''}
                        </span>
                        <span className="text-emerald-300">
                          {p.goals} G · {p.assists} A
                        </span>
                        {p.inferred && (
                          <small className="text-amber-300">Escalação histórica inferida</small>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </>
          )}
        </section>
      </div>
    </ModalPortal>
  );
}
