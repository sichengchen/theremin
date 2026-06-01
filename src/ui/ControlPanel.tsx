import {
  Camera,
  ChevronDown,
  FlipHorizontal,
  Play,
  RefreshCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { Waveform } from "../audio/ThereminSynth";
import {
  DEFAULT_MAPPING_SETTINGS,
  type MappingSettings,
  type PitchSide,
} from "../mapping/controlMapping";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface ControlPanelProps {
  cameraReady: boolean;
  audioReady: boolean;
  muted: boolean;
  settings: MappingSettings;
  waveform: Waveform;
  handCount: number;
  frequency: number;
  gain: number;
  confidence: number;
  onStartCamera: () => void;
  onStartAudio: () => void;
  onToggleMute: () => void;
  onWaveformChange: (waveform: Waveform) => void;
  onSettingsChange: (settings: MappingSettings) => void;
  onOpenCalibration: () => void;
  onReset: () => void;
}

const WAVEFORMS: Waveform[] = ["sine", "triangle", "sawtooth", "square"];

export function ControlPanel({
  cameraReady,
  audioReady,
  muted,
  settings,
  waveform,
  handCount,
  frequency,
  gain,
  confidence,
  onStartCamera,
  onStartAudio,
  onToggleMute,
  onWaveformChange,
  onSettingsChange,
  onOpenCalibration,
  onReset,
}: ControlPanelProps) {
  const stateLine = [
    cameraReady ? "camera ready" : "camera off",
    audioReady && !muted ? "audio armed" : muted ? "muted" : "audio off",
    `${handCount}/2 hands`,
  ].join(" · ");

  return (
    <aside className="control-rail" aria-label="Instrument controls">
      <Card className="instrument-panel">
        <CardHeader className="instrument-panel-header">
          <div>
            <CardTitle className="text-lg font-semibold tracking-normal">Theremin</CardTitle>
            <p className="panel-subtitle">{stateLine}</p>
          </div>
        </CardHeader>

        <CardContent className="instrument-panel-content">
          <section className="action-grid" aria-label="Performance actions">
            <Button
              variant="outline"
              size="lg"
              className="control-button"
              onClick={onStartCamera}
              disabled={cameraReady}
            >
              <Camera />
              {cameraReady ? "Camera ready" : "Start camera"}
            </Button>
            <Button size="lg" className="control-button" onClick={onStartAudio} disabled={audioReady}>
              <Play />
              {audioReady ? "Audio armed" : "Arm audio"}
            </Button>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-lg"
                    aria-label={muted ? "Unmute" : "Mute"}
                    onClick={onToggleMute}
                  />
                }
              >
                {muted ? <VolumeX /> : <Volume2 />}
              </TooltipTrigger>
              <TooltipContent side="left">{muted ? "Unmute" : "Mute"}</TooltipContent>
            </Tooltip>
          </section>

          <section className="primary-meters" aria-label="Live meters">
            <Meter label="Pitch" value={formatFrequency(frequency)} ratio={frequencyRatio(frequency, settings)} />
            <Meter label="Volume" value={`${Math.round(gain * 100)}%`} ratio={gain} />
          </section>

          <section className="compact-fields" aria-label="Tone controls">
            <SelectRow
              label="Waveform"
              value={waveform}
              onValueChange={(value) => onWaveformChange(value as Waveform)}
              options={WAVEFORMS}
            />
            <SelectRow
              label="Pitch side"
              value={settings.pitchSide}
              onValueChange={(value) =>
                onSettingsChange({ ...settings, pitchSide: value as PitchSide })
              }
              options={["right", "left"]}
            />
          </section>

          <Collapsible className="advanced-panel">
            <CollapsibleTrigger className="advanced-trigger">
              <span>Fine tune</span>
              <ChevronDown className="size-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="advanced-content">
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
              <SliderRow
                label="Max note"
                value={settings.maxFrequency}
                min={880}
                max={3520}
                step={10}
                format={formatFrequency}
                onChange={(maxFrequency) => onSettingsChange({ ...settings, maxFrequency })}
              />
              <Meter label="Confidence" value={`${Math.round(confidence * 100)}%`} ratio={confidence} />
            </CollapsibleContent>
          </Collapsible>

          <section className="secondary-actions" aria-label="Calibration">
            <Button variant="outline" size="default" className="justify-start" onClick={onOpenCalibration}>
              <FlipHorizontal />
              Calibrate
            </Button>
            <Button variant="ghost" size="default" className="justify-start" onClick={onReset}>
              <RefreshCcw />
              Reset
            </Button>
          </section>
        </CardContent>
      </Card>
    </aside>
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
    <div className="field-row">
      <div>
        <span>{label}</span>
        <strong className="capitalize">{value}</strong>
      </div>
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

function formatFrequency(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(2)} kHz` : `${Math.round(value)} Hz`;
}

function frequencyRatio(value: number, settings: MappingSettings): number {
  return (
    Math.log(value / settings.minFrequency) /
    Math.log(settings.maxFrequency / settings.minFrequency || DEFAULT_MAPPING_SETTINGS.maxFrequency)
  );
}
