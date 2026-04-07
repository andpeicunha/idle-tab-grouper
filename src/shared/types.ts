export type GroupBehavior = "auto" | "suggest";
export type GroupStrategy = "hybrid" | "subject" | "site";
export type TabGroupColor = "grey" | "blue" | "cyan" | "green" | "yellow" | "orange" | "red" | "pink" | "purple";

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

export interface ExtensionSettings {
  enabled: boolean;
  behavior: GroupBehavior;
  strategy: GroupStrategy;
  inactivityMinutes: number;
  minimumTabsToGroup: number;
  collapseInactiveGroups: boolean;
  domainAliases: DomainAlias[];
  customRules: TabRule[];
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
