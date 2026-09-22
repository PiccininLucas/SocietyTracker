import { useEffect } from 'react';

/**
 * Mantém a tela ligada enquanto `enabled`. Sem isso o celular apagava no meio da partida e
 * o apito de fim de tempo só tocava com a tela acesa.
 *
 * O navegador solta a trava sozinho quando a aba vai para segundo plano; ela é pedida de
 * novo quando a aba volta a ficar visível.
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let requesting = false;
    let cancelled = false;
    const acquire = async () => {
      if (cancelled || sentinel || requesting || document.visibilityState !== 'visible') return;
      requesting = true;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
        lock.addEventListener('release', () => {
          if (sentinel === lock) sentinel = null;
        });
      } catch {
        // Recusado (economia de bateria, aba sem foco): a partida segue sem a trava.
      } finally {
        requesting = false;
      }
    };
    const onVisibility = () => void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    void acquire();
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [enabled]);
}
