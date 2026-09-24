import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Aviso curto de confirmação ("PNG baixado", "Imagem copiada"). Vai para o body: dentro do
 * <main> do Layout, que é relative z-10, um fixed z-50 ficava embaixo do cabeçalho.
 */
export function Toast({ message }: { message: string }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="status"
      className="fixed right-5 z-[100] max-w-[calc(100vw-2.5rem)] bg-emerald-500 text-gray-950 px-4 py-2.5 rounded-2xl font-bold text-sm shadow-2xl flex items-center gap-2 animate-bounce-short"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)' }}
    >
      <span aria-hidden="true">✅</span>
      <span>{message}</span>
    </div>,
    document.body
  );
}
