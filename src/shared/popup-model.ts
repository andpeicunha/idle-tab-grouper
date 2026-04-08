import { getOptimizationPresetLabel } from "./storage";
import type { OptimizationPreset, RamSavingsAnalyticsState } from "./types";
import { OPTIMIZATION_PRESETS } from "./defaults";

export interface RamHistoryPoint {
  day: string;
  estimatedMb: number;
  discardedTabs?: number;
}

export interface PopupRamSavings {
  estimatedMb: number;
  history: RamHistoryPoint[];
  label: string;
  localOnlyLabel: string;
}

export interface OptimizationPresetView {
  id: OptimizationPreset;
  label: string;
  minutes: number;
  description: string;
}

const RAM_HISTORY_LIMIT = 7;

export function toPresetView(presetId: OptimizationPreset, minutes: number): OptimizationPresetView {
  const preset = OPTIMIZATION_PRESETS.find(item => item.id === presetId);
  if (preset) {
    return {
      id: preset.id,
      label: preset.label,
      minutes: preset.inactivityMinutes,
      description:
        preset.id === "aggressive"
          ? "Prioriza descarte rápido"
          : preset.id === "conservative"
            ? "Menos agressivo com a sessão"
            : "Padrão recomendado"
    };
  }

  return {
    id: "custom",
    label: getOptimizationPresetLabel("custom"),
    minutes,
    description: "Ajuste manual"
  };
}

export function optimizationPresetOptions(selected: OptimizationPreset): string {
  const options = OPTIMIZATION_PRESETS.map(preset => {
    const view = toPresetView(preset.id, preset.inactivityMinutes);
    return `<option value="${preset.id}" ${preset.id === selected ? "selected" : ""}>${view.label} · ${view.minutes} min</option>`;
  }).join("");
  return `${options}<option value="custom" ${selected === "custom" ? "selected" : ""}>Customizado</option>`;
}

export function resolvePresetIdFromMinutes(minutes: number): OptimizationPreset {
  return OPTIMIZATION_PRESETS.find(item => item.inactivityMinutes === minutes)?.id ?? "custom";
}

export function readRamSavings(analytics: RamSavingsAnalyticsState | null): PopupRamSavings {
  const fallback: PopupRamSavings = {
    estimatedMb: 0,
    history: [],
    label: "Nenhuma estimativa ainda. O histórico local vai aparecer quando houver descartes.",
    localOnlyLabel: "Estimativa local, sem sync"
  };

  if (!analytics) return fallback;

  const history = analytics.days.slice(-RAM_HISTORY_LIMIT).map(day => ({
    day: day.date,
    estimatedMb: day.estimatedRamSavedMb,
    discardedTabs: day.discardedCount
  }));
  const estimatedMb = analytics.days.reduce((total, day) => total + day.estimatedRamSavedMb, 0);

  return {
    estimatedMb,
    history,
    label:
      history.length > 0
        ? `Histórico local de ${history.length} dia(s) com retenção de ${analytics.retentionDays} dia(s).`
        : fallback.label,
    localOnlyLabel: "Estimativa local, sem sync"
  };
}
