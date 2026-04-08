import { describe, expect, it } from "vitest";

import { normalizeRamSavingsAnalytics, pruneRamSavingsAnalytics } from "../src/shared/storage";

describe("RAM savings analytics", () => {
  it("normalizes analytics into a local-only ordered daily history", () => {
    const analytics = normalizeRamSavingsAnalytics({
      retentionDays: 7,
      days: [
        { date: "2026-04-08", discardedCount: 2, estimatedRamSavedMb: 100 },
        { date: "2026-04-07", discardedCount: 1, estimatedRamSavedMb: 50 }
      ]
    });

    expect(analytics.version).toBe(1);
    expect(analytics.retentionDays).toBe(7);
    expect(analytics.days.map(day => day.date)).toEqual(["2026-04-07", "2026-04-08"]);
  });

  it("drops malformed analytics entries instead of keeping garbage state", () => {
    const analytics = normalizeRamSavingsAnalytics({
      retentionDays: 7,
      days: [
        { date: "", discardedCount: 2, estimatedRamSavedMb: 100 },
        { date: "2026-04-08", discardedCount: 2, estimatedRamSavedMb: 100 }
      ]
    });

    expect(analytics.days).toEqual([{ date: "2026-04-08", discardedCount: 2, estimatedRamSavedMb: 100 }]);
  });

  it("prunes days outside the retention window", () => {
    const pruned = pruneRamSavingsAnalytics(
      {
        version: 1,
        retentionDays: 2,
        days: [
          { date: "2026-04-05", discardedCount: 1, estimatedRamSavedMb: 50 },
          { date: "2026-04-07", discardedCount: 2, estimatedRamSavedMb: 100 },
          { date: "2026-04-08", discardedCount: 3, estimatedRamSavedMb: 150 }
        ]
      },
      new Date("2026-04-08T12:00:00Z").getTime()
    );

    expect(pruned.days).toEqual([
      { date: "2026-04-07", discardedCount: 2, estimatedRamSavedMb: 100 },
      { date: "2026-04-08", discardedCount: 3, estimatedRamSavedMb: 150 }
    ]);
  });
});
