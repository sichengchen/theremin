import {
  AudioLines,
  Camera,
  FlipHorizontal,
  Gauge,
  Hand,
  Play,
  RefreshCcw,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { Waveform } from "../audio/ThereminSynth";
import {
  DEFAULT_MAPPING_SETTINGS,
  type MappingSettings,
  type PitchSide,
} from "../mapping/controlMapping";

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
  return (
    <aside className="control-panel" aria-label="Instrument controls">
      <div className="status-row">
        <StatusPill active={cameraReady} icon={<Camera size={15} />} label={cameraReady ? "Camera" : "Camera off"} />
        <StatusPill active={audioReady && !muted} icon={<AudioLines size={15} />} label={audioReady ? "Audio" : "Audio off"} />
        <StatusPill active={handCount === 2} icon={<Hand size={15} />} label={`${handCount}/2 hands`} />
      </div>

      <div className="primary-actions">
        <button className="action-button" onClick={onStartCamera} disabled={cameraReady} title="Start camera">
          <Camera size={18} />
          <span>{cameraReady ? "Camera ready" : "Start camera"}</span>
        </button>
        <button className="action-button accent" onClick={onStartAudio} disabled={audioReady} title="Arm audio">
          <Play size={18} />
          <span>{audioReady ? "Audio armed" : "Arm audio"}</span>
        </button>
        <button className="icon-button" onClick={onToggleMute} title={muted ? "Unmute" : "Mute"}>
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      <section className="control-group" aria-label="Sound">
        <div className="group-title">
          <SlidersHorizontal size={16} />
          <span>Sound</span>
        </div>
        <label>
          <span>Waveform</span>
          <select value={waveform} onChange={(event) => onWaveformChange(event.target.value as Waveform)}>
            {WAVEFORMS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Pitch side</span>
          <select
            value={settings.pitchSide}
            onChange={(event) =>
              onSettingsChange({ ...settings, pitchSide: event.target.value as PitchSide })
            }
          >
            <option value="right">right</option>
            <option value="left">left</option>
          </select>
        </label>
      </section>

      <section className="control-group" aria-label="Response">
        <div className="group-title">
          <Gauge size={16} />
          <span>Response</span>
        </div>
        <Slider
          label="Smoothing"
          min={0.15}
          max={0.92}
          step={0.01}
          value={settings.smoothing}
          onChange={(smoothing) => onSettingsChange({ ...settings, smoothing })}
        />
        <Slider
          label="Sensitivity"
          min={0.55}
          max={1.65}
          step={0.01}
          value={settings.sensitivity}
          onChange={(sensitivity) => onSettingsChange({ ...settings, sensitivity })}
        />
        <Slider
          label="Max note"
          min={880}
          max={3520}
          step={10}
          value={settings.maxFrequency}
          onChange={(maxFrequency) => onSettingsChange({ ...settings, maxFrequency })}
        />
      </section>

      <div className="meter-stack" aria-label="Live meters">
        <Meter label="Pitch" value={formatFrequency(frequency)} ratio={frequencyRatio(frequency, settings)} />
        <Meter label="Volume" value={`${Math.round(gain * 100)}%`} ratio={gain} />
        <Meter label="Confidence" value={`${Math.round(confidence * 100)}%`} ratio={confidence} />
      </div>

      <div className="secondary-actions">
        <button onClick={onOpenCalibration}>
          <FlipHorizontal size={16} />
          <span>Calibrate</span>
        </button>
        <button onClick={onReset}>
          <RefreshCcw size={16} />
          <span>Reset</span>
        </button>
      </div>
    </aside>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function StatusPill({
  active,
  icon,
  label,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className={active ? "status-pill active" : "status-pill"}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function Meter({ label, value, ratio }: { label: string; value: string; ratio: number }) {
  return (
    <div className="meter">
      <div className="meter-label">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%` }} />
      </div>
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
