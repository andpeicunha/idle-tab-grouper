import {
  canDiscardWithSettings,
  getEffectiveDiscardInactivityMinutes,
  shouldConsiderTab,
  shouldDiscardTab
} from "./shared/optimization";
import { classifyTab, getHostname, isIdle, normalizeDomain } from "./shared/rules";
import {
  ensureRamSavingsAnalytics,
  ensureSettings,
  readSettings,
  readSession,
  recordRamSavings,
  writeSettings,
  writeSession
} from "./shared/storage";
import type { SessionState, SessionSummary } from "./shared/types";
import type { TabDecision } from "./shared/rules";
import type { ExtensionSettings, SiteDiscardOverride } from "./shared/types";

const DEFAULT_ALARM_NAME = "scan-idle-tabs";
const SCAN_INTERVAL_MINUTES = 1;
const CONTEXT_MENU_PARENT_ID = "idle-tab-grouper:discard-site";
const CONTEXT_MENU_DEFAULT_ID = "idle-tab-grouper:discard-site:default";
const CONTEXT_MENU_NEVER_ID = "idle-tab-grouper:discard-site:never";
const CONTEXT_MENU_15_ID = "idle-tab-grouper:discard-site:15";
const CONTEXT_MENU_30_ID = "idle-tab-grouper:discard-site:30";
const CONTEXT_MENU_60_ID = "idle-tab-grouper:discard-site:60";
const ACTION_CONTEXTS = ["action"] as chrome.contextMenus.ContextType[];

chrome.runtime.onInstalled.addListener(async () => {
  await ensureSettings();
  await ensureRamSavingsAnalytics();
  await ensureAlarm();
  await ensureContextMenus();
  await scanAndGroupTabs("install");
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureSettings();
  await ensureRamSavingsAnalytics();
  await ensureAlarm();
  await ensureContextMenus();
});

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== DEFAULT_ALARM_NAME) return;
  await scanAndGroupTabs("alarm");
});

chrome.tabs.onActivated.addListener(async () => {
  await updateHeartbeat();
});

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    await updateHeartbeat();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "idle-tab-grouper:scan-now") return false;

  scanAndGroupTabs("manual")
    .then(summary => sendResponse({ ok: true, summary }))
    .catch(error => {
      console.error("Manual scan failed", error);
      sendResponse({ ok: false, error: String(error instanceof Error ? error.message : error) });
    });

  return true;
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const selected = toDiscardOverrideSelection(info.menuItemId);
  if (!selected) return;

  const targetTab = await resolveActionTargetTab(tab);
  if (!targetTab?.url) return;

  const domain = normalizeDomain(getHostname(targetTab.url));
  if (!domain) return;

  const settings = await readSettings();
  const nextSettings = applySiteDiscardOverride(settings, domain, selected);
  await writeSettings(nextSettings);
  await scanAndGroupTabs("context-menu");
});

async function ensureAlarm(): Promise<void> {
  const existing = await chrome.alarms.get(DEFAULT_ALARM_NAME);
  if (!existing) {
    chrome.alarms.create(DEFAULT_ALARM_NAME, { periodInMinutes: SCAN_INTERVAL_MINUTES });
  }
}

async function ensureContextMenus(): Promise<void> {
  await chrome.contextMenus.removeAll();
  await chrome.contextMenus.create({
    id: CONTEXT_MENU_PARENT_ID,
    title: "Inatividade no site atual",
    contexts: ACTION_CONTEXTS
  });
  await chrome.contextMenus.create({
    id: CONTEXT_MENU_DEFAULT_ID,
    parentId: CONTEXT_MENU_PARENT_ID,
    title: "Usar padrao",
    contexts: ACTION_CONTEXTS
  });
  await chrome.contextMenus.create({
    id: CONTEXT_MENU_NEVER_ID,
    parentId: CONTEXT_MENU_PARENT_ID,
    title: "Nunca inativar neste site",
    contexts: ACTION_CONTEXTS
  });
  await chrome.contextMenus.create({
    id: CONTEXT_MENU_15_ID,
    parentId: CONTEXT_MENU_PARENT_ID,
    title: "Tempo para inativar neste site: 15 min",
    contexts: ACTION_CONTEXTS
  });
  await chrome.contextMenus.create({
    id: CONTEXT_MENU_30_ID,
    parentId: CONTEXT_MENU_PARENT_ID,
    title: "Tempo para inativar neste site: 30 min",
    contexts: ACTION_CONTEXTS
  });
  await chrome.contextMenus.create({
    id: CONTEXT_MENU_60_ID,
    parentId: CONTEXT_MENU_PARENT_ID,
    title: "Tempo para inativar neste site: 60 min",
    contexts: ACTION_CONTEXTS
  });
}

