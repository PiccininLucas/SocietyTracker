import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ModalPortal } from '../ui/ModalPortal';

/**
 * Alerta de tela cheia quando o cronômetro zera. O apito pode não tocar (som bloqueado,
 * celular no silencioso) e o iOS não vibra: o aviso visual é o que sempre chega.
 *
 * A partida não encerra sozinha — sempre há um último lance, e quem finaliza é o mesário.
 */
export function TimeUpOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <ModalPortal label="Tempo esgotado" onClose={onDismiss}>
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-rose-700 p-6 text-center text-white motion-safe:animate-pulse"
        onClick={onDismiss}
      >
        <AlertTriangle className="h-20 w-20" aria-hidden="true" />
        <p className="font-display text-5xl font-black tracking-tight">TEMPO ESGOTADO</p>
        <p className="max-w-xs text-lg font-semibold">
          Aguarde a bola sair e toque em “Finalizar partida”.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[52px] rounded-xl bg-white px-8 text-lg font-black text-rose-700"
        >
          Entendi
        </button>
      </div>
    </ModalPortal>
  );
}
