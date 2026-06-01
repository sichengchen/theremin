import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
const CONTROL_CORNER_STORAGE_KEY = "vision-theremin-control-corner-v1";
const CONTROL_DOCK_MARGIN = 16;

type ControlCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type DragMode = "idle" | "dragging" | "snapping";

interface Position {
  x: number;
  y: number;
}

export function ControlPanel({
  cameraReady,
  audioReady,
  settings,
  waveform,
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
  const dockRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef<Position>({ x: 0, y: 0 });
  const dragPositionRef = useRef<Position | null>(null);
  const dragModeRef = useRef<DragMode>("idle");
  const snapTimerRef = useRef<number | null>(null);
  const [corner, setCorner] = useState<ControlCorner>(loadControlCorner);
  const [dragMode, setDragMode] = useState<DragMode>("idle");
  const [dragPosition, setDragPositionState] = useState<Position | null>(null);

  const setDragPosition = useCallback((position: Position | null) => {
    dragPositionRef.current = position;
    setDragPositionState(position);
  }, []);

  const updateDragMode = useCallback((mode: DragMode) => {
    dragModeRef.current = mode;
    setDragMode(mode);
  }, []);

  const beginDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if ((event.target as Element).closest("[data-drag-exempt]")) {
        return;
      }

      const dock = dockRef.current;
      const stage = dock?.parentElement;
      if (!dock || !stage) {
        return;
      }

      const dockRect = dock.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const startPosition = {
        x: dockRect.left - stageRect.left,
        y: dockRect.top - stageRect.top,
      };

      window.clearTimeout(snapTimerRef.current ?? undefined);
      dragOffsetRef.current = {
        x: event.clientX - dockRect.left,
        y: event.clientY - dockRect.top,
      };
      setDragPosition(startPosition);
      updateDragMode("dragging");
      event.preventDefault();
    },
    [setDragPosition, updateDragMode],
  );

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (dragModeRef.current !== "dragging") {
        return;
      }

      const dock = dockRef.current;
      const stage = dock?.parentElement;
      if (!dock || !stage) {
        return;
      }

      const dockRect = dock.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const margin = getDockMargin();
      const next = {
        x: event.clientX - stageRect.left - dragOffsetRef.current.x,
        y: event.clientY - stageRect.top - dragOffsetRef.current.y,
      };

      setDragPosition({
        x: clamp(next.x, margin, Math.max(margin, stageRect.width - dockRect.width - margin)),
        y: clamp(next.y, margin, Math.max(margin, stageRect.height - dockRect.height - margin)),
      });
      event.preventDefault();
    };

    const stop = () => {
      if (dragModeRef.current !== "dragging") {
        return;
      }

      const dock = dockRef.current;
      const stage = dock?.parentElement;
      const position = dragPositionRef.current;
      if (!dock || !stage || !position) {
        setDragPosition(null);
        updateDragMode("idle");
        return;
      }

      const dockRect = dock.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const nextCorner = nearestCorner(position, dockRect, stageRect);
      const target = cornerPosition(nextCorner, dockRect, stageRect);

      setCorner(nextCorner);
      saveControlCorner(nextCorner);
      updateDragMode("snapping");
      setDragPosition(target);
      window.clearTimeout(snapTimerRef.current ?? undefined);
      snapTimerRef.current = window.setTimeout(() => {
        setDragPosition(null);
        updateDragMode("idle");
      }, 240);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      window.clearTimeout(snapTimerRef.current ?? undefined);
    };
  }, [setDragPosition, updateDragMode]);

  return (
    <Card
      ref={dockRef}
      size="sm"
      className="control-dock"
      aria-label="Instrument controls"
      data-corner={corner}
      data-dragging={dragMode === "dragging" ? "true" : undefined}
      data-snapping={dragMode === "snapping" ? "true" : undefined}
      style={dragPosition ? dockDragStyle(dragPosition) : undefined}
    >
      <CardHeader className="control-dock-header" onPointerDown={beginDrag}>
        <div>
          <CardTitle>Air Theremin</CardTitle>
        </div>
        <Button data-drag-exempt variant="ghost" size="icon-sm" aria-label="Reset controls" onClick={onReset}>
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

function dockDragStyle(position: Position): CSSProperties {
  return {
    bottom: "auto",
    left: `${position.x}px`,
    right: "auto",
    top: `${position.y}px`,
  };
}

function getDockMargin(): number {
  return window.matchMedia("(max-width: 640px)").matches ? 12 : CONTROL_DOCK_MARGIN;
}

function nearestCorner(position: Position, dockRect: DOMRect, stageRect: DOMRect): ControlCorner {
  const centerX = position.x + dockRect.width / 2;
  const centerY = position.y + dockRect.height / 2;
  const vertical = centerY < stageRect.height / 2 ? "top" : "bottom";
  const horizontal = centerX < stageRect.width / 2 ? "left" : "right";

  return `${vertical}-${horizontal}` as ControlCorner;
}

function cornerPosition(corner: ControlCorner, dockRect: DOMRect, stageRect: DOMRect): Position {
  const margin = getDockMargin();
  const x = corner.endsWith("left") ? margin : stageRect.width - dockRect.width - margin;
  const y = corner.startsWith("top") ? margin : stageRect.height - dockRect.height - margin;

  return {
    x: clamp(x, margin, Math.max(margin, stageRect.width - dockRect.width - margin)),
    y: clamp(y, margin, Math.max(margin, stageRect.height - dockRect.height - margin)),
  };
}

function loadControlCorner(): ControlCorner {
  const stored = localStorage.getItem(CONTROL_CORNER_STORAGE_KEY);
  return isControlCorner(stored) ? stored : "top-right";
}

function saveControlCorner(corner: ControlCorner): void {
  localStorage.setItem(CONTROL_CORNER_STORAGE_KEY, corner);
}

function isControlCorner(value: string | null): value is ControlCorner {
  return value === "top-left" || value === "top-right" || value === "bottom-left" || value === "bottom-right";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