async function updateHeartbeat(): Promise<void> {
  const session = await readSession();
  await writeSession({
    ...session,
    lastRunAt: Date.now(),
    lastRunReason: "heartbeat"
  });
}

async function scanAndGroupTabs(reason: string): Promise<SessionSummary> {
  const settings = await readSettings();
  if (!settings.enabled) {
    const summary: SessionSummary = {
      movedCount: 0,
      suggestedCount: 0,
      collapsedGroupCount: 0,
      fallbackCount: 0,
      pendingCount: 0
    };
    await persistSummary(reason, summary);
    return summary;
  }

  const now = Date.now();
  const tabs = await chrome.tabs.query({});
  const groups = await chrome.tabGroups.query({});
  const groupsById = new Map(groups.map(group => [group.id, group]));
  const summary: SessionSummary = {
    movedCount: 0,
    suggestedCount: 0,
    collapsedGroupCount: 0,
    fallbackCount: 0,
    pendingCount: 0
  };
  const buckets = new Map<string, { decision: TabDecision; tabs: chrome.tabs.Tab[] }>();
  const discardCandidates: chrome.tabs.Tab[] = [];

  for (const tab of tabs) {
    if (!shouldConsiderTab(tab)) continue;
    const groupIdle = isIdle(tab, now, settings.inactivityMinutes);
    const canDiscard = canDiscardWithSettings(tab, settings);
    const discardThreshold = canDiscard ? getEffectiveDiscardInactivityMinutes(tab, settings) : null;
    const discardIdle = discardThreshold != null && isIdle(tab, now, discardThreshold);

    if (!groupIdle && !discardIdle) continue;

    if (groupIdle) {
      const decision = classifyTab(tab, settings);

      if (decision.source === "fallback") {
        summary.fallbackCount += 1;
        if (discardIdle) {
          discardCandidates.push(tab);
        }
        continue;
      }

      if (isAlreadyInCorrectGroup(tab, decision, groupsById)) {
        if (discardIdle) {
          discardCandidates.push(tab);
        }
        continue;
      }

      const bucketKey = `${decision.key}:${tab.windowId}`;
      const bucket = buckets.get(bucketKey);
      if (bucket) {
        bucket.tabs.push(tab);
      } else {
        buckets.set(bucketKey, {
          decision,
          tabs: [tab]
        });
      }
    }

    if (discardIdle) {
      discardCandidates.push(tab);
    }
  }

  for (const { decision, tabs: bucketTabs } of buckets.values()) {
    if (bucketTabs.length < settings.minimumTabsToGroup) {
      summary.pendingCount += bucketTabs.length;
      continue;
    }

    if (settings.behavior === "suggest") {
      summary.suggestedCount += bucketTabs.length;
      for (const tab of bucketTabs) {
        await setSuggestionBadge(tab.id);
      }
      continue;
    }

    const applied = await applyGrouping(bucketTabs, decision);
    if (applied) {
      summary.movedCount += bucketTabs.length;
      for (const tab of bucketTabs) {
        await clearSuggestionBadge(tab.id);
      }
    }
  }

  if (settings.collapseInactiveGroups) {
    summary.collapsedGroupCount = await collapseIdleGroups(tabs, groups, settings.inactivityMinutes, now);
  }

  const discardedCount = await discardIdleTabs(discardCandidates);
  if (discardedCount > 0) {
    await recordRamSavings({
      discardedCount,
      estimatedRamSavedMb: discardedCount * settings.estimatedRamPerDiscardMb,
      retentionDays: settings.ramSavingsRetentionDays
    });
    for (const tab of discardCandidates) {
      await clearSuggestionBadge(tab.id);
    }
  }

  await updateAlertBadge(summary.fallbackCount + summary.pendingCount);
  await persistSummary(reason, summary);
  return summary;
}

function isAlreadyInCorrectGroup(
  tab: chrome.tabs.Tab,
  decision: TabDecision,
  groupsById: Map<number, chrome.tabGroups.TabGroup>
): boolean {
  if (tab.groupId == null || tab.groupId === -1) return false;
  const group = groupsById.get(tab.groupId);
  if (!group) return false;
  return group.title === decision.title;
}

