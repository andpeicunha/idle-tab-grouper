import type { ExtensionSettings } from "./types";
import { findDiscardOverrideForHostname, getHostname } from "./rules";

const INTERNAL_URL_PREFIXES = ["chrome://", "chrome-extension://"] as const;

export function isProtectedInternalUrl(url: string | undefined): boolean {
  if (!url) return true;
  return INTERNAL_URL_PREFIXES.some(prefix => url.startsWith(prefix));
}

export function shouldConsiderTab(tab: chrome.tabs.Tab): boolean {
  if (tab.id == null || tab.windowId == null) return false;
  if (tab.pinned) return false;
  if (tab.active) return false;
  if (tab.discarded) return false;
  if (!tab.url) return false;
  if (isProtectedInternalUrl(tab.url)) return false;
  return true;
}

export function shouldDiscardTab(tab: chrome.tabs.Tab): boolean {
  if (tab.active) return false;
  if (tab.pinned) return false;
  if (tab.audible) return false;
  if (tab.discarded) return false;
  if (!tab.url) return false;
  if (isProtectedInternalUrl(tab.url)) return false;
  return true;
}

export function canDiscardWithSettings(tab: chrome.tabs.Tab, settings: ExtensionSettings): boolean {
  return settings.discardEnabled && settings.behavior === "auto" && shouldDiscardTab(tab);
}

export function getEffectiveDiscardInactivityMinutes(
  tab: chrome.tabs.Tab,
  settings: ExtensionSettings
): number | null {
  const hostname = getHostname(tab.url || "");
  const override = findDiscardOverrideForHostname(hostname, settings.siteDiscardOverrides);

  if (!override) {
    return settings.inactivityMinutes;
  }

  if (override.mode === "never") {
    return null;
  }

  return Math.max(settings.inactivityMinutes, override.inactivityMinutes ?? settings.inactivityMinutes);
}
