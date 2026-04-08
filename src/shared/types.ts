export type GroupBehavior = "auto" | "suggest";
export type GroupStrategy = "hybrid" | "subject" | "site";
export type TabGroupColor = "grey" | "blue" | "cyan" | "green" | "yellow" | "orange" | "red" | "pink" | "purple";
export type OptimizationPreset = "aggressive" | "balanced" | "conservative" | "custom";

export interface DomainAlias {
  id: string;
  domain: string;
  label: string;
  color: TabGroupColor;
}

export interface TabRule {
  id: string;
  name: string;
  color: TabGroupColor;
  keywords: string[];
}

export interface OptimizationPresetConfig {
  id: OptimizationPreset;
  label: string;
  inactivityMinutes: number;
}

export interface ExtensionSettings {
  enabled: boolean;
  behavior: GroupBehavior;
  strategy: GroupStrategy;
  optimizationPreset: OptimizationPreset;
  inactivityMinutes: number;
  minimumTabsToGroup: number;
  collapseInactiveGroups: boolean;
  discardEnabled: boolean;
  estimatedRamPerDiscardMb: number;
  ramSavingsRetentionDays: number;
  domainAliases: DomainAlias[];
  customRules: TabRule[];
}

export interface RamSavingsDailyEntry {
  date: string;
  discardedCount: number;
  estimatedRamSavedMb: number;
}

export interface RamSavingsAnalyticsState {
  version: 1;
  retentionDays: number;
  days: RamSavingsDailyEntry[];
}

export interface RamSavingsRecordInput {
  timestamp?: number;
  discardedCount?: number;
  estimatedRamSavedMb?: number;
  retentionDays?: number;
}

export interface SessionSummary {
  movedCount: number;
  suggestedCount: number;
  collapsedGroupCount: number;
  fallbackCount: number;
  pendingCount: number;
}

export interface SessionState {
  lastRunAt: number | null;
  lastRunReason: string | null;
  lastSummary: SessionSummary | null;
}
