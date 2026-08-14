/**
 * Utilitário de Efeitos Sonoros usando Web Audio API nativa.
 * Funciona 100% offline e sem necessidade de arquivos .mp3 externos.
 */

class SoundEffects {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Apito de juiz característico (duplo tom com modulação de frequência)
   */
  public playWhistle(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Cria dois osciladores para efeito de apito real (duplo tom)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(2600, now);
      osc1.frequency.exponentialRampToValueAtTime(2800, now + 0.1);
      osc1.frequency.exponentialRampToValueAtTime(2400, now + 0.5);

      osc2.frequency.setValueAtTime(2650, now);
      osc2.frequency.exponentialRampToValueAtTime(2850, now + 0.1);
      osc2.frequency.exponentialRampToValueAtTime(2450, now + 0.5);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.6);
      osc2.stop(now + 0.6);
    } catch {
      // Falha silenciosa caso o navegador restrinja áudio
    }
  }

  /**
   * Som de celebração de gol (arpeggio ascendente C-E-G-C)
   */
  public playGoalSound(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

      notes.forEach((freq, idx) => {
        const noteTime = now + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.2, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteTime);
        osc.stop(noteTime + 0.25);
      });
    } catch {
      // Ignora erro
    }
  }

  /**
   * Bipe tátil curto para botões e controle do cronômetro
   */
  public playClickBeep(pitch: 'low' | 'normal' | 'high' = 'normal'): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freqMap = {
        low: 440,
        normal: 750,
        high: 1100,
      };

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqMap[pitch], now);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // Ignora erro
    }
  }

  /**
   * Alerta de fim de jogo / vitória imediata
   */
  public playVictoryFanfare(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const chords = [
        [523.25, 659.25], // C5, E5
        [659.25, 783.99], // E5, G5
        [783.99, 1046.5], // G5, C6
        [1046.5, 1318.5], // C6, E6
      ];

      chords.forEach((chord, i) => {
        const stepTime = now + i * 0.12;
        chord.forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, stepTime);

          const duration = i === chords.length - 1 ? 0.6 : 0.15;
          gain.gain.setValueAtTime(0.18, stepTime);
          gain.gain.exponentialRampToValueAtTime(0.001, stepTime + duration);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(stepTime);
          osc.stop(stepTime + duration);
        });
      });
    } catch {
      // Ignora erro
    }
  }
}

export const soundFx = new SoundEffects();
