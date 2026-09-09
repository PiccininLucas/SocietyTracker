import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
export function ModalPortal({
  children,
  onClose,
  label,
}: {
  children: React.ReactNode;
  onClose: () => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === 'Tab') {
        const nodes = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),select,input,[tabindex="0"],a[href]'
          ) ?? []
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (!first) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    ref.current?.addEventListener('keydown', handler);
    const element = ref.current;
    return () => {
      element?.removeEventListener('keydown', handler);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="relative z-[100] outline-none"
    >
      {children}
    </div>,
    document.body
  );
}
