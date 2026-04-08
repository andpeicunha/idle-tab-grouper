import { PRESET_RULES } from "./defaults";
import { PRESET_ALIASES } from "./defaults";
import type { DomainAlias, ExtensionSettings, SiteDiscardOverride, TabGroupColor, TabRule } from "./types";

export interface TabDecision {
  title: string;
  color: TabGroupColor;
  source: "rule" | "alias" | "fallback";
  key: string;
}

export function normalizeText(value: string | undefined): string {
  return (value || "").toLowerCase();
}

export function createRuleId(): string {
  return crypto.randomUUID();
}

export function toRuleKeywords(value: string): string[] {
  return value
    .split(",")
    .map(keyword => keyword.trim().toLowerCase())
    .filter(Boolean);
}

export function fromStoredRules(rules: TabRule[]): TabRule[] {
  return rules.map(rule => ({
    ...rule,
    id: rule.id || createRuleId(),
    keywords: Array.isArray(rule.keywords) ? rule.keywords : []
  }));
}

export function fromStoredDiscardOverrides(overrides: SiteDiscardOverride[]): SiteDiscardOverride[] {
  const normalizedOverrides: SiteDiscardOverride[] = [];

  for (const override of overrides) {
    const domain = normalizeDomain(override.domain);
    if (!domain) continue;

    if (override.mode === "never") {
      normalizedOverrides.push({
        id: override.id || createRuleId(),
        domain,
        mode: "never"
      });
      continue;
    }

    const inactivityMinutes = Number(override.inactivityMinutes);
    if (!Number.isFinite(inactivityMinutes) || inactivityMinutes < 1) {
      continue;
    }

    normalizedOverrides.push({
      id: override.id || createRuleId(),
      domain,
      mode: "minutes",
      inactivityMinutes: Math.trunc(inactivityMinutes)
    });
  }

  return normalizedOverrides.sort((a, b) => a.domain.localeCompare(b.domain));
}

export function fromStoredAliases(aliases: DomainAlias[]): DomainAlias[] {
  return aliases.map(alias => ({
    ...alias,
    id: alias.id || createRuleId(),
    domain: normalizeDomain(alias.domain),
    label: alias.label.trim(),
    color: alias.color || "blue"
  }));
}

export function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function findAliasForHostname(hostname: string, aliases: DomainAlias[]): DomainAlias | null {
  const normalized = normalizeDomain(hostname);
  const sortedAliases = [...aliases]
    .map(alias => ({ ...alias, domain: normalizeDomain(alias.domain), label: alias.label.trim() }))
    .filter(alias => alias.domain.length > 0 && alias.label.length > 0)
    .sort((a, b) => b.domain.length - a.domain.length);

  return (
    sortedAliases.find(alias => normalized === alias.domain || normalized.endsWith(`.${alias.domain}`)) ||
    PRESET_ALIASES.map(alias => ({ ...alias, id: alias.domain }))
      .map(alias => ({ ...alias, domain: normalizeDomain(alias.domain), label: alias.label.trim() }))
      .find(alias => normalized === alias.domain || normalized.endsWith(`.${alias.domain}`)) ||
    null
  );
}

export function findDiscardOverrideForHostname(
  hostname: string,
  overrides: SiteDiscardOverride[]
): SiteDiscardOverride | null {
  const normalized = normalizeDomain(hostname);
  const sortedOverrides = [...overrides]
    .map(override => ({
      ...override,
      domain: normalizeDomain(override.domain)
    }))
    .filter(override => override.domain.length > 0)
    .sort((a, b) => b.domain.length - a.domain.length);

  return (
    sortedOverrides.find(override => normalized === override.domain || normalized.endsWith(`.${override.domain}`)) || null
  );
}

export function getRootDomain(hostname: string): string {
  const cleaned = hostname.replace(/^www\./, "");
  const parts = cleaned.split(".").filter(Boolean);
  if (parts.length <= 2) return cleaned || "misc";
  return parts.slice(-2).join(".");
}

export function pickColorFromDomain(domain: string): TabGroupColor {
  const palette: TabGroupColor[] = ["blue", "cyan", "green", "yellow", "orange", "red", "pink", "purple", "grey"];
  let hash = 0;
  for (const char of domain) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return palette[hash % palette.length];
}

export function classifyTab(tab: chrome.tabs.Tab, settings: ExtensionSettings): TabDecision {
  const url = tab.url || "";
  let title = tab.title || "";

  try {
    const parsed = new URL(url);
    if (!title) title = parsed.hostname;
  } catch {
    // keep fallbacks
  }

  const haystack = normalizeText(`${title} ${url}`);
  const allRules = [...settings.customRules, ...PRESET_RULES.map(rule => ({ ...rule, id: rule.name }))];

  if (settings.strategy !== "subject") {
    const alias = findAliasForHostname(getHostname(url), settings.domainAliases);
    if (alias) {
      return {
        title: alias.label,
        color: alias.color,
        source: "alias",
        key: `alias:${alias.domain}`
      };
    }
  }

  if (settings.strategy !== "site") {
    for (const rule of allRules) {
      if (rule.keywords.some(keyword => haystack.includes(keyword.toLowerCase()))) {
        return {
          title: rule.name,
          color: rule.color,
          source: "rule",
          key: `rule:${rule.name}`
        };
      }
    }
  }

  if (settings.strategy === "subject") {
    return {
      title: "Needs review",
      color: "grey",
      source: "fallback",
      key: "fallback:subject"
    };
  }

  try {
    return {
      title: "Needs review",
      color: "grey",
      source: "fallback",
      key: `fallback:${getHostname(url) || "unknown"}`
    };
  } catch {
    return {
      title: "Needs review",
      color: "grey",
      source: "fallback",
      key: "fallback:unknown"
    };
  }
}

export function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function isIdle(tab: chrome.tabs.Tab, now: number, inactivityMinutes: number): boolean {
  const lastAccessed = tab.lastAccessed ?? now;
  return now - lastAccessed >= inactivityMinutes * 60_000;
}
