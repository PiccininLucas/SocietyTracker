import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Unlock,
  Delete,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';
import { cn } from '../ui/utils';
import { soundFx } from '../ui/audio';
import { hapticFeedback } from '../ui/vibration';

interface PinLoginPadProps {
  redirectUrl?: string;
}

export const PinLoginPad: React.FC<PinLoginPadProps> = ({
  redirectUrl = '/rodada/mesario',
}) => {
  const [pin, setPin] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmitPin = useCallback(
    async (completedPin: string) => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: completedPin }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'PIN incorreto.');
        }

        // Sucesso!
        setIsSuccess(true);
        soundFx.playClickBeep('high');
        hapticFeedback.goal();

        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 500);
      } catch (err: any) {
        soundFx.playClickBeep('low');
        hapticFeedback.cancel();
        setIsShaking(true);
        setErrorMessage(err.message || 'PIN incorreto. Tente novamente.');
        setPin('');
        setTimeout(() => setIsShaking(false), 500);
      } finally {
        setIsLoading(false);
      }
    },
    [redirectUrl]
  );

  const handleKeyPress = useCallback(
    (digit: string) => {
      if (isLoading || isSuccess || pin.length >= 4) return;

      soundFx.playClickBeep('normal');
      hapticFeedback.click();

      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMessage(null);

      if (nextPin.length === 4) {
        handleSubmitPin(nextPin);
      }
    },
    [pin, isLoading, isSuccess, handleSubmitPin]
  );

  const handleDelete = useCallback(() => {
    if (isLoading || isSuccess || pin.length === 0) return;
    soundFx.playClickBeep('low');
    hapticFeedback.click();
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  }, [isLoading, isSuccess, pin.length]);

  const handleClear = useCallback(() => {
    if (isLoading || isSuccess || pin.length === 0) return;
    soundFx.playClickBeep('low');
    hapticFeedback.click();
    setPin('');
    setErrorMessage(null);
  }, [isLoading, isSuccess, pin.length]);

  // Suporte a teclado físico
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress, handleDelete, handleClear]);

  const numpadDigits = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
  ];

  return (
    <div className="w-full max-w-sm mx-auto p-6 rounded-3xl glass-card-glow bg-surface-100/95 border border-white/10 shadow-2xl space-y-6 animate-scale-up select-none">
      {/* Top Header */}
      <div className="text-center space-y-2">
        <div
          className={cn(
            'w-16 h-16 rounded-3xl mx-auto flex items-center justify-center transition-all duration-300 shadow-xl',
            isSuccess
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 scale-110'
              : errorMessage
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          )}
        >
          {isSuccess ? (
            <Unlock className="w-8 h-8 animate-bounce-short" />
          ) : (
            <KeyRound className="w-8 h-8" />
          )}
        </div>

        <h2 className="font-display font-black text-2xl text-white">
          Acesso do Mesário
        </h2>
        <p className="text-xs text-gray-400 max-w-xs mx-auto">
          Digite o PIN de 4 dígitos para gerenciar a rodada e lançar gols
        </p>
      </div>

      {/* 4 Indicadores de Dígitos (Dots) */}
      <div
        className={cn(
          'flex items-center justify-center gap-4 py-2 transition-transform',
          isShaking && 'animate-bounce-short'
        )}
      >
        {[0, 1, 2, 3].map((index) => {
          const isFilled = pin.length > index;
          return (
            <div
              key={index}
              className={cn(
                'w-4 h-4 rounded-full border-2 transition-all duration-200',
                isSuccess
                  ? 'bg-emerald-400 border-emerald-400 shadow-lg shadow-emerald-500/50 scale-110'
                  : isFilled
                  ? 'bg-emerald-500 border-emerald-400 shadow-md shadow-emerald-500/40 scale-125'
                  : 'bg-surface-50 border-white/20'
              )}
            />
          );
        })}
      </div>

      {/* Mensagem de Erro / Sucesso */}
      <div className="min-h-[24px] text-center">
        {isSuccess && (
          <span className="text-xs font-bold text-emerald-400 animate-fade-in flex items-center justify-center gap-1">
            <ShieldCheck className="w-4 h-4" />
            <span>PIN Correto! Redirecionando...</span>
          </span>
        )}
        {errorMessage && !isSuccess && (
          <span className="text-xs font-bold text-rose-400 animate-fade-in flex items-center justify-center gap-1">
            <ShieldAlert className="w-4 h-4" />
            <span>{errorMessage}</span>
          </span>
        )}
      </div>

      {/* Teclado Numérico Ergonômico */}
      <div className="space-y-2.5">
        {numpadDigits.map((row, rIdx) => (
          <div key={rIdx} className="grid grid-cols-3 gap-2.5">
            {row.map((digit) => (
              <button
                key={digit}
                type="button"
                disabled={isLoading || isSuccess}
                onClick={() => handleKeyPress(digit)}
                className="h-14 sm:h-16 rounded-2xl bg-surface-200/90 hover:bg-surface-50 border border-white/5 hover:border-emerald-500/40 text-white font-display font-black text-2xl flex items-center justify-center transition-all shadow-md active:scale-95 disabled:opacity-50 touch-press-scale"
              >
                {digit}
              </button>
            ))}
          </div>
        ))}

        {/* Última Linha: Limpar, 0, Backspace */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            disabled={isLoading || isSuccess || pin.length === 0}
            onClick={handleClear}
            className="h-14 sm:h-16 rounded-2xl bg-surface-200/50 hover:bg-surface-50 border border-white/5 text-gray-400 hover:text-white font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-30"
            title="Limpar PIN"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-[10px]">Limpar</span>
          </button>

          <button
            type="button"
            disabled={isLoading || isSuccess}
            onClick={() => handleKeyPress('0')}
            className="h-14 sm:h-16 rounded-2xl bg-surface-200/90 hover:bg-surface-50 border border-white/5 hover:border-emerald-500/40 text-white font-display font-black text-2xl flex items-center justify-center transition-all shadow-md active:scale-95 disabled:opacity-50 touch-press-scale"
          >
            0
          </button>

          <button
            type="button"
            disabled={isLoading || isSuccess || pin.length === 0}
            onClick={handleDelete}
            className="h-14 sm:h-16 rounded-2xl bg-surface-200/50 hover:bg-surface-50 border border-white/5 text-gray-400 hover:text-white font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-30"
            title="Apagar último dígito"
          >
            <Delete className="w-4 h-4" />
            <span className="text-[10px]">Apagar</span>
          </button>
        </div>
      </div>

      {/* Nota de Sessão de 24h & Voltar */}
      <div className="pt-2 border-t border-white/5 flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Sessão autenticada válida por 24 horas</span>
        </div>

        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar para a Classificação Pública</span>
        </a>
      </div>
    </div>
  );
};