async function applyGrouping(tabs: chrome.tabs.Tab[], decision: TabDecision): Promise<boolean> {
  const firstTab = tabs[0];
  if (!firstTab || firstTab.windowId == null) return false;

  const groups = await chrome.tabGroups.query({ windowId: firstTab.windowId });
  const existingGroup = groups.find(group => group.title === decision.title);
  const groupId = await chrome.tabs.group({
    tabIds: tabs.map(tab => tab.id).filter((tabId): tabId is number => tabId != null),
    groupId: existingGroup?.id
  });

  await chrome.tabGroups.update(groupId, {
    title: decision.title,
    color: decision.color
  });

  return true;
}

async function collapseIdleGroups(
  tabs: chrome.tabs.Tab[],
  groups: chrome.tabGroups.TabGroup[],
  inactivityMinutes: number,
  now: number
): Promise<number> {
  const tabsByGroupId = new Map<number, chrome.tabs.Tab[]>();
  for (const tab of tabs) {
    if (tab.groupId == null || tab.groupId === -1) continue;
    const list = tabsByGroupId.get(tab.groupId) || [];
    list.push(tab);
    tabsByGroupId.set(tab.groupId, list);
  }

  let collapsedCount = 0;
  for (const group of groups) {
    const groupedTabs = tabsByGroupId.get(group.id) || [];
    if (groupedTabs.length === 0) continue;

    const groupIdle = groupedTabs.every(tab => isIdle(tab, now, inactivityMinutes));
    if (groupIdle && !group.collapsed) {
      await chrome.tabGroups.update(group.id, { collapsed: true });
      collapsedCount += 1;
    }
  }

  return collapsedCount;
}

async function setSuggestionBadge(tabId: number | undefined): Promise<void> {
  if (tabId == null) return;
  try {
    await chrome.action.setBadgeText({ tabId, text: "sug" });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#111827" });
  } catch {
    // ignore badge failures
  }
}

async function clearSuggestionBadge(tabId: number | undefined): Promise<void> {
  if (tabId == null) return;
  try {
    await chrome.action.setBadgeText({ tabId, text: "" });
  } catch {
    // ignore badge failures
  }
}

async function updateAlertBadge(count: number): Promise<void> {
  try {
    if (count > 0) {
      await chrome.action.setBadgeText({ text: "!" });
      await chrome.action.setBadgeBackgroundColor({ color: "#f97316" });
      return;
    }

    await chrome.action.setBadgeText({ text: "" });
  } catch {
    // ignore badge failures
  }
}

async function persistSummary(reason: string, summary: SessionSummary): Promise<void> {
  const session: SessionState = {
    ...(await readSession()),
    lastRunAt: Date.now(),
    lastRunReason: reason,
    lastSummary: summary
  };
  await writeSession(session);
}

async function discardIdleTabs(tabs: chrome.tabs.Tab[]): Promise<number> {
  let discardedCount = 0;

  for (const tab of tabs) {
    if (tab.id == null) continue;

    if (!shouldDiscardTab(tab)) {
      continue;
    }

    try {
      const discardedTab = await chrome.tabs.discard(tab.id);
      if (discardedTab?.discarded) {
        discardedCount += 1;
      }
    } catch (error) {
      console.error("Failed to discard idle tab", error, tab.id);
    }
  }

  return discardedCount;
}

function toDiscardOverrideSelection(menuItemId: string | number): "default" | "never" | 15 | 30 | 60 | null {
  switch (menuItemId) {
    case CONTEXT_MENU_DEFAULT_ID:
      return "default";
    case CONTEXT_MENU_NEVER_ID:
      return "never";
    case CONTEXT_MENU_15_ID:
      return 15;
    case CONTEXT_MENU_30_ID:
      return 30;
    case CONTEXT_MENU_60_ID:
      return 60;
    default:
      return null;
  }
}

async function resolveActionTargetTab(clickedTab?: chrome.tabs.Tab): Promise<chrome.tabs.Tab | null> {
  if (clickedTab?.url) {
    return clickedTab;
  }

  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return activeTab ?? null;
}

function applySiteDiscardOverride(
  settings: ExtensionSettings,
  domain: string,
  selection: "default" | "never" | 15 | 30 | 60
): ExtensionSettings {
  const siteDiscardOverrides = settings.siteDiscardOverrides.filter(override => override.domain !== domain);

  if (selection === "default") {
    return {
      ...settings,
      siteDiscardOverrides
    };
  }

  const nextOverride: SiteDiscardOverride =
    selection === "never"
      ? {
          id: domain,
          domain,
          mode: "never"
        }
      : {
          id: domain,
          domain,
          mode: "minutes",
          inactivityMinutes: selection
        };

  return {
    ...settings,
    siteDiscardOverrides: [...siteDiscardOverrides, nextOverride].sort((a, b) => a.domain.localeCompare(b.domain))
  };
}
