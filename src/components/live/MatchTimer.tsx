import React, { useEffect, useMemo, useRef } from 'react';
import { Play, Pause, Plus, RotateCcw, AlertTriangle, Volume2 } from 'lucide-react';
import { cn } from '../ui/utils';
import { soundFx } from '../ui/audio';
import { hapticFeedback } from '../ui/vibration';
import { DEFAULT_MATCH_DURATION_SECONDS } from './types';

export interface MatchTimerProps {
  secondsRemaining: number;
  totalDuration?: number;
  isRunning: boolean;
  onToggleRunning: () => void;
  onAddMinute: () => void;
  onReset: () => void;
  onTimeExpired?: () => void;
  disabled?: boolean;
  className?: string;
}

export const MatchTimer: React.FC<MatchTimerProps> = ({
  secondsRemaining,
  totalDuration = DEFAULT_MATCH_DURATION_SECONDS,
  isRunning,
  onToggleRunning,
  onAddMinute,
  onReset,
  onTimeExpired,
  disabled = false,
  className,
}) => {
  const hasExpiredFiredRef = useRef(false);

  // Formata os segundos restantes para MM:SS
  const formattedTime = useMemo(() => {
    const clamped = Math.max(0, secondsRemaining);
    const mins = Math.floor(clamped / 60);
    const secs = clamped % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [secondsRemaining]);

  // Percentual restante (100% no início -> 0% ao zerar)
  const progressPercent = useMemo(() => {
    if (totalDuration <= 0) return 0;
    const pct = (Math.max(0, secondsRemaining) / totalDuration) * 100;
    return Math.min(100, Math.max(0, pct));
  }, [secondsRemaining, totalDuration]);

  // Alerta quando o tempo atinge 00:00
  useEffect(() => {
    if (secondsRemaining <= 0 && isRunning && !hasExpiredFiredRef.current) {
      hasExpiredFiredRef.current = true;
      soundFx.playWhistle();
      hapticFeedback.timeExpired();
      onTimeExpired?.();
    } else if (secondsRemaining > 0) {
      hasExpiredFiredRef.current = false;
    }
  }, [secondsRemaining, isRunning, onTimeExpired]);

  // Handler para Iniciar / Pausar
  const handleToggle = () => {
    if (disabled) return;
    hapticFeedback.click();
    soundFx.playClickBeep(isRunning ? 'low' : 'high');
    onToggleRunning();
  };

  // Handler para +1 Minuto (+60 segundos)
  const handleAddMinute = () => {
    if (disabled) return;
    hapticFeedback.click();
    soundFx.playClickBeep('normal');
    onAddMinute();
  };

  // Handler para Resetar
  const handleReset = () => {
    if (disabled) return;
    hapticFeedback.click();
    soundFx.playClickBeep('low');
    onReset();
  };

  // Determina a cor da barra e do texto conforme o tempo restante
  const timerTone = useMemo(() => {
    if (secondsRemaining <= 0) {
      return {
        bar: 'bg-rose-500',
        text: 'text-rose-500 animate-pulse',
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
        cardGlow: 'border-rose-500/50 shadow-[0_0_25px_rgba(244,63,94,0.3)]',
      };
    }
    if (secondsRemaining <= 60) {
      return {
        bar: 'bg-rose-500',
        text: 'text-rose-400',
        badge: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
        cardGlow: 'border-rose-500/30',
      };
    }
    if (secondsRemaining <= 180) {
      return {
        bar: 'bg-amber-400',
        text: 'text-amber-400',
        badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
        cardGlow: 'border-amber-500/30',
      };
    }
    return {
      bar: 'bg-emerald-500',
      text: 'text-emerald-400',
      badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      cardGlow: 'border-emerald-500/20',
    };
  }, [secondsRemaining]);

  const isExpired = secondsRemaining <= 0;

  return (
    <div
      className={cn(
        'w-full rounded-2xl glass-card p-4 transition-all duration-300',
        timerTone.cardGlow,
        className
      )}
    >
      {/* Header do Cronômetro */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border',
              timerTone.badge
            )}
          >
            {isExpired ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                Tempo Esgotado
              </>
            ) : isRunning ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Em Andamento
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                Pausado
              </>
            )}
          </span>
        </div>

        {/* Botão de teste rápido de áudio / status */}
        <button
          type="button"
          onClick={() => {
            soundFx.playWhistle();
            hapticFeedback.timeExpired();
          }}
          className="text-gray-400 hover:text-gray-200 p-1 rounded-lg transition-colors"
          title="Testar Apito do Juiz"
          aria-label="Testar Som de Apito"
        >
          <Volume2 className="w-4 h-4 opacity-70 hover:opacity-100" />
        </button>
      </div>

      {/* Display Central do Tempo */}
      <div className="flex flex-col items-center justify-center my-2">
        <div
          className={cn(
            'font-mono text-5xl sm:text-6xl font-extrabold tracking-tight select-none transition-colors duration-200',
            timerTone.text
          )}
        >
          {formattedTime}
        </div>
        <p className="text-xs text-gray-400 mt-1 font-medium">
          Duração oficial: {Math.floor(totalDuration / 60)} minutos ({totalDuration}s)
        </p>
      </div>

      {/* Barra de Progresso Visual */}
      <div className="w-full bg-gray-800/80 rounded-full h-2.5 my-3 overflow-hidden border border-gray-700/50">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-linear',
            timerTone.bar
          )}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Controles Rápidos Ergonômicos (Área mínima de toque >= 44px) */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        {/* Botão Reset */}
        <button
          type="button"
          disabled={disabled}
          onClick={handleReset}
          className="min-h-[46px] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gray-800/90 hover:bg-gray-700 active:scale-95 text-gray-300 hover:text-white font-medium text-xs sm:text-sm border border-gray-700/60 transition-all touch-press-scale disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Resetar Cronômetro"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset</span>
        </button>

        {/* Botão Iniciar / Pausar (Principal) */}
        <button
          type="button"
          disabled={disabled}
          onClick={handleToggle}
          className={cn(
            'min-h-[46px] col-span-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm sm:text-base transition-all touch-press-scale shadow-lg active:scale-95 disabled:opacity-40 disabled:pointer-events-none',
            isRunning
              ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-gray-950 shadow-amber-500/20'
              : 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-gray-950 shadow-emerald-500/25'
          )}
          aria-label={isRunning ? 'Pausar Cronômetro' : 'Iniciar Cronômetro'}
        >
          {isRunning ? (
            <>
              <Pause className="w-4 h-4 fill-current" />
              <span>Pausar</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Iniciar</span>
            </>
          )}
        </button>

        {/* Botão +1 Minuto */}
        <button
          type="button"
          disabled={disabled}
          onClick={handleAddMinute}
          className="min-h-[46px] flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl bg-gray-800/90 hover:bg-gray-700 active:scale-95 text-emerald-400 hover:text-emerald-300 font-semibold text-xs sm:text-sm border border-gray-700/60 transition-all touch-press-scale disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Adicionar 1 Minuto"
        >
          <Plus className="w-4 h-4" />
          <span>+1 min</span>
        </button>
      </div>
    </div>
  );
};
