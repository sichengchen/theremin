const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

export function frequencyToMidi(frequency: number): number {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    return 69;
  }

  return Math.round(69 + 12 * Math.log2(frequency / 440));
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (Math.round(midi) - 69) / 12);
}

export function noteNameFromMidi(midi: number): string {
  const rounded = Math.round(midi);
  const note = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return `${note}${octave}`;
}

export function frequencyToNoteName(frequency: number): string {
  return noteNameFromMidi(frequencyToMidi(frequency));
}

export function formatFrequency(frequency: number): string {
  return frequency >= 1000 ? `${(frequency / 1000).toFixed(2)} kHz` : `${Math.round(frequency)} Hz`;
}

export function formatPitch(frequency: number): string {
  return `${frequencyToNoteName(frequency)} - ${formatFrequency(frequency)}`;
}
