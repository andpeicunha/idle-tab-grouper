import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../src/shared/defaults";
import {
  getOptimizationPresetLabel,
  getOptimizationPresetMinutes,
  normalizeSettings
} from "../src/shared/storage";

describe("settings normalization", () => {
  it("keeps the balanced preset as the default and resolves preset minutes", () => {
    expect(DEFAULT_SETTINGS.optimizationPreset).toBe("balanced");
    expect(DEFAULT_SETTINGS.inactivityMinutes).toBe(5);
    expect(getOptimizationPresetMinutes("aggressive")).toBe(2);
    expect(getOptimizationPresetMinutes("balanced")).toBe(5);
    expect(getOptimizationPresetMinutes("conservative")).toBe(10);
    expect(getOptimizationPresetLabel("custom")).toBe("Customizado");
  });

  it("derives a known preset from inactivity minutes when the stored preset is missing", () => {
    const normalized = normalizeSettings({
      inactivityMinutes: 10
    });

    expect(normalized.optimizationPreset).toBe("conservative");
    expect(normalized.inactivityMinutes).toBe(10);
  });

  it("marks the preset as custom when the inactivity minutes do not match a named mode", () => {
    const normalized = normalizeSettings({
      inactivityMinutes: 7
    });

    expect(normalized.optimizationPreset).toBe("custom");
    expect(normalized.inactivityMinutes).toBe(7);
  });

  it("normalizes booleans and minimum numeric boundaries", () => {
    const normalized = normalizeSettings({
      enabled: 0 as unknown as boolean,
      discardEnabled: 0 as unknown as boolean,
      collapseInactiveGroups: 0 as unknown as boolean,
      minimumTabsToGroup: 1,
      estimatedRamPerDiscardMb: 0,
      ramSavingsRetentionDays: 0
    });

    expect(normalized.enabled).toBe(false);
    expect(normalized.discardEnabled).toBe(false);
    expect(normalized.collapseInactiveGroups).toBe(false);
    expect(normalized.minimumTabsToGroup).toBe(DEFAULT_SETTINGS.minimumTabsToGroup);
    expect(normalized.estimatedRamPerDiscardMb).toBe(DEFAULT_SETTINGS.estimatedRamPerDiscardMb);
    expect(normalized.ramSavingsRetentionDays).toBe(DEFAULT_SETTINGS.ramSavingsRetentionDays);
    expect(normalized.siteDiscardOverrides).toEqual([]);
  });
});
