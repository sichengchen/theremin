import { describe, expect, it } from "vite-plus/test";
import {
  formatPitch,
  frequencyToMidi,
  frequencyToNoteName,
  midiToFrequency,
  noteNameFromMidi,
} from "./notes";

describe("note formatting", () => {
  it("maps concert pitch to A4", () => {
    expect(frequencyToMidi(440)).toBe(69);
    expect(frequencyToNoteName(440)).toBe("A4");
  });

  it("maps middle C to C4", () => {
    expect(noteNameFromMidi(60)).toBe("C4");
    expect(frequencyToNoteName(261.63)).toBe("C4");
  });

  it("converts midi notes to frequency", () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 4);
    expect(midiToFrequency(60)).toBeCloseTo(261.63, 1);
  });

  it("formats note and frequency together", () => {
    expect(formatPitch(440)).toBe("A4 - 440 Hz");
  });
});
