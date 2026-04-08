import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../../src/shared/defaults";
import { normalizeRamSavingsAnalytics, normalizeSettings, pruneRamSavingsAnalytics } from "../../src/shared/storage";

describe("shared storage normalization", () => {
  it("normalizes booleans and minimum numeric bounds", () => {
    const settings = normalizeSettings({
      enabled: 1 as unknown as boolean,
      behavior: "suggest",
      strategy: "subject",
      optimizationPreset: "balanced",
      inactivityMinutes: 5,
      minimumTabsToGroup: 1,
      collapseInactiveGroups: 0 as unknown as boolean,
      discardEnabled: "yes" as unknown as boolean,
      estimatedRamPerDiscardMb: 60,
      ramSavingsRetentionDays: 14,
      domainAliases: [],
      customRules: []
    });

    expect(settings.enabled).toBe(true);
    expect(settings.behavior).toBe("suggest");
    expect(settings.strategy).toBe("subject");
    expect(settings.optimizationPreset).toBe("balanced");
    expect(settings.inactivityMinutes).toBe(5);
    expect(settings.minimumTabsToGroup).toBe(2);
    expect(settings.collapseInactiveGroups).toBe(false);
    expect(settings.discardEnabled).toBe(true);
    expect(settings.estimatedRamPerDiscardMb).toBe(60);
    expect(settings.ramSavingsRetentionDays).toBe(14);
  });

  it("falls back to custom when the preset and minutes diverge", () => {
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      optimizationPreset: "balanced",
      inactivityMinutes: 7
    });

    expect(settings.optimizationPreset).toBe("custom");
    expect(settings.inactivityMinutes).toBe(7);
  });

  it("normalizes and prunes RAM savings history", () => {
    const analytics = normalizeRamSavingsAnalytics({
      version: 1,
      retentionDays: 10,
      days: [
        { date: "2026-04-01", discardedCount: 2, estimatedRamSavedMb: 100 },
        { date: "2026-04-07", discardedCount: 3, estimatedRamSavedMb: 150 },
        { date: "", discardedCount: 99, estimatedRamSavedMb: 999 }
      ]
    });

    expect(analytics.days).toEqual([
      { date: "2026-04-01", discardedCount: 2, estimatedRamSavedMb: 100 },
      { date: "2026-04-07", discardedCount: 3, estimatedRamSavedMb: 150 }
    ]);

    const pruned = pruneRamSavingsAnalytics(
      {
        ...analytics,
        retentionDays: 2
      },
      Date.parse("2026-04-08T12:00:00Z")
    );
    expect(pruned.days).toEqual([{ date: "2026-04-07", discardedCount: 3, estimatedRamSavedMb: 150 }]);
  });
});
