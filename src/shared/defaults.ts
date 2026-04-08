import type {
  DomainAlias,
  ExtensionSettings,
  OptimizationPresetConfig,
  RamSavingsAnalyticsState,
  TabRule
} from "./types";

export const OPTIMIZATION_PRESETS: ReadonlyArray<OptimizationPresetConfig> = [
  {
    id: "aggressive",
    label: "Agressivo",
    inactivityMinutes: 2
  },
  {
    id: "balanced",
    label: "Equilibrado",
    inactivityMinutes: 5
  },
  {
    id: "conservative",
    label: "Conservador",
    inactivityMinutes: 10
  }
];

export const DEFAULT_OPTIMIZATION_PRESET: OptimizationPresetConfig["id"] = "balanced";
export const DEFAULT_ESTIMATED_RAM_PER_DISCARD_MB = 50;
export const DEFAULT_RAM_SAVINGS_RETENTION_DAYS = 7;

export const DEFAULT_RAM_SAVINGS_ANALYTICS: RamSavingsAnalyticsState = {
  version: 1,
  retentionDays: DEFAULT_RAM_SAVINGS_RETENTION_DAYS,
  days: []
};

export const PRESET_RULES: ReadonlyArray<Omit<TabRule, "id">> = [
  {
    name: "Work",
    color: "blue",
    keywords: ["gmail", "calendar", "docs", "drive", "meet", "slack", "notion", "jira", "github", "linear", "figma", "linkedin"]
  },
  {
    name: "Study",
    color: "green",
    keywords: ["wikipedia", "coursera", "udemy", "khan", "stackoverflow", "developer.mozilla", "mdn"]
  },
  {
    name: "Media",
    color: "pink",
    keywords: ["youtube", "spotify", "netflix", "primevideo", "twitch", "vimeo"]
  },
  {
    name: "Shopping",
    color: "yellow",
    keywords: ["amazon", "mercadolivre", "shopee", "aliexpress", "ebay", "walmart"]
  },
  {
    name: "Finance",
    color: "red",
    keywords: ["bank", "nubank", "itau", "c6", "paypal", "stripe", "wise", "b3", "inter", "bradesco", "santander"]
  }
];

export const PRESET_ALIASES: ReadonlyArray<Omit<DomainAlias, "id">> = [
  { domain: "google.com", label: "Google", color: "blue" },
  { domain: "clickup.com", label: "ClickUp", color: "cyan" },
  { domain: "grafana.com", label: "Grafana", color: "orange" },
  { domain: "github.com", label: "GitHub", color: "grey" },
  { domain: "notion.so", label: "Notion", color: "purple" },
  { domain: "slack.com", label: "Slack", color: "green" },
  { domain: "figma.com", label: "Figma", color: "pink" }
];

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  behavior: "auto",
  strategy: "hybrid",
  optimizationPreset: DEFAULT_OPTIMIZATION_PRESET,
  inactivityMinutes: 5,
  minimumTabsToGroup: 2,
  collapseInactiveGroups: true,
  discardEnabled: true,
  estimatedRamPerDiscardMb: DEFAULT_ESTIMATED_RAM_PER_DISCARD_MB,
  ramSavingsRetentionDays: DEFAULT_RAM_SAVINGS_RETENTION_DAYS,
  domainAliases: PRESET_ALIASES.map(alias => ({
    id: alias.domain,
    ...alias
  })),
  customRules: [],
  siteDiscardOverrides: []
};
