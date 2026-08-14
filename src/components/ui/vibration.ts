/**
 * Utilitário seguro para vibração háptica no dispositivo móvel do mesário.
 */

export function vibrate(pattern: number | number[] = 50): boolean {
  if (typeof window === 'undefined' || !('navigator' in window) || !('vibrate' in navigator)) {
    return false;
  }

  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

export const hapticFeedback = {
  click: () => vibrate(40),
  goal: () => vibrate([60, 40, 80]),
  timerWarning: () => vibrate([100, 50, 100]),
  timeExpired: () => vibrate([150, 80, 150, 80, 300]),
  victory: () => vibrate([100, 50, 100, 50, 200, 100, 400]),
  cancel: () => vibrate([30, 30]),
};
