import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchSummary } from '../../core/domain/repositories/IMatchRepository';
import {
  readCache,
  applyMatchResult,
  remapMatchId,
  saveCache,
  sendCommand,
  retryDelay,
  cacheKey,
  CommandRejectedError,
  AuthRequiredError,
  describeNetworkError,
  type PendingCommand,
  type SessionCache,
  type TimerState,
} from './matchSync';
interface Options {
  /**
   * Só a aba que detém o lock do mesário envia e grava (useTabLock). As outras apenas
   * espelham o que a dona salva no localStorage.
   */
  active?: boolean;
}
export function useMatchSession(sessionId: string, { active = true }: Options = {}) {
  const ref = useRef<SessionCache>({ version: 2, sessionId, pending: [], timers: {}, matches: [] });
  const [cache, setCache] = useState(ref.current);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [legacyCache, setLegacyCache] = useState<string | null>(null);
  // Sessão expirada: a fila fica parada (e intacta) até o mesário entrar de novo.
  const [needsLogin, setNeedsLogin] = useState(false);
  const pumping = useRef(false);
  // Pedido de envio feito enquanto outro estava em curso (por exemplo, um gol registrado
  // durante o refresh final): sem isso o lance ficava parado até o próximo gatilho.
  const rerun = useRef(false);
  const revision = useRef(0);
  const activeRef = useRef(active);
  activeRef.current = active;
  // Próximo envio agendado: fim da retenção do "Desfazer" ou nova tentativa com backoff.
  const retryTimer = useRef<number | undefined>(undefined);
  const attempt = useRef(0);
  // Operação enviada e ainda sem resposta: não pode mais ser desfeita.
  const inFlight = useRef<string | null>(null);
  const commit = useCallback((next: SessionCache) => {
    // Uma aba que perdeu o lock não grava: um envio em voo dela sobrescreveria a fila da aba
    // que assumiu. O lance que ela mandou será reenviado pela dona com a mesma chave.
    if (!activeRef.current) return;
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
      // Um 502/504 do gateway responde HTML; sem o catch o mesário via "Unexpected token '<'".
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Servidor indisponível no momento.');
      if (requestRevision === revision.current)
        commit({ ...ref.current, matches: data as MatchSummary[] });
      if (!ref.current.pending.length) setError('');
      setReady(true);
      return true;
    } catch (e) {
      setError(describeNetworkError(e));
      return false;
    }
  }, [sessionId, commit]);
  const flush = useCallback(async () => {
    if (!activeRef.current) return;
    if (pumping.current) {
      rerun.current = true;
      return;
    }
    window.clearTimeout(retryTimer.current);
    pumping.current = true;
    rerun.current = false;
    let rejected = '';
    let held = false;
    try {
      while (ref.current.pending.length && activeRef.current) {
        const op = ref.current.pending[0];
        const wait = (op.sendAfter ?? 0) - Date.now();
        if (wait > 0) {
          // Retida para o "Desfazer": não é falha, só ainda não é hora de enviar.
          held = true;
          retryTimer.current = window.setTimeout(() => void flush(), wait);
          break;
        }
        let match: MatchSummary;
        inFlight.current = op.operationId;
        try {
          match = await sendCommand(op);
        } catch (e) {
          if (e instanceof AuthRequiredError) setNeedsLogin(true);
          if (!(e instanceof CommandRejectedError)) throw e;
          // Recusa definitiva do servidor: reenviar não muda nada e a operação
          // bloquearia todos os lances seguintes da fila. Descarta e segue. Se foi o início
          // de uma partida, os lances enfileirados para ela vão junto — cada um receberia
          // um 404 que só esconderia o motivo real.
          rejected = e.message;
          revision.current++;
          const timers = { ...ref.current.timers };
          if (op.action === 'start') delete timers[op.operationId];
          commit({
            ...ref.current,
            timers,
            pending: ref.current.pending.filter(
              (p) =>
                p.operationId !== op.operationId &&
                !(op.action === 'start' && p.matchId === op.operationId)
            ),
          });
          continue;
        } finally {
          inFlight.current = null;
        }
        attempt.current = 0;
        setNeedsLogin(false);
        revision.current++;
        let next: SessionCache = {
          ...applyMatchResult(ref.current, match),
          pending: ref.current.pending.filter((p) => p.operationId !== op.operationId),
        };
        if (op.action === 'start') next = remapMatchId(next, op.operationId, match.matchId);
        commit(next);
        setError('');
        setNotice(match.deletedAt ? 'Partida apagada. Estatísticas atualizadas.' : op.action === 'finish' ? 'Partida finalizada e salva.' : 'Alteração salva.');
      }
      if (!held) await refresh();
      if (rejected)
        setError(rejected + ' O registro foi descartado; confira a súmula antes de seguir.');
    } catch (e) {
      if (e instanceof AuthRequiredError) {
        // Sem reenvio automático: só um novo login resolve.
        setError(e.message + ' A operação está pendente neste dispositivo.');
      } else {
        const delay = retryDelay(attempt.current++);
        retryTimer.current = window.setTimeout(() => void flush(), delay);
        setError(
          describeNetworkError(e) +
            ' A operação está pendente neste dispositivo. Nova tentativa automática em ' +
            Math.round(delay / 1000) +
            's.'
        );
      }
    } finally {
      pumping.current = false;
      if (rerun.current) {
        rerun.current = false;
        void flush();
      }
    }
  }, [commit, refresh]);
  useEffect(() => {
    ref.current = readCache(sessionId);
    setCache(ref.current);
    // Sem nada no aparelho, espera o servidor: mostrar "Iniciar partida" antes disso
    // permitiria iniciar por cima de uma partida já em andamento.
    setReady(ref.current.matches.length > 0 || !active);
    if (!active) {
      // Aba seguidora: mostra o que a dona grava, sem enviar nem escrever nada.
      const mirror = (e: StorageEvent) => {
        if (e.key !== cacheKey(sessionId)) return;
        ref.current = readCache(sessionId);
        setCache(ref.current);
      };
      window.addEventListener('storage', mirror);
      return () => window.removeEventListener('storage', mirror);
    }
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
    const online = () => {
      attempt.current = 0;
      void flush();
    };
    const visible = () => {
      if (document.visibilityState !== 'visible' || pumping.current) return;
      // O navegador congela timers em segundo plano: ao voltar, envia o que ficou na fila.
      if (ref.current.pending.length) void flush();
      else void refresh();
    };
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', visible);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !pumping.current) void refresh();
    }, 10000);
    return () => {
      clearInterval(interval);
      window.clearTimeout(retryTimer.current);
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [sessionId, active, refresh, flush]);
  const enqueue = (command: Omit<PendingCommand, 'operationId'>): PendingCommand | null => {
    if (!activeRef.current) return null;
    if (command.action === 'remove_match' && ref.current.pending.length) return null;
    const op: PendingCommand = { ...command, operationId: crypto.randomUUID() };
    try {
      commit({ ...ref.current, pending: [...ref.current.pending, op] });
      revision.current++;
      setNotice('Salvo no dispositivo; sincronizando…');
      void flush();
      return op;
    } catch {
      setError(
        'Não foi possível salvar no dispositivo. Libere espaço antes de registrar outro lance.'
      );
      return null;
    }
  };
  /**
   * Desfaz um lance ainda retido. Só vale antes do fim da retenção: depois dela o lance pode
   * já ter chegado ao servidor, mesmo que a resposta tenha se perdido.
   */
  const cancel = (operationId: string) => {
    const op = ref.current.pending.find((p) => p.operationId === operationId);
    if (
      !activeRef.current ||
      !op ||
      inFlight.current === operationId ||
      (op.sendAfter ?? 0) <= Date.now()
    )
      return false;
    try {
      revision.current++;
      commit({
        ...ref.current,
        pending: ref.current.pending.filter((p) => p.operationId !== operationId),
      });
      setNotice('Gol desfeito.');
      void flush();
      return true;
    } catch {
      setError('Falha ao salvar no dispositivo.');
      return false;
    }
  };
  const setTimer = (id: string, timer: TimerState) => {
    if (!activeRef.current) return;
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
  const retry = () => {
    attempt.current = 0;
    void flush();
  };
  return {
    cache,
    ready,
    error,
    notice,
    needsLogin,
    legacyCache,
    enqueue,
    cancel,
    setTimer,
    retry,
    refresh,
    discard,
  };
}
