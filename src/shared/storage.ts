import {
  DEFAULT_ESTIMATED_RAM_PER_DISCARD_MB,
  DEFAULT_RAM_SAVINGS_ANALYTICS,
  DEFAULT_SETTINGS,
  OPTIMIZATION_PRESETS
} from "./defaults";
import { fromStoredAliases, fromStoredDiscardOverrides, fromStoredRules } from "./rules";
import type {
  ExtensionSettings,
  OptimizationPreset,
  RamSavingsAnalyticsState,
  RamSavingsDailyEntry,
  RamSavingsRecordInput,
  SessionState
} from "./types";

const SETTINGS_KEY = "idle-tab-grouper-settings";
const SESSION_KEY = "idle-tab-grouper-session";
const RAM_SAVINGS_KEY = "idle-tab-grouper-ram-savings";

export function getOptimizationPresetMinutes(preset: OptimizationPreset): number {
  return OPTIMIZATION_PRESETS.find(option => option.id === preset)?.inactivityMinutes ?? DEFAULT_SETTINGS.inactivityMinutes;
}

export function getOptimizationPresetLabel(preset: OptimizationPreset): string {
  if (preset === "custom") return "Customizado";
  return OPTIMIZATION_PRESETS.find(option => option.id === preset)?.label ?? "Equilibrado";
}

export async function readSettings(): Promise<ExtensionSettings> {
  const [syncStored, localStored] = await Promise.all([
    chrome.storage.sync.get(SETTINGS_KEY),
    chrome.storage.local.get(SETTINGS_KEY)
  ]);
  return normalizeSettings({
    ...localStored[SETTINGS_KEY],
    ...syncStored[SETTINGS_KEY]
  });
}

export async function writeSettings(settings: ExtensionSettings): Promise<void> {
  const normalized = normalizeSettings(settings);
  await Promise.all([
    chrome.storage.sync.set({
      [SETTINGS_KEY]: normalized
    }),
    chrome.storage.local.set({
      [SETTINGS_KEY]: normalized
    })
  ]);
}

export async function ensureSettings(): Promise<void> {
  const [syncStored, localStored] = await Promise.all([
    chrome.storage.sync.get(SETTINGS_KEY),
    chrome.storage.local.get(SETTINGS_KEY)
  ]);

  if (!syncStored[SETTINGS_KEY] && localStored[SETTINGS_KEY]) {
    await chrome.storage.sync.set({
      [SETTINGS_KEY]: normalizeSettings(localStored[SETTINGS_KEY])
    });
  }

  if (!localStored[SETTINGS_KEY] && syncStored[SETTINGS_KEY]) {
    await chrome.storage.local.set({
      [SETTINGS_KEY]: normalizeSettings(syncStored[SETTINGS_KEY])
    });
  }

  if (!syncStored[SETTINGS_KEY] && !localStored[SETTINGS_KEY]) {
    await writeSettings(DEFAULT_SETTINGS);
  }
}

export function normalizeSettings(storedSettings: Partial<ExtensionSettings> | undefined | null): ExtensionSettings {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(storedSettings || {})
  };
  const inactivityMinutes = normalizePositiveInteger(merged.inactivityMinutes, DEFAULT_SETTINGS.inactivityMinutes, 1);
  const optimizationPreset = normalizeOptimizationPreset(storedSettings?.optimizationPreset, inactivityMinutes);
  const minimumTabsToGroup = normalizePositiveInteger(merged.minimumTabsToGroup, DEFAULT_SETTINGS.minimumTabsToGroup, 2);
  const estimatedRamPerDiscardMb = normalizePositiveInteger(
    merged.estimatedRamPerDiscardMb,
    DEFAULT_ESTIMATED_RAM_PER_DISCARD_MB,
    1
  );
  const ramSavingsRetentionDays = normalizePositiveInteger(merged.ramSavingsRetentionDays, DEFAULT_SETTINGS.ramSavingsRetentionDays, 1);

  return {
    ...merged,
    optimizationPreset,
    inactivityMinutes,
    minimumTabsToGroup,
    discardEnabled: Boolean(merged.discardEnabled),
    estimatedRamPerDiscardMb,
    ramSavingsRetentionDays,
    enabled: Boolean(merged.enabled),
    behavior: merged.behavior === "suggest" ? "suggest" : "auto",
    strategy: merged.strategy === "subject" || merged.strategy === "site" ? merged.strategy : "hybrid",
    collapseInactiveGroups: Boolean(merged.collapseInactiveGroups),
    domainAliases: fromStoredAliases(Array.isArray(merged.domainAliases) ? merged.domainAliases : []),
    customRules: fromStoredRules(Array.isArray(merged.customRules) ? merged.customRules : []),
    siteDiscardOverrides: fromStoredDiscardOverrides(
      Array.isArray(merged.siteDiscardOverrides) ? merged.siteDiscardOverrides : []
    )
  };
}

export async function readSession(): Promise<SessionState> {
  const stored = await chrome.storage.session.get(SESSION_KEY);
  return (
    stored[SESSION_KEY] || {
      lastRunAt: null,
      lastRunReason: null,
      lastSummary: null
    }
  );
}

export async function writeSession(state: SessionState): Promise<void> {
  await chrome.storage.session.set({
    [SESSION_KEY]: state
  });
}

export function createDefaultRamSavingsAnalytics(): RamSavingsAnalyticsState {
  return {
    ...DEFAULT_RAM_SAVINGS_ANALYTICS,
    days: []
  };
}

