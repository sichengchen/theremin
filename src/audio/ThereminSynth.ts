import type { MappingSettings } from "../mapping/controlMapping";

export type Waveform = OscillatorType;

export interface SynthUpdate {
  frequency: number;
  gain: number;
  vibratoDepth: number;
  vibratoRate: number;
}

export interface SynthTone {
  waveform: Waveform;
  filterCutoff: number;
}

export class ThereminSynth {
  private context: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private vibratoOscillator: OscillatorNode | null = null;
  private vibratoGain: GainNode | null = null;
  private tone: SynthTone = {
    waveform: "sine",
    filterCutoff: 4200,
  };

  get isRunning(): boolean {
    return Boolean(this.context && this.oscillator);
  }

  async start(): Promise<void> {
    if (this.context) {
      await this.context.resume();
      return;
    }

    const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
    const context = new AudioContextConstructor({
      latencyHint: "interactive",
    });

    const oscillator = context.createOscillator();
    oscillator.type = this.tone.waveform;
    oscillator.frequency.value = 220;

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = this.tone.filterCutoff;
    filter.Q.value = 0.7;

    const masterGain = context.createGain();
    masterGain.gain.value = 0;

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.16;

    const vibratoOscillator = context.createOscillator();
    vibratoOscillator.type = "sine";
    vibratoOscillator.frequency.value = 5.4;

    const vibratoGain = context.createGain();
    vibratoGain.gain.value = 0;

    vibratoOscillator.connect(vibratoGain);
    vibratoGain.connect(oscillator.frequency);
    oscillator.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(compressor);
    compressor.connect(context.destination);

    oscillator.start();
    vibratoOscillator.start();

    this.context = context;
    this.oscillator = oscillator;
    this.filter = filter;
    this.masterGain = masterGain;
    this.compressor = compressor;
    this.vibratoOscillator = vibratoOscillator;
    this.vibratoGain = vibratoGain;
  }

  update(update: SynthUpdate): void {
    if (!this.context || !this.oscillator || !this.masterGain || !this.vibratoOscillator || !this.vibratoGain) {
      return;
    }

    const now = this.context.currentTime;

    this.oscillator.frequency.setTargetAtTime(update.frequency, now, 0.026);
    this.masterGain.gain.setTargetAtTime(update.gain, now, update.gain > 0 ? 0.032 : 0.07);
    this.vibratoOscillator.frequency.setTargetAtTime(update.vibratoRate, now, 0.08);
    this.vibratoGain.gain.setTargetAtTime(update.vibratoDepth, now, 0.08);
  }

  setTone(tone: Partial<SynthTone>): void {
    this.tone = {
      ...this.tone,
      ...tone,
    };

    if (!this.context) {
      return;
    }

    const now = this.context.currentTime;
    if (tone.waveform && this.oscillator) {
      this.oscillator.type = tone.waveform;
    }
    if (typeof tone.filterCutoff === "number" && this.filter) {
      this.filter.frequency.setTargetAtTime(tone.filterCutoff, now, 0.08);
    }
  }

  applySettings(settings: MappingSettings): void {
    if (!this.context || !this.filter) {
      return;
    }

    this.filter.frequency.setTargetAtTime(
      Math.max(settings.maxFrequency * 2.5, 1600),
      this.context.currentTime,
      0.1,
    );
  }

  async shutdown(): Promise<void> {
    if (!this.context) {
      return;
    }

    const context = this.context;
    this.oscillator?.stop(context.currentTime + 0.05);
    this.vibratoOscillator?.stop(context.currentTime + 0.05);
    await context.close();

    this.context = null;
    this.oscillator = null;
    this.filter = null;
    this.masterGain = null;
    this.compressor = null;
    this.vibratoOscillator = null;
    this.vibratoGain = null;
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
