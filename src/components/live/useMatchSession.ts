import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchSummary } from '../../core/domain/repositories/IMatchRepository';
import {
  readCache,
  saveCache,
  sendCommand,
  type PendingCommand,
  type SessionCache,
  type TimerState,
} from './matchSync';
export function useMatchSession(sessionId: string) {
  const ref = useRef<SessionCache>({ version: 2, sessionId, pending: [], timers: {}, matches: [] });
  const [cache, setCache] = useState(ref.current);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [legacyCache, setLegacyCache] = useState<string | null>(null);
  const pumping = useRef(false);
  const revision = useRef(0);
  const commit = useCallback((next: SessionCache) => {
    saveCache(next);
    ref.current = next;
    setCache(next);
  }, []);
  const refresh = useCallback(async () => {
    const requestRevision = revision.current;
    try {
      const res = await fetch('/api/sessions/' + sessionId + '/matches', {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (requestRevision === revision.current)
        commit({ ...ref.current, matches: data as MatchSummary[] });
      if (!ref.current.pending.length) setError('');
      setReady(true);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sem conexão.');
      return false;
    }
  }, [sessionId, commit]);
  const flush = useCallback(async () => {
    if (pumping.current) return;
    pumping.current = true;
    try {
      while (ref.current.pending.length) {
        const op = ref.current.pending[0];
        const match = await sendCommand(op);
        revision.current++;
        commit({
          ...ref.current,
          matches: [...ref.current.matches.filter((m) => m.matchId !== match.matchId), match],
          pending: ref.current.pending.filter((p) => p.operationId !== op.operationId),
        });
        setError('');
        setNotice(op.action === 'finish' ? 'Partida finalizada e salva.' : 'Alteração salva.');
      }
      await refresh();
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : 'Falha de rede.') +
          ' A operação está pendente neste dispositivo.'
      );
    } finally {
      pumping.current = false;
    }
  }, [commit, refresh]);
  useEffect(() => {
    ref.current = readCache(sessionId);
    setCache(ref.current);
    if (ref.current.matches.length) setReady(true);
    // Keep the old cache intact: it has no server acknowledgements or trustworthy event IDs.
    const old = localStorage.getItem('society_active_match_state');
    if (old) {
      try {
        const legacy = JSON.parse(old);
        if (legacy.match?.sessionId === sessionId) {
          setLegacyCache(old);
          setNotice(
            'Registros da versão anterior preservados. Confira a súmula salva no histórico antes de relançar eventos antigos.'
          );
        }
      } catch {
        setLegacyCache(old);
      }
    }
    void refresh().then(() => flush());
    const online = () => void flush(),
      visible = () => {
        if (document.visibilityState === 'visible' && !pumping.current) void refresh();
      };
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', visible);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !pumping.current) void refresh();
    }, 10000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [sessionId, refresh, flush]);
  const enqueue = (command: Omit<PendingCommand, 'operationId'>) => {
    const op = { ...command, operationId: crypto.randomUUID() };
    try {
      commit({ ...ref.current, pending: [...ref.current.pending, op] });
      revision.current++;
      setNotice('Salvo no dispositivo; sincronizando…');
      void flush();
      return true;
    } catch {
      setError(
        'Não foi possível salvar no dispositivo. Libere espaço antes de registrar outro lance.'
      );
      return false;
    }
  };
  const setTimer = (id: string, timer: TimerState) => {
    try {
      commit({ ...ref.current, timers: { ...ref.current.timers, [id]: timer } });
    } catch {
      setError('Não foi possível guardar o cronômetro neste dispositivo.');
    }
  };
  const discard = () => {
    if (
      pumping.current ||
      !window.confirm(
        'Descartar a primeira operação pendente? O estado salvo no servidor será recarregado.'
      )
    )
      return;
    try {
      commit({ ...ref.current, pending: ref.current.pending.slice(1) });
      setError('');
      void flush();
    } catch {
      setError('Falha ao salvar no dispositivo.');
    }
  };
  return {
    cache,
    ready,
    error,
    notice,
    legacyCache,
    enqueue,
    setTimer,
    retry: flush,
    refresh,
    discard,
  };
}
