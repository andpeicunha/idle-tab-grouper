import type { DomainAlias, ExtensionSettings, TabRule } from "./types";

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
  inactivityMinutes: 3,
  minimumTabsToGroup: 2,
  collapseInactiveGroups: true,
  domainAliases: PRESET_ALIASES.map(alias => ({
    id: alias.domain,
    ...alias
  })),
  customRules: []
};
