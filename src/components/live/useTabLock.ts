import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * - `checking`: ainda sem resposta do navegador.
 * - `owner`: esta aba envia e grava a fila.
 * - `follower`: outra aba ou janela é a dona; esta só consulta.
 */
export type TabRole = 'checking' | 'owner' | 'follower';

/**
 * Uma só aba por rodada escreve a fila do mesário. Com duas abas abertas, cada uma
 * regravava o localStorage com a sua cópia e apagava os lances da outra.
 *
 * Usa Web Locks: a dona segura o lock enquanto estiver aberta; as outras esperam na fila
 * e assumem sozinhas quando ela fecha, ou na hora com `takeOver()`. Sem suporte (ou fora
 * de contexto seguro), toda aba é dona — o comportamento de antes.
 */
export function useTabLock(name: string) {
  const [role, setRole] = useState<TabRole>('checking');
  const [takeOvers, setTakeOvers] = useState(0);
  const stealRef = useRef(false);
  useEffect(() => {
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    if (!locks) {
      setRole('owner');
      return;
    }
    const controller = new AbortController();
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    const own = async (lock: Lock | null) => {
      if (!lock) return false;
      setRole('owner');
      await held;
      return true;
    };
    let steal = stealRef.current;
    stealRef.current = false;
    void (async () => {
      for (;;) {
        try {
          if (steal) await locks.request(name, { steal: true }, own);
          else if (!(await locks.request(name, { ifAvailable: true }, own))) {
            setRole('follower');
            await locks.request(name, { signal: controller.signal }, own);
          }
          return;
        } catch (error) {
          if (controller.signal.aborted) return;
          if ((error as { name?: unknown } | null)?.name !== 'AbortError') {
            // Lock indisponível por outro motivo (contexto restrito): segue como antes,
            // sem trava entre abas, em vez de tentar de novo sem parar.
            setRole('owner');
            return;
          }
          // Outra aba tocou em "Usar nesta aba": esta vira consulta e volta para a fila.
          steal = false;
          setRole('follower');
        }
      }
    })();
    return () => {
      controller.abort();
      release();
    };
  }, [name, takeOvers]);
  const takeOver = useCallback(() => {
    stealRef.current = true;
    setTakeOvers((n) => n + 1);
  }, []);
  return { role, takeOver };
}