export async function readRamSavingsAnalytics(): Promise<RamSavingsAnalyticsState> {
  const stored = await chrome.storage.local.get(RAM_SAVINGS_KEY);
  return normalizeRamSavingsAnalytics(stored[RAM_SAVINGS_KEY]);
}

export async function writeRamSavingsAnalytics(state: RamSavingsAnalyticsState): Promise<void> {
  await chrome.storage.local.set({
    [RAM_SAVINGS_KEY]: normalizeRamSavingsAnalytics(state)
  });
}

export async function ensureRamSavingsAnalytics(): Promise<void> {
  const stored = await chrome.storage.local.get(RAM_SAVINGS_KEY);
  if (!stored[RAM_SAVINGS_KEY]) {
    await writeRamSavingsAnalytics(createDefaultRamSavingsAnalytics());
  }
}

export async function recordRamSavings(input: RamSavingsRecordInput = {}): Promise<RamSavingsAnalyticsState> {
  const currentState = await readRamSavingsAnalytics();
  const timestamp = input.timestamp ?? Date.now();
  const dayKey = toLocalDateKey(timestamp);
  const discardedCount = normalizePositiveInteger(input.discardedCount, 1, 1);
  const estimatedRamSavedMb = normalizePositiveInteger(
    input.estimatedRamSavedMb,
    DEFAULT_ESTIMATED_RAM_PER_DISCARD_MB,
    1
  );
  const retentionDays = normalizePositiveInteger(input.retentionDays, currentState.retentionDays, 1);
  const nextState = normalizeRamSavingsAnalytics({
    ...currentState,
    retentionDays,
    days: upsertDailyRamSavings(currentState.days, dayKey, discardedCount, estimatedRamSavedMb),
    version: 1
  });

  await writeRamSavingsAnalytics(nextState);
  return nextState;
}

export function normalizeRamSavingsAnalytics(
  state: Partial<RamSavingsAnalyticsState> | null | undefined
): RamSavingsAnalyticsState {
  const merged = {
    ...DEFAULT_RAM_SAVINGS_ANALYTICS,
    ...(state || {})
  };
  const retentionDays = normalizePositiveInteger(merged.retentionDays, DEFAULT_RAM_SAVINGS_ANALYTICS.retentionDays, 1);
  const days = Array.isArray(merged.days) ? merged.days : [];

  return {
    version: 1,
    retentionDays,
    days: pruneRamSavingsDays(normalizeRamSavingsDays(days), retentionDays)
  };
}

export function pruneRamSavingsAnalytics(
  state: RamSavingsAnalyticsState,
  now: number = Date.now()
): RamSavingsAnalyticsState {
  const retentionDays = normalizePositiveInteger(state.retentionDays, DEFAULT_RAM_SAVINGS_ANALYTICS.retentionDays, 1);
  return {
    version: 1,
    retentionDays,
    days: pruneRamSavingsDays(normalizeRamSavingsDays(state.days), retentionDays, now)
  };
}

function normalizeOptimizationPreset(value: unknown, inactivityMinutes: number): OptimizationPreset {
  if (value === "custom") {
    return "custom";
  }

  if (value === "aggressive" || value === "balanced" || value === "conservative") {
    const selectedPreset = OPTIMIZATION_PRESETS.find(option => option.id === value);
    if (selectedPreset?.inactivityMinutes === inactivityMinutes) {
      return value;
    }
  }

  const matchedPreset = OPTIMIZATION_PRESETS.find(option => option.inactivityMinutes === inactivityMinutes);
  return matchedPreset?.id ?? "custom";
}

function normalizePositiveInteger(value: unknown, fallback: number, minimum: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.trunc(parsed);
  if (rounded < minimum) return fallback;
  return rounded;
}

function normalizeRamSavingsDays(days: Array<Partial<RamSavingsDailyEntry>>): RamSavingsDailyEntry[] {
  return days
    .map(day => {
      const date = typeof day.date === "string" ? day.date.trim() : "";
      if (!date) return null;
      return {
        date,
        discardedCount: normalizePositiveInteger(day.discardedCount, 0, 0),
        estimatedRamSavedMb: normalizePositiveInteger(day.estimatedRamSavedMb, 0, 0)
      };
    })
    .filter((day): day is RamSavingsDailyEntry => day !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function pruneRamSavingsDays(days: RamSavingsDailyEntry[], retentionDays: number, now: number = Date.now()): RamSavingsDailyEntry[] {
  const cutoffDateKey = toLocalDateKey(now - (retentionDays - 1) * 86_400_000);
  return days.filter(day => day.date >= cutoffDateKey);
}

function upsertDailyRamSavings(
  days: RamSavingsDailyEntry[],
  date: string,
  discardedCount: number,
  estimatedRamSavedMb: number
): RamSavingsDailyEntry[] {
  const nextDays = [...days];
  const existingIndex = nextDays.findIndex(day => day.date === date);
  if (existingIndex >= 0) {
    const existing = nextDays[existingIndex];
    nextDays[existingIndex] = {
      ...existing,
      discardedCount: existing.discardedCount + discardedCount,
      estimatedRamSavedMb: existing.estimatedRamSavedMb + estimatedRamSavedMb
    };
    return nextDays;
  }

  nextDays.push({
    date,
    discardedCount,
    estimatedRamSavedMb
  });
  return nextDays.sort((a, b) => a.date.localeCompare(b.date));
}

function toLocalDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const localOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - localOffsetMs).toISOString().slice(0, 10);
}
