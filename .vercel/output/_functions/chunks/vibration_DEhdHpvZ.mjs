//#region src/components/ui/audio.ts
/**
* Utilitário de Efeitos Sonoros usando Web Audio API nativa.
* Funciona 100% offline e sem necessidade de arquivos .mp3 externos.
*/
var SoundEffects = class {
	ctx = null;
	getContext() {
		if (typeof window === "undefined") return null;
		if (!this.ctx) {
			const AudioCtx = window.AudioContext || window.webkitAudioContext;
			if (AudioCtx) this.ctx = new AudioCtx();
		}
		if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
		return this.ctx;
	}
	/**
	* Apito de juiz característico (duplo tom com modulação de frequência)
	*/
	playWhistle() {
		const ctx = this.getContext();
		if (!ctx) return;
		try {
			const now = ctx.currentTime;
			const osc1 = ctx.createOscillator();
			const osc2 = ctx.createOscillator();
			const gain = ctx.createGain();
			osc1.type = "sine";
			osc2.type = "triangle";
			osc1.frequency.setValueAtTime(2600, now);
			osc1.frequency.exponentialRampToValueAtTime(2800, now + .1);
			osc1.frequency.exponentialRampToValueAtTime(2400, now + .5);
			osc2.frequency.setValueAtTime(2650, now);
			osc2.frequency.exponentialRampToValueAtTime(2850, now + .1);
			osc2.frequency.exponentialRampToValueAtTime(2450, now + .5);
			gain.gain.setValueAtTime(0, now);
			gain.gain.linearRampToValueAtTime(.3, now + .05);
			gain.gain.linearRampToValueAtTime(.25, now + .4);
			gain.gain.exponentialRampToValueAtTime(.001, now + .6);
			osc1.connect(gain);
			osc2.connect(gain);
			gain.connect(ctx.destination);
			osc1.start(now);
			osc2.start(now);
			osc1.stop(now + .6);
			osc2.stop(now + .6);
		} catch {}
	}
	/**
	* Som de celebração de gol (arpeggio ascendente C-E-G-C)
	*/
	playGoalSound() {
		const ctx = this.getContext();
		if (!ctx) return;
		try {
			const now = ctx.currentTime;
			[
				523.25,
				659.25,
				783.99,
				1046.5
			].forEach((freq, idx) => {
				const noteTime = now + idx * .08;
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.type = "triangle";
				osc.frequency.setValueAtTime(freq, noteTime);
				gain.gain.setValueAtTime(.2, noteTime);
				gain.gain.exponentialRampToValueAtTime(.001, noteTime + .25);
				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.start(noteTime);
				osc.stop(noteTime + .25);
			});
		} catch {}
	}
	/**
	* Bipe tátil curto para botões e controle do cronômetro
	*/
	playClickBeep(pitch = "normal") {
		const ctx = this.getContext();
		if (!ctx) return;
		try {
			const now = ctx.currentTime;
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			const freqMap = {
				low: 440,
				normal: 750,
				high: 1100
			};
			osc.type = "sine";
			osc.frequency.setValueAtTime(freqMap[pitch], now);
			gain.gain.setValueAtTime(.08, now);
			gain.gain.exponentialRampToValueAtTime(1e-4, now + .04);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(now);
			osc.stop(now + .04);
		} catch {}
	}
	/**
	* Alerta de fim de jogo / vitória imediata
	*/
	playVictoryFanfare() {
		const ctx = this.getContext();
		if (!ctx) return;
		try {
			const now = ctx.currentTime;
			const chords = [
				[523.25, 659.25],
				[659.25, 783.99],
				[783.99, 1046.5],
				[1046.5, 1318.5]
			];
			chords.forEach((chord, i) => {
				const stepTime = now + i * .12;
				chord.forEach((freq) => {
					const osc = ctx.createOscillator();
					const gain = ctx.createGain();
					osc.type = "sine";
					osc.frequency.setValueAtTime(freq, stepTime);
					const duration = i === chords.length - 1 ? .6 : .15;
					gain.gain.setValueAtTime(.18, stepTime);
					gain.gain.exponentialRampToValueAtTime(.001, stepTime + duration);
					osc.connect(gain);
					gain.connect(ctx.destination);
					osc.start(stepTime);
					osc.stop(stepTime + duration);
				});
			});
		} catch {}
	}
};
var soundFx = new SoundEffects();
//#endregion
//#region src/components/ui/vibration.ts
/**
* Utilitário seguro para vibração háptica no dispositivo móvel do mesário.
*/
function vibrate(pattern = 50) {
	if (typeof window === "undefined" || !("navigator" in window) || !("vibrate" in navigator)) return false;
	try {
		return navigator.vibrate(pattern);
	} catch {
		return false;
	}
}
var hapticFeedback = {
	click: () => vibrate(40),
	goal: () => vibrate([
		60,
		40,
		80
	]),
	timerWarning: () => vibrate([
		100,
		50,
		100
	]),
	timeExpired: () => vibrate([
		150,
		80,
		150,
		80,
		300
	]),
	victory: () => vibrate([
		100,
		50,
		100,
		50,
		200,
		100,
		400
	]),
	cancel: () => vibrate([30, 30])
};
//#endregion
export { soundFx as n, hapticFeedback as t };
