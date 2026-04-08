import { describe, expect, it } from "vitest";

import type { ExtensionSettings } from "../../src/shared/types";
import {
  canDiscardWithSettings,
  isProtectedInternalUrl,
  shouldConsiderTab,
  shouldDiscardTab
} from "../../src/shared/optimization";

function makeTab(overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab {
  return {
    active: false,
    audible: false,
    discarded: false,
    groupId: -1,
    id: 1,
    pinned: false,
    url: "https://example.com",
    windowId: 1,
    ...overrides
  } as chrome.tabs.Tab;
}

function makeSettings(overrides: Partial<ExtensionSettings> = {}): ExtensionSettings {
  return {
    enabled: true,
    behavior: "auto",
    strategy: "hybrid",
    optimizationPreset: "balanced",
    inactivityMinutes: 5,
    minimumTabsToGroup: 2,
    collapseInactiveGroups: true,
    discardEnabled: true,
    estimatedRamPerDiscardMb: 50,
    ramSavingsRetentionDays: 7,
    domainAliases: [],
    customRules: [],
    ...overrides
  };
}

describe("shared optimization guards", () => {
  it("detects protected internal URLs", () => {
    expect(isProtectedInternalUrl("chrome://settings")).toBe(true);
    expect(isProtectedInternalUrl("chrome-extension://abcd/popup.html")).toBe(true);
    expect(isProtectedInternalUrl("https://example.com")).toBe(false);
  });

  it("only considers eligible tabs for the optimization pass", () => {
    expect(shouldConsiderTab(makeTab())).toBe(true);
    expect(shouldConsiderTab(makeTab({ active: true }))).toBe(false);
    expect(shouldConsiderTab(makeTab({ pinned: true }))).toBe(false);
    expect(shouldConsiderTab(makeTab({ discarded: true }))).toBe(false);
    expect(shouldConsiderTab(makeTab({ url: "chrome://settings" }))).toBe(false);
    expect(shouldConsiderTab(makeTab({ id: null }))).toBe(false);
    expect(shouldConsiderTab(makeTab({ windowId: null }))).toBe(false);
  });

  it("blocks discard for audible and protected tabs", () => {
    expect(shouldDiscardTab(makeTab())).toBe(true);
    expect(shouldDiscardTab(makeTab({ audible: true }))).toBe(false);
    expect(shouldDiscardTab(makeTab({ active: true }))).toBe(false);
    expect(shouldDiscardTab(makeTab({ pinned: true }))).toBe(false);
    expect(shouldDiscardTab(makeTab({ discarded: true }))).toBe(false);
    expect(shouldDiscardTab(makeTab({ url: "chrome-extension://abcd/popup.html" }))).toBe(false);
  });

  it("requires auto behavior and an enabled discard toggle", () => {
    const tab = makeTab();
    expect(canDiscardWithSettings(tab, makeSettings())).toBe(true);
    expect(canDiscardWithSettings(tab, makeSettings({ discardEnabled: false }))).toBe(false);
    expect(canDiscardWithSettings(tab, makeSettings({ behavior: "suggest" }))).toBe(false);
    expect(canDiscardWithSettings(makeTab({ audible: true }), makeSettings())).toBe(false);
  });
});
