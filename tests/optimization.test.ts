import { describe, expect, it } from "vitest";

import { canDiscardWithSettings, isProtectedInternalUrl, shouldConsiderTab, shouldDiscardTab } from "../src/shared/optimization";
import { DEFAULT_SETTINGS } from "../src/shared/defaults";

function createTab(overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab {
  return {
    active: false,
    audible: false,
    discarded: false,
    groupId: -1,
    id: 1,
    pinned: false,
    url: "https://example.com/page",
    windowId: 1,
    ...overrides
  };
}

describe("shared optimization guards", () => {
  it("treats Chrome internal URLs as protected", () => {
    expect(isProtectedInternalUrl("chrome://extensions")).toBe(true);
    expect(isProtectedInternalUrl("chrome-extension://abcd/popup.html")).toBe(true);
    expect(isProtectedInternalUrl("https://example.com")).toBe(false);
  });

  it("considers only non-active, non-pinned, non-discarded tabs with safe URLs", () => {
    expect(shouldConsiderTab(createTab())).toBe(true);
    expect(shouldConsiderTab(createTab({ active: true }))).toBe(false);
    expect(shouldConsiderTab(createTab({ pinned: true }))).toBe(false);
    expect(shouldConsiderTab(createTab({ discarded: true }))).toBe(false);
    expect(shouldConsiderTab(createTab({ url: "chrome://settings" }))).toBe(false);
  });

  it("excludes audible tabs from discard even when they are otherwise eligible", () => {
    expect(shouldDiscardTab(createTab())).toBe(true);
    expect(shouldDiscardTab(createTab({ audible: true }))).toBe(false);
    expect(shouldDiscardTab(createTab({ active: true }))).toBe(false);
    expect(shouldDiscardTab(createTab({ pinned: true }))).toBe(false);
    expect(shouldDiscardTab(createTab({ discarded: true }))).toBe(false);
  });

  it("requires both settings and tab eligibility before discard is allowed", () => {
    expect(canDiscardWithSettings(createTab(), DEFAULT_SETTINGS)).toBe(true);
    expect(canDiscardWithSettings(createTab(), { ...DEFAULT_SETTINGS, discardEnabled: false })).toBe(false);
    expect(canDiscardWithSettings(createTab(), { ...DEFAULT_SETTINGS, behavior: "suggest" })).toBe(false);
    expect(canDiscardWithSettings(createTab({ audible: true }), DEFAULT_SETTINGS)).toBe(false);
  });
});
