import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Undo2 } from 'lucide-react';

interface UndoToastProps {
  label: string;
  /** Fim da janela (epoch ms): depois disso o lance vai para o servidor. */
  sendAfter: number;
  windowMs: number;
  onUndo: () => void;
  onExpire: () => void;
}

/**
 * Aviso de "Desfazer" do último gol. Fica no body (portal) para não ficar atrás da
 * navegação inferior nem do header, que têm z-index próprio.
 */
export function UndoToast({ label, sendAfter, windowMs, onUndo, onExpire }: UndoToastProps) {
  const [now, setNow] = useState(() => Date.now());
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 200);
    const expire = window.setTimeout(
      () => expireRef.current(),
      Math.max(0, sendAfter - Date.now())
    );
    return () => {
      clearInterval(tick);
      clearTimeout(expire);
    };
  }, [sendAfter]);
  const left = Math.max(0, sendAfter - now);
  if (typeof document === 'undefined' || left <= 0) return null;
  return createPortal(
    <div className="fixed inset-x-0 bottom-24 md:bottom-6 z-[90] flex justify-center px-4 pointer-events-none">
      <div
        role="status"
        className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-gray-900 shadow-2xl animate-slide-up"
      >
        <div className="flex items-center gap-3 p-3">
          <p className="flex-1 text-sm font-semibold text-white">{label}</p>
          <button
            type="button"
            onClick={onUndo}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 font-black text-gray-950 touch-press-scale"
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" />
            Desfazer
          </button>
        </div>
        <div
          className="h-1 origin-left bg-amber-400 transition-transform duration-200 ease-linear"
          style={{ transform: `scaleX(${Math.min(1, left / windowMs)})` }}
          aria-hidden="true"
        />
      </div>
    </div>,
    document.body
  );
}
