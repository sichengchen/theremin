import { ChevronDown, RefreshCcw } from "lucide-react";
import {
  formatPitch,
  frequencyToMidi,
  midiToFrequency,
} from "../audio/notes";
import type { Waveform } from "../audio/ThereminSynth";
import {
  type MappingSettings,
} from "../mapping/controlMapping";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

export interface ControlPanelProps {
  cameraReady: boolean;
  audioReady: boolean;
  settings: MappingSettings;
  waveform: Waveform;
  handCount: number;
  frequency: number;
  volume: number;
  confidence: number;
  onCameraChange: (enabled: boolean) => void;
  onAudioChange: (enabled: boolean) => void;
  onWaveformChange: (waveform: Waveform) => void;
  onSettingsChange: (settings: MappingSettings) => void;
  onReset: () => void;
}

const WAVEFORMS: Waveform[] = ["sine", "triangle", "sawtooth", "square"];
const LOWEST_PITCH_MIDI = 24;
const HIGHEST_PITCH_MIDI = 108;
const MIN_PITCH_SPAN = 1;

export function ControlPanel({
  cameraReady,
  audioReady,
  settings,
  waveform,
  handCount,
  frequency,
  volume,
  confidence,
  onCameraChange,
  onAudioChange,
  onWaveformChange,
  onSettingsChange,
  onReset,
}: ControlPanelProps) {
  const lowPitchMidi = frequencyToMidi(settings.minFrequency);
  const highPitchMidi = frequencyToMidi(settings.maxFrequency);

  return (
    <Card size="sm" className="control-dock" aria-label="Instrument controls">
      <CardHeader className="control-dock-header">
        <div>
          <CardTitle>Controls</CardTitle>
          <p>{handCount}/2 hands</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Reset controls" onClick={onReset}>
          <RefreshCcw />
        </Button>
      </CardHeader>

      <CardContent className="control-dock-content">
        <section className="switch-grid" aria-label="Input and audio">
          <SwitchRow label="Camera" checked={cameraReady} onCheckedChange={onCameraChange} />
          <SwitchRow label="Audio" checked={audioReady} onCheckedChange={onAudioChange} />
        </section>

        <section className="meter-grid" aria-label="Live meters">
          <Meter label="Pitch" value={formatPitch(frequency)} ratio={frequencyRatio(frequency, settings)} />
          <Meter label="Volume" value={`${Math.round(volume * 100)}%`} ratio={volume} />
        </section>

        <SelectRow
          label="Waveform"
          value={waveform}
          onValueChange={(value) => onWaveformChange(value as Waveform)}
          options={WAVEFORMS}
        />

        <Collapsible className="fine-tune-panel" defaultOpen={false}>
          <CollapsibleTrigger className="fine-tune-trigger">
            <span>Fine tune</span>
            <ChevronDown className="size-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="fine-tune-content">
            <SliderRow
              label="Smoothing"
              value={settings.smoothing}
              min={0.15}
              max={0.92}
              step={0.01}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={(smoothing) => onSettingsChange({ ...settings, smoothing })}
            />
            <SliderRow
              label="Sensitivity"
              value={settings.sensitivity}
              min={0.55}
              max={1.65}
              step={0.01}
              format={(value) => value.toFixed(2)}
              onChange={(sensitivity) => onSettingsChange({ ...settings, sensitivity })}
            />
            <PitchLimitRow
              label="Low note"
              value={lowPitchMidi}
              min={LOWEST_PITCH_MIDI}
              max={HIGHEST_PITCH_MIDI}
              onChange={(midi) =>
                onSettingsChange({
                  ...settings,
                  minFrequency: midiToFrequency(Math.min(midi, highPitchMidi - MIN_PITCH_SPAN)),
                })
              }
            />
            <PitchLimitRow
              label="High note"
              value={highPitchMidi}
              min={LOWEST_PITCH_MIDI}
              max={HIGHEST_PITCH_MIDI}
              onChange={(midi) =>
                onSettingsChange({
                  ...settings,
                  maxFrequency: midiToFrequency(Math.max(midi, lowPitchMidi + MIN_PITCH_SPAN)),
                })
              }
            />
            <Meter label="Confidence" value={`${Math.round(confidence * 100)}%`} ratio={confidence} />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function SwitchRow({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = `control-${label.toLowerCase()}`;

  return (
    <div className="switch-row" data-disabled={disabled ? "true" : undefined}>
      <Label htmlFor={id}>{label}</Label>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SelectRow<TValue extends string>({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: TValue;
  options: readonly TValue[];
  onValueChange: (value: TValue) => void;
}) {
  return (
    <div className="select-row">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(next) => onValueChange(next as TValue)}>
        <SelectTrigger className="w-36 justify-between" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              <span className="capitalize">{option}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PitchLimitRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (midi: number) => void;
}) {
  const safeValue = Math.min(Math.max(value, min), max);

  return (
    <SliderRow
      label={label}
      value={safeValue}
      min={min}
      max={max}
      step={1}
      format={(midi) => formatPitch(midiToFrequency(midi))}
      onChange={(midi) => onChange(Math.round(midi))}
    />
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="slider-row">
      <div className="control-label">
        <span>{label}</span>
        <strong>{format(value)}</strong>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
      />
    </div>
  );
}

function Meter({ label, value, ratio }: { label: string; value: string; ratio: number }) {
  return (
    <div className="meter-row">
      <div className="control-label">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <Progress value={Math.max(0, Math.min(1, ratio)) * 100} />
    </div>
  );
}

function frequencyRatio(value: number, settings: MappingSettings): number {
  const denominator = Math.log(settings.maxFrequency / settings.minFrequency);
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, Math.log(value / settings.minFrequency) / denominator));
}
